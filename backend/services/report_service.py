from sqlalchemy.orm import Session
from sqlalchemy import func, and_
from models import Order, OrderItem, MenuItem, InventoryTransaction, WastageLog, Ingredient
from typing import Dict, List
from uuid import UUID
from datetime import datetime, timedelta
from decimal import Decimal
import numpy as np
import logging

logger = logging.getLogger(__name__)

class ReportService:
    """
    Analytics and reporting service
    """
    
    @staticmethod
    def get_dashboard_stats(db: Session, restaurant_id: UUID) -> Dict:
        """
        Get dashboard overview statistics
        """
        today = datetime.utcnow().date()
        yesterday = today - timedelta(days=1)
        
        # Today's stats
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        today_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= today_start,
            Order.created_at <= today_end,
            Order.status != "cancelled"
        ).all()
        
        today_revenue = sum(order.total_amount for order in today_orders)
        today_order_count = len(today_orders)
        
        # Yesterday's stats
        yesterday_start = datetime.combine(yesterday, datetime.min.time())
        yesterday_end = datetime.combine(yesterday, datetime.max.time())
        
        yesterday_orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= yesterday_start,
            Order.created_at <= yesterday_end,
            Order.status != "cancelled"
        ).all()
        
        yesterday_revenue = sum(order.total_amount for order in yesterday_orders)
        yesterday_order_count = len(yesterday_orders)
        
        # Calculate trends
        revenue_trend = 0
        if yesterday_revenue > 0:
            revenue_trend = ((today_revenue - yesterday_revenue) / yesterday_revenue) * 100
        elif today_revenue > 0:
            revenue_trend = 100
            
        orders_trend = 0
        if yesterday_order_count > 0:
            orders_trend = ((today_order_count - yesterday_order_count) / yesterday_order_count) * 100
        elif today_order_count > 0:
            orders_trend = 100
            
        # Other stats
        menu_items_count = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.is_available == True
        ).count()
        
        # For now, active staff is just total staff
        from models import User
        active_staff = db.query(User).filter(
            User.restaurant_id == restaurant_id,
            User.is_active == True
        ).count()
        
        return {
            "total_revenue": float(today_revenue),
            "revenue_trend": round(revenue_trend, 1),
            "total_orders": today_order_count,
            "orders_trend": round(orders_trend, 1),
            "menu_items": menu_items_count,
            "active_staff": active_staff
        }

    @staticmethod
    def get_dashboard_charts(db: Session, restaurant_id: UUID) -> Dict:
        """
        Get dashboard chart data for visualizations
        """
        # Revenue trend for last 7 days
        revenue_trend = []
        orders_trend = []
        today = datetime.utcnow().date()
        
        for i in range(6, -1, -1):
            date = today - timedelta(days=i)
            day_start = datetime.combine(date, datetime.min.time())
            day_end = datetime.combine(date, datetime.max.time())
            
            day_orders = db.query(Order).filter(
                Order.restaurant_id == restaurant_id,
                Order.created_at >= day_start,
                Order.created_at <= day_end,
                Order.status != "cancelled"
            ).all()
            
            day_revenue = sum(order.total_amount for order in day_orders)
            day_count = len(day_orders)
            
            revenue_trend.append({
                "date": date.strftime("%Y-%m-%d"),
                "revenue": float(day_revenue)
            })
            
            orders_trend.append({
                "date": date.strftime("%Y-%m-%d"),
                "count": day_count
            })
        
        # Top 5 selling items (last 7 days)
        week_start = datetime.combine(today - timedelta(days=7), datetime.min.time())
        
        top_items_query = db.query(
            MenuItem.name,
            func.sum(OrderItem.quantity).label('total_quantity'),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label('total_revenue')
        ).join(
            OrderItem, MenuItem.id == OrderItem.menu_item_id
        ).join(
            Order, OrderItem.order_id == Order.id
        ).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= week_start,
            Order.status != "cancelled"
        ).group_by(
            MenuItem.id, MenuItem.name
        ).order_by(
            func.sum(OrderItem.quantity).desc()
        ).limit(5).all()
        
        top_items = [
            {
                "name": item.name,
                "quantity": int(item.total_quantity),
                "revenue": float(item.total_revenue)
            }
            for item in top_items_query
        ]
        
        # Order status breakdown (today)
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        status_counts = db.query(
            Order.status,
            func.count(Order.id).label('count')
        ).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= today_start,
            Order.created_at <= today_end
        ).group_by(Order.status).all()
        
        order_status = {
            "placed": 0,
            "preparing": 0,
            "ready": 0,
            "served": 0,
            "completed": 0,
            "cancelled": 0
        }
        
        for status, count in status_counts:
            if status in order_status:
                order_status[status] = count
        
        return {
            "revenue_trend": revenue_trend,
            "orders_trend": orders_trend,
            "top_items": top_items,
            "order_status": order_status
        }

    @staticmethod
    def get_sales_report(
        db: Session,
        restaurant_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """
        Get sales report for a date range
        """
        # Total sales
        total_sales = db.query(func.sum(Order.total_amount)).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != "cancelled",
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).scalar() or 0
        
        # Total orders
        total_orders = db.query(func.count(Order.id)).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != "cancelled",
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).scalar() or 0
        
        # Average order value
        avg_order_value = float(total_sales / total_orders) if total_orders > 0 else 0
        
        return {
            "period": {
                "start": start_date.isoformat(),
                "end": end_date.isoformat()
            },
            "total_sales": float(total_sales),
            "total_orders": total_orders,
            "average_order_value": avg_order_value
        }
    
    @staticmethod
    def get_item_wise_sales(
        db: Session,
        restaurant_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """
        Get sales breakdown by menu item
        """
        results = db.query(
            MenuItem.name,
            func.sum(OrderItem.quantity).label("quantity_sold"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue")
        ).join(
            OrderItem, OrderItem.menu_item_id == MenuItem.id
        ).join(
            Order, Order.id == OrderItem.order_id
        ).filter(
            MenuItem.restaurant_id == restaurant_id,
            Order.status != "cancelled",
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).group_by(
            MenuItem.id, MenuItem.name
        ).order_by(
            func.sum(OrderItem.quantity * OrderItem.unit_price).desc()
        ).all()
        
        return [
            {
                "item_name": result.name,
                "quantity_sold": result.quantity_sold,
                "revenue": float(result.revenue)
            }
            for result in results
        ]
    
    @staticmethod
    def get_peak_hours(
        db: Session,
        restaurant_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """
        Get peak hours analysis
        """
        results = db.query(
            func.extract('hour', Order.created_at).label("hour"),
            func.count(Order.id).label("order_count"),
            func.sum(Order.total_amount).label("revenue")
        ).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != "cancelled",
            Order.created_at >= start_date,
            Order.created_at <= end_date
        ).group_by(
            func.extract('hour', Order.created_at)
        ).order_by(
            func.count(Order.id).desc()
        ).all()
        
        return [
            {
                "hour": int(result.hour),
                "order_count": result.order_count,
                "revenue": float(result.revenue or 0)
            }
            for result in results
        ]
    
    @staticmethod
    def get_ingredient_usage(
        db: Session,
        restaurant_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> List[Dict]:
        """
        Get ingredient usage report
        """
        results = db.query(
            Ingredient.name,
            Ingredient.unit,
            func.sum(
                func.abs(InventoryTransaction.quantity)
            ).label("total_used")
        ).join(
            InventoryTransaction, InventoryTransaction.ingredient_id == Ingredient.id
        ).filter(
            Ingredient.restaurant_id == restaurant_id,
            InventoryTransaction.transaction_type == "deduction",
            InventoryTransaction.created_at >= start_date,
            InventoryTransaction.created_at <= end_date
        ).group_by(
            Ingredient.id, Ingredient.name, Ingredient.unit
        ).order_by(
            func.sum(func.abs(InventoryTransaction.quantity)).desc()
        ).all()
        
        return [
            {
                "ingredient_name": result.name,
                "total_used": float(result.total_used or 0),
                "unit": result.unit.value
            }
            for result in results
        ]
    
    @staticmethod
    def get_wastage_report(
        db: Session,
        restaurant_id: UUID,
        start_date: datetime,
        end_date: datetime
    ) -> Dict:
        """
        Get wastage analysis
        """
        wastage_logs = db.query(
            Ingredient.name,
            Ingredient.unit,
            Ingredient.cost_per_unit,
            func.sum(WastageLog.quantity).label("total_wasted"),
            WastageLog.reason
        ).join(
            WastageLog, WastageLog.ingredient_id == Ingredient.id
        ).filter(
            Ingredient.restaurant_id == restaurant_id,
            WastageLog.created_at >= start_date,
            WastageLog.created_at <= end_date
        ).group_by(
            Ingredient.id, Ingredient.name, Ingredient.unit, 
            Ingredient.cost_per_unit, WastageLog.reason
        ).all()
        
        total_wastage_cost = sum(
            float(log.total_wasted * log.cost_per_unit) 
            for log in wastage_logs
        )
        
        wastage_by_ingredient = [
            {
                "ingredient_name": log.name,
                "quantity_wasted": float(log.total_wasted),
                "unit": log.unit.value,
                "cost": float(log.total_wasted * log.cost_per_unit),
                "reason": log.reason
            }
            for log in wastage_logs
        ]
        
        return {
            "total_wastage_cost": total_wastage_cost,
            "wastage_details": wastage_by_ingredient
        }
    
    @staticmethod
    def get_cost_per_dish(db: Session, menu_item_id: UUID) -> Dict:
        """
        Calculate cost per dish based on BOM
        """
        from models import BOMMaping
        
        menu_item = db.query(MenuItem).filter(MenuItem.id == menu_item_id).first()
        
        if not menu_item:
            return {"success": False, "error": "Menu item not found"}
        
        bom_mappings = db.query(BOMMaping).filter(
            BOMMaping.menu_item_id == menu_item_id
        ).all()
        
        total_cost = Decimal(0)
        ingredients_cost = []
        
        for bom in bom_mappings:
            ingredient = db.query(Ingredient).filter(
                Ingredient.id == bom.ingredient_id
            ).first()
            
            ingredient_cost = bom.quantity_required * ingredient.cost_per_unit
            total_cost += ingredient_cost
            
            ingredients_cost.append({
                "ingredient_name": ingredient.name,
                "quantity": float(bom.quantity_required),
                "unit": ingredient.unit.value,
                "cost_per_unit": float(ingredient.cost_per_unit),
                "total_cost": float(ingredient_cost)
            })
        
        profit_margin = menu_item.price - total_cost
        profit_percentage = (profit_margin / menu_item.price * 100) if menu_item.price > 0 else 0
        
        return {
            "success": True,
            "menu_item": menu_item.name,
            "selling_price": float(menu_item.price),
            "total_cost": float(total_cost),
            "profit_margin": float(profit_margin),
            "profit_percentage": float(profit_percentage),
            "ingredients_breakdown": ingredients_cost
        }

    @staticmethod
    def get_sales_forecast(db: Session, restaurant_id: UUID, history_days: int = 30, forecast_days: int = 7) -> Dict:
        """
        ML-powered sales forecast using polynomial regression.
        Fetches `history_days` of daily revenue, fits a degree-2 polynomial,
        and projects revenue for the next `forecast_days`.
        """
        today = datetime.utcnow().date()
        historical = []

        # --- Gather daily revenue for the last N days ---
        for i in range(history_days - 1, -1, -1):
            date = today - timedelta(days=i)
            day_start = datetime.combine(date, datetime.min.time())
            day_end = datetime.combine(date, datetime.max.time())

            day_orders = db.query(Order).filter(
                Order.restaurant_id == restaurant_id,
                Order.created_at >= day_start,
                Order.created_at <= day_end,
                Order.status != "cancelled"
            ).all()

            day_revenue = float(sum(order.total_amount for order in day_orders))
            historical.append({
                "date": date.strftime("%Y-%m-%d"),
                "revenue": round(day_revenue, 2),
                "type": "historical"
            })

        revenues = np.array([d["revenue"] for d in historical])

        # Need at least 3 data points for polynomial fit
        if len(revenues) < 3 or revenues.sum() == 0:
            return {
                "historical": historical,
                "forecast": [],
                "model": "insufficient_data",
                "accuracy": 0
            }

        # --- Fit polynomial regression (degree 2) ---
        x = np.arange(len(revenues))
        degree = min(2, len(revenues) - 1)

        try:
            coeffs = np.polyfit(x, revenues, degree)
            poly = np.poly1d(coeffs)

            # Calculate R² score on training data
            predicted_train = poly(x)
            ss_res = np.sum((revenues - predicted_train) ** 2)
            ss_tot = np.sum((revenues - np.mean(revenues)) ** 2)
            r_squared = float(1 - (ss_res / ss_tot)) if ss_tot > 0 else 0

            # Residual standard deviation for confidence bounds
            residual_std = float(np.std(revenues - predicted_train))

            # --- Generate forecast ---
            forecast = []
            for i in range(1, forecast_days + 1):
                future_x = len(revenues) - 1 + i
                predicted = float(poly(future_x))
                predicted = max(0, predicted)  # Revenue can't be negative

                # Confidence bounds widen as we project further
                margin = residual_std * (1 + 0.15 * i)
                upper = round(predicted + margin, 2)
                lower = round(max(0, predicted - margin), 2)

                future_date = today + timedelta(days=i)
                forecast.append({
                    "date": future_date.strftime("%Y-%m-%d"),
                    "forecast": round(predicted, 2),
                    "upper": upper,
                    "lower": lower,
                    "type": "forecast"
                })

            logger.info(f"Sales forecast generated: R²={r_squared:.3f}, {len(forecast)} days projected")

            return {
                "historical": historical,
                "forecast": forecast,
                "model": f"polynomial_degree_{degree}",
                "r_squared": round(r_squared, 4),
                "residual_std": round(residual_std, 2),
                "avg_daily_revenue": round(float(np.mean(revenues)), 2),
                "trend": "up" if coeffs[0] > 0 else "down" if degree == 1 else (
                    "up" if coeffs[-2] > 0 else "down"
                )
            }
        except Exception as e:
            logger.error(f"Forecast model error: {e}")
            return {
                "historical": historical,
                "forecast": [],
                "model": "error",
                "accuracy": 0,
                "error": str(e)
            }
