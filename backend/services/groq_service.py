"""
Groq Service for Ask-AI Chatbot
Production-grade integration with Groq API (Llama 3.3 70B)
Intelligent prompt engineering for restaurant POS operations
"""

import os
import json
import logging
from typing import Dict, Any, Optional, List
from groq import Groq
from services.schema_context import get_schema_context
from config import settings

logger = logging.getLogger(__name__)

# ──────────────────────────────────────────────────────────────
# The Master System Prompt — the "brain" of Ask AI
# ──────────────────────────────────────────────────────────────
SYSTEM_PERSONA = """You are **SujalPOS AI** — the world's smartest restaurant co-pilot.

You are embedded inside a production Restaurant POS (Point-of-Sale) system used by restaurant managers, cashiers, and kitchen staff. You have **real-time access** to the restaurant's database and can answer questions about sales, inventory, orders, menu, wastage, and general operations.

## Your Personality
- Professional yet warm — like a trusted restaurant consultant
- Data-driven — always back claims with numbers
- Proactive — if you notice something important in the data, mention it
- Concise — busy restaurant staff don't have time for essays

## Formatting Rules (CRITICAL)
1. **Use Markdown** — bold for key numbers, headers for sections
2. **Tables** — when showing multiple items/orders, ALWAYS use markdown tables
3. **Currency** — always use ₹ symbol, format with commas (₹1,234.56)
4. **Percentages** — round to 1 decimal place
5. **Dates/Times** — use human-readable format (e.g., "Today, 17 Feb", "3:45 PM")
6. **Lists** — use bullet points for 3+ items
7. **Keep responses under 300 words** unless the user asks for detail

## Chart Instructions
When your response involves numerical/trend data that would benefit from visual display, include a `__chart__` JSON block at the END of your response (after all text) in this exact format:

```
__chart__{"type":"bar","title":"Chart Title","data":[{"label":"Item1","value":100},{"label":"Item2","value":80}],"xKey":"label","yKey":"value"}__chart__
```

Chart types: `bar`, `line`, `pie`
- Use `bar` for comparisons (top items, daily sales)
- Use `line` for trends over time
- Use `pie` for distribution/breakdown
- Only include charts when data has 2+ data points
- Do NOT include charts for simple single-number answers

## What You Can Do
1. **Sales Analysis** — revenue, order counts, trends, peak hours, AOV
2. **Inventory Status** — stock levels, low stock alerts, expiring items
3. **Order Management** — track orders, check status, find specific orders
4. **Menu Intelligence** — prices, availability, popular items, food cost
5. **Wastage Tracking** — waste logs, reasons, cost impact
6. **Business Insights (Revenue Intelligence)** — actionable recommendations on margins, profitability, popularity (BCG Matrix), combo deals, upselling, and price optimization.
7. **Menu Optimization** — identifying "Hidden Gems" (high margin, low sales) or "Workhorses" (high sales, low margin).
8. **Menu Management** — change item prices, add new items, remove items, toggle availability — all in real-time.
9. **Batch Operations** — execute MULTIPLE menu/order operations in a single command (e.g., "Add paneer wrap at 220, change burger to 300, and remove cold coffee").
10. **Report Generation** — generate comprehensive, detailed sales reports (daily/weekly/monthly/quarterly) with KPIs, charts, insights, and downloadable PDF. Reports include revenue trends, top items, category breakdown, payment modes, peak hours, day-of-week analysis, and period-over-period comparisons.

## Menu Management — Smart Follow-up Rules (CRITICAL)
- When a user asks to **update/change a price** without specifying the new price, FIRST show the current price from the Retrieved Data, then ask what they'd like the new price to be.
- When a user asks to **add a new item** without full details, ask for: item name, price, category, description, and prep time.
- When a user asks to **delete/remove an item**, always confirm with the user before proceeding. Show the item name and price.
- When responding to **follow-up messages** (like "make it 150", "yes", "confirm"), use the conversation history to understand context and complete the pending action.
- After a successful menu change, always show the **before and after** values clearly.

## Multi-Operation Results
- When the system returns `multi_operation: true`, format each operation's result clearly with numbered steps.
- Show ✅ for successes, ❌ for failures, ⚠️ for skipped operations.
- Summarize at the end: "X/Y operations completed successfully."

## Error Handling
- If no data is returned, explain nicely: "I couldn't find any [X] for [period]. This could mean no [activity] has been recorded yet."
- If the query is ambiguous, ask ONE clarifying question
- NEVER make up numbers — only use data from the Retrieved Data section
- If you see an error in the data, acknowledge it honestly
"""


