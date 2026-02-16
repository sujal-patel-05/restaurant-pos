"""
Gemini LLM Service for Ask-AI Chatbot
Integrates Google's Gemini API for intelligent responses
"""

import os
import google.generativeai as genai
from typing import Dict, Any, Optional
from services.schema_context import get_schema_context

class GeminiService:
    """
    Service for interacting with Google's Gemini LLM
    """
    
    def __init__(self):
        api_key = os.getenv('GEMINI_API_KEY')
        if not api_key:
            raise ValueError("GEMINI_API_KEY not found in environment variables")
        
        genai.configure(api_key=api_key)
        # Use Gemini 2.0 Flash for faster and better responses
        self.model = genai.GenerativeModel('gemini-2.0-flash')
        self.schema_context = get_schema_context()
    
    def classify_intent_with_llm(self, message: str) -> Dict[str, Any]:
        """
        Use Gemini to classify intent and extract entities
        Returns structured intent data
        """
        
        prompt = f"""You are an AI assistant for a Restaurant POS System. Analyze the user's message and classify the intent.

**Available Intent Types:**
1. **create_order** - User wants to place an order (e.g., "Add 2 burgers to table 5")
2. **sales_query** - User asks about sales/revenue (e.g., "What are today's sales?")
3. **inventory_query** - User asks about stock levels (e.g., "Which items are low in stock?")
4. **order_status** - User asks about order status (e.g., "Show pending orders")
5. **menu_info** - User asks about menu items (e.g., "What's the price of burger?")
6. **wastage_query** - User asks about wastage (e.g., "How much wastage this week?")
7. **general** - Greetings, help requests, or general questions

**User Message:** "{message}"

**Task:** Classify the intent and extract relevant entities. Respond ONLY with valid JSON in this exact format:

{{
    "intent_type": "one of the above types",
    "confidence": 0.9,
    "entities": {{
        "items": [
            {{"name": "item_name", "quantity": 2}}
        ],
        "table_number": "5",
        "order_type": "dine_in",
        "period": "today",
        "days": 1,
        "order_number": "ORD-12345678-1234",
        "item_name": "burger"
    }},
    "needs_data": true
}}

**Rules:**
- For create_order: Extract items (name + quantity), table_number, order_type
- For sales/wastage queries: Extract time period (today, this week, last 7 days)
- For order_status: Extract order_number if mentioned
- For menu_info: Extract item_name
- Set needs_data to true for all except general
- Only include relevant entities for the intent type
"""
        
        try:
            response = self.model.generate_content(prompt)
            result_text = response.text.strip()
            
            # Extract JSON from response (handle markdown code blocks)
            if "```json" in result_text:
                result_text = result_text.split("```json")[1].split("```")[0].strip()
            elif "```" in result_text:
                result_text = result_text.split("```")[1].split("```")[0].strip()
            
            import json
            intent_data = json.loads(result_text)
            return intent_data
            
        except Exception as e:
            print(f"Gemini intent classification error: {e}")
            # Fallback to rule-based
            return None
    
    def generate_intelligent_response(
        self, 
        message: str, 
        intent_type: str,
        data: Optional[Dict[str, Any]] = None,
        conversation_history: list = None
    ) -> str:
        """
        Generate intelligent, contextual response using Gemini
        """
        
        # Build context
        context = f"""You are an intelligent AI assistant for a Restaurant POS System.

**Database Schema Context:**
{self.schema_context}

**User's Question:** {message}

**Intent Type:** {intent_type}

**Retrieved Data:**
{data if data else "No data available"}

**Instructions:**
1. Provide a helpful, well-structured response
2. Use emojis appropriately (💰 for money, 📦 for orders, ⚠️ for alerts, etc.)
3. Format numbers with commas (e.g., ₹1,234.56)
4. Use markdown formatting (bold, lists, headers)
5. Be conversational and friendly
6. If data shows 0 or empty results, explain why and suggest next steps
7. For order creation success, congratulate and confirm details
8. Add helpful insights or tips when relevant

**Response Format:**
- Start with a clear header or summary
- Use bullet points or numbered lists for multiple items
- Include relevant metrics and totals
- End with a helpful tip or next action suggestion

Generate a professional, well-structured response:"""
        
        try:
            response = self.model.generate_content(context)
            return response.text.strip()
        except Exception as e:
            print(f"Gemini response generation error: {e}")
            return "I encountered an error generating a response. Please try again."


# Singleton instance
_gemini_service = None

def get_gemini_service() -> GeminiService:
    """Get or create GeminiService singleton"""
    global _gemini_service
    if _gemini_service is None:
        try:
            _gemini_service = GeminiService()
        except ValueError as e:
            print(f"Warning: {e}. Gemini service not available.")
            return None
    return _gemini_service
