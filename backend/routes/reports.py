from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from database import get_db
from models import User
from services.report_service import ReportService
from routes.auth import get_current_user
from datetime import datetime, timedelta
from uuid import UUID

router = APIRouter(prefix="/api/reports", tags=["Reports & Analytics"])

@router.get("/dashboard-stats")
def get_dashboard_stats(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard overview statistics"""
    return ReportService.get_dashboard_stats(db, current_user.restaurant_id)

@router.get("/dashboard-charts")
def get_dashboard_charts(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get dashboard chart data for visualizations"""
    return ReportService.get_dashboard_charts(db, current_user.restaurant_id)

@router.get("/sales")
def get_sales_report(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get sales report"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    report = ReportService.get_sales_report(
        db,
        current_user.restaurant_id,
        start_date,
        end_date
    )
    
    return report

@router.get("/sales/items")
def get_item_wise_sales(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get item-wise sales report"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    report = ReportService.get_item_wise_sales(
        db,
        current_user.restaurant_id,
        start_date,
        end_date
    )
    
    return {"items": report}

@router.get("/peak-hours")
def get_peak_hours(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get peak hours analysis"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    report = ReportService.get_peak_hours(
        db,
        current_user.restaurant_id,
        start_date,
        end_date
    )
    
    return {"peak_hours": report}

@router.get("/inventory/usage")
def get_ingredient_usage(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get ingredient usage report"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    report = ReportService.get_ingredient_usage(
        db,
        current_user.restaurant_id,
        start_date,
        end_date
    )
    
    return {"ingredients": report}

@router.get("/wastage")
def get_wastage_report(
    days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get wastage report"""
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    
    report = ReportService.get_wastage_report(
        db,
        current_user.restaurant_id,
        start_date,
        end_date
    )
    
    return report

@router.get("/cost-analysis/{menu_item_id}")
def get_cost_per_dish(
    menu_item_id: UUID,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get cost analysis for a menu item"""
    report = ReportService.get_cost_per_dish(db, menu_item_id)
    return report

@router.get("/sales-forecast")
def get_sales_forecast(
    days: int = 30,
    forecast_days: int = 7,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """ML-powered sales forecast using polynomial regression"""
    return ReportService.get_sales_forecast(
        db,
        current_user.restaurant_id,
        history_days=days,
        forecast_days=forecast_days
    )

# ── Daily Summaries (Stored Snapshots) ──

@router.get("/daily-summaries")
def get_daily_summaries(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Get stored daily summary snapshots for the last N days"""
    from services.snapshot_service import SnapshotService
    summaries = SnapshotService.get_summaries(db, str(current_user.restaurant_id), days)
    return {"summaries": summaries, "count": len(summaries), "period_days": days}

@router.post("/daily-summaries/snapshot")
def trigger_daily_snapshot(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Manually trigger today's daily snapshot (recalculate)"""
    from services.snapshot_service import SnapshotService
    from datetime import date
    summary = SnapshotService.compute_daily_snapshot(
        db, str(current_user.restaurant_id), date.today()
    )
    return {
        "status": "success",
        "date": str(summary.summary_date),
        "total_revenue": float(summary.total_revenue or 0),
        "total_orders": summary.total_orders or 0,
        "top_selling_item": summary.top_selling_item
    }

@router.get("/daily-summaries/monthly-comparison")
def get_monthly_comparison(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Compare this month vs last month using stored daily summaries"""
    from services.snapshot_service import SnapshotService
    return SnapshotService.get_monthly_comparison(db, str(current_user.restaurant_id))


# ── Online vs Offline Analytics ──

@router.get("/online-vs-offline")
def get_online_vs_offline(
    days: int = 30,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Online vs Offline order analytics — Zomato/Swiggy breakdown"""
    from sqlalchemy import func, case
    from models import Order, OrderStatus, OrderSource
    
    end_date = datetime.utcnow()
    start_date = end_date - timedelta(days=days)
    rid = str(current_user.restaurant_id)
    
    # All non-cancelled orders in period
    orders = db.query(Order).filter(
        Order.restaurant_id == rid,
        Order.status != OrderStatus.CANCELLED,
        Order.status != OrderStatus.PENDING_ONLINE,
        Order.created_at >= start_date,
    ).all()
    
    # Aggregate
    online_orders = [o for o in orders if o.order_source in (OrderSource.ZOMATO, OrderSource.SWIGGY)]
    offline_orders = [o for o in orders if o.order_source == OrderSource.POS or o.order_source is None]
    
    zomato = [o for o in online_orders if o.order_source == OrderSource.ZOMATO]
    swiggy = [o for o in online_orders if o.order_source == OrderSource.SWIGGY]
    
    def agg(lst):
        revenue = sum(float(o.total_amount or 0) for o in lst)
        return {"count": len(lst), "revenue": round(revenue, 2)}
    
    # Daily trend
    from collections import defaultdict
    daily = defaultdict(lambda: {"online": 0, "offline": 0, "zomato": 0, "swiggy": 0,
                                  "online_rev": 0, "offline_rev": 0})
    for o in orders:
        d = o.created_at.strftime("%Y-%m-%d") if o.created_at else "unknown"
        amt = float(o.total_amount or 0)
        if o.order_source in (OrderSource.ZOMATO, OrderSource.SWIGGY):
            daily[d]["online"] += 1
            daily[d]["online_rev"] += amt
            if o.order_source == OrderSource.ZOMATO:
                daily[d]["zomato"] += 1
            else:
                daily[d]["swiggy"] += 1
        else:
            daily[d]["offline"] += 1
            daily[d]["offline_rev"] += amt
    
    daily_trend = sorted([
        {"date": k, **v} for k, v in daily.items()
    ], key=lambda x: x["date"])
    
    total_count = len(orders)
    online_pct = round(len(online_orders) / total_count * 100, 1) if total_count else 0
    
    return {
        "period_days": days,
        "total_orders": total_count,
        "online": agg(online_orders),
        "offline": agg(offline_orders),
        "zomato": agg(zomato),
        "swiggy": agg(swiggy),
        "online_percentage": online_pct,
        "daily_trend": daily_trend[-14:],  # Last 14 days
        "platform_split": {
            "type": "pie",
            "title": "Order Source Distribution",
            "data": [
                {"label": "POS / Walk-in", "value": len(offline_orders)},
                {"label": "Zomato", "value": len(zomato)},
                {"label": "Swiggy", "value": len(swiggy)},
            ]
        }
    }
