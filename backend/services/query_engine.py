"""
Query Engine for Ask-AI Chatbot
Translates AI intents into database queries using existing API endpoints
"""

from typing import Dict, Any, Optional
from sqlalchemy.orm import Session
from datetime import datetime, timedelta
from models import Order, MenuItem, Ingredient, OrderItem, WastageLog, OrderStatus
from sqlalchemy import func, and_
from services.revenue_intelligence_service import RevenueIntelligenceService

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
        elif intent_type == "revenue_intel":
            return QueryEngine._query_revenue_intelligence(entities, db, restaurant_id)
        
        return {}
    
    @staticmethod
    def _query_sales(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query sales data for specified period + historical comparisons from daily_summaries"""
        days = entities.get('days', 1)
        period = entities.get('period', 'today')
        
        now = datetime.now()
        
        if period == 'today':
            start_date = now.replace(hour=0, minute=0, second=0, microsecond=0)
        else:
            start_date = now - timedelta(days=days)
        
        # Query all non-cancelled orders
        orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant_id,
                Order.status != OrderStatus.CANCELLED,
                Order.created_at >= start_date
            )
        ).all()
        
        total_revenue = sum(order.total_amount for order in orders if order.total_amount)
        total_orders = len(orders)
        
        # Group by date for charts
        daily_sales = {}
        for order in orders:
            if not order.created_at: continue
            date_str = order.created_at.strftime('%Y-%m-%d')
            if date_str not in daily_sales:
                daily_sales[date_str] = 0
            daily_sales[date_str] += float(order.total_amount or 0)
            
        chart_data = []
        current = start_date
        end_date = datetime.now()
        
        while current <= end_date:
            date_key = current.strftime('%Y-%m-%d')
            day_name = current.strftime('%a') 
            chart_data.append({
                "date": date_key,
                "name": day_name,
                "sales": daily_sales.get(date_key, 0)
            })
            current += timedelta(days=1)
        
        # ── Pull historical comparisons from daily_summaries ──
        from models import DailySummary
        today_date = now.date()
        yesterday_date = today_date - timedelta(days=1)
        week_ago = today_date - timedelta(days=7)
        
        # Get recent daily summaries (last 30 days)
        recent_summaries = db.query(DailySummary).filter(
            DailySummary.restaurant_id == restaurant_id,
            DailySummary.summary_date >= today_date - timedelta(days=30)
        ).order_by(DailySummary.summary_date.desc()).all()
        
        history = []
        yesterday_data = None
        for s in recent_summaries:
            row = {
                "date": str(s.summary_date),
                "revenue": float(s.total_revenue or 0),
                "orders": s.total_orders or 0,
                "avg_order_value": float(s.avg_order_value or 0),
                "top_item": s.top_selling_item,
                "peak_hour": s.peak_hour,
            }
            history.append(row)
            if s.summary_date == yesterday_date:
                yesterday_data = row
        
        # Weekly/monthly aggregates
        last_7_days = [s for s in recent_summaries if s.summary_date >= week_ago]
        week_revenue = sum(float(s.total_revenue or 0) for s in last_7_days)
        week_orders = sum(s.total_orders or 0 for s in last_7_days)
        month_revenue = sum(float(s.total_revenue or 0) for s in recent_summaries)
        month_orders = sum(s.total_orders or 0 for s in recent_summaries)
            
        # Only include chart data if there's enough for a trend (2+ points)
        chart_info = None
        if len(chart_data) > 1:
            chart_info = {
                "type": "bar",
                "title": "Sales Trend",
                "data": chart_data,
                "dataKey": "sales",
                "xAxisKey": "name"
            }
            
        return {
            "total_revenue": float(total_revenue) if total_revenue else 0.0,
            "total_orders": total_orders,
            "period_days": days,
            "yesterday": yesterday_data,
            "last_7_days": {"revenue": week_revenue, "orders": week_orders},
            "last_30_days": {"revenue": month_revenue, "orders": month_orders},
            "daily_history": history[:14],  # Last 14 days for context
            "chart_data": chart_info
        }
    
    @staticmethod
    def _query_inventory(db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query inventory: low stock + expiry alerts"""
        from datetime import date
        today = date.today()
        
        # Low stock items
        low_stock_items = db.query(Ingredient).filter(
            and_(
                Ingredient.restaurant_id == restaurant_id,
                Ingredient.current_stock <= Ingredient.reorder_level
            )
        ).all()
        
        # All ingredients (for expiry info)
        all_ingredients = db.query(Ingredient).filter(
            Ingredient.restaurant_id == restaurant_id
        ).all()
        
        # Expiry analysis
        expired = []
        expiring_soon = []  # within 7 days
        all_with_expiry = []
        
        for item in all_ingredients:
            if item.expiry_date:
                days_left = (item.expiry_date - today).days
                info = {
                    "name": item.name,
                    "current_stock": float(item.current_stock),
                    "unit": item.unit.value,
                    "expiry_date": str(item.expiry_date),
                    "days_until_expiry": days_left,
                    "cost_per_unit": float(item.cost_per_unit or 0),
                    "risk_value": round(float(item.current_stock) * float(item.cost_per_unit or 0), 2)
                }
                all_with_expiry.append(info)
                if days_left < 0:
                    expired.append(info)
                elif days_left <= 7:
                    expiring_soon.append(info)
        
        # Sort by soonest expiry
        all_with_expiry.sort(key=lambda x: x["days_until_expiry"])
        
        return {
            "low_stock_items": [
                {
                    "name": item.name,
                    "current_stock": float(item.current_stock),
                    "reorder_level": float(item.reorder_level),
                    "unit": item.unit.value
                }
                for item in low_stock_items
            ],
            "expired_items": expired,
            "expiring_soon_items": expiring_soon,
            "all_items_with_expiry": all_with_expiry,
            "total_expiry_risk_value": sum(i["risk_value"] for i in expiring_soon + expired),
            "total_ingredients": len(all_ingredients)
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

    @staticmethod
    def _query_revenue_intelligence(entities: Dict[str, Any], db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Query complex revenue intelligence metrics: margins, profitability, combos, pricing."""
        days = entities.get('days', 30)
        query_type = entities.get('query_sub_type', 'full_report')

        if query_type == "margins":
            return {"margins": RevenueIntelligenceService.get_contribution_margins(db, restaurant_id, days)}
        elif query_type == "profitability":
            return {"profitability": RevenueIntelligenceService.get_item_profitability(db, restaurant_id, days)}
        elif query_type == "velocity":
            return {"velocity": RevenueIntelligenceService.get_sales_velocity(db, restaurant_id, days)}
        elif query_type == "combos":
            return {"combos": RevenueIntelligenceService.get_combo_recommendations(db, restaurant_id, days)}
        elif query_type == "upsells":
            return {"upsells": RevenueIntelligenceService.get_upsell_priorities(db, restaurant_id, days)}
        elif query_type == "pricing":
            return {"price_recommendations": RevenueIntelligenceService.get_price_recommendations(db, restaurant_id, days)}
        elif query_type == "inventory_signals":
            return {"inventory_signals": RevenueIntelligenceService.get_inventory_signals(db, restaurant_id, days)}
        
        # Default: Full Report
        return RevenueIntelligenceService.get_full_report(db, restaurant_id, days)
