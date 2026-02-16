"""
Action Engine for Ask-AI Chatbot
Executes actions like creating orders, processing payments, etc.
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from models import MenuItem, Order, OrderItem, OrderType, OrderStatus
from services.order_service import OrderService
from datetime import datetime
import uuid

class ActionEngine:
    """
    Executes action-based intents with transaction safety
    """
    
    @staticmethod
    def execute_action(intent_type: str, entities: Dict[str, Any], db: Session, restaurant_id: str, user_id: str) -> Dict[str, Any]:
        """
        Execute action based on intent type and entities
        Returns result with success status and data
        """
        
        if intent_type == "create_order":
            return ActionEngine._create_order(entities, db, restaurant_id, user_id)
        
        return {"success": False, "error": "Unknown action type"}
    
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


# Singleton instance
_action_engine = None

def get_action_engine() -> ActionEngine:
    """Get or create ActionEngine singleton"""
    global _action_engine
    if _action_engine is None:
        _action_engine = ActionEngine()
    return _action_engine
