"""
Custom CrewAI Tools for SujalPOS
Wraps existing ReportService and InventoryService for agent consumption
"""

import json
from datetime import datetime, timedelta
from crewai.tools import tool
from database import SessionLocal
from models import Restaurant, MenuItem
from services.report_service import ReportService
from services.inventory_service import InventoryService


def _get_db_and_restaurant():
    """Get database session and first restaurant"""
    db = SessionLocal()
    restaurant = db.query(Restaurant).first()
    if not restaurant:
        db.close()
        return None, None, "No restaurant found in database"
    return db, restaurant, None


def _safe_json(data):
    """Convert data to JSON-safe string"""
    def default_serializer(obj):
        if hasattr(obj, 'isoformat'):
            return obj.isoformat()
        if hasattr(obj, '__float__'):
            return float(obj)
        return str(obj)
    return json.dumps(data, indent=2, default=default_serializer)


# ═══════════════════════════════════════════════════════
# INVENTORY TOOLS
# ═══════════════════════════════════════════════════════

@tool("Get Low Stock Items")
def get_low_stock_items(query: str = "low stock") -> str:
    """
    Get all ingredients that are currently below their reorder level.
    Returns a list of items with name, current stock, reorder level, and unit.
    Use this to identify which ingredients need urgent restocking.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        alerts = InventoryService.get_low_stock_alerts(db, restaurant.id)
        if not alerts:
            return "No low stock alerts. All ingredient levels are healthy."
        return f"LOW STOCK ALERTS ({len(alerts)} items):\n{_safe_json(alerts)}"
    finally:
        db.close()


@tool("Get Expiry Alerts")
def get_expiry_alerts(query: str = "expiry") -> str:
    """
    Get ingredients expiring within the next 7 days.
    Returns items with name, current stock, expiry date, and unit.
    Use this to prevent wastage from expired ingredients.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        alerts = InventoryService.get_expiry_alerts(db, restaurant.id, days=7)
        if not alerts:
            return "No expiry alerts. No ingredients expiring within 7 days."
        return f"EXPIRY ALERTS ({len(alerts)} items expiring within 7 days):\n{_safe_json(alerts)}"
    finally:
        db.close()


@tool("Get Wastage Data")
def get_wastage_data(query: str = "wastage") -> str:
    """
    Get wastage analysis for the past 30 days.
    Returns total wastage cost and breakdown by ingredient with reasons.
    Use this to identify wastage patterns and suggest cost-saving measures.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=30)
        report = ReportService.get_wastage_report(db, restaurant.id, start_date, end_date)
        if not report.get("wastage_details"):
            return "No wastage recorded in the past 30 days."
        return f"WASTAGE REPORT (Last 30 Days):\nTotal Cost: ₹{report['total_wastage_cost']:.2f}\n{_safe_json(report)}"
    finally:
        db.close()


@tool("Get Ingredient Usage")
def get_ingredient_usage(query: str = "usage") -> str:
    """
    Get ingredient consumption/usage data for the past 7 days.
    Returns how much of each ingredient was used based on order deductions.
    Use this to calculate burn rates and predict when stock will run out.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        usage = ReportService.get_ingredient_usage(db, restaurant.id, start_date, end_date)
        if not usage:
            return "No ingredient usage data in the past 7 days."
        return f"INGREDIENT USAGE (Last 7 Days):\n{_safe_json(usage)}"
    finally:
        db.close()


# ═══════════════════════════════════════════════════════
# SALES TOOLS
# ═══════════════════════════════════════════════════════

