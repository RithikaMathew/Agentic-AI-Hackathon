"""
A small orchestrator wrapper that will try to use LangGraph when available.
If LangGraph is not installed, it falls back to a simple sequencer that calls
your school's OpenAI-compatible API to produce a JSON array of steps.

Each step should be a dict: {"instruction": "Click the Next button", "target_text": "Next"}
"""
from typing import List, Dict, Any
import os
import json
import requests
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

try:
    import langgraph  # type: ignore
    HAS_LANGGRAPH = True
except Exception:
    HAS_LANGGRAPH = False

# Configuration for FAU HPC API
FAU_API_URL = os.environ.get('FAU_API_URL', 'https://chat.hpc.fau.edu/openai/chat/completions')
FAU_API_KEY = os.environ.get('FAU_API_KEY', 'sk-6513a2c196d74796a79bc6c32cd426d2')
FAU_MODEL = os.environ.get('FAU_MODEL', 'gemini-2.0-flash-lite')

print(f"[DEBUG] FAU_API_URL: {FAU_API_URL}")
print(f"[DEBUG] FAU_API_KEY: {FAU_API_KEY[:20] + '...' if FAU_API_KEY else 'None'}")
print(f"[DEBUG] FAU_MODEL: {FAU_MODEL}")


def call_llm_directly(query: str) -> str:
    """
    Call the LLM directly using the OpenAI chat completions endpoint.
    Returns the LLM response for generating steps.
    """
    print(f"[DEBUG] call_llm_directly called with: {query}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {FAU_API_KEY}",
    }
    
    # Enhanced prompt with specific FAU knowledge and example format
    system_prompt = """You are FAU Assistant, an expert guide for Florida Atlantic University students.

Your job is to provide detailed, accurate step-by-step instructions for navigating FAU's systems.

IMPORTANT: You MUST respond with ONLY valid JSON in this exact format:
{
  "summary": "Brief description of the task",
  "steps": [
    {"instruction": "Detailed step instruction", "target_text": "UI Element Text"},
    {"instruction": "Next step instruction", "target_text": "Button/Link Text"}
  ]
}

FAU SYSTEM KNOWLEDGE:
- MyFAU Portal (https://myfau.fau.edu): Access Student Self Service, Registration, Student Account, Financial Aid
- Registration: MyFAU → Student Self Service → Registration → Register for Classes
- Tuition Payment: MyFAU → Student Self Service → Student Account → Make a Payment
- Financial Aid: FAU Financial Aid website (https://www.fau.edu/finaid) → Apply for Aid
- Career Services: FAU Career Center (https://www.fau.edu/career) → Handshake (https://fau.joinhandshake.com)
- Housing: FAU Housing website (https://www.fau.edu/housing) → Apply for Housing
- Transcripts: MyFAU → Student Self Service → Academic Records → Request Transcript
- Health Services: Student Health Services (https://www.fau.edu/studenthealth) → Schedule Appointment
- Parking: Parking Services (https://www.fau.edu/parking) → Purchase Permit
- Library: FAU Libraries (https://library.fau.edu) → Search Resources
- Advising: Academic Advising → Schedule Appointment

TARGET_TEXT RULES:
- Should be the exact text visible on buttons, links, or menu items
- Examples: "Student Self Service", "Register for Classes", "Make a Payment", "Apply for Aid"
- Keep it short and specific to what appears on screen

INSTRUCTION RULES:
- For website navigation steps, use format: "Go to the FAU website" or "Go to MyFAU portal"
- The content script will automatically add clickable links for common FAU websites
- Be specific about which website to visit

IMPORTANT: Always provide at least 3-4 actionable steps. Never return empty steps. If you don't have specific information about a service, provide general navigation steps to find it on the FAU website.

DO NOT include any explanation, markdown, or text outside the JSON object."""

    payload = {
        "model": FAU_MODEL,
        "messages": [
            {
                "role": "system",
                "content": system_prompt
            },
            {
                "role": "user",
                "content": f"Provide step-by-step instructions for: {query}"
            }
        ]
    }
    
    print(f"[DEBUG] Calling LLM with enhanced prompt...")
    
    try:
        print(f"[DEBUG] Making POST request to {FAU_API_URL}")
        print(f"[DEBUG] Headers: Content-Type=application/json, Authorization=Bearer {FAU_API_KEY[:20]}...")
        print(f"[DEBUG] Model: {FAU_MODEL}")
        
        resp = requests.post(FAU_API_URL, json=payload, headers=headers, timeout=60)
        print(f"[DEBUG] Response status: {resp.status_code}")
        
        # Print response body even on error to debug
        if resp.status_code != 200:
            print(f"[DEBUG] Error response body: {resp.text[:500]}")
        
        resp.raise_for_status()
        result = resp.json()
        print(f"[DEBUG] LLM query successful")
        
        # Extract the response content from OpenAI format
        if 'choices' in result and len(result['choices']) > 0:
            content = result['choices'][0]['message']['content']
            print(f"[DEBUG] Raw LLM response: {content[:500]}...")
            return content
        else:
            raise RuntimeError("Invalid response format from LLM")
        
    except Exception as e:
        print(f"[DEBUG] ❌ LLM query failed: {e}")
        raise RuntimeError(f"LLM query failed: {e}")


