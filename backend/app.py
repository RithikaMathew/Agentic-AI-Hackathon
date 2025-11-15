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

class EmailReplyRequest(BaseModel):
    emailText: str
    userInstructions: str = ''


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


@app.post("/draft-reply")
async def draft_email_reply(req: EmailReplyRequest):
    """Generate AI-powered email reply based on selected email text and user instructions"""
    try:
        import requests
        
        FAU_API_URL = os.environ.get('FAU_API_URL', 'https://chat.hpc.fau.edu/openai/chat/completions')
        FAU_API_KEY = os.environ.get('FAU_API_KEY', 'sk-6513a2c196d74796a79bc6c32cd426d2')
        FAU_MODEL = os.environ.get('FAU_MODEL', 'gemini-2.0-flash-lite')
        
        # Build prompt with user instructions
        instructions_part = ''
        if req.userInstructions:
            instructions_part = f"\n\nUser's additional instructions: {req.userInstructions}"
        
        system_prompt = """You are a professional email assistant. Generate clear, concise, and polite email replies appropriate for academic and business contexts. 
        
Format the reply as a proper email with:
- Appropriate greeting (Dear [Name], Hello, Hi, etc.)
- Well-structured paragraphs with proper line breaks
- Professional closing (Best regards, Sincerely, Thank you, etc.)
- Proper spacing between sections

The reply should be:
- Professional and courteous
- Direct and to the point
- Free of JSON or code formatting
- Include proper email structure and spacing

Respond ONLY with the formatted email reply text, nothing else."""
        
        user_prompt = f"""Please draft a professional email reply to the following email:{instructions_part}

Original Email:
---
{req.emailText}
---

Your Reply:"""
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {FAU_API_KEY}",
        }
        
        payload = {
            "model": FAU_MODEL,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt}
            ]
        }
        
        print(f"[DEBUG] Generating email reply...")
        resp = requests.post(FAU_API_URL, json=payload, headers=headers, timeout=60)
        resp.raise_for_status()
        result = resp.json()
        
        # Extract the response content from OpenAI format
        if 'choices' in result and len(result['choices']) > 0:
            reply = result['choices'][0]['message']['content']
            print(f"[DEBUG] Email reply generated successfully")
            return {"reply": reply.strip()}
        else:
            raise RuntimeError("Invalid response format from LLM")
        
    except Exception as e:
        print(f"[ERROR] Email reply failed: {e}")
        import traceback
        traceback.print_exc()
        return {"reply": "Thank you for your email. I will review this and get back to you soon."}


if __name__ == '__main__':
    uvicorn.run('app:app', host='0.0.0.0', port=int(os.environ.get('PORT', 8000)), reload=True)
