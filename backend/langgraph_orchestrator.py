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

# Configuration for Knowledge Base API
KB_API_URL = os.environ.get('KB_API_URL', 'https://api.example.com')  # Replace with actual KB API URL
KB_API_KEY = os.environ.get('KB_API_KEY')  # Set your KB API key
KB_COLLECTION_NAME = os.environ.get('KB_COLLECTION_NAME', 'fau_kb')

print(f"[DEBUG] KB_API_URL: {KB_API_URL}")
print(f"[DEBUG] KB_API_KEY: {KB_API_KEY[:20] + '...' if KB_API_KEY else 'None'}")
print(f"[DEBUG] KB_COLLECTION_NAME: {KB_COLLECTION_NAME}")


def query_knowledge_base(query: str) -> str:
    """
    Query the knowledge base collection for FAU-specific information.
    Returns the response content from the knowledge base.
    """
    print(f"[DEBUG] query_knowledge_base called with: {query}")
    
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {KB_API_KEY}",
    }
    
    payload = {
        "collection_names": [KB_COLLECTION_NAME],
        "query": query,
        "k": 5
    }
    
    print(f"[DEBUG] Payload: {json.dumps(payload, indent=2)}")
    
    try:
        url = f"{KB_API_URL}/api/v1/retrieval/query/collection"
        print(f"[DEBUG] Making POST request to {url}")
        resp = requests.post(url, json=payload, headers=headers, timeout=60)
        print(f"[DEBUG] Response status: {resp.status_code}")
        
        resp.raise_for_status()
        result = resp.json()
        print(f"[DEBUG] Knowledge base query successful")
        
        # Extract the answer/content from the KB response
        content = result.get('answer', result.get('content', result.get('response', '')))
        return content
        
    except Exception as e:
        print(f"[DEBUG] ❌ Knowledge base query failed: {e}")
        raise RuntimeError(f"Knowledge base query failed: {e}")


def orchestrate_via_knowledge_base(user_message: str) -> Dict[str, Any]:
    """
    Query the knowledge base and convert response to structured steps.
    Returns dict with keys: summary (str) and steps (list of {instruction, target_text})
    """
    print(f"[DEBUG] orchestrate_via_knowledge_base called with: {user_message}")
    
    try:
        # Query the knowledge base for FAU-specific information
        kb_response = query_knowledge_base(user_message)
        print(f"[DEBUG] Knowledge base response: {kb_response[:200]}...")
        
        # Convert KB response to structured steps
        steps = parse_kb_response_to_steps(kb_response, user_message)
        
        return {
            "summary": f"Steps for: {user_message}",
            "steps": steps
        }
        
    except Exception as e:
        print(f"[DEBUG] ❌ Knowledge base orchestration failed: {e}")
        # Fallback to predefined steps based on common queries
        return get_fallback_steps(user_message)


def parse_kb_response_to_steps(kb_response: str, user_query: str) -> List[Dict[str, str]]:
    """
    Parse knowledge base response into clean UI steps.
    """
    steps = []
    
    try:
        # Parse the KB response JSON
        if isinstance(kb_response, str):
            import json
            kb_data = json.loads(kb_response)
        else:
            kb_data = kb_response
            
        # Extract documents from the response
        documents = kb_data.get('documents', [[]])[0] if kb_data.get('documents') else []
        
        if documents:
            # Combine all document content
            content = ' '.join(documents)
            
            # Extract step-by-step instructions from the content
            steps = extract_steps_from_content(content)
            
        if not steps:
            # Fallback to predefined steps based on query type
            steps = get_predefined_steps(user_query)
            
    except Exception as e:
        print(f"[DEBUG] Error parsing KB response: {e}")
        steps = get_predefined_steps(user_query)
    
    return steps


def extract_steps_from_content(content: str) -> List[Dict[str, str]]:
    """
    Extract clean steps from KB content.
    """
    steps = []
    
    # Split content into lines and clean up
    lines = [line.strip() for line in content.split('\n') if line.strip()]
    
    # Look for step-like patterns
    step_keywords = ['select', 'click', 'choose', 'go to', 'navigate', 'enter', 'complete']
    
    for line in lines:
        line_lower = line.lower()
        
        # Skip very short lines or lines that don't seem like instructions
        if len(line) < 10:
            continue
            
        # Check if line contains step-like keywords
        if any(keyword in line_lower for keyword in step_keywords):
            # Extract target text (usually the last meaningful word/phrase)
            target_text = extract_target_text(line)
            
            steps.append({
                "instruction": line,
                "target_text": target_text
            })
    
    # Limit to reasonable number of steps
    return steps[:6]