def orchestrate_via_llm(user_message: str) -> Dict[str, Any]:
    """
    Query the LLM and convert response to structured steps.
    Returns dict with keys: summary (str) and steps (list of {instruction, target_text})
    """
    print(f"[DEBUG] orchestrate_via_llm called with: {user_message}")
    
    try:
        # Query the LLM directly
        llm_response = call_llm_directly(user_message)
        print(f"[DEBUG] LLM response length: {len(llm_response)}")
        
        # Try to extract JSON from response
        json_text = llm_response.strip()
        
        # Look for JSON object if wrapped in markdown or extra text
        if '```json' in json_text:
            json_text = json_text.split('```json')[1].split('```')[0].strip()
        elif '```' in json_text:
            json_text = json_text.split('```')[1].split('```')[0].strip()
        
        # Find JSON object boundaries
        if '{' in json_text and '}' in json_text:
            start = json_text.find('{')
            end = json_text.rfind('}') + 1
            json_text = json_text[start:end]
        
        # Parse JSON response
        try:
            result = json.loads(json_text)
            
            # Validate the structure
            if 'steps' in result and isinstance(result['steps'], list):
                valid_steps = []
                for step in result['steps']:
                    if isinstance(step, dict) and 'instruction' in step:
                        if 'target_text' not in step:
                            step['target_text'] = extract_target_text(step['instruction'])
                        valid_steps.append(step)
                
                if valid_steps:
                    print(f"[DEBUG] ✅ Successfully parsed {len(valid_steps)} steps from LLM")
                    return {
                        "summary": result.get('summary', f"Steps for: {user_message}"),
                        "steps": valid_steps
                    }
            
        except json.JSONDecodeError as je:
            print(f"[DEBUG] ❌ JSON decode error: {je}")
        
        # Fallback to predefined steps
        return get_fallback_steps(user_message)
        
    except Exception as e:
        print(f"[DEBUG] ❌ LLM orchestration failed: {e}")
        return get_fallback_steps(user_message)


def extract_target_text(instruction: str) -> str:
    """
    Extract likely UI target text from instruction.
    """
    # Common FAU UI elements
    ui_patterns = [
        'Student Self Service', 'Registration', 'Register for Classes',
        'Student Account', 'Make a Payment', 'Financial Aid', 'Apply for Aid',
        'FAFSA', 'Academic Records', 'Request Transcript', 'MyFAU',
        'Student Portal', 'Career Center', 'Handshake', 'Housing', 'Apply'
    ]
    
    instruction_lower = instruction.lower()
    
    # Look for quoted text first
    if '"' in instruction or "'" in instruction:
        import re
        quotes = re.findall(r'["\'](.*?)["\']', instruction)
        if quotes:
            return quotes[0]
    
    # Look for known UI patterns
    for pattern in ui_patterns:
        if pattern.lower() in instruction_lower:
            return pattern
    
    # Extract meaningful words
    words = [w for w in instruction.split() if w.lower() not in ['the', 'a', 'an', 'and', 'or', 'to', 'for', 'on', 'in', 'at', 'click', 'select', 'go', 'navigate']]
    if len(words) > 1:
        return ' '.join(words[-2:]).title()
    elif words:
        return words[-1].title()
    
    return 'Next'


