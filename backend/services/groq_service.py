"""
Groq Service for Ask-AI Chatbot
Integrates Groq API (Qwen, Llama 3, etc.) for lightning-fast responses
"""

import os
import json
from typing import Dict, Any, Optional
from groq import Groq
from services.schema_context import get_schema_context

from config import settings

class GroqService:
    """
    Service for interacting with Groq Cloud API
    """
    
    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model_name = settings.GROQ_MODEL or 'qwen-2.5-32b'
        
        if not self.api_key:
            print("⚠️ GROQ_API_KEY not found in settings.")
            self.client = None
        else:
            try:
                self.client = Groq(api_key=self.api_key)
                print(f"✅ Connected to Groq API (Model: {self.model_name})")
            except Exception as e:
                print(f"⚠️ Could not init Groq client: {e}")
                self.client = None
            
        self.schema_context = get_schema_context()
    
    def classify_intent_with_llm(self, message: str) -> Dict[str, Any]:
        """
        Use Groq to classify intent and extract entities
        Returns structured intent data
        """
        if not self.client:
            return None
        
        prompt = f"""You are the Advanced AI Brain for the SujalPOS System. Your job is to accurately classify user intents and extract structured entities from natural language.

**System capabilities:**
1. **Order Management:** Creating orders, checking status, updating KOTs.
   - Linked Tables: `orders`, `order_items`, `menu_items`, `tables`
2. **Inventory Control:** Checking stock, finding low items, analyzing wastage.
   - Linked Tables: `ingredients`, `inventory_transactions`, `wastage_logs`
3. **Business Intelligence:** Analyzing sales, revenue, peak hours, and trends.
   - Linked Tables: `orders` (completed), `payments`
4. **Menu Knowledge:** Answering questions about item prices, availability, and ingredients.
   - Linked Tables: `menu_items`, `menu_categories`, `bom_mappings`

**Available Intent Types:**
1. `create_order`: User wants to place a new order. Triggers the Action Engine.
   - *Example:* "Add 2 burgers and a coke to table 5"
2. `sales_query`: User asks about financial performance or order counts.
   - *Example:* "How much did we earn today?", "Show me weekly revenue"
3. `inventory_query`: User asks about stock levels, reordering, or specific ingredients.
   - *Example:* "Do we have enough cheese?", "List low stock items"
4. `order_status`: User tracking specific orders or kitchen status.
   - *Example:* "Is order #123 ready?", "Show pending KOTs"
5. `menu_info`: User asks about product details, prices, or description.
   - *Example:* "How much is the Lava Cake?"
6. `wastage_query`: User asks about wasted ingredients or logs.
   - *Example:* "What was the wastage this week?"
7. `general`: Greetings, capabilities questions, or off-topic chat.

**User Message:** "{message}"

**Critical Instructions:**
- Analyze the deep semantic meaning of the message.
- If the user implies an action (buying, adding, placing), use `create_order`.
- For sales/wastage, extract precise time periods (today, yesterday, last 7 days, this month).
- Always extract `item_name` for menu queries.
- **Output ONLY valid JSON.**

**Response Format (JSON Only):**
{{
    "intent_type": "intent_name",
    "confidence": 0.95,
    "entities": {{
        "items": [{{"name": "burger", "quantity": 2}}],
        "table_number": "5",
        "order_type": "dine_in",
        "period": "today",
        "days": 1,
        "order_number": "ORD-1234",
        "item_name": "pizza"
    }},
    "needs_data": true
}}
"""
        
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {'role': 'system', 'content': "You are a precise JSON-only intent classifier."},
                    {'role': 'user', 'content': prompt}
                ],
                model=self.model_name,
                temperature=0.1,  # Low temperature for deterministic/strict output
                item_separator_and_max_tokens_are_deprecated=True,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content.strip()
            
            # Groq's JSON mode usually returns clean JSON, but extra safety:
            import json
            intent_data = json.loads(result_text)
            return intent_data
            
        except Exception as e:
            print(f"Groq intent classification error: {e}")
            return None
    
    def generate_intelligent_response(
        self, 
        message: str, 
        intent_type: str,
        data: Optional[Dict[str, Any]] = None,
        conversation_history: list = None
    ) -> str:
        """
        Generate intelligent, contextual response using Groq
        """
        if not self.client:
            return "AI service unavailable."
        
        # Build context
        context = f"""You are 'Ask AI', the expert virtual assistant for SujalPOS. You are professional, concise, and helpful.

**System Knowledge (Database Schema):**
{self.schema_context}

**Current Interaction:**
- **User Intent:** `{intent_type}`
- **User Query:** "{message}"
- **Retrieved Data:**
{data if data else "No specific data returned from database."}

**Response Guidelines:**
1. **Be Data-Driven:** Base your answer strictly on the 'Retrieved Data'. Do not hallucinate numbers.
2. **Professional Tone:** Use a business-like but friendly tone.
3. **Smart Formatting:**
   - Use **Bold** for key numbers (revenue, counts, prices).
   - Use lists for multiple items.
   - Use emojis sparingly but effectively (📊, 💰, ⚠️, ✅).
4. **Handling "No Data":**
   - If data is empty, explain *why* nicely (e.g., "I couldn't find any sales for that period. This might mean no orders were completed yet.").
5. **Action Confirmation:**
   - For `create_order`, explicitly confirm the items, table, and total value if available.

**Goal:** Provide a response that would make a restaurant manager feel confident and informed.
"""
        
        try:
            # Build messages history
            messages = []
            
            # System prompt
            messages.append({'role': 'system', 'content': context})
            
            # Add limited history
            if conversation_history:
                for msg in conversation_history[-4:]: 
                    messages.append({'role': msg.role, 'content': msg.content})
            
            # User message (redundant in content but good for completion structure)
            messages.append({'role': 'user', 'content': message})
            
            response = self.client.chat.completions.create(
                messages=messages,
                model=self.model_name,
                temperature=0.7,
            )
            
            return response.choices[0].message.content.strip()
            
        except Exception as e:
            print(f"Groq response generation error: {e}")
            return "I encountered an error generating a response. Please try again."


# Singleton instance
_groq_service = None

def get_groq_service() -> GroqService:
    """Get or create GroqService singleton"""
    global _groq_service
    if _groq_service is None:
        try:
            _groq_service = GroqService()
        except Exception as e:
            print(f"Warning: {e}. Groq service not available.")
            return None
    return _groq_service
