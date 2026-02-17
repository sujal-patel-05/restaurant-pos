
import asyncio
import sys
import os

# Add parent directory to path to import backend modules
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from services.ai_service import get_ai_service
from schemas.ai_schemas import Intent

async def test_ai():
    print("🤖 Initializing AI Service...")
    ai = get_ai_service()
    print(f"🚀 Active Provider: {ai.provider.upper()}")
    
    test_cases = [
        # Sales Queries
        "What are the total sales for today?",
        "How much revenue did we make this week?",
        
        # Inventory Queries
        "Which items are low in stock?",
        "Do we have enough tomatoes?",
        
        # Menu Queries
        "What is the price of the Burger?",
        "Show me all menu items.",
        
        # Order Status
        "Show me active orders.",
        
        # General
        "Hello!",
        "What can you do?"
    ]
    
    print(f"\n🧪 Starting AI Capability Test ({len(test_cases)} cases)\n")
    print("-" * 60)
    
    for query in test_cases:
        print(f"\n📝 Query: '{query}'")
        
        # 1. Test Classification
        try:
            intent = ai.classify_intent(query)
            print(f"   ↳ Intent: {intent.intent_type} (Confidence: {intent.confidence})")
            if intent.entities:
                print(f"   ↳ Entities: {intent.entities}")
        except Exception as e:
            print(f"   ❌ Classification Error: {e}")
            continue

        # 2. Test Response Generation (Mocking data fetching for now, just testing the flow)
        # Note: In a real test we'd mock the DB data. Here we just checking if Generation crashes.
        try:
            # We pass empty data just to see if it handles it gracefully or crashes
            response = ai.generate_response(query, intent, data={}, conversation_id="test-session")
            print(f"   ↳ Response Length: {len(response)} chars")
            # print(f"   ↳ Response Preview: {response[:50]}...")
        except Exception as e:
             print(f"   ❌ Generation Error: {e}")
             
        print("-" * 60)

if __name__ == "__main__":
    asyncio.run(test_ai())