def extract_target_text(instruction: str) -> str:
    """
    Extract likely UI target text from instruction.
    """
    # Common FAU UI elements (more specific)
    ui_patterns = [
        'Student Services', 'Registration', 'Add or Drop Classes',
        'Register for Classes', 'Plan Ahead', 'MyFAU', 'Student Portal',
        'Financial Aid', 'Apply for Aid', 'FAFSA', 'Transcript',
        'Academic Records', 'Next', 'Submit', 'Continue', 'Login',
        'Click Here for Registration', 'Student Self Service',
        'Add Course', 'Drop Course', 'Search Classes', 'Class Schedule'
    ]
    
    instruction_lower = instruction.lower()
    
    # Look for quoted text first
    if '"' in instruction:
        quoted = instruction.split('"')[1] if len(instruction.split('"')) > 1 else ''
        if quoted:
            return quoted
    
    # Look for "Click" or "Select" patterns
    if 'click' in instruction_lower:
        # Extract text after "click" or "click on"
        parts = instruction_lower.split('click')
        if len(parts) > 1:
            after_click = parts[1].strip()
            if after_click.startswith('on '):
                after_click = after_click[3:].strip()
            if after_click.startswith('the '):
                after_click = after_click[4:].strip()
            # Remove quotes and get first meaningful phrase
            after_click = after_click.strip('"\'')
            if after_click:
                return after_click.split(' that ')[0].split(' to ')[0].title()
    
    if 'select' in instruction_lower:
        parts = instruction_lower.split('select')
        if len(parts) > 1:
            after_select = parts[1].strip()
            after_select = after_select.strip('"\'')
            if after_select:
                return after_select.split(' from ')[0].split(' in ')[0].title()
    
    # Look for known UI patterns
    for pattern in ui_patterns:
        if pattern.lower() in instruction_lower:
            return pattern
    
    # Extract meaningful words (avoid common words)
    words = [w for w in instruction.split() if w.lower() not in ['the', 'a', 'an', 'and', 'or', 'to', 'for', 'on', 'in', 'at']]
    if len(words) > 2:
        return ' '.join(words[-2:]).title()
    
    return words[-1].title() if words else 'Next'


def get_predefined_steps(user_query: str) -> List[Dict[str, str]]:
    """
    Fallback predefined steps based on query type.
    """
    query_lower = user_query.lower()
    
    if "register" in query_lower or "registration" in query_lower:
        return [
            {"instruction": "Go to MyFAU student portal", "target_text": "MyFAU"},
            {"instruction": "Click on Student Self Service", "target_text": "Student Self Service"},
            {"instruction": "Select Registration", "target_text": "Registration"},
            {"instruction": "Click 'Register for Classes'", "target_text": "Register for Classes"},
            {"instruction": "Search and add your courses", "target_text": "Search Classes"}
        ]
    elif "transcript" in query_lower:
        return [
            {"instruction": "Access Student Services", "target_text": "Student Services"},
            {"instruction": "Go to Academic Records", "target_text": "Academic Records"},
            {"instruction": "Request Official Transcript", "target_text": "Request Transcript"}
        ]
    elif "financial aid" in query_lower or "fafsa" in query_lower:
        return [
            {"instruction": "Visit Financial Aid section", "target_text": "Financial Aid"},
            {"instruction": "Click Apply for Financial Aid", "target_text": "Apply for Aid"},
            {"instruction": "Complete your FAFSA", "target_text": "FAFSA"}
        ]
    else:
        return [
            {"instruction": "Navigate to FAU homepage", "target_text": "Home"},
            {"instruction": "Find Student Services", "target_text": "Student Services"},
            {"instruction": "Look for relevant information", "target_text": "Search"}
        ]


def get_fallback_steps(user_query: str) -> Dict[str, Any]:
    """
    Provide fallback steps when knowledge base is unavailable.
    """
    return {
        "summary": f"General steps for: {user_query}",
        "steps": [
            {"instruction": "Visit the FAU website", "target_text": "FAU"},
            {"instruction": "Navigate to Student Services", "target_text": "Student Services"},
            {"instruction": "Find the relevant section for your query", "target_text": "Search"}
        ]
    }


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
                return orchestrate_via_knowledge_base(user_message)
        else:
            print("[DEBUG] ✓ No LangGraph detected, calling orchestrate_via_knowledge_base directly")
            result = orchestrate_via_knowledge_base(user_message)
            print(f"[DEBUG] ✅ Successfully got result from Knowledge Base")
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