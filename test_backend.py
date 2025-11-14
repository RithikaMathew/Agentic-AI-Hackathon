#!/usr/bin/env python3
"""
Simple test script to send messages to the FAU Chat Assistant backend
and see what AI responses are generated.
"""

import requests
import json
import sys

# Backend URL
BACKEND_URL = "http://127.0.0.1:8000/orchestrate"

def test_backend(message):
    """Send a message to the backend and print the response"""
    print(f"\n🔍 Testing message: '{message}'")
    print("-" * 50)
    
    try:
        # Prepare request
        payload = {"message": message}
        headers = {"Content-Type": "application/json"}
        
        # Send request
        response = requests.post(BACKEND_URL, json=payload, headers=headers, timeout=30)
        
        # Check status
        print(f"Status Code: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            # Print summary
            summary = data.get('summary', 'No summary')
            print(f"Summary: {summary}")
            
            # Print steps
            steps = data.get('steps', [])
            print(f"Steps ({len(steps)}):")
            for i, step in enumerate(steps, 1):
                instruction = step.get('instruction', 'No instruction')
                target_text = step.get('target_text', 'No target')
                print(f"  {i}. {instruction}")
                print(f"     → Target: '{target_text}'")
            
            # Print raw JSON for debugging
            print(f"\nRaw JSON Response:")
            print(json.dumps(data, indent=2))
            
        else:
            print(f"Error: {response.status_code} - {response.text}")
            
    except requests.exceptions.ConnectionError:
        print("❌ Cannot connect to backend. Make sure it's running on http://127.0.0.1:8000")
    except requests.exceptions.Timeout:
        print("⏱️ Request timed out")
    except Exception as e:
        print(f"❌ Error: {e}")

def main():
    """Test various messages"""
    
    # Test messages
    test_messages = [
        "How do I register for classes?",
        "How to contact advisor?", 
        "How do I drop a course?",
        "Where is the library?",
        "How to apply for financial aid?",
        "What is the graduation requirement?"
    ]
    
    print("🚀 FAU Chat Assistant Backend Test")
    print("=" * 50)
    
    # Test health endpoint first
    try:
        health_response = requests.get("http://127.0.0.1:8000/health", timeout=5)
        print(f"✅ Backend health check: {health_response.json()}")
    except Exception as e:
        print(f"❌ Backend health check failed: {e}")
        return
    
    # Test each message
    for message in test_messages:
        test_backend(message)
        print()
    
    print("✅ Test completed!")
    
    # Interactive mode
    print("\n" + "=" * 50)
    print("🔧 Interactive Mode - Type your own messages (or 'quit' to exit)")
    while True:
        try:
            user_input = input("\nEnter message: ").strip()
            if user_input.lower() in ['quit', 'exit', 'q']:
                break
            if user_input:
                test_backend(user_input)
        except KeyboardInterrupt:
            break
    
    print("👋 Goodbye!")

if __name__ == "__main__":
    main()