"""
Snapshot Service — Computes and stores daily aggregated metrics into DailySummary table.
Runs automatically on startup for any missing days, and can be triggered manually.
"""

import logging
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Optional, List, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func, extract, and_, case
from uuid import UUID

from models import (
    Order, OrderItem, OrderStatus, OrderType, MenuItem,
    Payment, WastageLog, Ingredient, DailySummary, Restaurant
)

logger = logging.getLogger(__name__)


class SnapshotService:
    """Aggregates daily data from orders, payments, wastage into DailySummary rows"""

    @staticmethod
    def compute_daily_snapshot(db: Session, restaurant_id: str, target_date: date) -> DailySummary:
        """
        Compute all metrics for a single day and upsert into DailySummary.
        If a row already exists for that day, it will be updated (idempotent).
        """
        day_start = datetime.combine(target_date, datetime.min.time())
        day_end = datetime.combine(target_date, datetime.max.time())

        # ── Orders ──
        orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.created_at >= day_start,
            Order.created_at <= day_end
        ).all()

        total_orders = len(orders)
        completed = [o for o in orders if o.status != OrderStatus.CANCELLED]
        cancelled = [o for o in orders if o.status == OrderStatus.CANCELLED]

        total_revenue = sum(float(o.total_amount or 0) for o in completed)
        total_gst = sum(float(o.gst_amount or 0) for o in completed)
        total_discount = sum(float(o.discount_amount or 0) for o in completed)
        avg_order_value = total_revenue / len(completed) if completed else 0

        # Order type breakdown
        dine_in = [o for o in completed if o.order_type == OrderType.DINE_IN]
        takeaway = [o for o in completed if o.order_type == OrderType.TAKEAWAY]
        delivery = [o for o in completed if o.order_type == OrderType.DELIVERY]

        # ── Payments ──
        payments = db.query(Payment).filter(
            Payment.order_id.in_([o.id for o in completed])
        ).all() if completed else []

        cash_total = sum(float(p.amount or 0) for p in payments if p.payment_mode and p.payment_mode.value == 'cash')
        upi_total = sum(float(p.amount or 0) for p in payments if p.payment_mode and p.payment_mode.value == 'upi')
        card_total = sum(float(p.amount or 0) for p in payments if p.payment_mode and p.payment_mode.value == 'card')

        # ── Top selling item ──
        top_item_name = None
        top_item_qty = 0
        if completed:
            order_ids = [o.id for o in completed]
            top_item = db.query(
                MenuItem.name,
                func.sum(OrderItem.quantity).label('total_qty')
            ).join(
                OrderItem, MenuItem.id == OrderItem.menu_item_id
            ).filter(
                OrderItem.order_id.in_(order_ids)
            ).group_by(MenuItem.name).order_by(
                func.sum(OrderItem.quantity).desc()
            ).first()
            if top_item:
                top_item_name = top_item.name
                top_item_qty = int(top_item.total_qty)

        # ── Peak hour ──
        peak_hour = None
        peak_hour_orders = 0
        if completed:
            hour_counts = {}
            for o in completed:
                h = o.created_at.hour
                hour_counts[h] = hour_counts.get(h, 0) + 1
            if hour_counts:
                peak_hour = max(hour_counts, key=hour_counts.get)
                peak_hour_orders = hour_counts[peak_hour]

        # ── Wastage ──
        wastage_logs = db.query(WastageLog).filter(
            WastageLog.created_at >= day_start,
            WastageLog.created_at <= day_end
        ).all()
        # Filter by restaurant via ingredient
        wastage_entries = len(wastage_logs)
        wastage_cost = 0.0
        for wl in wastage_logs:
            ingredient = db.query(Ingredient).filter(Ingredient.id == wl.ingredient_id).first()
            if ingredient and str(ingredient.restaurant_id) == str(restaurant_id):
                wastage_cost += float(wl.quantity or 0) * float(ingredient.cost_per_unit or 0)

        # ── Low stock ──
        low_stock = db.query(Ingredient).filter(
            Ingredient.restaurant_id == restaurant_id,
            Ingredient.current_stock <= Ingredient.reorder_level
        ).count()

        # ── Upsert ──
        existing = db.query(DailySummary).filter(
            DailySummary.restaurant_id == restaurant_id,
            DailySummary.summary_date == target_date
        ).first()

        if existing:
            summary = existing
        else:
            summary = DailySummary(restaurant_id=restaurant_id, summary_date=target_date)
            db.add(summary)

        summary.total_revenue = round(total_revenue, 2)
        summary.total_orders = total_orders
        summary.completed_orders = len(completed)
        summary.cancelled_orders = len(cancelled)
        summary.avg_order_value = round(avg_order_value, 2)
        summary.dine_in_orders = len(dine_in)
        summary.takeaway_orders = len(takeaway)
        summary.delivery_orders = len(delivery)
        summary.dine_in_revenue = round(sum(float(o.total_amount or 0) for o in dine_in), 2)
        summary.takeaway_revenue = round(sum(float(o.total_amount or 0) for o in takeaway), 2)
        summary.delivery_revenue = round(sum(float(o.total_amount or 0) for o in delivery), 2)
        summary.total_gst = round(total_gst, 2)
        summary.total_discount = round(total_discount, 2)
        summary.cash_payments = round(cash_total, 2)
        summary.upi_payments = round(upi_total, 2)
        summary.card_payments = round(card_total, 2)
        summary.total_wastage_entries = wastage_entries
        summary.total_wastage_cost = round(wastage_cost, 2)
        summary.low_stock_count = low_stock
        summary.top_selling_item = top_item_name
        summary.top_selling_qty = top_item_qty
        summary.peak_hour = peak_hour
        summary.peak_hour_orders = peak_hour_orders
        summary.updated_at = datetime.utcnow()

        db.commit()
        db.refresh(summary)
        logger.info(f"Snapshot {target_date}: ₹{total_revenue:,.0f} | {total_orders} orders")
        return summary

    @staticmethod
    def backfill_missing_days(db: Session, restaurant_id: str, lookback_days: int = 30):
        """
        Check for missing daily summaries in the last N days and fill them.
        Called on app startup to ensure continuity.
        """
        today = date.today()
        filled = 0
        for i in range(lookback_days, -1, -1):
            target = today - timedelta(days=i)
            existing = db.query(DailySummary).filter(
                DailySummary.restaurant_id == restaurant_id,
                DailySummary.summary_date == target
            ).first()
            if not existing:
                SnapshotService.compute_daily_snapshot(db, restaurant_id, target)
                filled += 1

        # Always refresh today (data changes throughout the day)
        SnapshotService.compute_daily_snapshot(db, restaurant_id, today)
        logger.info(f"Backfill complete: {filled} missing days filled + today refreshed")

    @staticmethod
    def get_summaries(db: Session, restaurant_id: str, days: int = 30) -> List[Dict[str, Any]]:
        """Get daily summaries for the last N days"""
        start_date = date.today() - timedelta(days=days)
        summaries = db.query(DailySummary).filter(
            DailySummary.restaurant_id == restaurant_id,
            DailySummary.summary_date >= start_date
        ).order_by(DailySummary.summary_date.asc()).all()

        return [{
            'date': str(s.summary_date),
            'total_revenue': float(s.total_revenue or 0),
            'total_orders': s.total_orders or 0,
            'completed_orders': s.completed_orders or 0,
            'cancelled_orders': s.cancelled_orders or 0,
            'avg_order_value': float(s.avg_order_value or 0),
            'dine_in_orders': s.dine_in_orders or 0,
            'takeaway_orders': s.takeaway_orders or 0,
            'delivery_orders': s.delivery_orders or 0,
            'dine_in_revenue': float(s.dine_in_revenue or 0),
            'takeaway_revenue': float(s.takeaway_revenue or 0),
            'delivery_revenue': float(s.delivery_revenue or 0),
            'total_gst': float(s.total_gst or 0),
            'total_discount': float(s.total_discount or 0),
            'cash_payments': float(s.cash_payments or 0),
            'upi_payments': float(s.upi_payments or 0),
            'card_payments': float(s.card_payments or 0),
            'total_wastage_entries': s.total_wastage_entries or 0,
            'total_wastage_cost': float(s.total_wastage_cost or 0),
            'low_stock_count': s.low_stock_count or 0,
            'top_selling_item': s.top_selling_item,
            'top_selling_qty': s.top_selling_qty or 0,
            'peak_hour': s.peak_hour,
            'peak_hour_orders': s.peak_hour_orders or 0,
        } for s in summaries]

    @staticmethod
    def get_monthly_comparison(db: Session, restaurant_id: str) -> Dict[str, Any]:
        """Compare this month vs last month using stored daily summaries"""
        today = date.today()
        this_month_start = today.replace(day=1)
        last_month_end = this_month_start - timedelta(days=1)
        last_month_start = last_month_end.replace(day=1)

        def aggregate_period(start, end):
            rows = db.query(DailySummary).filter(
                DailySummary.restaurant_id == restaurant_id,
                DailySummary.summary_date >= start,
                DailySummary.summary_date <= end
            ).all()
            return {
                'revenue': sum(float(r.total_revenue or 0) for r in rows),
                'orders': sum(r.total_orders or 0 for r in rows),
                'avg_order_value': sum(float(r.avg_order_value or 0) for r in rows) / len(rows) if rows else 0,
                'wastage_cost': sum(float(r.total_wastage_cost or 0) for r in rows),
                'days': len(rows)
            }

        this_month = aggregate_period(this_month_start, today)
        last_month = aggregate_period(last_month_start, last_month_end)

        # Calculate growth percentages
        def pct_change(current, previous):
            if previous == 0:
                return 100.0 if current > 0 else 0.0
            return round(((current - previous) / previous) * 100, 1)

        return {
            'this_month': this_month,
            'last_month': last_month,
            'revenue_growth': pct_change(this_month['revenue'], last_month['revenue']),
            'order_growth': pct_change(this_month['orders'], last_month['orders']),
        }