@tool("Get Sales Summary")
def get_sales_summary(query: str = "sales") -> str:
    """
    Get sales summary for the past 7 days.
    Returns total revenue, total orders, and average order value.
    Also includes today's stats and comparison with yesterday.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        # Weekly report
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        weekly = ReportService.get_sales_report(db, restaurant.id, start_date, end_date)
        
        # Dashboard stats (today vs yesterday)
        stats = ReportService.get_dashboard_stats(db, restaurant.id)
        
        result = {
            "weekly_summary": weekly,
            "today": {
                "revenue": stats["total_revenue"],
                "orders": stats["total_orders"],
                "revenue_trend_vs_yesterday": f"{stats['revenue_trend']}%",
                "orders_trend_vs_yesterday": f"{stats['orders_trend']}%"
            }
        }
        return f"SALES SUMMARY:\n{_safe_json(result)}"
    finally:
        db.close()


@tool("Get Peak Hours Analysis")
def get_peak_hours(query: str = "peak hours") -> str:
    """
    Analyze peak ordering hours over the past 7 days.
    Returns hour-by-hour breakdown of order count and revenue.
    Use this to identify busiest hours for staffing and prep planning.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        hours = ReportService.get_peak_hours(db, restaurant.id, start_date, end_date)
        if not hours:
            return "No peak hour data available for the past 7 days."
        return f"PEAK HOURS ANALYSIS (Last 7 Days):\n{_safe_json(hours)}"
    finally:
        db.close()


@tool("Get Item Performance")
def get_item_performance(query: str = "item performance") -> str:
    """
    Get item-wise sales performance for the past 7 days.
    Returns each menu item's quantity sold and revenue generated.
    Use this to identify best sellers, worst sellers, and trending items.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        end_date = datetime.utcnow()
        start_date = end_date - timedelta(days=7)
        items = ReportService.get_item_wise_sales(db, restaurant.id, start_date, end_date)
        if not items:
            return "No item sales data available for the past 7 days."
        return f"ITEM PERFORMANCE (Last 7 Days):\n{_safe_json(items)}"
    finally:
        db.close()


@tool("Get Revenue Trends")
def get_revenue_trends(query: str = "revenue trends") -> str:
    """
    Get day-by-day revenue and order count trends for the past 7 days.
    Returns daily revenue, order counts, and top selling items.
    Use this to identify day-of-week patterns and growth/decline trends.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        charts = ReportService.get_dashboard_charts(db, restaurant.id)
        return f"REVENUE TRENDS (Last 7 Days):\n{_safe_json(charts)}"
    finally:
        db.close()


# ═══════════════════════════════════════════════════════
# PRICING / COST TOOLS
# ═══════════════════════════════════════════════════════

@tool("Get Cost Analysis For All Items")
def get_cost_analysis(query: str = "cost analysis") -> str:
    """
    Get cost-per-dish analysis for all menu items using BOM data.
    Returns selling price, ingredient cost, profit margin, and margin percentage.
    Use this to find high-margin and low-margin items for pricing decisions.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        menu_items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant.id,
            MenuItem.is_available == True
        ).all()
        
        results = []
        for item in menu_items:
            cost_data = ReportService.get_cost_per_dish(db, item.id)
            if cost_data.get("success"):
                results.append({
                    "item": cost_data["menu_item"],
                    "selling_price": cost_data["selling_price"],
                    "cost": cost_data["total_cost"],
                    "profit_margin": cost_data["profit_margin"],
                    "profit_pct": round(cost_data["profit_percentage"], 1)
                })
        
        if not results:
            return "No cost analysis data available. BOM mappings may not be configured."
        
        # Sort by profit percentage
        results.sort(key=lambda x: x["profit_pct"], reverse=True)
        return f"COST ANALYSIS ({len(results)} items):\n{_safe_json(results)}"
    finally:
        db.close()


@tool("Get Dashboard Overview")
def get_dashboard_overview(query: str = "dashboard") -> str:
    """
    Get a quick overview of today's restaurant performance.
    Returns today's revenue, orders, trends vs yesterday, menu item count, and staff count.
    The query parameter is optional and ignored.
    """
    db, restaurant, err = _get_db_and_restaurant()
    if err:
        return err
    try:
        stats = ReportService.get_dashboard_stats(db, restaurant.id)
        return f"TODAY'S DASHBOARD:\n{_safe_json(stats)}"
    finally:
        db.close()