# ──────────────────────────────────────────────────────────────
# Intent Classification Prompt
# ──────────────────────────────────────────────────────────────
INTENT_CLASSIFICATION_PROMPT = """Classify this restaurant POS message into exactly ONE intent.

## Intents
| Intent | Description | Example |
|--------|-------------|---------|
| `create_order` | Place/add items to an order | "Add 2 burgers to table 5" |
| `sales_query` | Revenue, earnings, order counts, trends | "How much did we earn today?" |
| `inventory_query` | Stock levels, ingredients, low stock, expiry dates | "Do we have enough cheese?", "What's expiring soon?" |
| `order_status` | Check/find specific orders | "Is order #123 ready?" |
| `menu_info` | Item prices, availability, menu details | "How much is the pizza?" |
| `wastage_query` | Waste logs, spoilage, food waste | "What was wasted this week?" |
| `revenue_intel` | Margins, profit contribution, popular items (BCG), combo deals, pricing advice, under-promoted items | "Which items have the highest margin?", "Give me combo suggestions", "What are our hidden gems?" |
| `generate_report` | Generate/download/create/export comprehensive sales reports (daily, weekly, monthly, quarterly) with KPIs, charts, and PDF | "Generate monthly sales report", "Download weekly report", "Create a sales report" |
| `update_menu_item` | Change item price, toggle availability, modify item details | "Change burger price to 250", "Update price of dosa", "Make pizza unavailable" |
| `add_menu_item` | Add new items/dishes to the restaurant menu | "Add paneer tikka at 280 in starters", "Add new item to menu" |
| `delete_menu_item` | Remove/disable items from the menu | "Remove cold coffee from menu", "Delete samosa" |
| `multi_operation` | MULTIPLE operations in ONE message (add + update + delete combined) | "Add paneer wrap at 220, change burger to 300, and remove cold coffee" |
| `general` | Greetings, capabilities, off-topic | "Hi", "What can you do?" |

## CRITICAL: Report vs Sales Query Distinction
- `generate_report` = user wants a REPORT (PDF, download, export, generate, create report, comprehensive analytics)
- `sales_query` = user is ASKING about sales data (how much, how many, today's total)
- Keywords for `generate_report`: "report", "generate", "download", "create report", "export", "PDF", "print report"

## CRITICAL: Multi-Operation Detection
- If the message contains TWO or MORE distinct menu/order operations, classify as `multi_operation`
- Indicators: conjunctions ("and", "also", "then"), commas separating distinct actions, semicolons
- Example: "Add paneer wrap at 220 and change burger price to 300" → multi_operation
- Example: "Remove cold coffee, add mango lassi at 120, and update pizza price to 400" → multi_operation
- Single operations like "Add paneer wrap at 220 in starters" → add_menu_item (NOT multi_operation)

## Few-Shot Examples
User: "What are today's sales?" → {{"intent_type":"sales_query","confidence":0.97,"entities":{{"period":"today","days":1}},"needs_data":true}}
User: "How much cheese do we have?" → {{"intent_type":"inventory_query","confidence":0.95,"entities":{{"item_name":"cheese"}},"needs_data":true}}
User: "Add 3 burgers and 2 cokes to table 4" → {{"intent_type":"create_order","confidence":0.98,"entities":{{"items":[{{"name":"burger","quantity":3}},{{"name":"coke","quantity":2}}],"table_number":"4","order_type":"dine_in"}},"needs_data":true}}
User: "Show me pending orders" → {{"intent_type":"order_status","confidence":0.95,"entities":{{"status":"pending"}},"needs_data":true}}
User: "What's on the menu?" → {{"intent_type":"menu_info","confidence":0.92,"entities":{{}},"needs_data":true}}
User: "How much wastage happened last week?" → {{"intent_type":"wastage_query","confidence":0.95,"entities":{{"period":"last_week","days":7}},"needs_data":true}}
User: "Hello!" → {{"intent_type":"general","confidence":0.99,"entities":{{}},"needs_data":false}}
User: "What's the revenue for this month?" → {{"intent_type":"sales_query","confidence":0.96,"entities":{{"period":"this_month","days":30}},"needs_data":true}}
User: "Which items are running low?" → {{"intent_type":"inventory_query","confidence":0.94,"entities":{{}},"needs_data":true}}
User: "What's expiring soon?" → {{"intent_type":"inventory_query","confidence":0.95,"entities":{{}},"needs_data":true}}
User: "Show me expired items" → {{"intent_type":"inventory_query","confidence":0.95,"entities":{{}},"needs_data":true}}
User: "Which ingredients are about to expire?" → {{"intent_type":"inventory_query","confidence":0.96,"entities":{{}},"needs_data":true}}
User: "What are our most profitable items?" → {{"intent_type":"revenue_intel","confidence":0.98,"entities":{{"query_sub_type":"profitability"}},"needs_data":true}}
User: "Show me combo recommendations" → {{"intent_type":"revenue_intel","confidence":0.97,"entities":{{"query_sub_type":"combos"}},"needs_data":true}}
User: "Which items have low margins but high volume?" → {{"intent_type":"revenue_intel","confidence":0.95,"entities":{{"query_sub_type":"velocity"}},"needs_data":true}}
User: "Give me a full revenue intelligence report" → {{"intent_type":"revenue_intel","confidence":0.99,"entities":{{"query_sub_type":"full_report"}},"needs_data":true}}
User: "Generate monthly sales report" → {{"intent_type":"generate_report","confidence":0.98,"entities":{{"report_type":"monthly","days":30}},"needs_data":true}}
User: "Download weekly report" → {{"intent_type":"generate_report","confidence":0.97,"entities":{{"report_type":"weekly","days":7}},"needs_data":true}}
User: "Create a daily sales report" → {{"intent_type":"generate_report","confidence":0.97,"entities":{{"report_type":"daily","days":1}},"needs_data":true}}
User: "I need a sales report for this month" → {{"intent_type":"generate_report","confidence":0.96,"entities":{{"report_type":"monthly","days":30}},"needs_data":true}}
User: "Export quarterly report with charts" → {{"intent_type":"generate_report","confidence":0.97,"entities":{{"report_type":"quarterly","days":90}},"needs_data":true}}
User: "Report banao aaj ka" → {{"intent_type":"generate_report","confidence":0.95,"entities":{{"report_type":"daily","days":1}},"needs_data":true}}
User: "Give me detailed analytics report for last 14 days" → {{"intent_type":"generate_report","confidence":0.96,"entities":{{"report_type":"custom","days":14}},"needs_data":true}}
User: "Change burger price to 300" → {{"intent_type":"update_menu_item","confidence":0.98,"entities":{{"item_name":"burger","new_price":300}},"needs_data":true}}
User: "Update price of dosa" → {{"intent_type":"update_menu_item","confidence":0.96,"entities":{{"item_name":"dosa"}},"needs_data":true}}
User: "Make pizza unavailable" → {{"intent_type":"update_menu_item","confidence":0.97,"entities":{{"item_name":"pizza","availability":false}},"needs_data":true}}
User: "Add paneer tikka at 280 in starters" → {{"intent_type":"add_menu_item","confidence":0.97,"entities":{{"item_name":"paneer tikka","price":280,"category":"starters"}},"needs_data":true}}
User: "Add a new item to the menu" → {{"intent_type":"add_menu_item","confidence":0.95,"entities":{{}},"needs_data":true}}
User: "Add grilled sandwich at 180, a crispy grilled cheese sandwich, takes 10 minutes" → {{"intent_type":"add_menu_item","confidence":0.97,"entities":{{"item_name":"grilled sandwich","price":180,"description":"a crispy grilled cheese sandwich","preparation_time":10}},"needs_data":true}}
User: "Remove cold coffee from menu" → {{"intent_type":"delete_menu_item","confidence":0.97,"entities":{{"item_name":"cold coffee"}},"needs_data":true}}
User: "Delete samosa" → {{"intent_type":"delete_menu_item","confidence":0.96,"entities":{{"item_name":"samosa"}},"needs_data":true}}
User: "Burger ki price 250 karo" → {{"intent_type":"update_menu_item","confidence":0.95,"entities":{{"item_name":"burger","new_price":250}},"needs_data":true}}
User: "Dosa ka price badha do" → {{"intent_type":"update_menu_item","confidence":0.94,"entities":{{"item_name":"dosa"}},"needs_data":true}}
User: "Add paneer wrap at 220, change burger to 300, and remove cold coffee" → {{"intent_type":"multi_operation","confidence":0.98,"entities":{{}},"needs_data":true}}
User: "Add mango lassi at 120 in beverages and update pizza price to 400" → {{"intent_type":"multi_operation","confidence":0.97,"entities":{{}},"needs_data":true}}
User: "Remove samosa and add spring rolls at 150" → {{"intent_type":"multi_operation","confidence":0.96,"entities":{{}},"needs_data":true}}

## Time Period Extraction Rules
- "today" → period: "today", days: 1
- "yesterday" → period: "yesterday", days: 1
- "this week" / "last 7 days" → period: "this_week", days: 7
- "last week" → period: "last_week", days: 7
- "this month" / "last 30 days" → period: "this_month", days: 30
- "last month" → period: "last_month", days: 30

## User Message: "{message}"

Output ONLY valid JSON. No explanation."""


