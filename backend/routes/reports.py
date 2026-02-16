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
