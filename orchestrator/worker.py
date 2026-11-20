"""Celery worker: runs the graph off the request path. Start with
    celery -A orchestrator.worker worker --loglevel=info
"""

import os
import time
from contextlib import contextmanager

from celery import Celery
from langgraph.checkpoint.redis import RedisSaver
from langgraph.types import Command

from . import db
from .graph import build_graph
from .llm import get_llm

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379/0")
app = Celery("orchestrator", broker=REDIS_URL, backend=REDIS_URL)
app.conf.task_acks_late = True  # a worker that dies mid-run hands the task back


@contextmanager
def graph(llm=None):
    """The compiled graph with Redis as the checkpointer: state is saved after every node."""
    with RedisSaver.from_conn_string(REDIS_URL) as cp:
        cp.setup()
        yield build_graph(llm, db.log_step, cp)


def config(run_id: str, checkpoint_id: str | None = None) -> dict:
    return {"configurable": {"thread_id": run_id, **({"checkpoint_id": checkpoint_id} if checkpoint_id else {})}}


def pending_approval(g, run_id: str) -> dict | None:
    st = g.get_state(config(run_id))
    return st.interrupts[0].value if st.interrupts else None


def execute(run_id: str, goal: str | None = None, decision: dict | None = None, checkpoint_id: str | None = None):
    """Start (goal), resume after a human decision (decision), or replay from a checkpoint (checkpoint_id)."""
    db.update_run(run_id, status="running", error=None)
    with graph(get_llm()) as g:
        payload = {"goal": goal} if goal else Command(resume=decision) if decision is not None else None
        for attempt in range(3):
            try:
                # retries resume from the last checkpoint, so finished nodes don't run again
                g.invoke(payload, config(run_id, checkpoint_id)) if attempt == 0 else g.invoke(None, config(run_id))
                break
            except Exception as e:  # rate limits, model hiccups: a fresh sample usually works
                if attempt == 2:
                    db.update_run(run_id, status="failed", error=f"{type(e).__name__}: {e}")
                    return
                time.sleep(10 * (attempt + 1))
        st = g.get_state(config(run_id))
        if st.interrupts:
            db.update_run(run_id, status="waiting_approval")
        else:
            db.update_run(run_id, status="done", answer=st.values.get("answer"))


@app.task(name="orchestrator.run")
def run_agent(run_id: str, goal: str | None = None, decision: dict | None = None, checkpoint_id: str | None = None):
    execute(run_id, goal, decision, checkpoint_id)