def get_fallback_steps(user_query: str) -> Dict[str, Any]:
    """
    Provide fallback steps based on query type.
    """
    query_lower = user_query.lower()
    
    if "register" in query_lower or "registration" in query_lower:
        return {
            "summary": "How to register for classes at FAU",
            "steps": [
                {"instruction": "Go to MyFAU portal", "target_text": "MyFAU"},
                {"instruction": "Log in with your FAU credentials", "target_text": "Login"},
                {"instruction": "Click Student Self Service", "target_text": "Student Self Service"},
                {"instruction": "Select Registration from the menu", "target_text": "Registration"},
                {"instruction": "Click Register for Classes", "target_text": "Register for Classes"}
            ]
        }
    elif "tuition" in query_lower or ("pay" in query_lower and "tuition" in query_lower):
        return {
            "summary": "How to pay tuition at FAU",
            "steps": [
                {"instruction": "Go to MyFAU portal", "target_text": "MyFAU"},
                {"instruction": "Log in with your FAU credentials", "target_text": "Login"},
                {"instruction": "Click Student Self Service", "target_text": "Student Self Service"},
                {"instruction": "Select Student Account", "target_text": "Student Account"},
                {"instruction": "Click Make a Payment", "target_text": "Make a Payment"}
            ]
        }
    elif "financial aid" in query_lower or "fafsa" in query_lower:
        return {
            "summary": "How to apply for financial aid at FAU",
            "steps": [
                {"instruction": "Go to FAU Financial Aid website", "target_text": "Financial Aid"},
                {"instruction": "Click Apply for Aid", "target_text": "Apply for Aid"},
                {"instruction": "Complete the FAFSA application", "target_text": "FAFSA"},
                {"instruction": "Submit required documents", "target_text": "Submit Documents"}
            ]
        }
    else:
        return {
            "summary": f"General guidance for: {user_query}",
            "steps": [
                {"instruction": "Go to the FAU website", "target_text": "FAU"},
                {"instruction": "Use the search function to find information", "target_text": "Search"},
                {"instruction": "Navigate to the relevant department page", "target_text": "Department"},
                {"instruction": "Contact the office for specific assistance", "target_text": "Contact"}
            ]
        }


def orchestrate(user_message: str) -> Dict[str, Any]:
    """
    Main orchestration function. Tries LangGraph if available, otherwise uses LLM directly.
    """
    print(f"\n{'='*60}")
    print(f"[DEBUG] 🚀 Orchestrate called with message: {user_message}")
    print(f"[DEBUG] HAS_LANGGRAPH: {HAS_LANGGRAPH}")
    print(f"{'='*60}\n")
    
    try:
        if HAS_LANGGRAPH:
            print("[DEBUG] ✓ Trying LangGraph...")
            try:
                # Placeholder for LangGraph usage
                graph = langgraph.Graph()
                node = graph.add_llm_node("openai", prompt_template="{user_message}")
                out = graph.run({"user_message": user_message})
                parsed = json.loads(out)
                return {"summary": parsed.get('summary', ''), "steps": parsed.get('steps', [])}
            except Exception as e:
                print(f"[DEBUG] ❌ LangGraph failed: {e}, falling back to LLM")
                return orchestrate_via_llm(user_message)
        else:
            print("[DEBUG] ✓ No LangGraph detected, calling orchestrate_via_llm directly")
            result = orchestrate_via_llm(user_message)
            print(f"[DEBUG] ✅ Successfully got result from LLM")
            return result
            
    except Exception as e:
        print(f"[DEBUG] ❌❌❌ CRITICAL ERROR in orchestrate: {e}")
        # Ultimate fallback
        return {
            "summary": "Steps to register for classes at FAU",
            "steps": [
                {"instruction": "Go to the FAU Student Portal", "target_text": "Student Portal"},
                {"instruction": "Click on Registration", "target_text": "Registration"},
                {"instruction": "Select Register for Classes", "target_text": "Register for Classes"},
                {"instruction": "Search and add your courses", "target_text": "Add Course"}
            ]
        }