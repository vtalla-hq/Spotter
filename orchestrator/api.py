"""HTTP API. Start with
    uvicorn orchestrator.api:app --reload
"""

import uuid

from fastapi import FastAPI, HTTPException
from pydantic import BaseModel, Field

from . import db
from .worker import config, graph, pending_approval, run_agent

app = FastAPI(title="Agent Orchestration")


@app.on_event("startup")
def startup():
    db.setup()


class NewRun(BaseModel):
    goal: str = Field(min_length=3, max_length=2000)


class Decision(BaseModel):
    approved: bool
    reason: str = Field(default="", max_length=500)


class Replay(BaseModel):
    checkpoint_id: str | None = Field(default=None, description="Omit to resume from the latest checkpoint, e.g. after a failure")


def _run(run_id: str) -> dict:
    r = db.get_run(run_id)
    if not r:
        raise HTTPException(404, "No such run")
    return r


@app.post("/runs", status_code=202)
def create_run(body: NewRun):
    run_id = uuid.uuid4().hex
    db.create_run(run_id, body.goal)
    run_agent.delay(run_id, goal=body.goal)
    return {"id": run_id, "status": "queued"}


@app.get("/runs/{run_id}")
def get_run(run_id: str):
    r = _run(run_id)
    if r["status"] == "waiting_approval":
        with graph() as g:
            r["pending_approval"] = pending_approval(g, run_id)
    return r


@app.post("/runs/{run_id}/approve", status_code=202)
def approve(run_id: str, body: Decision):
    if _run(run_id)["status"] != "waiting_approval":
        raise HTTPException(409, "Run is not waiting for approval")
    db.update_run(run_id, status="queued")  # so a double click can't resume twice
    run_agent.delay(run_id, decision=body.model_dump())
    return {"id": run_id, "status": "queued"}


@app.get("/runs/{run_id}/steps")
def steps(run_id: str):
    _run(run_id)
    return db.get_steps(run_id)


@app.get("/runs/{run_id}/history")
def history(run_id: str):
    """Every checkpoint, newest first. Pass a checkpoint_id to /replay to re-run from there."""
    _run(run_id)
    with graph() as g:
        return [
            {
                "checkpoint_id": s.config["configurable"]["checkpoint_id"],
                "step": s.metadata.get("step"),
                "next": list(s.next),
                "created_at": s.created_at,
                "values": s.values,
            }
            for s in g.get_state_history(config(run_id))
        ]


@app.post("/runs/{run_id}/replay", status_code=202)
def replay(run_id: str, body: Replay):
    """Fork the run from an earlier checkpoint and run it forward again (e.g. after fixing a tool),
    or with no checkpoint_id, resume a failed run where it stopped."""
    if _run(run_id)["status"] in ("queued", "running"):
        raise HTTPException(409, "Run is in progress")
    with graph() as g:
        if not g.get_state(config(run_id, body.checkpoint_id)).values:
            raise HTTPException(404, "No such checkpoint")
    db.update_run(run_id, status="queued", answer=None)
    run_agent.delay(run_id, checkpoint_id=body.checkpoint_id)
    return {"id": run_id, "status": "queued"}
