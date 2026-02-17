"""
Query Engine for Ask-AI Chatbot
Translates AI intents into database queries using existing API endpoints
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models import Order, MenuItem, Ingredient, OrderItem, WastageLog, OrderStatus
from sqlalchemy import func, and_

class QueryEngine:
    """
    Executes database queries based on classified intents
    Uses existing models and business logic
    """
    
    @staticmethod
    def execute_query(intent_type: str, entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """
        Execute query based on intent type and entities
        Returns structured data for response generation
        """
        
        if intent_type == "sales_query":
            return QueryEngine._query_sales(entities, db, restaurant_id)
        elif intent_type == "inventory_query":
            return QueryEngine._query_inventory(db, restaurant_id)
        elif intent_type == "order_status":
            return QueryEngine._query_orders(entities, db, restaurant_id)
        elif intent_type == "menu_info":
            return QueryEngine._query_menu(entities, db, restaurant_id)
        elif intent_type == "wastage_query":
            return QueryEngine._query_wastage(entities, db, restaurant_id)
        
        return {}
    
    @staticmethod
    def _query_sales(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query sales data for specified period"""
        days = entities.get('days', 1)
        period = entities.get('period', 'today')
        
        now = datetime.now()
        
        if period == 'today':
            # Start of today (00:00:00)
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            # Last N days (rolling window) OR start of that day
            # For simplicity in this POS context, let's just go back N days from now
            start_date = now - timedelta(days=days)
        
        # Query all non-cancelled orders (matching dashboard behavior)
        # Include: placed, preparing, ready, served, completed
        orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant_id,
                Order.status != OrderStatus.CANCELLED,
                Order.created_at >= start_date
            )
        ).all()
        
        total_revenue = sum(order.total_amount for order in orders if order.total_amount)
        total_orders = len(orders)
        
        # Implement proper grouping for charts (always include for sales queries)
        # Group by date for the period
        daily_sales = {}
        for order in orders:
            if not order.created_at: continue
            date_str = order.created_at.strftime('%Y-%m-%d')
            if date_str not in daily_sales:
                daily_sales[date_str] = 0
            daily_sales[date_str] += float(order.total_amount or 0)
            
        # Fill in missing dates if needed (e.g. for last 7 days)
        chart_data = []
        current = start_date
        end_date = datetime.now()
        
        while current <= end_date:
            date_key = current.strftime('%Y-%m-%d')
            # Short day name for X-axis (e.g., "Mon", "Tue")
            day_name = current.strftime('%a') 
            
            chart_data.append({
                "date": date_key,
                "name": day_name,
                "sales": daily_sales.get(date_key, 0)
            })
            current += timedelta(days=1)
            
        return {
            "total_revenue": float(total_revenue) if total_revenue else 0.0,
            "total_orders": total_orders,
            "period_days": days,
            "chart_data": {
                "type": "bar",
                "title": "Sales Trend",
                "data": chart_data,
                "dataKey": "sales",
                "xAxisKey": "name"
            }
        }
    
    @staticmethod
    def _query_inventory(db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query low stock items"""
        low_stock_items = db.query(Ingredient).filter(
            and_(
                Ingredient.restaurant_id == restaurant_id,
                Ingredient.current_stock <= Ingredient.reorder_level
            )
        ).all()
        
        return {
            "low_stock_items": [
                {
                    "name": item.name,
                    "current_stock": float(item.current_stock),
                    "reorder_level": float(item.reorder_level),
                    "unit": item.unit.value
                }
                for item in low_stock_items
            ]
        }
    
    @staticmethod
    def _query_orders(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query orders by number or status"""
        order_number = entities.get('order_number')
        
        if order_number:
            # Single order query
            order = db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant_id,
                    Order.order_number == order_number
                )
            ).first()
            
            if not order:
                return {"orders": []}
            
            return {
                "orders": [{
                    "order_number": order.order_number,
                    "status": order.status.value,
                    "total_amount": float(order.total_amount),
                    "items": [
                        {
                            "name": item.menu_item.name,
                            "quantity": item.quantity,
                            "price": float(item.unit_price)
                        }
                        for item in order.order_items
                    ]
                }]
            }
        else:
            # List pending orders
            orders = db.query(Order).filter(
                and_(
                    Order.restaurant_id == restaurant_id,
                    Order.status.in_([OrderStatus.PLACED, OrderStatus.PREPARING, OrderStatus.READY])
                )
            ).order_by(Order.created_at.desc()).limit(10).all()
            
            return {
                "orders": [
                    {
                        "order_number": order.order_number,
                        "status": order.status.value,
                        "total_amount": float(order.total_amount),
                        "created_at": order.created_at.isoformat()
                    }
                    for order in orders
                ]
            }
    
    @staticmethod
    def _query_menu(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query menu items"""
        item_name = entities.get('item_name')
        
        if item_name:
            # Search for specific item
            items = db.query(MenuItem).filter(
                and_(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.name.ilike(f"%{item_name}%")
                )
            ).all()
        else:
            # List all available items
            items = db.query(MenuItem).filter(
                and_(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.is_available == True
                )
            ).limit(10).all()
        
        return {
            "items": [
                {
                    "name": item.name,
                    "price": float(item.price),
                    "is_available": item.is_available,
                    "description": item.description,
                    "category_name": item.category.name if item.category else None
                }
                for item in items
            ]
        }
    
    @staticmethod
    def _query_wastage(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query wastage data"""
        days = entities.get('days', 1)
        start_date = datetime.utcnow() - timedelta(days=days)
        
        # Query wastage logs
        wastage_logs = db.query(
            WastageLog.ingredient_id,
            Ingredient.name.label('ingredient_name'),
            func.sum(WastageLog.quantity).label('total_quantity'),
            func.sum(WastageLog.quantity * Ingredient.cost_per_unit).label('total_cost')
        ).join(
            Ingredient, WastageLog.ingredient_id == Ingredient.id
        ).filter(
            and_(
                Ingredient.restaurant_id == restaurant_id,
                WastageLog.created_at >= start_date
            )
        ).group_by(
            WastageLog.ingredient_id, Ingredient.name
        ).all()
        
        total_wastage_cost = sum(log.total_cost for log in wastage_logs if log.total_cost)
        
        return {
            "total_wastage_cost": float(total_wastage_cost) if total_wastage_cost else 0.0,
            "wastage_details": [
                {
                    "ingredient_name": log.ingredient_name,
                    "quantity": float(log.total_quantity),
                    "cost": float(log.total_cost) if log.total_cost else 0.0
                }
                for log in wastage_logs
            ]
        }
