"""
AI Service for Ask-AI Chatbot
Handles LLM integration, intent classification, and response generation
"""

import json
import re
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from services.schema_context import get_schema_context, get_api_endpoints_context
from schemas.ai_schemas import Intent, ChatMessage

# For production, we'll use a simple rule-based system initially
# and can upgrade to LLaMA later

class AIService:
    """
    Production-grade AI service for POS chatbot
    Uses rule-based intent classification with fallback to LLM
    """
    
    def __init__(self):
        self.schema_context = get_schema_context()
        self.api_context = get_api_endpoints_context()
        # Conversation memory (in-memory for now, can be moved to Redis/DB)
        self.conversations: Dict[str, list] = {}
        
        # Initialize Ollama service (falls back to rule-based)
        try:
            from services.ollama_service import get_ollama_service
            self.llm_service = get_ollama_service()
            self.use_llm = self.llm_service is not None
        except Exception as e:
            print(f"Ollama service not available: {e}")
            self.llm_service = None
            self.use_llm = False
            
    
    def classify_intent(self, message: str) -> Intent:
        """
        Classify user intent using Hybrid Approach (Rule-Based + Local LLM)
        Prioritizes Rule-Based for speed, falls back to LLM for complexity
        """
        
        # 1. Try Rule-Based Classification FIRST (Instant)
        intent = self._rule_based_classification(message)
        
        # 2. If Rule-Based found a specific intent (not general), return it
        if intent.intent_type != 'general' and intent.confidence > 0.6:
            print(f"✅ Rule-based match: {intent.intent_type}")
            return intent
            
        # 3. If Rule-Based failed or returned general, try LLM (Llama 2)
        if self.use_llm and self.llm_service:
            try:
                print("⚠️ Rule-based failed, trying LLM...")
                intent_data = self.llm_service.classify_intent_with_llm(message)
                if intent_data:
                    return Intent(
                        intent_type=intent_data.get('intent_type', 'general'),
                        confidence=intent_data.get('confidence', 0.8),
                        entities=intent_data.get('entities', {}),
                        needs_data=intent_data.get('needs_data', False)
                    )
            except Exception as e:
                print(f"LLM classification failed: {e}")
        
        return intent
    
    def _rule_based_classification(self, message: str) -> Intent:
        """Rule-based intent classification (fallback)"""
        message_lower = message.lower()
        
        # Order creation (ACTION)
        if any(word in message_lower for word in ['add', 'order', 'i want', 'get me', 'place order']):
            entities = self._extract_order_items(message)
            if entities.get('items'):
                return Intent(
                    intent_type="create_order",
                    confidence=0.9,
                    entities=entities,
                    needs_data=True
                )
        
        # Sales queries
        if any(word in message_lower for word in ['sales', 'revenue', 'earning', 'income', 'total']):
            entities = self._extract_time_period(message_lower)
            return Intent(
                intent_type="sales_query",
                confidence=0.9,
                entities=entities,
                needs_data=True
            )
        
        # Inventory queries
        if any(word in message_lower for word in ['stock', 'inventory', 'ingredient', 'low stock', 'reorder']):
            return Intent(
                intent_type="inventory_query",
                confidence=0.9,
                entities={},
                needs_data=True
            )
        
        # Order status
        if any(word in message_lower for word in ['order', 'pending', 'kot', 'kitchen']):
            order_number = self._extract_order_number(message)
            return Intent(
                intent_type="order_status",
                confidence=0.85,
                entities={"order_number": order_number} if order_number else {},
                needs_data=True
            )
        
        # Menu queries
        if any(word in message_lower for word in ['menu', 'item', 'dish', 'price', 'available']):
            item_name = self._extract_item_name(message)
            return Intent(
                intent_type="menu_info",
                confidence=0.8,
                entities={"item_name": item_name} if item_name else {},
                needs_data=True
            )
        
        # Wastage queries
        if any(word in message_lower for word in ['wastage', 'waste', 'expired', 'damaged']):
            entities = self._extract_time_period(message_lower)
            return Intent(
                intent_type="wastage_query",
                confidence=0.85,
                entities=entities,
                needs_data=True
            )
        
        # General/greeting
        return Intent(
            intent_type="general",
            confidence=0.5,
            entities={},
            needs_data=False
        )
    
    
    def _extract_time_period(self, message: str) -> Dict[str, Any]:
        """Extract time period from message (today, this week, last 7 days, etc.)"""
        entities = {}
        
        if 'today' in message:
            entities['period'] = 'today'
            entities['days'] = 1
        elif 'yesterday' in message:
            entities['period'] = 'yesterday'
            entities['days'] = 1
        elif 'this week' in message or 'week' in message:
            entities['period'] = 'week'
            entities['days'] = 7
        elif 'this month' in message or 'month' in message:
            entities['period'] = 'month'
            entities['days'] = 30
        elif 'last' in message:
            # Extract number (e.g., "last 7 days")
            match = re.search(r'last\s+(\d+)\s+(day|week|month)', message)
            if match:
                num = int(match.group(1))
                unit = match.group(2)
                if unit == 'day':
                    entities['days'] = num
                elif unit == 'week':
                    entities['days'] = num * 7
                elif unit == 'month':
                    entities['days'] = num * 30
                entities['period'] = f'last_{num}_{unit}s'
        else:
            # Default to today
            entities['period'] = 'today'
            entities['days'] = 1
        
        return entities
    
    def _extract_order_number(self, message: str) -> Optional[str]:
        """Extract order number from message (e.g., ORD-12345678-1234)"""
        match = re.search(r'(ORD-\d{8}-\d{4})', message, re.IGNORECASE)
        return match.group(1) if match else None
    
    def _extract_item_name(self, message: str) -> Optional[str]:
        """Extract potential item name from message"""
        # Remove common question words
        cleaned = re.sub(r'\b(what|is|the|price|of|cost|how|much|available|in|stock)\b', '', message, flags=re.IGNORECASE)
        cleaned = cleaned.strip()
        
        # If there's a quoted string, use that
        quoted = re.search(r'["\']([^"\']+)["\']', message)
        if quoted:
            return quoted.group(1)
        
        # Otherwise return cleaned message if it's not too long
        if len(cleaned) > 0 and len(cleaned) < 50:
            return None
        
        return None
    
    def _extract_order_items(self, message: str) -> Dict[str, Any]:
        """
        Extract items and quantities from order message
        Examples:
        - "Add 2 burgers and 1 coke" -> [{"name": "burger", "quantity": 2}, {"name": "coke", "quantity": 1}]
        - "I want 3 pizzas" -> [{"name": "pizza", "quantity": 3}]
        - "Order burger" -> [{"name": "burger", "quantity": 1}]
        """
        import re
        
        items = []
        table_number = None
        order_type = "dine_in"  # default
        
        # Extract table number
        table_match = re.search(r'table\s+(\d+|[a-z]\d+)', message, re.IGNORECASE)
        if table_match:
            table_number = table_match.group(1).upper()
        
        # Extract order type
        if any(word in message.lower() for word in ['takeaway', 'take away', 'pickup']):
            order_type = "takeaway"
        elif any(word in message.lower() for word in ['delivery', 'deliver']):
            order_type = "delivery"
        
        # Pattern 1: "2 burgers", "3 pizzas", "1 coke"
        pattern1 = re.findall(r'(\d+)\s+([a-z\s]+?)(?:\s+and|\s+,|$)', message, re.IGNORECASE)
        for qty, item_name in pattern1:
            items.append({
                "name": item_name.strip(),
                "quantity": int(qty)
            })
        
        # Pattern 2: "burger", "pizza" (no quantity specified, default to 1)
        if not items:
            # Remove common words
            cleaned = re.sub(r'\b(add|order|get|me|i|want|please|table|to|for|and|the|a|an)\b', '', message, flags=re.IGNORECASE)
            words = cleaned.strip().split()
            if words:
                # Assume the remaining words are item names
                for word in words:
                    if len(word) > 2:  # Ignore very short words
                        items.append({
                            "name": word.strip(),
                            "quantity": 1
                        })
        
        return {
            "items": items,
            "table_number": table_number,
            "order_type": order_type
        }
    
    
    def generate_response(
        self, 
        message: str, 
        intent: Intent, 
        data: Optional[Dict[str, Any]] = None,
        conversation_id: Optional[str] = None
    ) -> str:
        """
        Generate natural language response using Local LLM (with fallback)
        """
        
        # Try LLM for intelligent responses
        if self.use_llm and self.llm_service:
            try:
                conversation_history = self.get_conversation(conversation_id) if conversation_id else []
                llm_response = self.llm_service.generate_intelligent_response(
                    message,
                    intent.intent_type,
                    data,
                    conversation_history
                )
                if llm_response:
                    return llm_response
            except Exception as e:
                print(f"LLM response generation failed, using template-based: {e}")
        
        # Fallback to template-based responses
        return self._template_based_response(message, intent, data)
    
    def _template_based_response(
        self,
        message: str,
        intent: Intent,
        data: Optional[Dict[str, Any]] = None
    ) -> str:
        """Template-based response generation (fallback)"""
        
        # Handle general/greeting
        if intent.intent_type == "general":
            return self._handle_general(message)
        
        # Handle action-based intents
        if intent.intent_type == "create_order":
            return self._format_create_order_response(data)
        
        # If no data provided, return error
        if not data:
            return "I couldn't fetch the data for your query. Please try again or rephrase your question."
        
        # Generate response based on intent type
        if intent.intent_type == "sales_query":
            return self._format_sales_response(data, intent.entities)
        elif intent.intent_type == "inventory_query":
            return self._format_inventory_response(data)
        elif intent.intent_type == "order_status":
            return self._format_order_response(data, intent.entities)
        elif intent.intent_type == "menu_info":
            return self._format_menu_response(data, intent.entities)
        elif intent.intent_type == "wastage_query":
            return self._format_wastage_response(data, intent.entities)
        
        return "I understood your question but I'm not sure how to answer it yet. Can you try rephrasing?"
    
    
    def _handle_general(self, message: str) -> str:
        """Handle general messages and greetings"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey']):
            return "Hello! I'm your POS assistant. I can help you with sales reports, inventory status, order tracking, and menu information. What would you like to know?"
        
        if any(word in message_lower for word in ['help', 'what can you do']):
            return """I can help you with:
