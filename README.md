# FAU Chat Assistant — Chrome Extension + FastAPI backend

This repository contains a Chrome Manifest V3 extension and a FastAPI backend that together implement a popup React chatbot which sends user queries to a backend orchestrator. The backend produces structured, step-by-step UI instructions (instruction + target_text). The content script highlights matched elements on *.fau.edu pages and draws a visual cue; clicking the highlighted element advances to the next step.

High-level components
- manifest.json — extension manifest
- contentScript.js — code injected into FAU pages to highlight and sequence steps
- popup/ — React + TypeScript popup app (Vite)
- backend/ — FastAPI app and orchestrator wrapper (tries to use LangGraph if installed)

Quick start

1) Backend

Install Python deps and run server (use a virtualenv):

```powershell
cd backend
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
# Set your OpenAI API key (do NOT commit it into source)
$env:OPENAI_API_KEY = "<your-key>"
uvicorn app:app --reload
```

2) Popup (build)

In a separate terminal (Node.js required):

```powershell
cd popup
npm install
npm run build
# output will be in popup/dist (manifest points to popup/dist/index.html)
```

3) Load extension into Chrome

- Open chrome://extensions
- Toggle Developer mode
- Click "Load unpacked" and choose the workspace folder (the root that contains manifest.json).

API contract example

Request (POST /orchestrate)

```json
{
  "message": "How do I register for classes?"
}
```

Response (example)

```json
{
  "summary": "Steps to register for classes at FAU",
  "steps": [
    {"instruction": "Click the 'Student Services' menu.", "target_text": "Student Services"},
    {"instruction": "Select 'Registration' from the menu.", "target_text": "Registration"},
    {"instruction": "Click 'Register for Classes' or 'Add/Drop Classes'.", "target_text": "Register for Classes"}
  ]
}
```

Notes and next steps
- For production use, secure the backend and validate/escape any UI-target strings before interacting with the DOM.
- If you want a full LangGraph pipeline, install the real LangGraph package and replace the placeholder in `backend/langgraph_orchestrator.py` with your pipeline.
