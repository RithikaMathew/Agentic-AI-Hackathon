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

try:
    import langgraph  # type: ignore
    HAS_LANGGRAPH = True
except Exception:
    HAS_LANGGRAPH = False

# Configuration for FAU HPC API
FAU_API_URL = os.environ.get('FAU_API_URL', 'https://chat.hpc.fau.edu/openai/chat/completions')
FAU_API_KEY = os.environ.get('FAU_API_KEY', 'sk-6513a2c196d74796a79bc6c32cd426d2')
FAU_MODEL = os.environ.get('FAU_MODEL', 'gemini-2.0-flash-lite')  # Changed from gpt-5

print(f"[DEBUG] FAU_API_URL: {FAU_API_URL}")
print(f"[DEBUG] FAU_API_KEY: {FAU_API_KEY[:20] + '...' if FAU_API_KEY else 'None'}")
print(f"[DEBUG] FAU_MODEL: {FAU_MODEL}")


def call_fau_api(messages: List[Dict[str, str]], model: str = None) -> Dict[str, Any]:
    """
    Call the FAU HPC OpenAI-compatible API.
    Returns a dict compatible with OpenAI ChatCompletion response.
    """
    if model is None:
        model = FAU_MODEL
        
    print(f"[DEBUG] call_fau_api called with model: {model}")
    print(f"[DEBUG] Messages: {messages}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {FAU_API_KEY}",
    }
    
    payload = {
        "model": model,
        "messages": messages,
        "temperature": 0.2,
    }
    
    print(f"[DEBUG] Payload: {json.dumps(payload, indent=2)}")
    
    try:
        print(f"[DEBUG] Making POST request to {FAU_API_URL}")
        resp = requests.post(FAU_API_URL, json=payload, headers=headers, timeout=60)
        print(f"[DEBUG] Response status: {resp.status_code}")
        print(f"[DEBUG] Response headers: {dict(resp.headers)}")
        print(f"[DEBUG] Response text (first 500 chars): {resp.text[:500]}")
        
        resp.raise_for_status()
        result = resp.json()
        print(f"[DEBUG] Response JSON parsed successfully")
        print(f"[DEBUG] Response keys: {list(result.keys())}")
        return result
        
    except requests.exceptions.Timeout:
        print(f"[DEBUG] ❌ Request timeout after 60 seconds")
        raise RuntimeError("FAU API request timeout")
    except requests.exceptions.RequestException as e:
        print(f"[DEBUG] ❌ Request failed with exception: {type(e).__name__}: {e}")
        if 'resp' in locals():
            print(f"[DEBUG] Response status: {resp.status_code}")
            print(f"[DEBUG] Response content: {resp.text}")
        raise RuntimeError(f"FAU API request failed: {e}")
    except json.JSONDecodeError as e:
        print(f"[DEBUG] ❌ Failed to parse JSON response: {e}")
        if 'resp' in locals():
            print(f"[DEBUG] Raw response: {resp.text}")
        raise RuntimeError(f"Invalid JSON response from FAU API: {e}")
    except Exception as e:
        print(f"[DEBUG] ❌ Unexpected error: {type(e).__name__}: {e}")
        import traceback
        print(f"[DEBUG] Full traceback:\n{traceback.format_exc()}")
        raise


