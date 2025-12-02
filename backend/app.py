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
        
        system_prompt = """You are a professional email assistant. Help draft email replies by gathering necessary information first.

Rules:
1. Remember all information the user has already provided in this conversation
2. Only ask for information that hasn't been provided yet
3. Use simple, clean formatting - no markdown, no ** for bold, no numbered lists
4. Be concise and conversational
5. When you have enough info, generate the final email without placeholders

Generate the final email only when you have:
- Recipient's name (if needed)
- User's key details (graduation date, contact info, etc.)
- Clear understanding of the request

Format emails with proper spacing and professional structure."""
        
        user_prompt = f"""I need help drafting a professional email reply to the following email:{instructions_part}

Original Email:
---
{req.emailText}
---

Please help me create an appropriate response. Ask me for any information you need to draft a complete reply without placeholder text."""
        
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {FAU_API_KEY}",
        }
        
        # Get recent chat messages for context
        messages = [{"role": "system", "content": system_prompt}]
        
        # Add conversation history for context (last 6 messages)
        try:
            import json as json_lib
            chat_history = json_lib.loads(req.userInstructions) if req.userInstructions.startswith('[') else []
            if isinstance(chat_history, list):
                for msg in chat_history[-6:]:
                    if isinstance(msg, dict) and 'from' in msg and 'text' in msg:
                        role = 'user' if msg['from'] == 'user' else 'assistant'
                        messages.append({"role": role, "content": msg['text']})
        except:
            pass
        
        # Add current user message
        messages.append({"role": "user", "content": user_prompt})
        
        payload = {
            "model": FAU_MODEL,
            "messages": messages
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
