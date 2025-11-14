#!/usr/bin/env python3
"""
Direct test of the orchestrator module to see debug output.
This bypasses the FastAPI backend to test the orchestrator directly.
"""

import sys
import os

# Add the path to your orchestrator module if needed
# sys.path.insert(0, '/path/to/your/orchestrator/directory')

def test_direct_orchestrator():
    """Test the orchestrator directly without going through the API"""
    print("=" * 70)
    print("TESTING ORCHESTRATOR DIRECTLY")
    print("=" * 70)
    
    try:
        # Import your orchestrator module
        from langgraph_orchestrator import orchestrate
        
        # Test message
        test_message = "How do I schedule an advisor meeting?"
        
        print(f"\n🧪 Testing with message: '{test_message}'\n")
        
        # Call orchestrate directly
        result = orchestrate(test_message)
        
        print("\n" + "=" * 70)
        print("✅ FINAL RESULT:")
        print("=" * 70)
        print(f"Summary: {result.get('summary', 'N/A')}")
        print(f"\nSteps ({len(result.get('steps', []))}):")
        for i, step in enumerate(result.get('steps', []), 1):
            print(f"  {i}. {step.get('instruction', 'N/A')}")
            print(f"     Target: '{step.get('target_text', 'N/A')}'")
        print("=" * 70)
        
    except ImportError as e:
        print(f"❌ Failed to import orchestrator: {e}")
        print("\nMake sure:")
        print("1. You're in the correct directory")
        print("2. The orchestrator.py file exists")
        print("3. All dependencies are installed")
    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()


def test_via_api():
    """Test via the FastAPI backend (your original method)"""
    import requests
    import json
    
    print("\n" + "=" * 70)
    print("TESTING VIA API BACKEND")
    print("=" * 70)
    
    url = "http://127.0.0.1:8000/orchestrate"
    payload = {"message": "How do I schedule advisor meeting?"}
    
    print(f"\n📡 Sending POST to {url}")
    print(f"Payload: {json.dumps(payload, indent=2)}")
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"\n✅ Status Code: {response.status_code}")
        print(f"Response: {json.dumps(response.json(), indent=2)}")
    except requests.exceptions.ConnectionError:
        print("❌ Connection error - is your backend server running?")
        print("   Start it with: uvicorn main:app --reload")
    except Exception as e:
        print(f"❌ Error: {e}")


if __name__ == "__main__":
    print("\n🚀 Starting Orchestrator Tests\n")
    
    # Test 1: Direct orchestrator call (shows all debug output)
    test_direct_orchestrator()
    
    # Test 2: Via API (requires backend to be running)
    print("\n\n")
    try_api = input("Do you want to test via API backend too? (y/n): ").strip().lower()
    if try_api == 'y':
        test_via_api()
    
    print("\n✨ Tests complete!\n")