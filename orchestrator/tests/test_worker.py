from contextlib import contextmanager
from types import SimpleNamespace

from orchestrator import worker


def test_failed_run_resumes_from_checkpoint(monkeypatch):
    calls, updates = [], []

    class G:
        def invoke(self, payload, cfg):
            calls.append((payload, cfg))
            if len(calls) == 1:
                raise RuntimeError("429")

        def get_state(self, cfg):
            return SimpleNamespace(interrupts=(), values={"answer": "ok"})

    monkeypatch.setattr(worker, "graph", contextmanager(lambda llm=None: (yield G())))
    monkeypatch.setattr(worker, "get_llm", lambda: None)
    monkeypatch.setattr(worker.time, "sleep", lambda s: None)
    monkeypatch.setattr(worker.db, "update_run", lambda run_id, **f: updates.append(f))

    worker.execute("r1", goal="q")
    assert calls == [({"goal": "q"}, worker.config("r1")), (None, worker.config("r1"))]
    assert updates[-1] == {"status": "done", "answer": "ok"}
