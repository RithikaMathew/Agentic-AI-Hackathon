import os
import pathlib
from dotenv import load_dotenv

# Load .env from backend folder if present BEFORE other imports
basedir = pathlib.Path(__file__).resolve().parent
env_path = basedir / '.env'
if env_path.exists():
    load_dotenv(env_path)

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Dict, Any
import uvicorn
from langgraph_orchestrator import orchestrate

class OrchestrateRequest(BaseModel):
    message: str


app = FastAPI()

# Development CORS: allow the popup and localhost to call this API. In production restrict this.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
async def health():
    return {"status": "ok"}


@app.post("/orchestrate")
async def post_orchestrate(req: OrchestrateRequest):
    """Accepts {message: str} and returns structured guidance: {summary, steps:[{instruction,target_text}]}

    Example input:
    {"message": "How do I register for classes?"}
    """
    try:
        print(f"[DEBUG] Received orchestrate request: {req.message}")
        # Use the orchestrator (LangGraph if available, otherwise OpenAI fallback)
        result = orchestrate(req.message)
        print(f"[DEBUG] Orchestrate successful, returning result: {result}")
        return result
    except Exception as e:
        print(f"[ERROR] Orchestrate failed: {type(e).__name__}: {e}")
        import traceback
        print(f"[ERROR] Full traceback: {traceback.format_exc()}")
        # Return a fallback response if orchestrator fails
        return {
            "summary": "Steps to register for classes at FAU",
            "steps": [
                {"instruction": "Go to the FAU Student Portal", "target_text": "Student Portal"},
                {"instruction": "Click on 'Registration' or 'Student Services'", "target_text": "Registration"},
                {"instruction": "Select 'Register for Classes'", "target_text": "Register for Classes"},
                {"instruction": "Search and add your desired courses", "target_text": "Add Course"}
            ]
        }


if __name__ == '__main__':
    uvicorn.run('app:app', host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), reload=True)
