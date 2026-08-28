import asyncio
import json
from uuid import uuid4

import httpx
from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from app.config import settings
from app.models import EvaluationResult
from app.pdf_service import extract_evidence
from app.workflow import run_panel


app = FastAPI(title="PanelAI API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.client_origin],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

runs: dict[str, EvaluationResult] = {}
queues: dict[str, asyncio.Queue] = {}


async def publish(run_id: str, event: dict) -> None:
    run = runs[run_id]
    if event["type"] == "stage":
        run.stage = event["stage"]
    elif event["type"] == "profile_complete":
        run.profile = event["profile"]
    elif event["type"] == "agent_complete":
        run.opinions[event["agent"]] = event["opinion"]
    elif event["type"] == "debate_complete":
        run.debate = event["debate"]
    elif event["type"] == "decision_complete":
        run.decision = event["decision"]
    await queues[run_id].put(event)


async def process_run(run_id: str, evidence) -> None:
    run = runs[run_id]
    run.status = "running"
    run.stage = "profile"
    try:
        state = await run_panel(evidence, lambda event: publish(run_id, event))
        run.profile = state["profile"]
        run.opinions = state["opinions"]
        run.debate = state["debate"]
        run.decision = state["decision"]
        run.status = "completed"
        run.stage = "complete"
        await publish(run_id, {"type": "complete", "result": run.model_dump(mode="json")})
    except Exception as exc:
        run.status = "failed"
        run.stage = "failed"
        run.error = str(exc)
        await publish(run_id, {"type": "error", "message": str(exc)})


@app.get("/api/health")
async def health():
    model_available = False
    ollama_available = False
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            response = await client.get(f"{settings.ollama_base_url}/api/tags")
            response.raise_for_status()
            ollama_available = True
            model_available = settings.ollama_model in {item["name"] for item in response.json().get("models", [])}
    except httpx.HTTPError:
        pass
    return {
        "status": "healthy",
        "model": settings.ollama_model,
        "ollama_available": ollama_available,
        "model_available": model_available,
    }


@app.post("/api/evaluations", status_code=202)
async def create_evaluation(
    job_description: UploadFile = File(...),
    resume: UploadFile = File(...),
    transcript: UploadFile = File(...),
):
    files = (job_description, resume, transcript)
    if any(file.content_type != "application/pdf" for file in files):
        raise HTTPException(400, "All three documents must be PDFs")
    evidence = []
    for file, document, prefix in (
        (job_description, "job_description", "JD"),
        (resume, "resume", "CV"),
        (transcript, "transcript", "TR"),
    ):
        evidence.extend(extract_evidence(await file.read(), document, prefix))
    run_id = str(uuid4())
    runs[run_id] = EvaluationResult(id=run_id, status="queued", stage="queued", evidence=evidence)
    queues[run_id] = asyncio.Queue()
    asyncio.create_task(process_run(run_id, evidence))
    return {"id": run_id, "status": "queued"}


@app.get("/api/evaluations/{run_id}")
async def get_evaluation(run_id: str):
    if run_id not in runs:
        raise HTTPException(404, "Evaluation not found")
    return runs[run_id]


@app.get("/api/evaluations/{run_id}/events")
async def evaluation_events(run_id: str):
    if run_id not in runs:
        raise HTTPException(404, "Evaluation not found")

    async def stream():
        yield f"data: {json.dumps({'type': 'snapshot', 'result': runs[run_id].model_dump(mode='json')})}\n\n"
        while True:
            try:
                event = await asyncio.wait_for(queues[run_id].get(), timeout=15)
                yield f"data: {json.dumps(event)}\n\n"
                if event["type"] in {"complete", "error"}:
                    break
            except TimeoutError:
                yield ": keep-alive\n\n"

    return StreamingResponse(stream(), media_type="text/event-stream")
