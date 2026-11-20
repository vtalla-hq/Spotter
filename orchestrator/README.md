# Agent orchestrator

A research agent for Spotter: give it a goal ("Does creatine harm kidney function?"), and it plans, calls tools, reflects, and answers with PubMed citations. Writes to shared data wait for a human.

**Stack:** Python · LangGraph · Claude API · Redis · Postgres · FastAPI · Celery

```
POST /runs ──> FastAPI ──> Celery worker ──> LangGraph:  plan ──> act ──> tools ──> reflect ─┐
                                                          ^        ^                         │
                                                          │        └──── next step ──────────┤
                                                          └───────── re-plan ────────────────┘ done ──> answer
     state saved to Redis after every node (checkpointer)        every node logged to Postgres
```

| Piece | Where |
|---|---|
| **1. Graph** with plan, act and reflect nodes. `act` only chooses a tool; a separate `tools` node runs it, so resuming after approval doesn't call the model again | `graph.py` |
| **2. Tools** each registered with a typed Pydantic input schema and a risk level. Arguments are validated before anything runs; bad input comes back to the model as an observation | `tools.py` |
| **3. Memory** is LangGraph state, checkpointed to Redis (`RedisSaver`) after every node. Kill the worker mid-run and the next one picks up where it stopped | `worker.py` |
| **4. Human in the loop:** high-risk tools (`save_to_library`) call `interrupt()`. The run waits as `waiting_approval` until `POST /runs/{id}/approve` | `graph.py`, `api.py` |
| **5. Step log:** every node writes node, status, output, error and timing to Postgres. `/history` lists checkpoints; `/replay` forks from any of them, or resumes a failed run | `db.py`, `api.py` |

Tools: `search_pubmed`, `read_abstracts` (NCBI E-utilities), `fetch_page` (Scrapling; public URLs only, pages through long text, jumps to a keyword), `save_to_library` (high risk; writes to the shared study library).

The model is Claude (`claude-opus-5-5`, adaptive thinking, `medium` effort, with the server-side refusal fallback). Set `LLM_PROVIDER=groq` to use Groq's free API instead, as the Ask tab does.

## Run it

```bash
cp .env.example .env    # set ANTHROPIC_API_KEY (or LLM_PROVIDER=groq + GROQ_API_KEY)
docker compose -f orchestrator/docker-compose.yml up --build
```

Or locally, with Redis 8+ and Postgres running:

```bash
pip install -r orchestrator/requirements.txt
celery -A orchestrator.worker worker --loglevel=info &
uvicorn orchestrator.api:app
```

## API

```bash
curl -X POST localhost:8000/runs -H 'content-type: application/json' \
  -d '{"goal": "Does creatine harm kidney function in healthy adults? Save the best 2 studies to the library."}'
# {"id": "…", "status": "queued"}

curl localhost:8000/runs/ID            # status: queued | running | waiting_approval | done | failed
                                        # + pending_approval {tool, input} while waiting, answer when done
curl -X POST localhost:8000/runs/ID/approve -H 'content-type: application/json' -d '{"approved": false, "reason": "only meta-analyses"}'
curl localhost:8000/runs/ID/steps      # step log: node, status, output, error, ms
curl localhost:8000/runs/ID/history    # checkpoints, newest first
curl -X POST localhost:8000/runs/ID/replay -H 'content-type: application/json' -d '{"checkpoint_id": "…"}'  # fork from there
curl -X POST localhost:8000/runs/ID/replay -H 'content-type: application/json' -d '{}'                      # resume a failed run
```

A rejected action goes back to the agent as an observation ("A human rejected this action…"), and it carries on without it. Runs stop after 8 reflect cycles and answer with what they have.

## Tests

```bash
python -m pytest orchestrator   # graph, approval/rejection, iteration cap, schemas, SSRF guard, parsing
```

The tests use a scripted fake model and an in-memory checkpointer, so they need no keys, Redis or Postgres.