def orchestrate_via_fau_api(user_message: str) -> Dict[str, Any]:
    """
    Call the FAU HPC API to generate structured steps.
    Returns dict with keys: summary (str) and steps (list of {instruction, target_text})
    """
    print(f"[DEBUG] orchestrate_via_fau_api called with: {user_message}")
    
    system = (
        "You are an assistant that converts a student question into a sequence of UI-level steps."
        " Output must be valid JSON with keys: summary (string) and steps (array of objects with 'instruction' and 'target_text')."
        " 'target_text' should be short text expected to appear on the page (e.g., 'Next', 'Register', 'Add Course')."
        " Return ONLY the JSON object, no additional text or explanation."
    )

    messages = [
        {"role": "system", "content": system},
        {"role": "user", "content": f"User asked: {user_message}\n\nReturn the JSON."},
    ]

    print(f"[DEBUG] About to call call_fau_api with messages: {messages}")
    resp = call_fau_api(messages)
    print(f"[DEBUG] call_fau_api returned: {type(resp)}")

    # Extract content from response
    try:
        if "choices" not in resp:
            print(f"[DEBUG] Unexpected response format: {resp}")
            raise ValueError("Response missing 'choices' key")
            
        text = resp["choices"][0]["message"]["content"]
        print(f"[DEBUG] Extracted text from response: {text}")
        
        # Handle API errors
        if text == "request_error":
            raise RuntimeError("API returned request_error")
            
    except (KeyError, IndexError) as e:
        print(f"[DEBUG] Failed to extract text from response: {e}")
        raise RuntimeError(f"Invalid response format: {e}")

    # Parse JSON from response
    try:
        # Try direct JSON parsing
        j = json.loads(text)
        print(f"[DEBUG] Successfully parsed JSON: {j}")
    except json.JSONDecodeError:
        # Fallback: try to find JSON object in the text
        try:
            start = text.index('{')
            end = text.rindex('}') + 1
            json_str = text[start:end]
            j = json.loads(json_str)
            print(f"[DEBUG] Extracted and parsed JSON from text: {j}")
        except (ValueError, json.JSONDecodeError) as e:
            print(f"[DEBUG] Failed to parse JSON, using fallback: {e}")
            # Ultimate fallback: create a single-step reply
            j = {
                "summary": text.strip()[:300],
                "steps": [{"instruction": text.strip(), "target_text": ""}]
            }

    # Normalize steps format
    steps = j.get('steps', [])
    normalized = []
    for s in steps:
        if isinstance(s, str):
            normalized.append({"instruction": s, "target_text": ""})
        else:
            normalized.append({
                "instruction": s.get('instruction') or s.get('text') or s.get('step') or '',
                "target_text": s.get('target_text') or s.get('target') or ''
            })

    return {"summary": j.get('summary', ''), "steps": normalized}


def orchestrate(user_message: str) -> Dict[str, Any]:
    """
    Main orchestration function. Tries LangGraph if available, otherwise uses FAU API.
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
                print(f"[DEBUG] ❌ LangGraph failed: {e}, falling back to FAU API")
                return orchestrate_via_fau_api(user_message)
        else:
            print("[DEBUG] ✓ No LangGraph detected, calling orchestrate_via_fau_api directly")
            result = orchestrate_via_fau_api(user_message)
            print(f"[DEBUG] ✅ Successfully got result from FAU API")
            print(f"[DEBUG] Result summary: {result.get('summary', 'N/A')}")
            print(f"[DEBUG] Number of steps: {len(result.get('steps', []))}")
            return result
            
    except Exception as e:
        print(f"\n{'='*60}")
        print(f"[DEBUG] ❌❌❌ CRITICAL ERROR in orchestrate")
        print(f"[DEBUG] Error type: {type(e).__name__}")
        print(f"[DEBUG] Error message: {e}")
        import traceback
        print(f"[DEBUG] Full traceback:\n{traceback.format_exc()}")
        print(f"{'='*60}\n")
        
        print("[DEBUG] ⚠️ Using fallback response")
        # Ultimate fallback for any error
        return {
            "summary": "Steps to register for classes at FAU",
            "steps": [
                {"instruction": "Go to the FAU Student Portal", "target_text": "Student Portal"},
                {"instruction": "Click on 'Registration' or 'Student Services'", "target_text": "Registration"},
                {"instruction": "Select 'Register for Classes'", "target_text": "Register for Classes"},
                {"instruction": "Search and add your desired courses", "target_text": "Add Course"}
            ]
        }