class GroqService:
    """Production-grade service for Groq Cloud API integration"""

    def __init__(self):
        self.api_key = settings.GROQ_API_KEY
        self.model_name = settings.GROQ_MODEL or 'llama-3.3-70b-versatile'

        if not self.api_key:
            logger.warning("GROQ_API_KEY not configured — AI responses will use fallback templates")
            self.client = None
        else:
            try:
                self.client = Groq(api_key=self.api_key)
                logger.info(f"Groq API connected (Model: {self.model_name})")
            except Exception as e:
                logger.error(f"Groq client init failed: {e}")
                self.client = None

        self.schema_context = get_schema_context()

    def classify_intent_with_llm(self, message: str) -> Optional[Dict[str, Any]]:
        """
        Use Groq LLM for precise intent classification with entity extraction.
        Returns structured intent data or None on failure.
        """
        if not self.client:
            return None

        prompt = INTENT_CLASSIFICATION_PROMPT.format(message=message)

        try:
            response = self.client.chat.completions.create(
                messages=[
                    {'role': 'system', 'content': 'You are a precise JSON-only intent classifier for a restaurant POS system. Output ONLY valid JSON, nothing else.'},
                    {'role': 'user', 'content': prompt}
                ],
                model=self.model_name,
                temperature=0.05,
                max_tokens=300,
                response_format={"type": "json_object"}
            )

            result_text = response.choices[0].message.content.strip()
            intent_data = json.loads(result_text)

            # Validate required fields
            if 'intent_type' not in intent_data:
                intent_data['intent_type'] = 'general'
            if 'confidence' not in intent_data:
                intent_data['confidence'] = 0.7
            if 'entities' not in intent_data:
                intent_data['entities'] = {}
            if 'needs_data' not in intent_data:
                intent_data['needs_data'] = intent_data['intent_type'] != 'general'

            logger.info(f"Groq classified: '{message[:50]}...' → {intent_data['intent_type']} ({intent_data['confidence']:.0%})")
            return intent_data

        except json.JSONDecodeError as e:
            logger.error(f"Groq returned invalid JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Groq intent classification error: {e}")
            return None

    def generate_intelligent_response(
        self,
        message: str,
        intent_type: str,
        data: Optional[Dict[str, Any]] = None,
        conversation_history: list = None,
        user_name: str = "User",
        user_role: str = "admin"
    ) -> str:
        """
        Generate production-quality, data-driven response using Groq.
        Includes full POS context, retrieved data, and chart generation instructions.
        """
        if not self.client:
            return "AI service is currently unavailable. Please check your Groq API key configuration."

        # Build the rich system context
        from datetime import datetime
        current_time = datetime.now().strftime("%A, %d %B %Y at %I:%M %p")

        system_prompt = f"""{SYSTEM_PERSONA}

## Database Schema Reference
{self.schema_context}

## Current Context
- **Current Time:** {current_time}
- **User:** {user_name} (Role: {user_role})
- **Detected Intent:** `{intent_type}`

## Retrieved Data from Database
```json
{json.dumps(data, indent=2, default=str) if data else "null — No data was retrieved. This means either the query returned empty results, or no database lookup was needed."}
```

Now respond to the user's message using the retrieved data above. Remember:
- Use ONLY the data provided — never invent numbers
- Format with markdown (tables for lists, bold for key numbers)
- Keep it concise and actionable
- Include a chart (__chart__...__chart__) ONLY if the data warrants visual representation (2+ data points)
"""

        try:
            messages = [{'role': 'system', 'content': system_prompt}]

            # Add conversation history (last 6 messages for context)
            if conversation_history:
                for msg in conversation_history[-6:]:
                    messages.append({
                        'role': msg.role if hasattr(msg, 'role') else msg.get('role', 'user'),
                        'content': msg.content if hasattr(msg, 'content') else msg.get('content', '')
                    })

            messages.append({'role': 'user', 'content': message})

            response = self.client.chat.completions.create(
                messages=messages,
                model=self.model_name,
                temperature=0.6,
                max_tokens=1500,
            )

            result = response.choices[0].message.content.strip()
            logger.info(f"Groq response generated ({len(result)} chars) for intent: {intent_type}")
            return result

        except Exception as e:
            logger.error(f"Groq response generation error: {e}")
            return "I encountered an error generating a response. Please try again in a moment."


    def decompose_multi_operation(self, message: str) -> Optional[list]:
        """
        Use Groq LLM to decompose a compound message into individual operations.
        
        Input:  "Add paneer wrap at 220, change burger to 300, and remove cold coffee"
        Output: [
            {"intent_type": "add_menu_item", "entities": {"item_name": "paneer wrap", "price": 220}, "original_text": "Add paneer wrap at 220"},
            {"intent_type": "update_menu_item", "entities": {"item_name": "burger", "new_price": 300}, "original_text": "change burger to 300"},
            {"intent_type": "delete_menu_item", "entities": {"item_name": "cold coffee"}, "original_text": "remove cold coffee"}
        ]
        """
        if not self.client:
            return None
        
        decompose_prompt = f"""Decompose this compound restaurant POS command into individual operations.

Each operation must be one of:
- `add_menu_item` — entities: item_name, price, category (optional), description (optional), preparation_time (optional)
- `update_menu_item` — entities: item_name, new_price (optional), availability (optional: true/false)
- `delete_menu_item` — entities: item_name
- `create_order` — entities: items (list of {{name, quantity}}), table_number, order_type

Return a JSON object with a single key "operations" containing an array. Each operation has:
- "intent_type": the intent string
- "entities": extracted entities for that operation
- "original_text": the portion of the original message for this operation

## Examples
Input: "Add paneer wrap at 220 in starters and change burger price to 300"
Output: {{"operations": [
  {{"intent_type": "add_menu_item", "entities": {{"item_name": "paneer wrap", "price": 220, "category": "starters"}}, "original_text": "Add paneer wrap at 220 in starters"}},
  {{"intent_type": "update_menu_item", "entities": {{"item_name": "burger", "new_price": 300}}, "original_text": "change burger price to 300"}}
]}}

Input: "Remove samosa, add spring rolls at 150 in appetizers, and make pizza unavailable"
Output: {{"operations": [
  {{"intent_type": "delete_menu_item", "entities": {{"item_name": "samosa"}}, "original_text": "Remove samosa"}},
  {{"intent_type": "add_menu_item", "entities": {{"item_name": "spring rolls", "price": 150, "category": "appetizers"}}, "original_text": "add spring rolls at 150 in appetizers"}},
  {{"intent_type": "update_menu_item", "entities": {{"item_name": "pizza", "availability": false}}, "original_text": "make pizza unavailable"}}
]}}

## User Message: "{message}"

Output ONLY valid JSON. No explanation."""
        
        try:
            response = self.client.chat.completions.create(
                messages=[
                    {'role': 'system', 'content': 'You are a precise JSON-only operation decomposer for a restaurant POS system. Output ONLY valid JSON, nothing else.'},
                    {'role': 'user', 'content': decompose_prompt}
                ],
                model=self.model_name,
                temperature=0.05,
                max_tokens=800,
                response_format={"type": "json_object"}
            )
            
            result_text = response.choices[0].message.content.strip()
            result = json.loads(result_text)
            
            operations = result.get('operations', [])
            if not operations:
                logger.warning("LLM decomposition returned no operations")
                return None
            
            # Validate each operation has required fields
            validated = []
            for op in operations:
                if 'intent_type' in op and 'entities' in op:
                    if 'original_text' not in op:
                        op['original_text'] = f"Operation: {op['intent_type']}"
                    validated.append(op)
            
            logger.info(f"LLM decomposed '{message[:50]}...' into {len(validated)} operations")
            return validated if validated else None
            
        except json.JSONDecodeError as e:
            logger.error(f"Groq multi-op decomposition returned invalid JSON: {e}")
            return None
        except Exception as e:
            logger.error(f"Groq multi-op decomposition error: {e}")
            return None


# Singleton instance
_groq_service = None

def get_groq_service() -> Optional[GroqService]:
    """Get or create GroqService singleton"""
    global _groq_service
    if _groq_service is None:
        try:
            _groq_service = GroqService()
        except Exception as e:
            logger.error(f"Failed to initialize GroqService: {e}")
            return None
    return _groq_service
