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

