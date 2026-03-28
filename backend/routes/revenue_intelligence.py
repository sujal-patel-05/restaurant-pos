"""
Revenue Intelligence API Routes
─────────────────────────────────
Endpoints for the Revenue Intelligence & Menu Optimization Engine.
"""

from fastapi import APIRouter, Depends, Query
from sqlalchemy.orm import Session
from database import get_db
from models import User
from routes.auth import get_current_user
from services.revenue_intelligence_service import RevenueIntelligenceService

router = APIRouter(
    prefix="/api/revenue-intelligence",
    tags=["Revenue Intelligence"],
)

svc = RevenueIntelligenceService


@router.get("/full-report")
def get_full_report(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Complete Revenue Intelligence report — all 9 analysis modules."""
    return svc.get_full_report(db, str(current_user.restaurant_id), days)


@router.get("/margins")
def get_margins(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Contribution margin for every menu item."""
    return {"margins": svc.get_contribution_margins(db, str(current_user.restaurant_id), days)}


@router.get("/profitability")
def get_profitability(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Item-level profitability analysis."""
    return {"profitability": svc.get_item_profitability(db, str(current_user.restaurant_id), days)}


@router.get("/velocity")
def get_velocity(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Sales velocity & BCG-style popularity scoring."""
    return {"velocity": svc.get_sales_velocity(db, str(current_user.restaurant_id), days)}


@router.get("/combos")
def get_combos(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Combo recommendations from association analysis."""
    return {"combos": svc.get_combo_recommendations(db, str(current_user.restaurant_id), days)}


@router.get("/upsells")
def get_upsells(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Smart upsell prioritisation with profit impact estimates."""
    return {"upsells": svc.get_upsell_priorities(db, str(current_user.restaurant_id), days)}


@router.get("/price-recommendations")
def get_price_recommendations(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """Price optimisation suggestions with projected revenue impact."""
    return {"price_recommendations": svc.get_price_recommendations(db, str(current_user.restaurant_id), days)}
