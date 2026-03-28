
import sys
import os
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from database import SessionLocal
from services.query_engine import QueryEngine
from services.ai_service import get_ai_service
from schemas.ai_schemas import Intent

def test_intel_query():
    db = SessionLocal()
    restaurant_id = "REST-001" # Default test restaurant
    ai_service = get_ai_service()
    
    test_queries = [
        "Which items have the highest profit margins?",
        "What are some recommended menu combos?",
        "Tell me about my hidden gems.",
        "How can I optimize my pricing?",
        "What is the sales velocity of my items?"
    ]
    
    print("-" * 50)
    for query in test_queries:
        print(f"\nTesting Query: {query}")
        
        # 1. Test Intent Classification
        intent = ai_service.classify_intent(query)
        print(f"Detected Intent: {intent.intent_type}")
        print(f"Entities: {intent.entities}")
        
        if intent.intent_type == "revenue_intel":
            print("✅ Intent correctly identified as revenue_intel")
        else:
            print("❌ Intent NOT identified as revenue_intel!")
            continue
            
        # 2. Test Data Fetching
        try:
            data = QueryEngine.execute_query(intent.intent_type, intent.entities, db, restaurant_id)
            print(f"Data keys returned: {list(data.keys())}")
            
            # 3. Test Response Generation (Template-based)
            response, chart = ai_service._template_based_response(query, intent, data)
            print(f"Template Response Snippet: {response[:200]}...")
            
        except Exception as e:
            print(f"❌ Error during execution: {e}")
            import traceback
            traceback.print_exc()

    db.close()

if __name__ == "__main__":
    test_intel_query()