- Sales reports (e.g., "What are today's sales?")
- Inventory status (e.g., "Which items are low in stock?")
- Order tracking (e.g., "Show me pending orders")
- Menu information (e.g., "What's the price of burger?")
- Wastage analysis (e.g., "How much wastage this week?")

Just ask me a question!"""
        
        return "I'm here to help! You can ask me about sales, inventory, orders, menu items, or wastage."
    
    def _format_create_order_response(self, data: Dict[str, Any]) -> str:
        """Format order creation response"""
        if not data.get('success'):
            error = data.get('error', 'Unknown error')
            not_found = data.get('not_found', [])
            
            if not_found:
                response = f"❌ **Unable to create order**\n\n"
                response += f"I couldn't find these items in your menu:\n"
                for item in not_found:
                    response += f"• {item}\n"
                response += f"\n💡 **Tip**: Check the spelling or ask me \"What's on the menu?\" to see available items."
                return response
            
            return f"❌ **Error**: {error}\n\nPlease try again or rephrase your order."
        
        order = data.get('order', {})
        items = order.get('items', [])
        not_found = data.get('not_found', [])
        
        response = "✅ **Order Created Successfully!**\n\n"
        response += f"📋 **Order Number**: {order.get('order_number')}\n"
        
        if order.get('table_number'):
            response += f"🪑 **Table**: {order.get('table_number')}\n"
        
        response += f"📦 **Type**: {order.get('order_type', 'dine_in').replace('_', ' ').title()}\n\n"
        
        response += f"**Items** ({len(items)}):\n"
        for item in items:
            response += f"• {item.get('name')} × {item.get('quantity')} - ₹{item.get('unit_price', 0):,.2f}\n"
        
        response += f"\n💰 **Total Amount**: ₹{order.get('total_amount', 0):,.2f}\n"
        response += f"📊 **Status**: {order.get('status', 'placed').replace('_', ' ').title()}\n\n"
        
        if not_found:
            response += f"⚠️ **Note**: Some items weren't found: {', '.join(not_found)}\n\n"
        
        response += "🔔 The kitchen has been notified and will start preparing your order!"
        
        return response
    
    def _format_sales_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format sales data into natural language"""
        period = entities.get('period', 'today')
        
        total_revenue = data.get('total_revenue', 0)
        total_orders = data.get('total_orders', 0)
        avg_order_value = total_revenue / total_orders if total_orders > 0 else 0
        
        # Create a natural, conversational response
        period_text = period.replace('_', ' ').title()
        
        response = f"Based on your sales data for **{period_text}**, here's what I found:\n\n"
        
        if total_orders == 0:
            response += "📭 You haven't had any orders yet for this period. "
            response += "Orders will start appearing here once customers place them through your POS system."
        else:
            response += f"📊 **Sales Summary**\n\n"
            response += f"You've processed **{total_orders} order{'s' if total_orders != 1 else ''}** "
            response += f"with a total revenue of **₹{total_revenue:,.2f}**.\n\n"
            
            response += f"💰 **Revenue**: ₹{total_revenue:,.2f}\n"
            response += f"📦 **Orders**: {total_orders}\n"
            response += f"📈 **Average Order Value**: ₹{avg_order_value:,.2f}\n\n"
            
            # Add insights
            if avg_order_value > 500:
                response += "✨ Great job! Your average order value is quite healthy."
            elif avg_order_value > 300:
                response += "👍 Your average order value looks good."
            else:
                response += "💡 Tip: Consider upselling to increase your average order value."
        
        return response
    
    def _format_inventory_response(self, data: Dict[str, Any]) -> str:
        """Format inventory data into natural language"""
        low_stock_items = data.get('low_stock_items', [])
        
        if not low_stock_items:
            return "✅ **Good news!** All your inventory items are well-stocked. No items need reordering at the moment."
        
        response = f"⚠️ **Inventory Alert**\n\n"
        response += f"I found **{len(low_stock_items)} item{'s' if len(low_stock_items) != 1 else ''}** "
        response += f"running low on stock:\n\n"
        
        for i, item in enumerate(low_stock_items[:5], 1):
            name = item.get('name', 'Unknown')
            current = item.get('current_stock', 0)
            reorder = item.get('reorder_level', 0)
            unit = item.get('unit', '')
            
            response += f"{i}. **{name}**: {current}{unit} remaining "
            response += f"(reorder threshold: {reorder}{unit})\n"
        
        if len(low_stock_items) > 5:
            response += f"\n...and {len(low_stock_items) - 5} more items\n"
        
        response += "\n💡 **Recommendation**: Consider placing orders for these items soon to avoid stockouts."
        
        return response
    
    def _format_order_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format order data into natural language"""
        orders = data.get('orders', [])
        
        if not orders:
            return "📭 No orders found matching your query. This could mean all orders are completed or there are no active orders right now."
        
        if entities.get('order_number'):
            # Single order detail
            order = orders[0]
            response = f"📋 **Order Details**\n\n"
            response += f"**Order Number**: {order.get('order_number')}\n"
            response += f"**Status**: {order.get('status', 'Unknown').replace('_', ' ').title()}\n"
            response += f"**Total Amount**: ₹{order.get('total_amount', 0):,.2f}\n"
            
            items = order.get('items', [])
            if items:
                response += f"\n**Items** ({len(items)}):\n"
                for item in items:
                    response += f"• {item.get('name')} × {item.get('quantity')} - ₹{item.get('price', 0):,.2f}\n"
            
            return response
        else:
            # List of orders
            response = f"📦 **Active Orders**\n\n"
            response += f"You have **{len(orders)} active order{'s' if len(orders) != 1 else ''}**:\n\n"
            
            for i, order in enumerate(orders[:5], 1):
                status = order.get('status', 'Unknown').replace('_', ' ').title()
                response += f"{i}. **{order.get('order_number')}** - {status} - ₹{order.get('total_amount', 0):,.2f}\n"
            
            if len(orders) > 5:
                response += f"\n...and {len(orders) - 5} more orders\n"
            
            return response
    
    def _format_menu_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format menu data into natural language"""
        items = data.get('items', [])
        
        if not items:
            item_name = entities.get('item_name')
            if item_name:
                return f"❌ I couldn't find any menu items matching '{item_name}'. Please check the spelling or try a different search term."
            return "📋 Your menu is currently empty. Add items through the Menu Management page to get started."
        
        if len(items) == 1:
            # Single item detail
            item = items[0]
            response = f"🍽️ **{item.get('name')}**\n\n"
            
            if item.get('description'):
                response += f"{item.get('description')}\n\n"
            
            response += f"💰 **Price**: ₹{item.get('price', 0):,.2f}\n"
            response += f"📂 **Category**: {item.get('category_name', 'Uncategorized')}\n"
            
            if item.get('is_available'):
                response += f"✅ **Status**: Available\n"
            else:
                response += f"❌ **Status**: Currently unavailable\n"
            
            return response
        else:
            # List of items
            response = f"📋 **Menu Items**\n\n"
            response += f"I found **{len(items)} item{'s' if len(items) != 1 else ''}** for you:\n\n"
            
            for i, item in enumerate(items[:8], 1):
                available = "✅" if item.get('is_available') else "❌"
                response += f"{i}. {available} **{item.get('name')}** - ₹{item.get('price', 0):,.2f}\n"
            
            if len(items) > 8:
                response += f"\n...and {len(items) - 8} more items\n"
            
            return response
    
    def _format_wastage_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format wastage data into natural language"""
        period = entities.get('period', 'today')
        total_cost = data.get('total_wastage_cost', 0)
        wastage_details = data.get('wastage_details', [])
        
        period_text = period.replace('_', ' ').title()
        
        response = f"📊 **Wastage Report - {period_text}**\n\n"
        
        if total_cost == 0:
            response += "✅ **Excellent!** No wastage recorded for this period. Keep up the good work!"
            return response
        
        response += f"The total wastage cost for this period is **₹{total_cost:,.2f}**.\n\n"
        
        if wastage_details:
            response += "**Top Wastage Items:**\n\n"
            for i, item in enumerate(wastage_details[:5], 1):
                name = item.get('ingredient_name', 'Unknown')
                cost = item.get('cost', 0)
                response += f"{i}. **{name}**: ₹{cost:,.2f}\n"
            
            if len(wastage_details) > 5:
                response += f"\n...and {len(wastage_details) - 5} more items\n"
        
        response += "\n💡 **Tip**: Monitor wastage patterns to identify areas for improvement and reduce costs."
        
        return response
    
    def _format_order_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format order data into natural language"""
        orders = data.get('orders', [])
        
        if not orders:
            return "No orders found matching your query."
        
        if entities.get('order_number'):
            # Single order detail
            order = orders[0]
            response = f"**Order #{order.get('order_number')}**\n\n"
            response += f"Status: {order.get('status', 'Unknown').replace('_', ' ').title()}\n"
            response += f"Total: ₹{order.get('total_amount', 0):,.2f}\n"
            response += f"Items: {len(order.get('items', []))}\n"
            return response
        else:
            # List of orders
            response = f"**Orders** ({len(orders)} found)\n\n"
            for order in orders[:5]:
                status = order.get('status', 'Unknown').replace('_', ' ').title()
                response += f"• #{order.get('order_number')} - {status} - ₹{order.get('total_amount', 0):,.2f}\n"
            
            if len(orders) > 5:
                response += f"\n...and {len(orders) - 5} more orders"
            
            return response
    
    def _format_menu_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format menu data into natural language"""
        items = data.get('items', [])
        
        if not items:
            return "No menu items found."
        
        if len(items) == 1:
            # Single item detail
            item = items[0]
            response = f"**{item.get('name')}**\n\n"
            response += f"💰 Price: ₹{item.get('price', 0):,.2f}\n"
            response += f"📂 Category: {item.get('category_name', 'N/A')}\n"
            response += f"✅ Available: {'Yes' if item.get('is_available') else 'No'}\n"
            if item.get('description'):
                response += f"\n{item.get('description')}"
            return response
        else:
            # List of items
            response = f"**Menu Items** ({len(items)} found)\n\n"
            for item in items[:5]:
                available = "✅" if item.get('is_available') else "❌"
                response += f"{available} {item.get('name')} - ₹{item.get('price', 0):,.2f}\n"
            
            if len(items) > 5:
                response += f"\n...and {len(items) - 5} more items"
            
            return response
    
    def _format_wastage_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format wastage data into natural language"""
        period = entities.get('period', 'today')
        total_cost = data.get('total_wastage_cost', 0)
        wastage_details = data.get('wastage_details', [])
        
        response = f"**Wastage Report ({period.replace('_', ' ').title()})**\n\n"
        response += f"💸 Total Wastage Cost: ₹{total_cost:,.2f}\n\n"
        
        if wastage_details:
            response += "**Top Wastage Items:**\n"
            for item in wastage_details[:5]:
                name = item.get('ingredient_name', 'Unknown')
                cost = item.get('cost', 0)
                response += f"• {name}: ₹{cost:,.2f}\n"
        
        return response
    
    def add_to_conversation(self, conversation_id: str, message: ChatMessage):
        """Add message to conversation history"""
        if conversation_id not in self.conversations:
            self.conversations[conversation_id] = []
        self.conversations[conversation_id].append(message)
    
    def get_conversation(self, conversation_id: str) -> list:
        """Get conversation history"""
        return self.conversations.get(conversation_id, [])


# Singleton instance
_ai_service = None

def get_ai_service() -> AIService:
    """Get or create AIService singleton"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service
