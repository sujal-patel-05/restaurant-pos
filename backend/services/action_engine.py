"""
Action Engine for Ask-AI Chatbot
Executes actions like creating orders, updating menu items, processing payments, etc.
Supports smart follow-up flows for incomplete commands.
Supports multi-operation batch execution for compound commands.
"""

from typing import Dict, Any, Optional, List, Tuple
from sqlalchemy.orm import Session
from sqlalchemy import func
from models import MenuItem, MenuCategory, Order, OrderItem, OrderType, OrderStatus
from services.order_service import OrderService
from datetime import datetime
import uuid
import re
import logging

logger = logging.getLogger(__name__)


class ActionEngine:
    """
    Executes action-based intents with transaction safety.
    Supports: create_order, update_menu_item, add_menu_item, delete_menu_item.
    Supports multi-operation batch execution for compound commands.
    """
    
    @staticmethod
    def execute_action(intent_type: str, entities: Dict[str, Any], db: Session, restaurant_id: str, user_id: str) -> Dict[str, Any]:
        """
        Execute action based on intent type and entities.
        Returns result with success status and data.
        """
        
        if intent_type == "create_order":
            return ActionEngine._create_order(entities, db, restaurant_id, user_id)
        elif intent_type == "update_menu_item":
            return ActionEngine._update_menu_item(entities, db, restaurant_id)
        elif intent_type == "add_menu_item":
            return ActionEngine._add_menu_item(entities, db, restaurant_id)
        elif intent_type == "delete_menu_item":
            return ActionEngine._delete_menu_item(entities, db, restaurant_id)
        
        return {"success": False, "error": "Unknown action type"}
    
    # ── Menu Update ──────────────────────────────────────────────
    @staticmethod
    def _update_menu_item(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """
        Update menu item price or availability.
        
        Smart follow-up logic:
        - If item found but no new_price provided → return current data with pending=True
        - If item found and new_price provided → execute the update
        - If availability change requested → toggle is_available
        """
        try:
            item_name = entities.get('item_name', '').strip()
            new_price = entities.get('new_price')
            availability = entities.get('availability')  # True/False/None
            
            if not item_name:
                return {
                    "success": False,
                    "pending": True,
                    "action": "update_menu_item",
                    "error": "No item name specified",
                    "message": "Which menu item would you like to update? Please provide the item name."
                }
            
            # Fuzzy match against menu items
            menu_item = ActionEngine._fuzzy_find_item(db, restaurant_id, item_name)
            
            if not menu_item:
                # Try broader search
                all_items = db.query(MenuItem).filter(
                    MenuItem.restaurant_id == restaurant_id
                ).all()
                suggestions = [i.name for i in all_items if item_name.lower() in i.name.lower()][:5]
                
                return {
                    "success": False,
                    "error": f"Item '{item_name}' not found in the menu",
                    "suggestions": suggestions if suggestions else None,
                    "message": f"I couldn't find '{item_name}' on your menu." + (
                        f" Did you mean: {', '.join(suggestions)}?" if suggestions else
                        " Please check the item name and try again."
                    )
                }
            
            # ── Availability Toggle ──
            if availability is not None:
                old_status = menu_item.is_available
                menu_item.is_available = availability
                db.commit()
                db.refresh(menu_item)
                
                status_text = "available" if availability else "unavailable"
                return {
                    "success": True,
                    "action": "toggle_availability",
                    "item": {
                        "name": menu_item.name,
                        "id": str(menu_item.id),
                        "price": float(menu_item.price),
                        "was_available": old_status,
                        "is_available": availability
                    },
                    "message": f"✅ **{menu_item.name}** has been marked as **{status_text}**."
                }
            
            # ── Price Update: Incomplete (no new_price) → Ask for follow-up ──
            if new_price is None:
                return {
                    "success": True,
                    "pending": True,
                    "action": "update_menu_item",
                    "item": {
                        "name": menu_item.name,
                        "id": str(menu_item.id),
                        "current_price": float(menu_item.price),
                        "category": menu_item.category.name if menu_item.category else "Uncategorized",
                        "is_available": menu_item.is_available
                    },
                    "message": f"📋 **{menu_item.name}** is currently priced at **₹{float(menu_item.price):,.2f}**. What would you like the new price to be?"
                }
            
            # ── Price Update: Complete → Execute ──
            if new_price <= 0:
                return {
                    "success": False,
                    "error": "Price must be greater than zero",
                    "message": "❌ Price must be a positive number. Please provide a valid price."
                }
            
            old_price = float(menu_item.price)
            menu_item.price = new_price
            db.commit()
            db.refresh(menu_item)
            
            price_change = "increased" if new_price > old_price else "decreased" if new_price < old_price else "unchanged"
            
            return {
                "success": True,
                "action": "price_update",
                "item": {
                    "name": menu_item.name,
                    "id": str(menu_item.id),
                    "old_price": old_price,
                    "new_price": float(menu_item.price),
                    "price_change": price_change,
                    "category": menu_item.category.name if menu_item.category else "Uncategorized",
                    "is_available": menu_item.is_available
                },
                "message": f"✅ **Price Updated!** {menu_item.name}: ~~₹{old_price:,.2f}~~ → **₹{float(menu_item.price):,.2f}**"
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Menu update error: {e}")
            return {"success": False, "error": str(e)}
    
    # ── Menu Add ─────────────────────────────────────────────────
    @staticmethod
    def _add_menu_item(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """
        Add a new menu item with full details.
        
        Supported fields:
        - item_name (required)
        - price (required)
        - category (optional) — auto-matched against existing categories
        - description (optional) — item description text
        - preparation_time (optional) — prep time in minutes (default: 15)
        
        Smart follow-up logic:
        - If name or price is missing → return pending=True asking for details
        - If complete → create the item, auto-match category
        """
        try:
            item_name = entities.get('item_name', '').strip()
            price = entities.get('price')
            category_name = entities.get('category', '').strip()
            description = entities.get('description', '').strip()
            preparation_time = entities.get('preparation_time', 15)
            
            # Validate preparation_time
            if isinstance(preparation_time, str):
                prep_match = re.search(r'(\d+)', str(preparation_time))
                preparation_time = int(prep_match.group(1)) if prep_match else 15
            preparation_time = max(1, min(int(preparation_time or 15), 120))  # 1-120 min
            
            # ── Incomplete: Missing required details (including category) → Ask for details ──
            if not item_name or price is None or not category_name:
                # Get available categories for context
                categories = db.query(MenuCategory).filter(
                    MenuCategory.restaurant_id == restaurant_id,
                    MenuCategory.is_active == True
                ).all()
                cat_names = [c.name for c in categories]
                
                # Determine what is missing to craft the prompt
                missing = []
                if not item_name: missing.append("Item name")
                if price is None: missing.append("Price")
                if not category_name: missing.append("Category")
                
                msg_parts = []
                if item_name and price is not None:
                    msg_parts.append(f"Almost done with **{item_name}** at ₹{price}! I just need to know which category it belongs to.")
                elif item_name:
                    msg_parts.append(f"Got it, **{item_name}**. I still need a price and category.")
                else:
                    msg_parts.append("Sure! I need a few details to add the new item:")
                
                msg_parts.append("\n\nPlease provide:")
                if not item_name: msg_parts.append("- **Item name** — What should it be called?")
                if price is None: msg_parts.append("- **Price** — How much should it cost?")
                if not category_name:
                    cat_hint = f" (Available: {', '.join(cat_names)})" if cat_names else ""
                    msg_parts.append(f"- **Category** — What category should this be under?{cat_hint}")
                
                if len(missing) == 3:
                    msg_parts.append("\n*You can also provide a description and prep time (e.g. 'Paneer Wrap, 220, Starters, Crispy wrap, 10 min')*")
                
                return {
                    "success": True,
                    "pending": True,
                    "action": "add_menu_item",
                    "partial_entities": {
                        "item_name": item_name,
                        "price": price,
                        "category": category_name,
                        "description": description,
                        "preparation_time": preparation_time
                    },
                    "available_categories": cat_names,
                    "message": "\n".join(msg_parts)
                }
            
            # Validate price
            if price is not None and price <= 0:
                return {
                    "success": False,
                    "error": "Price must be greater than zero",
                    "message": "❌ Price must be a positive number."
                }
            
            # Check for duplicate names
            existing = db.query(MenuItem).filter(
                MenuItem.restaurant_id == restaurant_id,
                func.lower(MenuItem.name) == item_name.lower()
            ).first()
            
            if existing:
                return {
                    "success": False,
                    "error": f"An item named '{existing.name}' already exists (₹{float(existing.price):,.2f})",
                    "message": f"❌ **'{existing.name}'** already exists on your menu at **₹{float(existing.price):,.2f}**. "
                               f"Did you mean to update its price instead?"
                }
            
            # Auto-match or create category
            category_id = None
            matched_category_name = None
            if category_name:
                category = db.query(MenuCategory).filter(
                    MenuCategory.restaurant_id == restaurant_id,
                    MenuCategory.name.ilike(f"%{category_name}%"),
                    MenuCategory.is_active == True
                ).first()
                
                if category:
                    category_id = category.id
                    matched_category_name = category.name
                else:
                    # Create the new category
                    new_category = MenuCategory(
                        restaurant_id=restaurant_id,
                        name=category_name.title(),
                        is_active=True
                    )
                    db.add(new_category)
                    db.commit()
                    db.refresh(new_category)
                    category_id = new_category.id
                    matched_category_name = new_category.name
            
            # Create the item with all fields
            new_item = MenuItem(
                restaurant_id=restaurant_id,
                name=item_name.title(),
                price=price,
                description=description or None,
                category_id=category_id,
                is_available=True,
                preparation_time=preparation_time
            )
            db.add(new_item)
            db.commit()
            db.refresh(new_item)
            
            # Build detailed success message
            msg_parts = [f"✅ **Item Added!** {new_item.name} — **₹{float(new_item.price):,.2f}**"]
            msg_parts.append(f"📂 Category: {matched_category_name or 'Uncategorized'}")
            if new_item.description:
                msg_parts.append(f"📝 Description: {new_item.description}")
            msg_parts.append(f"⏱️ Prep Time: {new_item.preparation_time} min")
            
            return {
                "success": True,
                "action": "add_menu_item",
                "item": {
                    "name": new_item.name,
                    "id": str(new_item.id),
                    "price": float(new_item.price),
                    "category": matched_category_name or "Uncategorized",
                    "description": new_item.description,
                    "preparation_time": new_item.preparation_time,
                    "is_available": True
                },
                "message": "\n".join(msg_parts)
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Menu add error: {e}")
            return {"success": False, "error": str(e)}
    
    # ── Menu Delete ──────────────────────────────────────────────
    @staticmethod
    def _delete_menu_item(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """
        Remove a menu item (soft-delete by setting is_available=False).
        
        Smart follow-up logic:
        - If no item name → ask what to delete
        - If item found but no confirmation → show item details, ask to confirm
        - If confirmed → soft-delete the item
        """
        try:
            item_name = entities.get('item_name', '').strip()
            confirmed = entities.get('confirmed', False)
            
            if not item_name:
                return {
                    "success": False,
                    "pending": True,
                    "action": "delete_menu_item",
                    "error": "No item name specified",
                    "message": "Which item would you like to remove from the menu? Please provide the item name."
                }
            
            # Fuzzy match
            menu_item = ActionEngine._fuzzy_find_item(db, restaurant_id, item_name)
            
            if not menu_item:
                all_items = db.query(MenuItem).filter(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.is_available == True
                ).all()
                suggestions = [i.name for i in all_items if item_name.lower() in i.name.lower()][:5]
                
                return {
                    "success": False,
                    "error": f"Item '{item_name}' not found",
                    "suggestions": suggestions if suggestions else None,
                    "message": f"I couldn't find '{item_name}' on your menu." + (
                        f" Did you mean: {', '.join(suggestions)}?" if suggestions else ""
                    )
                }
            
            # If not confirmed → ask for confirmation
            if not confirmed:
                return {
                    "success": True,
                    "pending": True,
                    "needs_confirmation": True,
                    "action": "delete_menu_item",
                    "item": {
                        "name": menu_item.name,
                        "id": str(menu_item.id),
                        "price": float(menu_item.price),
                        "category": menu_item.category.name if menu_item.category else "Uncategorized",
                        "is_available": menu_item.is_available
                    },
                    "message": f"⚠️ **{menu_item.name}** (₹{float(menu_item.price):,.2f}) found.\n\n"
                               f"Are you sure you want to remove it from the menu?"
                }
            
            # Confirmed → soft-delete
            item_name_saved = menu_item.name
            item_price_saved = float(menu_item.price)
            menu_item.is_available = False
            db.commit()
            
            return {
                "success": True,
                "action": "delete_menu_item",
                "item": {
                    "name": item_name_saved,
                    "price": item_price_saved
                },
                "message": f"✅ **{item_name_saved}** has been removed from the menu."
            }
            
        except Exception as e:
            db.rollback()
            logger.error(f"Menu delete error: {e}")
            return {"success": False, "error": str(e)}
    
    # ── Fuzzy Item Finder ────────────────────────────────────────
    @staticmethod
    def _fuzzy_find_item(db: Session, restaurant_id: str, item_name: str) -> Optional[MenuItem]:
        """
        Find a menu item using progressively broader matching:
        1. Exact match (case-insensitive)
        2. Contains match (ILIKE %name%)
        3. Word-by-word match (each word in the item name)
        """
        if not item_name:
            return None
            
        name_lower = item_name.lower().strip()
        
        # 1. Exact match
        item = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant_id,
            func.lower(MenuItem.name) == name_lower
        ).first()
        if item:
            return item
        
        # 2. Contains match
        item = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.name.ilike(f"%{name_lower}%")
        ).first()
        if item:
            return item
        
        # 3. Word-by-word match — try each word individually
        words = name_lower.split()
        for word in words:
            if len(word) > 2:  # Skip very short words
                item = db.query(MenuItem).filter(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.name.ilike(f"%{word}%")
                ).first()
                if item:
                    return item
        
        return None
    
    # ── Create Order (existing) ──────────────────────────────────
    @staticmethod
    def _create_order(entities: Dict[str, Any], db: Session, restaurant_id: str, user_id: str) -> Dict[str, Any]:
        """Create a new order from AI command"""
        try:
            items_data = entities.get('items', [])
            table_number = entities.get('table_number')
            order_type = entities.get('order_type', 'dine_in')
            
            if not items_data:
                return {"success": False, "error": "No items specified"}
            
            # Match items with menu
            matched_items = []
            not_found_items = []
            
            for item_data in items_data:
                item_name = item_data.get('name', '').lower()
                quantity = item_data.get('quantity', 1)
                
                # Search for menu item (fuzzy match)
                menu_item = db.query(MenuItem).filter(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.name.ilike(f"%{item_name}%"),
                    MenuItem.is_available == True
                ).first()
                
                if menu_item:
                    matched_items.append({
                        "menu_item_id": str(menu_item.id),
                        "quantity": quantity,
                        "unit_price": float(menu_item.price),
                        "name": menu_item.name
                    })
                else:
                    not_found_items.append(item_name)
            
            if not matched_items:
                return {
                    "success": False,
                    "error": "None of the items were found in the menu",
                    "not_found": not_found_items
                }
            
            # Calculate total
            subtotal = sum(item['unit_price'] * item['quantity'] for item in matched_items)
            
            # Create order
            order_data = {
                "restaurant_id": restaurant_id,
                "order_type": order_type,
                "table_number": table_number,
                "customer_name": "AI Order",
                "items": matched_items
            }
            
            # Use OrderService to create order
            order_service = OrderService(db)
            order = order_service.create_order(order_data, user_id)
            
            return {
                "success": True,
                "order": {
                    "order_number": order.order_number,
                    "order_id": str(order.id),
                    "table_number": table_number,
                    "order_type": order_type,
                    "items": matched_items,
                    "subtotal": subtotal,
                    "total_amount": float(order.total_amount),
                    "status": order.status.value
                },
                "not_found": not_found_items if not_found_items else None
            }
            
        except Exception as e:
            return {"success": False, "error": str(e)}


    # ── Multi-Operation Batch Executor ────────────────────────────
    @staticmethod
    def execute_multi_action(
        operations: List[Dict[str, Any]],
        db: Session,
        restaurant_id: str,
        user_id: str
    ) -> Dict[str, Any]:
        """
        Execute multiple operations sequentially.
        
        Each operation dict: {"intent_type": str, "entities": dict, "original_text": str}
        Uses individual commits per operation so partial successes are preserved.
        
        Returns aggregated result with per-operation status.
        """
        results = []
        success_count = 0
        fail_count = 0
        
        for i, op in enumerate(operations):
            intent_type = op.get('intent_type', '')
            entities = op.get('entities', {})
            original_text = op.get('original_text', f'Operation {i+1}')
            
            try:
                result = ActionEngine.execute_action(
                    intent_type, entities, db, restaurant_id, user_id
                )
                
                # Skip pending results in multi-op (we can't do follow-ups mid-batch)
                if result.get('pending'):
                    result['success'] = False
                    result['message'] = f"⚠️ Skipped — requires additional details: {result.get('message', '')}"
                    fail_count += 1
                elif result.get('success'):
                    success_count += 1
                else:
                    fail_count += 1
                    
                results.append({
                    "index": i + 1,
                    "operation": intent_type,
                    "original_text": original_text,
                    "success": result.get('success', False),
                    "message": result.get('message', ''),
                    "data": result
                })
                
            except Exception as e:
                logger.error(f"Multi-op error on op {i+1}: {e}")
                fail_count += 1
                results.append({
                    "index": i + 1,
                    "operation": intent_type,
                    "original_text": original_text,
                    "success": False,
                    "message": f"❌ Error: {str(e)}",
                    "data": {"success": False, "error": str(e)}
                })
        
        # Build aggregate summary
        total = len(operations)
        if success_count == total:
            summary = f"✅ **All {total} operations completed successfully!**"
        elif success_count > 0:
            summary = f"⚠️ **{success_count}/{total} operations succeeded**, {fail_count} failed."
        else:
            summary = f"❌ **All {total} operations failed.**"
        
        return {
            "success": success_count > 0,
            "multi_operation": True,
            "total_operations": total,
            "success_count": success_count,
            "fail_count": fail_count,
            "summary": summary,
            "results": results,
            "message": summary
        }


# Singleton instance
_action_engine = None

def get_action_engine() -> ActionEngine:
    """Get or create ActionEngine singleton"""
    global _action_engine
    if _action_engine is None:
        _action_engine = ActionEngine()
    return _action_engine
