# PanelAI - Multi-Agent Interview Panel

PanelAI evaluates a candidate against a job description using four independent local AI personas, a structured debate, and a final evidence-weighted adjudication. It runs with React, FastAPI, LangChain, LangGraph, and a local Ollama model.

## Architecture

```text
PDF upload -> evidence extraction -> shared profile
                                  -> Technical agent ------\
                                  -> HR/Culture agent ------> Debate -> Adjudicator -> Report
                                  -> Hiring Manager agent --/
                                  -> Skeptic agent --------/
```

Each initial persona is a separate model call. The four calls fan out from the same profile and cannot see one another's conclusions. They join only at the debate stage. Every conclusion must reference a stable evidence ID extracted from a specific document and page.

## Requirements

- Node.js and npm
- Python 3.11+
- Ollama running locally
- `llama3.1:8b` downloaded in Ollama

Verify Ollama:

```powershell
ollama list
ollama pull llama3.1:8b
```

## Run the server

```powershell
cd server
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
uvicorn app.main:app --reload
```

The API runs at `http://localhost:8000`; interactive API documentation is at `http://localhost:8000/docs`.

## Run the client

Open a second terminal:

```powershell
cd client
npm install
Copy-Item .env.example .env
npm run dev
```

Open `http://localhost:5173`.

## Use the app

Upload exactly three PDFs:

1. Job description
2. Candidate resume
3. Interview transcript

The UI streams profile, agent, debate, and decision progress through Server-Sent Events.

## Tests

```powershell
cd server
.\.venv\Scripts\python.exe -m pytest -q

cd ..\client
npm run build
npm run lint
```

## Current storage

Evaluation state is intentionally in memory for the hackathon MVP. Restarting the FastAPI process clears existing runs.

## Deploy on Render

The repository includes `render.yaml`, which creates a FastAPI web service and React static site. Render uses Groq-hosted Llama in production while local development continues to use Ollama.

1. Push the repository to GitHub.
2. In Render, create a new Blueprint from this repository.
3. Set the private `GROQ_API_KEY` value when prompted.
4. Deploy both services.
