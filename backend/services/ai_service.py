"""
AI Service for Ask-AI Chatbot
Handles LLM integration, intent classification, and response generation
"""

import json
import re
import os
import logging
from typing import Dict, Any, Optional, Tuple, List
from datetime import datetime, timedelta
from services.schema_context import get_schema_context, get_api_endpoints_context
from schemas.ai_schemas import Intent, ChatMessage
from config import settings

logger = logging.getLogger(__name__)

class AIService:
    """
    Production-grade AI service for POS chatbot.
    
    Uses a 3-Layer Ensemble NLP Pipeline for intent classification:
      Layer 1: TF-IDF + SVM (scikit-learn) — fast trained classifier
      Layer 2: Semantic Embeddings (sentence-transformers) — deep understanding
      Layer 3: LLM Fallback (Groq Llama 3.3 70B) — ultimate fallback
    
    Falls back to rule-based classification if ensemble models are not trained.
    """
    
    def __init__(self):
        self.schema_context = get_schema_context()
        self.api_context = get_api_endpoints_context()
        self.conversations: Dict[str, list] = {}
        # ── Pending Action State (for follow-up flows) ──
        # Stores pending actions per conversation_id so follow-up messages
        # like "100" after "Change price of coke" are resolved instantly
        self.pending_actions: Dict[str, Dict[str, Any]] = {}
        
        # ── Initialize Ensemble NLP Classifier ──
        self.ensemble_classifier = None
        try:
            from services.ensemble_classifier import get_ensemble_classifier
            self.ensemble_classifier = get_ensemble_classifier()
            if self.ensemble_classifier.is_trained:
                logger.info("✅ Ensemble NLP Classifier loaded (SVM + Embeddings)")
            else:
                logger.warning("⚠️ Ensemble models not trained — using rule-based fallback. Run: python train_ensemble.py")
        except Exception as e:
            logger.warning(f"Ensemble classifier not available: {e}")
        
        # Initialize AI Provider - prefer Groq for production speed
        self.provider = getattr(settings, 'AI_PROVIDER', 'groq').lower()
        self.llm_service = None
        
        try:
            if self.provider == 'groq':
                from services.groq_service import get_groq_service
                logger.info("Initializing Groq AI Service...")
                self.llm_service = get_groq_service()
            else:
                from services.ollama_service import get_ollama_service
                logger.info("Initializing Ollama AI Service...")
                self.llm_service = get_ollama_service()
                
            self.use_llm = self.llm_service is not None and getattr(self.llm_service, 'client', None) is not None
        except Exception as e:
            logger.error(f"AI Service ({self.provider}) not available: {e}")
            self.llm_service = None
            self.use_llm = False
            
    
    def classify_intent(self, message: str) -> Intent:
        """
        Classify user intent using the 3-Layer Ensemble NLP Pipeline.
        
        Pipeline:
          1. Ensemble Classifier (SVM + Embeddings) — runs first (<15ms)
          2. If ensemble is confident → extract entities via rule-based helpers
          3. If ensemble is unsure → fallback to LLM (Groq Llama 3.3 70B)
          4. If ensemble not trained → fallback to legacy rule-based classifier
        """
        
        # ── Layer 1+2: Ensemble Classification (SVM + Embeddings) ──
        if self.ensemble_classifier and self.ensemble_classifier.is_trained:
            ensemble_result = self.ensemble_classifier.classify(message)
            
            if ensemble_result["method"] != "llm_required":
                # Ensemble is confident — use its result
                intent_type = ensemble_result["intent"]
                confidence = ensemble_result["confidence"]
                method = ensemble_result["method"]
                
                # Extract entities using rule-based helpers
                entities = self._extract_entities(message, intent_type)
                
                logger.info(f"[Ensemble {method}]: {intent_type} ({confidence:.2f})")
                logger.info(f"   SVM: {ensemble_result['svm_result']} | EMB: {ensemble_result['embedding_result']}")
                
                return Intent(
                    intent_type=intent_type,
                    confidence=confidence,
                    entities=entities,
                    needs_data=intent_type != 'general'
                )
            else:
                logger.info("Ensemble unsure, escalating to LLM...")
        else:
            # Ensemble not trained — try legacy rule-based first
            intent = self._rule_based_classification(message)
            if intent.intent_type != 'general' and intent.confidence > 0.6:
                logger.info(f"Rule-based match: {intent.intent_type}")
                return intent
        
        # ── Layer 3: LLM Fallback (Groq Llama 3.3 70B) ──
        if self.use_llm and self.llm_service:
            try:
                logger.info("LLM classification (Layer 3)...")
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
        
        # ── Ultimate Fallback: Rule-based ──
        return self._rule_based_classification(message)
    
    def _extract_entities(self, message: str, intent_type: str) -> Dict[str, Any]:
        """
        Extract relevant entities from the message based on the classified intent.
        Uses rule-based extraction helpers (time period, order number, item name, etc.)
        """
        message_lower = message.lower()
        entities = {}
        
        if intent_type in ("sales_query", "wastage_query"):
            entities = self._extract_time_period(message_lower)
        elif intent_type == "revenue_intel":
            entities = self._extract_time_period(message_lower)
            # Detect revenue intel sub-type
            entities['query_sub_type'] = (
                "margins" if "margin" in message_lower else
                "profitability" if "profit" in message_lower else
                "velocity" if "velocity" in message_lower or "popular" in message_lower or "bcg" in message_lower else
                "combos" if "combo" in message_lower else
                "upsells" if "upsell" in message_lower else
                "pricing" if "price" in message_lower or "optimiz" in message_lower else
                "inventory_signals" if "risk" in message_lower or "signal" in message_lower else
                "full_report"
            )
        elif intent_type == "order_status":
            order_number = self._extract_order_number(message)
            if order_number:
                entities["order_number"] = order_number
        elif intent_type == "menu_info":
            item_name = self._extract_item_name(message)
            if item_name:
                entities["item_name"] = item_name
        elif intent_type == "create_order":
            entities = self._extract_order_items(message)
        elif intent_type == "update_menu_item":
            entities = self._extract_menu_update_entities(message)
        elif intent_type == "add_menu_item":
            entities = self._extract_menu_add_entities(message)
        elif intent_type == "delete_menu_item":
            entities = self._extract_menu_delete_entities(message)
        elif intent_type == "multi_operation":
            # Multi-op doesn't need entity extraction here — handled separately
            entities = {}
        elif intent_type == "generate_report":
            entities = self._extract_report_entities(message_lower)
        
        return entities
    
    def _rule_based_classification(self, message: str) -> Intent:
        """Rule-based intent classification (fallback)"""
        message_lower = message.lower()
        
        # Detect analytical/query keywords — these mean the user is ASKING, not ORDERING
        is_analytical = any(word in message_lower for word in [
            'total', 'how many', 'how much', 'count', 'compare', 'trend',
            'average', 'best selling', 'top selling', 'peak', 'report',
            'this week', 'this month', 'today', 'yesterday', 'last week',
            'last month', 'summary', 'analysis', 'insight', 'performance',
            'growth', 'forecast', 'profit', 'loss', 'aov', 'daily'
        ])
        
        # 0. Report Generation (HIGHEST PRIORITY — "generate report", "download report")
        report_keywords = ['generate report', 'download report', 'create report',
                          'sales report', 'monthly report', 'weekly report', 'daily report',
                          'export report', 'print report', 'make report',
                          'report download', 'report generate', 'report banao',
                          'report chahiye', 'report do', 'give me report',
                          'show report', 'prepare report']
        if any(word in message_lower for word in report_keywords):
            entities = self._extract_report_entities(message_lower)
            return Intent(
                intent_type="generate_report",
                confidence=0.96,
                entities=entities,
                needs_data=True
            )

        # 1. Revenue Intelligence / Menu Optimization (NEW HERO FEATURE - PRIORITIZE)
        intel_keywords = ['margin', 'profitability', 'popular', 'velocity', 'combo', 'upsell', 'price optimization', 'hidden gem', 'bcg', 'risk', 'food cost']
        if any(word in message_lower for word in intel_keywords):
            entities = self._extract_time_period(message_lower)
            # Detect sub-type
            entities['query_sub_type'] = (
                "margins" if "margin" in message_lower else
                "profitability" if "profit" in message_lower else
                "velocity" if "velocity" in message_lower or "popular" in message_lower or "bcg" in message_lower else
                "combos" if "combo" in message_lower else
                "upsells" if "upsell" in message_lower else
                "pricing" if "price" in message_lower or "optimiz" in message_lower else
                "inventory_signals" if "risk" in message_lower or "signal" in message_lower else
                "full_report"
            )
            return Intent(
                intent_type="revenue_intel",
                confidence=0.95,
                entities=entities,
                needs_data=True
            )

        # 2. Sales / analytics queries
        sales_keywords = ['sales', 'revenue', 'earning', 'income', 'total order',
                         'how many order', 'order count', 'best selling', 'top selling',
                         'peak hour', 'aov', 'average order', 'compare', 'trend',
                         'performance', 'growth', 'forecast', 'profit']
        if any(word in message_lower for word in sales_keywords) or \
           (is_analytical and 'order' in message_lower):
            entities = self._extract_time_period(message_lower)
            return Intent(
                intent_type="sales_query",
                confidence=0.9,
                entities=entities,
                needs_data=True
            )

        # 3. Inventory queries (including expiry)
        if any(word in message_lower for word in ['stock', 'inventory', 'ingredient', 'low stock', 'reorder', 'expiry', 'expiring', 'expire', 'shelf life', 'expiration']):
            return Intent(
                intent_type="inventory_query",
                confidence=0.9,
                entities={},
                needs_data=True
            )
        
        # 3. Menu Management — UPDATE (price/availability changes)
        update_keywords = ['change price', 'update price', 'set price', 'modify price',
                          'increase price', 'reduce price', 'make price', 'price change',
                          'price badha', 'price kam', 'price update', 'price karo',
                          'rate change', 'rate badha', 'rate kar do',
                          'make unavailable', 'make available', 'mark available',
                          'mark unavailable', 'out of stock', 'disable', 'enable']
        if any(word in message_lower for word in update_keywords):
            entities = self._extract_menu_update_entities(message)
            return Intent(
                intent_type="update_menu_item",
                confidence=0.92,
                entities=entities,
                needs_data=True
            )
        
        # 4. Menu Management — DELETE (remove items)
        delete_keywords = ['remove from menu', 'delete item', 'take off menu',
                          'remove item', 'hatao', 'hata do', 'nikal do',
                          'drop from menu', 'get rid of']
        if any(word in message_lower for word in delete_keywords):
            entities = self._extract_menu_delete_entities(message)
            return Intent(
                intent_type="delete_menu_item",
                confidence=0.92,
                entities=entities,
                needs_data=True
            )
        
        # 5. Menu Management — ADD (new items)
        add_keywords = ['add new item', 'add item', 'new dish', 'create dish',
                       'put on menu', 'naya item', 'daal do menu', 'add to menu',
                       'add menu item', 'new menu item']
        if any(word in message_lower for word in add_keywords):
            entities = self._extract_menu_add_entities(message)
            return Intent(
                intent_type="add_menu_item",
                confidence=0.92,
                entities=entities,
                needs_data=True
            )
        
        # 5.5 Multi-Operation Detection (compound commands)
        if self._detect_multi_operation(message_lower):
            return Intent(
                intent_type="multi_operation",
                confidence=0.93,
                entities={},
                needs_data=True
            )
        
        # 6. Order creation (ACTION) — only if NOT analytical
        if not is_analytical and any(word in message_lower for word in ['add', 'order', 'i want', 'get me', 'place order']):
            entities = self._extract_order_items(message)
            if entities.get('items'):
                return Intent(
                    intent_type="create_order",
                    confidence=0.9,
                    entities=entities,
                    needs_data=True
                )
        
        # 7. Order status
        if any(word in message_lower for word in ['order status', 'pending', 'kot', 'kitchen', 'active order']):
            order_number = self._extract_order_number(message)
            return Intent(
                intent_type="order_status",
                confidence=0.85,
                entities={"order_number": order_number} if order_number else {},
                needs_data=True
            )
        
        # 8. Menu queries (read-only)
        if any(word in message_lower for word in ['menu', 'dish', 'price', 'available']):
            item_name = self._extract_item_name(message)
            return Intent(
                intent_type="menu_info",
                confidence=0.8,
                entities={"item_name": item_name} if item_name else {},
                needs_data=True
            )
        
        # 9. Wastage queries
        if any(word in message_lower for word in ['wastage', 'waste', 'damaged']):
            entities = self._extract_time_period(message_lower)
            return Intent(
                intent_type="wastage_query",
                confidence=0.85,
                entities=entities,
                needs_data=True
            )
        
        # 10. General/greeting
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
            # Smart defaults based on query content
            best_seller_keywords = ['best', 'top', 'popular', 'trending', 'most', 'moving', 'famous', 'specialty']
            if any(word in message for word in best_seller_keywords):
                entities['period'] = 'last_30_days'
                entities['days'] = 30
                logger.info("Smart Default: Using 30-day range for best-seller query")
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
    
    def _extract_menu_update_entities(self, message: str) -> Dict[str, Any]:
        """
        Extract entities for menu item update: item name, new price, availability.
        Handles patterns like:
        - "Change burger price to 250" → item=burger, new_price=250
        - "Update price of dosa" → item=dosa, new_price=None (follow-up needed)
        - "Make pizza unavailable" → item=pizza, availability=False
        """
        import re
        message_lower = message.lower()
        entities = {}
        
        # Extract price — multiple patterns
        price_patterns = [
            r'(?:to|at|for|=)\s*₹?\s*(\d+(?:\.\d{1,2})?)',           # "to 250", "at ₹300"
            r'₹\s*(\d+(?:\.\d{1,2})?)',                               # "₹250"
            r'(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|rupaiye)',       # "250 rupees"
            r'price\s+(?:is\s+|=\s*)?(\d+(?:\.\d{1,2})?)',           # "price 250"
            r'(\d+(?:\.\d{1,2})?)\s*(?:mein|me|kar\s*do|karo)',      # "250 mein" (Hindi)
            r'from\s+\d+\s+to\s+(\d+(?:\.\d{1,2})?)',               # "from 200 to 300"
        ]
        for pattern in price_patterns:
            match = re.search(pattern, message_lower)
            if match:
                entities['new_price'] = float(match.group(1))
                break
        
        # Extract availability intent
        if any(w in message_lower for w in ['unavailable', 'out of stock', 'disable', 'turn off', 'band karo', 'hatao']):
            entities['availability'] = False
        elif any(w in message_lower for w in ['available again', 'enable', 'turn on', 'mark available', 'chalu karo']):
            entities['availability'] = True
        
        # Extract item name — remove action words and price to get the item
        cleaned = re.sub(
            r'\b(change|update|set|modify|increase|reduce|make|mark|the|price|of|to|at|for|from|'
            r'cost|rate|rupees?|rs\.?|mein|karo|kar\s*do|badha\s*do|kam\s*karo|ki|ka|'
            r'unavailable|available|out\s*of\s*stock|disable|enable|turn\s*off|turn\s*on|again|'
            r'item|menu|please|can\s*you|i\s*want|i\s*need)\b',
            '', message, flags=re.IGNORECASE
        )
        # Remove numbers (prices already extracted)
        cleaned = re.sub(r'₹?\d+(?:\.\d{1,2})?', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        if cleaned and len(cleaned) > 1:
            entities['item_name'] = cleaned
        
        return entities
    
    def _extract_menu_add_entities(self, message: str) -> Dict[str, Any]:
        """
        Extract entities for adding a new menu item: name, price, category,
        description, and preparation_time.
        
        Handles:
        - "Add paneer tikka at 280 in starters"
        - "Add grilled sandwich at 180, a crispy cheese sandwich, takes 10 min"
        - "Paneer Wrap, 220, Starters, Grilled paneer in a tortilla wrap, 12 min"
        """
        import re
        message_lower = message.lower()
        entities = {}
        
        # Extract price
        price_patterns = [
            r'(?:at|for|@|price|=)\s*₹?\s*(\d+(?:\.\d{1,2})?)',
            r'₹\s*(\d+(?:\.\d{1,2})?)',
            r'(\d+(?:\.\d{1,2})?)\s*(?:rupees?|rs\.?|rupaiye)',
            r'(\d+(?:\.\d{1,2})?)\s*(?:mein|me)',
        ]
        for pattern in price_patterns:
            match = re.search(pattern, message_lower)
            if match:
                entities['price'] = float(match.group(1))
                break
        
        # Extract preparation time ("takes 10 min", "15 minutes", "prep time 20")
        prep_patterns = [
            r'(?:takes?|prep(?:aration)?\s*(?:time)?|ready\s*in)\s*(\d+)\s*(?:min|minutes?|mins?)',
            r'(\d+)\s*(?:min|minutes?)\s*(?:to\s*prepare|prep)',
        ]
        for pattern in prep_patterns:
            match = re.search(pattern, message_lower)
            if match:
                entities['preparation_time'] = int(match.group(1))
                break
        
        # Extract category ("in starters", "under desserts", "to beverages")
        cat_match = re.search(r'(?:in|under|to|category)\s+([a-z\s]+?)(?:\s+at|\s+for|\s*,|$)', message_lower)
        if cat_match:
            cat = cat_match.group(1).strip()
            # Filter out non-category words
            non_cat_words = ['menu', 'the', 'my', 'our', 'restaurant', 'item', 'new']
            if cat and cat not in non_cat_words and len(cat) > 2:
                entities['category'] = cat
        
        # Extract description — look for text after a comma that isn't price/category/prep time
        # Pattern: name at/for price [in category], description [, takes N min]
        desc_match = re.search(
            r'(?:,\s*)((?!\d+\s*(?:rupees?|rs|min|minutes?))(?!in\s|under\s|takes?\s)[a-zA-Z].{5,80}?)(?:\s*,|\s*$)',
            message
        )
        if desc_match:
            desc = desc_match.group(1).strip()
            # Exclude if it's just numbers or prep-time-like
            if desc and not re.match(r'^\d+', desc) and 'min' not in desc.lower()[:10]:
                entities['description'] = desc
        
        # Extract item name — remove action words, price, and category
        cleaned = re.sub(
            r'\b(add|create|put|new|item|dish|called|named|menu|to|the|a|an|in|under|'
            r'at|for|please|i\s*want|can\s*you|mein|daal\s*do|karo|naya|chahiye|ek)\b',
            '', message, flags=re.IGNORECASE
        )
        # Remove price and category we already extracted
        cleaned = re.sub(r'₹?\d+(?:\.\d{1,2})?', '', cleaned)
        cleaned = re.sub(r'\b(?:rupees?|rs\.?|rupaiye)\b', '', cleaned, flags=re.IGNORECASE)
        # Remove prep time text
        cleaned = re.sub(r'(?:takes?|prep(?:aration)?\s*time?)\s*\d+\s*(?:min|minutes?|mins?)', '', cleaned, flags=re.IGNORECASE)
        cleaned = re.sub(r'\d+\s*(?:min|minutes?)\s*(?:to\s*prepare|prep)', '', cleaned, flags=re.IGNORECASE)
        if entities.get('category'):
            cleaned = re.sub(re.escape(entities['category']), '', cleaned, flags=re.IGNORECASE)
        if entities.get('description'):
            cleaned = cleaned.replace(entities['description'], '')
        cleaned = re.sub(r'[,:;!?]', '', cleaned)
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        if cleaned and len(cleaned) > 1:
            entities['item_name'] = cleaned
        
        return entities
    
    def _extract_menu_delete_entities(self, message: str) -> Dict[str, Any]:
        """
        Extract item name from delete/remove command.
        Handles: "Remove cold coffee from menu", "Delete samosa"
        """
        import re
        entities = {}
        
        cleaned = re.sub(
            r'\b(remove|delete|take|off|drop|get\s*rid\s*of|the|from|menu|item|'
            r'hatao|hata\s*do|nikal\s*do|menu\s*se|se|ye|please|can\s*you|i\s*want\s*to)\b',
            '', message, flags=re.IGNORECASE
        )
        cleaned = re.sub(r'\s+', ' ', cleaned).strip()
        
        if cleaned and len(cleaned) > 1:
            entities['item_name'] = cleaned
        
        return entities
    
    def _extract_report_entities(self, message: str) -> Dict[str, Any]:
        """
        Extract report type and period from generate_report messages.
        Handles: "Generate monthly sales report", "Daily report", "Weekly sales report download"
        """
        entities = {}
        message_lower = message.lower() if not message.islower() else message
        
        # Detect report type
        if any(w in message_lower for w in ['daily', 'today', "today's"]):
            entities['report_type'] = 'daily'
            entities['days'] = 1
        elif any(w in message_lower for w in ['weekly', 'week', 'last 7', '7 day']):
            entities['report_type'] = 'weekly'
            entities['days'] = 7
        elif any(w in message_lower for w in ['quarterly', 'quarter', 'last 3 month', '3 month', '90 day']):
            entities['report_type'] = 'quarterly'
            entities['days'] = 90
        else:
            # Default: monthly
            entities['report_type'] = 'monthly'
            entities['days'] = 30
        
        # Check for custom day count (e.g., "last 14 days report")
        import re
        day_match = re.search(r'last\s+(\d+)\s+day', message_lower)
        if day_match:
            entities['days'] = int(day_match.group(1))
            entities['report_type'] = 'custom'
        
        return entities
    
    def _format_report_response(self, data: Dict[str, Any]) -> str:
        """Format the generate_report result into a polished, comprehensive natural language summary."""
        if not data or not data.get('kpis'):
            return "I couldn't generate the report. Please try again."
        
        meta = data.get('meta', {})
        kpis = data['kpis']
        comparison = data.get('comparison', {})
        top_items = data.get('top_items', [])
        bottom_items = data.get('bottom_items', [])
        order_types = data.get('order_types', [])
        order_sources = data.get('order_sources', [])
        payment_modes = data.get('payment_modes', [])
        category_breakdown = data.get('category_breakdown', [])
        insights = data.get('insights', [])
        stats = data.get('statistics', {})
        best_day = data.get('best_day')
        worst_day = data.get('worst_day')
        busiest_dow = data.get('busiest_dow')
        peak_hour = data.get('peak_hour')
        lunch_vs_dinner = data.get('lunch_vs_dinner', {})
        download_url = data.get('report_download_url')
        
        report_label = meta.get('report_label', 'Sales Report')
        period_days = meta.get('days', 30)
        
        # Revenue change arrow
        rev_change = comparison.get('revenue_change_pct', 0)
        rev_arrow = "📈" if rev_change >= 0 else "📉"
        ord_change = comparison.get('orders_change_pct', 0)
        aov_change = comparison.get('aov_change_pct', 0)
        
        response = f"## 📊 {report_label}\n\n"
        
        # ── AI Insights (top highlights) ──
        if insights:
            response += "### 💡 Key Insights\n"
            for insight in insights:
                response += f"{insight}\n"
            response += "\n"
        
        # ── KPI Dashboard ──
        response += "### 📋 KPI Dashboard\n"
        response += f"| Metric | Value | vs Previous Period |\n"
        response += f"|--------|-------|-------------------|\n"
        response += f"| 💰 Total Revenue | **₹{kpis['total_revenue']:,.2f}** | {rev_arrow} {rev_change:+.1f}% |\n"
        response += f"| 🛒 Total Orders | **{kpis['total_orders']:,}** | {'+' if ord_change >=0 else ''}{ord_change:.1f}% |\n"
        response += f"| 🎯 Avg Order Value | **₹{kpis['avg_order_value']:,.2f}** | {aov_change:+.1f}% |\n"
        response += f"| 📦 Items Sold | **{kpis.get('total_items_sold', 0):,}** ({kpis.get('unique_items_sold', 0)} unique) | — |\n"
        response += f"| ❌ Cancellations | **{kpis['cancelled_orders']}** ({kpis['cancellation_rate']}%) | — |\n\n"
        
        # ── Statistical Summary ──
        if stats:
            response += "### 📐 Statistical Summary\n"
            response += f"| Metric | Value |\n"
            response += f"|--------|-------|\n"
            response += f"| Daily Avg Revenue | ₹{stats.get('daily_avg_revenue', 0):,.2f} |\n"
            response += f"| Daily Avg Orders | {stats.get('daily_avg_orders', 0):.0f} |\n"
            response += f"| Median Order | ₹{stats.get('median_order', 0):,.2f} |\n"
            response += f"| Order Range | ₹{stats.get('min_order', 0):,.0f} — ₹{stats.get('max_order', 0):,.0f} |\n"
            if stats.get('std_dev'):
                response += f"| Std Deviation | ₹{stats['std_dev']:,.2f} |\n"
            response += "\n"
        
        # ── Top Selling Items ──
        if top_items:
            response += "### 🏆 Top Selling Items\n"
            response += f"| # | Item | Qty | Revenue | Share |\n"
            response += f"|---|------|-----|---------|-------|\n"
            medals = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"]
            for i, item in enumerate(top_items[:10], 0):
                medal = medals[i] if i < len(medals) else str(i+1)
                response += f"| {medal} | **{item['name']}** | {item['qty']} | ₹{item['revenue']:,.0f} | {item['pct']}% |\n"
            response += "\n"
        
        # ── Category Performance ──
        if category_breakdown and len(category_breakdown) > 1:
            response += "### 📂 Category Performance\n"
            for cat in category_breakdown:
                response += f"• **{cat['category']}**: {cat['qty']} items sold — ₹{cat['revenue']:,.0f} ({cat['pct']}%)\n"
            response += "\n"
        
        # ── Peak Hours & Day Analysis ──
        timing_parts = []
        if peak_hour:
            timing_parts.append(f"⏰ **Peak Hour**: {peak_hour.get('display', '')} — {peak_hour.get('orders', 0)} orders ({peak_hour.get('pct_orders', 0)}% of total)")
        if busiest_dow:
            timing_parts.append(f"🗓️ **Busiest Day**: {busiest_dow.get('day', '')} — avg ₹{busiest_dow.get('avg_revenue', 0):,.0f}/day")
        if best_day:
            timing_parts.append(f"📈 **Best Day**: {best_day.get('day_full', '')} {best_day.get('date', '')} — ₹{best_day.get('revenue', 0):,.0f}")
        if worst_day and worst_day != best_day:
            timing_parts.append(f"📉 **Slowest Day**: {worst_day.get('day_full', '')} {worst_day.get('date', '')} — ₹{worst_day.get('revenue', 0):,.0f}")
        lunch = lunch_vs_dinner.get('lunch', 0)
        dinner = lunch_vs_dinner.get('dinner', 0)
        if lunch and dinner:
            dominant = "🍽️ Lunch" if lunch > dinner else "🌙 Dinner"
            timing_parts.append(f"**{dominant} dominates**: Lunch {lunch} orders vs Dinner {dinner} orders")
        
        if timing_parts:
            response += "### ⏰ Timing Analysis\n"
            for part in timing_parts:
                response += f"{part}\n"
            response += "\n"
        
        # ── Order Types ──
        if order_types:
            response += "### 📦 Order Types\n"
            for ot in order_types:
                response += f"• **{ot['type']}**: {ot['count']} orders ({ot['pct']}%) — ₹{ot['revenue']:,.0f} | AOV ₹{ot.get('aov', 0):,.0f}\n"
            response += "\n"
        
        # ── Order Sources ──
        if order_sources and len(order_sources) > 1:
            response += "### 📱 Order Sources\n"
            for src in order_sources:
                response += f"• **{src['source']}**: {src['count']} orders ({src['pct']}%) — ₹{src['revenue']:,.0f}\n"
            response += "\n"
        
        # ── Payment Modes ──
        if payment_modes:
            response += "### 💳 Payment Modes\n"
            for pm in payment_modes:
                response += f"• **{pm['mode']}**: {pm['count']} transactions ({pm['pct']}%) — ₹{pm['amount']:,.0f}\n"
            response += "\n"
        
        # ── Financial Breakdown ──
        response += "### 💵 Financial Breakdown\n"
        response += f"| Component | Amount |\n"
        response += f"|-----------|--------|\n"
        response += f"| Subtotal | ₹{kpis['total_subtotal']:,.2f} |\n"
        response += f"| GST | ₹{kpis['total_gst']:,.2f} |\n"
        response += f"| Discounts | ₹{kpis['total_discount']:,.2f} |\n"
        response += f"| **Net Revenue** | **₹{kpis['total_revenue']:,.2f}** |\n\n"
        
        # ── Period Comparison ──
        if comparison.get('prev_revenue', 0) > 0:
            response += "### 📊 Period-over-Period Comparison\n"
            response += f"| Metric | Current | Previous | Change |\n"
            response += f"|--------|---------|----------|--------|\n"
            response += f"| Revenue | ₹{kpis['total_revenue']:,.0f} | ₹{comparison['prev_revenue']:,.0f} | {rev_change:+.1f}% |\n"
            response += f"| Orders | {kpis['total_orders']} | {comparison['prev_orders']} | {ord_change:+.1f}% |\n"
            response += f"| AOV | ₹{kpis['avg_order_value']:,.0f} | ₹{comparison['prev_aov']:,.0f} | {aov_change:+.1f}% |\n\n"
        
        # ── Download link ──
        if download_url:
            response += "📥 **The full PDF report with charts & analytics is ready for download below.**\n"
        
        return response
    


    def generate_response(
        self, 
        message: str, 
        intent: Intent, 
        data: Optional[Dict[str, Any]] = None,
        conversation_id: Optional[str] = None
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        Generate natural language response using Groq LLM (with template fallback).
        Parses embedded __chart__ blocks from LLM output.
        Returns: (response_text, chart_data)
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
                    # Parse embedded chart data from LLM response
                    response_text, chart_data = self._parse_chart_from_response(llm_response)
                    # Also check if query engine returned chart_data
                    if not chart_data and data and isinstance(data, dict):
                        chart_data = data.get('chart_data')
                    return response_text, chart_data
            except Exception as e:
                logger.error(f"LLM response generation failed, using template-based: {e}")
        
        # Fallback to template-based responses
        return self._template_based_response(message, intent, data)
    
    def _parse_chart_from_response(self, response: str) -> Tuple[str, Optional[Dict[str, Any]]]:
        """
        Extract __chart__{...}__chart__ blocks from LLM response.
        Returns: (cleaned_text, chart_data_dict)
        """
        chart_data = None
        chart_pattern = r'__chart__(.+?)__chart__'
        match = re.search(chart_pattern, response, re.DOTALL)
        
        if match:
            try:
                raw_json = match.group(1).strip()
                chart_data = json.loads(raw_json)
                if 'type' in chart_data and 'data' in chart_data:
                    logger.info(f"Parsed chart from LLM: type={chart_data['type']}, {len(chart_data['data'])} points")
                else:
                    chart_data = None
            except (json.JSONDecodeError, KeyError) as e:
                logger.warning(f"Failed to parse chart JSON from LLM: {e}")
                chart_data = None
            
            # Remove the chart block from the visible text
            response = re.sub(chart_pattern, '', response, flags=re.DOTALL).strip()
            response = re.sub(r'```\s*$', '', response).strip()
        
        return response, chart_data
    
    
    def _template_based_response(
        self,
        message: str,
        intent: Intent,
        data: Optional[Dict[str, Any]] = None
    ) -> Tuple[str, Optional[Dict[str, Any]]]:
        """Template-based response generation (fallback)"""
        
        # Handle general/greeting
        if intent.intent_type == "general":
            return self._handle_general(message), None
        
        # Handle action-based intents (menu management + order creation)
        if intent.intent_type == "create_order":
            return self._format_create_order_response(data), None
        if intent.intent_type in ("update_menu_item", "add_menu_item", "delete_menu_item"):
            return self._format_menu_action_response(data, intent.intent_type), None
        
        # If no data provided, return error
        if not data:
            return "I couldn't fetch the data for your query. Please try again or rephrase your question.", None
        
        # Prepare chart data from query result if available
        chart_data = data.get('chart_data')

        # Generate response based on intent type
        response_text = ""
        if intent.intent_type == "sales_query":
            response_text = self._format_sales_response(data, intent.entities, message)
        elif intent.intent_type == "inventory_query":
            response_text = self._format_inventory_response(data)
        elif intent.intent_type == "order_status":
            response_text = self._format_order_response(data, intent.entities)
        elif intent.intent_type == "menu_info":
            response_text = self._format_menu_response(data, intent.entities)
        elif intent.intent_type == "wastage_query":
            response_text = self._format_wastage_response(data, intent.entities)
        elif intent.intent_type == "revenue_intel":
            response_text = self._format_revenue_intel_response(data, intent.entities)
        elif intent.intent_type == "generate_report":
            response_text = self._format_report_response(data)
            chart_data = data.get('chart_data')  # Override chart_data with report charts
        else:
            response_text = "I understood your question but I'm not sure how to answer it yet. Can you try rephrasing?"
            
        return response_text, chart_data
    
    
    def _handle_general(self, message: str) -> str:
        """Handle general messages and greetings"""
        message_lower = message.lower()
        
        if any(word in message_lower for word in ['hello', 'hi', 'hey']):
            return "Hello! I'm your POS assistant. I can help you with sales reports, inventory tracking, order management, menu information, and **real-time menu management** — change prices, add items, or remove items just by telling me! What would you like to do?"
        
        if any(word in message_lower for word in ['help', 'what can you do']):
            return """I can help you with:
- 📊 **Sales reports** — "What are today's sales?", "Compare this week vs last week"
- 📦 **Inventory & expiry tracking** — "Which items are expiring soon?", "Show low stock items"
- 🛒 **Order tracking** — "Show me pending orders"
- 🍽️ **Menu information** — "What's the price of burger?"
- 🗑️ **Wastage analysis** — "How much wastage this week?"
- ✏️ **Update menu prices** — "Change burger price to 300", "Update price of dosa"
- ➕ **Add new items** — "Add paneer wrap at 220 in starters"
- ❌ **Remove items** — "Remove cold coffee from menu"

Just ask me a question or tell me what to do!"""
        
        return "I'm here to help! You can ask me about sales, inventory, orders, or menu — or tell me to **change prices, add items, or remove items** from your menu."
    
    def _format_menu_action_response(self, data: Dict[str, Any], intent_type: str) -> str:
        """Format response for menu management actions (update/add/delete)"""
        if not data:
            return "I couldn't process that menu operation. Please try again."
        
        # If the action engine returned a message, use it directly (it's already formatted)
        if data.get('message'):
            return data['message']
        
        # Fallback formatting
        if not data.get('success'):
            error = data.get('error', 'Unknown error')
            suggestions = data.get('suggestions', [])
            response = f"❌ **Error**: {error}"
            if suggestions:
                response += f"\n\n💡 Did you mean: {', '.join(suggestions)}?"
            return response
        
        return "✅ Menu operation completed successfully."
    
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
    
    def _format_sales_response(self, data: Dict[str, Any], entities: Dict[str, Any], message: str = "") -> str:
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
            response += "Orders will start appearing here once customers place them through your POS system.\n\n"
            
            # Smart fallback: mention historical context if available
            last_30 = data.get('last_30_days', {})
            yesterday = data.get('yesterday', {})
            
            if last_30.get('revenue', 0) > 0:
                response += f"💡 **Historical Context**: Over the last 30 days, your business has generated **₹{last_30['revenue']:,.2f}** from **{last_30['orders']} orders**. "
                
                # If we have a top item in the history summaries
                history = data.get('daily_history', [])
                if history:
                    # Find the most frequent top item in the last 14 days
                    top_items = [h.get('top_item') for h in history if h.get('top_item')]
                    if top_items:
                        from collections import Counter
                        most_common = Counter(top_items).most_common(1)[0][0]
                        response += f"Your most consistent top-selling product is often the **{most_common}**.\n\n"
                
                response += "Would you like me to show you the full analytics for the last 30 days instead?"
        else:
            response += f"📊 **Sales Summary**\n\n"
            response += f"You've processed **{total_orders} order{'s' if total_orders != 1 else ''}** "
            response += f"with a total revenue of **₹{total_revenue:,.2f}**.\n\n"
            
            response += f"💰 **Revenue**: ₹{total_revenue:,.2f}\n"
            response += f"📦 **Orders**: {total_orders}\n"
            response += f"📈 **Average Order Value**: ₹{avg_order_value:,.2f}\n\n"
            
            # Add highlights if this is a "best seller" focused query
            best_seller_all_time = data.get('best_selling_item_all_time')
            is_best_seller_query = any(word in message.lower() for word in ['best', 'top', 'popular', 'trending', 'most', 'moving'])
            
            if is_best_seller_query and best_seller_all_time:
                response += f"🏆 **Top Performer**: Based on your 30-day history, the **{best_seller_all_time}** is your most popular item!\n\n"
            elif is_best_seller_query:
                 # Fallback to manual calculation if explicit field missing
                 history = data.get('daily_history', [])
                 if history:
                    top_items = [h.get('top_item') for h in history if h.get('top_item')]
                    if top_items:
                        from collections import Counter
                        most_common = Counter(top_items).most_common(1)[0][0]
                        response += f"🏆 **Top Performer**: The **{most_common}** continues to be your most popular choice recently.\n\n"

            # Add general insights
            if avg_order_value > 500:
                response += "✨ Great job! Your average order value is quite healthy."
            elif avg_order_value > 300:
                response += "👍 Your average order value looks good."
            else:
                response += "💡 Tip: Consider upselling to increase your average order value."
        
        return response
    
    def _format_inventory_response(self, data: Dict[str, Any]) -> str:
        """Format inventory data into natural language (low stock + expiry)"""
        low_stock_items = data.get('low_stock_items', [])
        expired_items = data.get('expired_items', [])
        expiring_soon = data.get('expiring_soon_items', [])
        risk_value = data.get('total_expiry_risk_value', 0)
        
        parts = []
        
        # Expired items
        if expired_items:
            section = f"🔴 **Expired Items ({len(expired_items)})**\n\n"
            for i, item in enumerate(expired_items[:5], 1):
                section += f"{i}. **{item['name']}**: expired {abs(item['days_until_expiry'])} days ago "
                section += f"({item['current_stock']} {item['unit']} @ ₹{item['cost_per_unit']:,.2f}/unit — ₹{item['risk_value']:,.2f} at risk)\n"
            parts.append(section)
        
        # Expiring soon
        if expiring_soon:
            section = f"🟠 **Expiring Within 7 Days ({len(expiring_soon)})**\n\n"
            for i, item in enumerate(expiring_soon[:5], 1):
                section += f"{i}. **{item['name']}**: {item['days_until_expiry']} day(s) left — expires {item['expiry_date']} "
                section += f"({item['current_stock']} {item['unit']} — ₹{item['risk_value']:,.2f} at risk)\n"
            parts.append(section)
        
        # Risk value
        if risk_value > 0:
            parts.append(f"💸 **Total Expiry Risk**: ₹{risk_value:,.2f} worth of stock at risk\n")
        
        # Low stock items
        if low_stock_items:
            section = f"⚠️ **Low Stock Items ({len(low_stock_items)})**\n\n"
            for i, item in enumerate(low_stock_items[:5], 1):
                name = item.get('name', 'Unknown')
                current = item.get('current_stock', 0)
                reorder = item.get('reorder_level', 0)
                unit = item.get('unit', '')
                section += f"{i}. **{name}**: {current}{unit} remaining (reorder threshold: {reorder}{unit})\n"
            if len(low_stock_items) > 5:
                section += f"\n...and {len(low_stock_items) - 5} more items\n"
            parts.append(section)
        
        if not parts:
            return "✅ **Good news!** All inventory items are well-stocked and no items are near expiry!"
        
        response = "📦 **Inventory & Expiry Report**\n\n" + "\n".join(parts)
        response += "\n💡 **Recommendation**: Address expired items immediately and plan to use expiring-soon items first."
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

    def _format_revenue_intel_response(self, data: Dict[str, Any], entities: Dict[str, Any]) -> str:
        """Format revenue intelligence data into natural language"""
        sub_type = entities.get('query_sub_type', 'full_report')
        
        response = "🧠 **Revenue Intelligence Report**\n\n"
        
        if sub_type == "margins":
            margins = data.get('margins', [])
            response += f"Found **{len(margins)} items** with detailed margin analysis.\n\n"
            for m in margins[:5]:
                response += f"• **{m['name']}**: {m['margin_pct']}% margin (₹{m['margin']} per unit)\n"
        elif sub_type == "combos":
            combos = data.get('combos', [])
            response += f"Suggested **{len(combos)} combo deals** based on order patterns:\n\n"
            for c in combos[:3]:
                response += f"• **{c['item_a']} + {c['item_b']}**: Suggested Price ₹{c['suggested_combo_price']} ({c['discount_pct']}% off)\n"
        elif sub_type == "upsells":
            upsells = data.get('upsells', [])
            response += f"Top **{len(upsells)} upselling opportunities**:\n\n"
            for u in upsells[:3]:
                response += f"• From **{u['base_item']}** to **{u['upsell_to']}** (Gain: ₹{u['monthly_profit_impact']} monthly profit)\n"
        else:
            summary = data.get('summary', {})
            if summary:
                response += f"Overall Performance ({summary.get('period_days')} days):\n"
                response += f"• **Total Revenue**: ₹{summary.get('total_revenue', 0):,.2f}\n"
                response += f"• **Total Profit**: ₹{summary.get('total_profit', 0):,.2f}\n"
                response += f"• **Avg Margin**: {summary.get('avg_margin_pct', 0)}%\n"
                response += f"• **Top Performer**: {summary.get('top_performer', 'N/A')}\n"
            else:
                response += "I've analyzed your menu performance. You can see detailed insights on the Revenue Intelligence dashboard, or ask me specifically about 'margins', 'combos', or 'profitable items'."
        
        return response
    
    def add_to_conversation(self, conversation_id: str, message: ChatMessage, restaurant_id: str, user_id: str):
        """Add message to conversation history in the database"""
        from database import SessionLocal
        from models.ai_chat import AIChatHistory
        
        db = SessionLocal()
        try:
            # Determine the title from the first user message
            title = "New Chat"
            if message.role == 'user':
                # Check if this is the first message
                existing = db.query(AIChatHistory).filter(AIChatHistory.conversation_id == conversation_id).first()
                if not existing:
                    title = message.content[:60] + ('...' if len(message.content) > 60 else '')
                else:
                    title = existing.title
            else:
                # If assistant, copy title from an existing message in the same conversation
                existing = db.query(AIChatHistory).filter(AIChatHistory.conversation_id == conversation_id).first()
                if existing:
                    title = existing.title

            chat_msg = AIChatHistory(
                restaurant_id=restaurant_id,
                user_id=user_id,
                conversation_id=conversation_id,
                title=title,
                role=message.role,
                content=message.content
            )
            db.add(chat_msg)
            db.commit()
            
            # Update memory cache for backward compatibility during this session
            if conversation_id not in self.conversations:
                self.conversations[conversation_id] = []
            self.conversations[conversation_id].append(message)
        except Exception as e:
            logger.error(f"Failed to save chat history: {e}")
            db.rollback()
        finally:
            db.close()
    
    def get_conversation(self, conversation_id: str, restaurant_id: str, user_id: str) -> list:
        """Get conversation history from database"""
        from database import SessionLocal
        from models.ai_chat import AIChatHistory
        from schemas.ai_schemas import ChatMessage
        
        db = SessionLocal()
        try:
            history = db.query(AIChatHistory).filter(
                AIChatHistory.conversation_id == conversation_id,
                AIChatHistory.restaurant_id == restaurant_id,
                AIChatHistory.user_id == user_id
            ).order_by(AIChatHistory.created_at.asc()).all()
            
            messages = []
            for h in history:
                messages.append(ChatMessage(role=h.role, content=h.content))
                
            # Fallback to cache if DB empty but cache has it (transitional safety)
            if not messages and conversation_id in self.conversations:
                return self.conversations[conversation_id]
                
            return messages
        finally:
            db.close()
    
    def list_conversations(self, restaurant_id: str, user_id: str) -> list:
        """List all conversations for a user, sorted by most recent"""
        from database import SessionLocal
        from models.ai_chat import AIChatHistory
        
        db = SessionLocal()
        try:
            all_msgs = db.query(AIChatHistory).filter(
                AIChatHistory.restaurant_id == restaurant_id,
                AIChatHistory.user_id == user_id
            ).order_by(AIChatHistory.created_at.desc()).all()
            
            convos_map = {}
            for msg in all_msgs:
                cid = msg.conversation_id
                if cid not in convos_map:
                    convos_map[cid] = {
                        'conversation_id': cid,
                        'title': msg.title,
                        'created_at': msg.created_at.isoformat(),
                        'updated_at': msg.created_at.isoformat(),
                        'message_count': 1
                    }
                else:
                    convos_map[cid]['message_count'] += 1
                    # Keep oldest created_at, freshest updated_at
                    if msg.created_at.isoformat() < convos_map[cid]['created_at']:
                        convos_map[cid]['created_at'] = msg.created_at.isoformat()
            
            convos = list(convos_map.values())
            # Sort by updated_at descending (most recent first)
            convos.sort(key=lambda x: x.get('updated_at', ''), reverse=True)
            return convos
        finally:
            db.close()
    
    def delete_conversation(self, conversation_id: str, restaurant_id: str, user_id: str) -> bool:
        """Delete a conversation from the database"""
        from database import SessionLocal
        from models.ai_chat import AIChatHistory
        
        db = SessionLocal()
        try:
            deleted_count = db.query(AIChatHistory).filter(
                AIChatHistory.conversation_id == conversation_id,
                AIChatHistory.restaurant_id == restaurant_id,
                AIChatHistory.user_id == user_id
            ).delete()
            db.commit()
            
            # Also remove from memory
            if conversation_id in self.conversations:
                del self.conversations[conversation_id]
                
            return deleted_count > 0
        except Exception as e:
            logger.error(f"Failed to delete conversation: {e}")
            db.rollback()
            return False
        finally:
            db.close()

    # ── Pending Action State Management ──────────────────────────
    def set_pending_action(self, conversation_id: str, action_data: Dict[str, Any]):
        """
        Store a pending action for a conversation.
        Called when an action returns pending=True (e.g., price update without new_price).
        """
        self.pending_actions[conversation_id] = action_data
        logger.info(f"Pending action set for conv {conversation_id[:8]}: {action_data.get('action')}")
    
    def get_pending_action(self, conversation_id: str) -> Optional[Dict[str, Any]]:
        """Get the pending action for a conversation, if any."""
        return self.pending_actions.get(conversation_id)
    
    def clear_pending_action(self, conversation_id: str):
        """Clear the pending action for a conversation."""
        if conversation_id in self.pending_actions:
            del self.pending_actions[conversation_id]
            logger.info(f"Pending action cleared for conv {conversation_id[:8]}")
    
    def resolve_pending_action(
        self, conversation_id: str, message: str, db, restaurant_id: str, user_id: str
    ) -> Optional[Dict[str, Any]]:
        """
        Try to resolve a pending action with the user's follow-up message.
        
        Examples:
        - Pending: update_menu_item for "Coke" (no price) → User sends "100" → resolves to price update
        - Pending: delete_menu_item confirmation → User sends "yes" → resolves to deletion
        - Pending: add_menu_item (missing details) → User sends "Paneer Wrap, 220, Starters" → resolves
        
        Returns: resolved action result dict, or None if the message doesn't look like a follow-up.
        """
        pending = self.get_pending_action(conversation_id)
        if not pending:
            return None
        
        action_type = pending.get('action')
        message_stripped = message.strip()
        message_lower = message_stripped.lower()
        
        # ── Resolve: Price Update Follow-up ──
        if action_type == 'update_menu_item' and pending.get('item'):
            # User is expected to provide a new price.
            # Check if the message is a number (possibly with ₹ or "rupees")
            import re
            price_match = re.search(r'₹?\s*(\d+(?:\.\d{1,2})?)', message_stripped)
            
            if price_match:
                new_price = float(price_match.group(1))
                item_info = pending['item']
                
                # Re-execute the update with the new price
                from services.action_engine import get_action_engine
                action_engine = get_action_engine()
                entities = {
                    'item_name': item_info['name'],
                    'new_price': new_price
                }
                result = action_engine.execute_action(
                    'update_menu_item', entities, db, restaurant_id, user_id
                )
                self.clear_pending_action(conversation_id)
                return {
                    'resolved': True,
                    'intent_type': 'update_menu_item',
                    'data': result
                }
        
        # ── Resolve: Delete Confirmation ──
        if action_type == 'delete_menu_item' and pending.get('needs_confirmation'):
            confirm_words = ['yes', 'confirm', 'sure', 'go ahead', 'do it', 'haan', 'ha', 'ok', 'okay', 'proceed', 'delete it', 'remove it']
            decline_words = ['no', 'cancel', 'stop', 'nahi', 'nah', 'never mind', 'abort']
            
            if any(w in message_lower for w in confirm_words):
                item_info = pending['item']
                from services.action_engine import get_action_engine
                action_engine = get_action_engine()
                entities = {
                    'item_name': item_info['name'],
                    'confirmed': True
                }
                result = action_engine.execute_action(
                    'delete_menu_item', entities, db, restaurant_id, user_id
                )
                self.clear_pending_action(conversation_id)
                return {
                    'resolved': True,
                    'intent_type': 'delete_menu_item',
                    'data': result
                }
            elif any(w in message_lower for w in decline_words):
                self.clear_pending_action(conversation_id)
                return {
                    'resolved': True,
                    'intent_type': 'delete_menu_item',
                    'data': {
                        'success': True,
                        'message': '🚫 **Cancelled.** The item has not been removed from the menu.'
                    }
                }
        
        # ── Resolve: Add Menu Item Follow-up ──
        if action_type == 'add_menu_item':
            partial = pending.get('partial_entities', {})
            
            import re
            entities = self._extract_menu_add_entities(message)
            
            # Special case: If we only need a category and user typed 1-2 words
            if not partial.get('category') and partial.get('item_name') and partial.get('price') is not None:
                if len(message_stripped.split()) <= 3 and not entities.get('item_name'):
                    entities['category'] = message_stripped
                elif entities.get('item_name') and not entities.get('price') and not entities.get('category'):
                    # The extractor might have mistaken the category for an item name
                    entities['category'] = entities.pop('item_name')
            
            # Special case: If we only need a price and user typed a number
            if partial.get('item_name') and partial.get('price') is None:
                price_match = re.search(r'(\d+(?:\.\d{1,2})?)', message_stripped)
                if price_match:
                    entities['price'] = float(price_match.group(1))
            
            # Fallback comma-separated parsing if it's a completely fresh string
            if not partial.get('item_name'):
                parts = [p.strip() for p in message_stripped.split(',')]
                if len(parts) >= 2 and not entities.get('item_name'):
                    entities['item_name'] = parts[0]
                    price_match = re.search(r'(\d+(?:\.\d{1,2})?)', parts[1])
                    if price_match:
                        entities['price'] = float(price_match.group(1))
                    if len(parts) >= 3:
                        part3 = parts[2]
                        prep_match = re.search(r'(\d+)\s*(?:min|minutes?)', part3, re.IGNORECASE)
                        if prep_match:
                            entities['preparation_time'] = int(prep_match.group(1))
                        else:
                            entities['category'] = part3
            
            # Merge partial with newly extracted
            merged_entities = {**partial}
            for k, v in entities.items():
                if v is not None and v != "":
                    merged_entities[k] = v
            
            from services.action_engine import get_action_engine
            action_engine = get_action_engine()
            result = action_engine.execute_action(
                'add_menu_item', merged_entities, db, restaurant_id, user_id
            )
            
            self.clear_pending_action(conversation_id)
            return {
                'resolved': True,
                'intent_type': 'add_menu_item',
                'data': result
            }
        
        # Message doesn't look like a follow-up — don't resolve, let normal flow handle it
        # But if the message is clearly a new intent, clear the pending action
        if len(message_stripped) > 20 or any(w in message_lower for w in [
            'show', 'what', 'how', 'tell', 'change', 'update', 'add', 'remove',
            'delete', 'sales', 'revenue', 'order', 'menu', 'inventory', 'help'
        ]):
            self.clear_pending_action(conversation_id)
        
        return None

    # ══════════════════════════════════════════════════════════════
    # MULTI-OPERATION ENGINE
    # Detects compound commands, splits them, and executes sequentially
    # ══════════════════════════════════════════════════════════════
    
    def _detect_multi_operation(self, message_lower: str) -> bool:
        """
        Fast rule-based detection of multi-operation commands.
        
        Returns True if the message likely contains 2+ distinct operations.
        Uses action keyword co-occurrence + conjunction detection.
        """
        # Action keywords grouped by operation type
        add_kw = ['add new', 'add item', 'add to menu', 'new dish', 'naya item', 'daal do']
        update_kw = ['change price', 'update price', 'set price', 'modify price',
                     'increase price', 'reduce price', 'make unavailable', 'make available',
                     'price badha', 'price kam', 'price change']
        delete_kw = ['remove from menu', 'delete item', 'remove item', 'hatao',
                     'hata do', 'nikal do', 'take off', 'get rid of']
        
        # Count how many DIFFERENT operation types appear
        has_add = any(kw in message_lower for kw in add_kw)
        has_update = any(kw in message_lower for kw in update_kw)
        has_delete = any(kw in message_lower for kw in delete_kw)
        
        op_type_count = sum([has_add, has_update, has_delete])
        
        # If 2+ different operation types → definitely multi-op
        if op_type_count >= 2:
            return True
        
        # Check for conjunctions with action verbs repeated
        # e.g., "add X and add Y" or "add X, change Y, and remove Z"
        action_verbs = ['add', 'remove', 'delete', 'change', 'update', 'set', 'make']
        conjunctions = [' and ', ' also ', ' then ', '; ']
        
        verb_count = sum(1 for v in action_verbs if v in message_lower)
        has_conjunction = any(c in message_lower for c in conjunctions)
        
        # Multiple action verbs with conjunction → likely multi-op
        if verb_count >= 2 and has_conjunction:
            return True
        
        # Comma-separated actions: "add X at 100, add Y at 200"
        if ',' in message_lower and verb_count >= 2:
            # Check that there are action verbs in different comma segments
            segments = message_lower.split(',')
            segments_with_verbs = sum(
                1 for seg in segments
                if any(v in seg for v in action_verbs)
            )
            if segments_with_verbs >= 2:
                return True
        
        return False
    
    def execute_multi_operation(
        self,
        message: str,
        db,
        restaurant_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Full multi-operation pipeline:
        1. Decompose the compound message into individual operations (via LLM)
        2. Execute each operation via ActionEngine
        3. Return aggregate results
        
        Falls back to rule-based splitting if LLM is unavailable.
        """
        operations = None
        
        # ── Layer 1: LLM-powered decomposition (preferred) ──
        if self.use_llm and self.llm_service:
            try:
                operations = self.llm_service.decompose_multi_operation(message)
            except Exception as e:
                logger.error(f"LLM decomposition failed: {e}")
        
        # ── Layer 2: Rule-based fallback ──
        if not operations:
            operations = self._rule_based_split(message)
        
        if not operations or len(operations) < 2:
            # Couldn't decompose into multiple ops — treat as single intent
            return None
        
        # ── Execute all operations via ActionEngine ──
        from services.action_engine import get_action_engine
        action_engine = get_action_engine()
        
        result = action_engine.execute_multi_action(
            operations, db, restaurant_id, user_id
        )
        
        # Build a nicely formatted message for the response
        result['message'] = self._format_multi_operation_response(result)
        
        return result
    
    def _rule_based_split(self, message: str) -> Optional[List[Dict[str, Any]]]:
        """
        Rule-based fallback for splitting compound commands.
        Splits on conjunctions/delimiters and classifies each segment.
        """
        import re
        
        # Split on: ", and ", " and ", "; ", " then ", " also "
        # But NOT "and" inside item names like "mac and cheese"
        segments = re.split(
            r'\s*(?:,\s*and\s+|\s+and\s+(?=add|remove|delete|change|update|set|make)|;\s*|\s+then\s+|\s+also\s+)',
            message,
            flags=re.IGNORECASE
        )
        
        # Also split on commas if a segment starts with an action verb
        expanded = []
        for seg in segments:
            sub_parts = seg.split(',')
            for part in sub_parts:
                part = part.strip()
                if part:
                    expanded.append(part)
        
        # Merge non-action segments back with the previous action
        action_verbs = ['add', 'remove', 'delete', 'change', 'update', 'set', 'make', 'put']
        merged = []
        for part in expanded:
            part_lower = part.lower().strip()
            starts_with_action = any(part_lower.startswith(v) for v in action_verbs)
            
            if starts_with_action or not merged:
                merged.append(part)
            else:
                # Merge with previous segment (it's likely a continuation)
                if merged:
                    merged[-1] = merged[-1] + ', ' + part
        
        if len(merged) < 2:
            return None
        
        # Classify each segment
        operations = []
        for seg in merged:
            seg = seg.strip()
            if not seg:
                continue
            intent = self._rule_based_classification(seg)
            if intent.intent_type != 'general':
                entities = self._extract_entities(seg, intent.intent_type)
                operations.append({
                    'intent_type': intent.intent_type,
                    'entities': entities,
                    'original_text': seg
                })
        
        return operations if len(operations) >= 2 else None
    
    def _format_multi_operation_response(self, result: Dict[str, Any]) -> str:
        """
        Format multi-operation results into a clean, readable response.
        """
        parts = []
        parts.append(f"## ⚡ Batch Operations ({result.get('total_operations', 0)} operations)\n")
        
        for r in result.get('results', []):
            idx = r.get('index', '?')
            success = r.get('success', False)
            op_type = r.get('operation', 'unknown').replace('_', ' ').title()
            msg = r.get('message', '')
            icon = '✅' if success else '❌'
            
            parts.append(f"**{icon} Op {idx}: {op_type}**")
            if msg:
                # Indent the message slightly
                parts.append(f"> {msg}\n")
        
        # Summary
        parts.append(f"\n---\n{result.get('summary', '')}")
        
        return '\n'.join(parts)


# Singleton instance
_ai_service = None

def get_ai_service() -> AIService:
    """Get or create AIService singleton"""
    global _ai_service
    if _ai_service is None:
        _ai_service = AIService()
    return _ai_service

