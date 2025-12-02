"""
Script to set up the FAU knowledge base using the knowledge base API endpoints.
Run this once to create and populate your knowledge base with FAU website content.
"""
import os
import json
import requests
from typing import List
from dotenv import load_dotenv

# Load environment variables from .env file
load_dotenv()

# Configuration
KB_API_URL = os.environ.get('KB_API_URL', 'https://chat.hpc.fau.edu')
KB_API_KEY = os.environ.get('KB_API_KEY')
KB_NAME = "fau_kb"
KB_DESCRIPTION = "All FAU website content for student guidance"

# FAU URLs to add to knowledge base
FAU_URLS = [
    "https://www.fau.edu/registrar/forms/",
    "https://www.fau.edu/registrar/registration/",
    "https://www.fau.edu/registrar/",
    "https://www.fau.edu/financialaid/",
    "https://www.fau.edu/financialaid/apply/",
    "https://www.fau.edu/admissions/",
    "https://www.fau.edu/student-services/",
    "https://www.fau.edu/academics/",
    "https://www.fau.edu/bursar/",
    "https://www.fau.edu/housing/",
]

def make_api_request(endpoint: str, method: str = "POST", data: dict = None) -> dict:
    """Make API request to knowledge base."""
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {KB_API_KEY}",
    }
    
    url = f"{KB_API_URL}/api/v1/{endpoint}"
    
    if method == "POST":
        resp = requests.post(url, json=data, headers=headers)
    elif method == "GET":
        resp = requests.get(url, headers=headers)
    
    resp.raise_for_status()
    return resp.json()

def create_knowledge_base() -> str:
    """Create a new knowledge base and return its ID."""
    print("Creating knowledge base...")
    
    data = {
        "name": KB_NAME,
        "description": KB_DESCRIPTION
    }
    
    result = make_api_request("knowledge/create", data=data)
    knowledge_id = result.get("id") or result.get("knowledge_id")
    
    print(f"✅ Knowledge base created with ID: {knowledge_id}")
    return knowledge_id

def process_urls_individually(urls: List[str], collection_name: str):
    """Process URLs individually using the retrieval/process/web endpoint."""
    print(f"Processing {len(urls)} URLs individually...")
    
    for i, url in enumerate(urls, 1):
        print(f"Processing URL {i}/{len(urls)}: {url}")
        try:
            data = {
                "collection_name": collection_name,
                "url": url
            }
            
            result = make_api_request("retrieval/process/web", data=data)
            print(f"✅ Processed: {url}")
        except Exception as e:
            print(f"❌ Failed to process {url}: {e}")
    
    print("✅ All URLs processed")

def reindex_knowledge_base():
    """Reindex the knowledge base for efficient searching."""
    print("Reindexing knowledge base...")
    
    result = make_api_request("knowledge/reindex")
    print("✅ Knowledge base reindexed")
    return result

def test_query(collection_name: str = None):
    """Test querying the knowledge base."""
    if not collection_name:
        collection_name = KB_NAME
        
    print("Testing knowledge base query...")
    
    data = {
        "collection_names": [collection_name],
        "query": "How do I register for classes at FAU?",
        "k": 5
    }
    
    result = make_api_request("retrieval/query/collection", data=data)
    print("✅ Test query successful")
    print(f"Response: {result}")
    return result

def main():
    """Main setup function."""
    if not KB_API_KEY:
        print("❌ Please set KB_API_KEY environment variable")
        return
    
    try:
        # Step 1: Create knowledge base
        knowledge_id = create_knowledge_base()
        
        # Step 2: Process URLs individually
        process_urls_individually(FAU_URLS, KB_NAME)
        
        # Step 3: Reindex (optional)
        try:
            reindex_knowledge_base()
        except Exception as e:
            print(f"⚠️ Reindex failed (continuing anyway): {e}")
        
        # Step 4: Test query
        test_query()
        
        print(f"\n🎉 Knowledge base setup complete!")
        print(f"Knowledge ID: {knowledge_id}")
        print(f"Collection Name: {KB_NAME}")
        print(f"Set KB_COLLECTION_NAME={KB_NAME} in your environment")
        
    except Exception as e:
        print(f"❌ Setup failed: {e}")

if __name__ == "__main__":
    main()