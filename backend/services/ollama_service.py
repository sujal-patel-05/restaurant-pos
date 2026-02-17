"""
Ollama Service for Ask-AI Chatbot
Integrates local Ollama models (Llama 2, Mistral, etc.) for intelligent responses
"""

import os
import ollama
from typing import Dict, Any, Optional
from services.schema_context import get_schema_context

class OllamaService:
    """
    Service for interacting with local Ollama models
    """
    
    def __init__(self):
        # Default to llama2, but can be configured
        self.model_name = os.getenv('OLLAMA_MODEL', 'llama2')
        self.base_url = os.getenv('OLLAMA_BASE_URL', 'http://localhost:11434')
        
        # Configure client explicitly if needed, though ollama python lib handles defaults well
        # checks if ollama is running
        try:
            ollama.list()
            print(f"✅ Connected to Ollama (Model: {self.model_name})")
        except Exception as e:
            print(f"⚠️ Could not connect to Ollama: {e}")
            print("Make sure Ollama is running! (ollama serve)")
            
        self.schema_context = get_schema_context()
    
    def classify_intent_with_llm(self, message: str) -> Dict[str, Any]:
        """
        Use Ollama to classify intent and extract entities
        Returns structured intent data
        """
        
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
            response = ollama.chat(model=self.model_name, messages=[
                {'role': 'user', 'content': prompt},
            ])
            
            result_text = response['message']['content'].strip()
            
            # Extract JSON from response (handle markdown code blocks if Llama adds them)
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            import json
            # Handle potential trailing commas or minor JSON errors if model is weak
            intent_data = json.loads(result_text)
            return intent_data
            
        except Exception as e:
            print(f"Ollama intent classification error: {e}")
            return None
    
    def generate_intelligent_response(
        self, 
        message: str, 
        intent_type: str,
        data: Optional[Dict[str, Any]] = None,
        conversation_history: list = None
    ) -> str:
        """
        Generate intelligent, contextual response using Ollama
        """
        
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
            # Build messages history if available
            messages = []
            if conversation_history:
                # Add limited history context
                for msg in conversation_history[-4:]: # Last 4 messages
                    messages.append({'role': msg.role, 'content': msg.content})
            
            messages.append({'role': 'user', 'content': context})
            
            response = ollama.chat(model=self.model_name, messages=messages)
            return response['message']['content'].strip()
            
        except Exception as e:
            print(f"Ollama response generation error: {e}")
            return "I encountered an error generating a response. Please try again."


# Singleton instance
_ollama_service = None

def get_ollama_service() -> OllamaService:
    """Get or create OllamaService singleton"""
    global _ollama_service
    if _ollama_service is None:
        try:
            _ollama_service = OllamaService()
        except Exception as e:
            print(f"Warning: {e}. Ollama service not available.")
            return None
    return _ollama_service
