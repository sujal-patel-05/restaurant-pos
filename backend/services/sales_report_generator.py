"""
Sales Report Generator — Production-Grade Analytics Engine
═══════════════════════════════════════════════════════════
Generates comprehensive, data-rich sales reports with deep
analytics suitable for management decision-making.

Includes:
  • KPI Dashboard (Revenue, Orders, AOV, Cancellation Rate)
  • Daily Revenue Trend with Moving Averages
  • Day-of-Week Performance Analysis
  • Hourly Heatmap / Peak Hours Analysis
  • Top/Bottom Selling Items with Rankings
  • Category Performance Breakdown
  • Payment Mode Distribution
  • Order Source Analysis (POS/Zomato/Swiggy/Waiter)
  • Order Type Analysis (Dine-in/Takeaway/Delivery)
  • Revenue Per Order Analysis
  • Period-over-Period Comparison with Growth Rates
  • Statistical Summary (median, std dev, percentiles)
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case, extract
from datetime import datetime, timedelta, date
from decimal import Decimal
from typing import Dict, Any, List, Optional
from collections import defaultdict
import logging
import statistics

logger = logging.getLogger(__name__)


class SalesReportGenerator:

    @staticmethod
    def generate(
        db: Session,
        restaurant_id: str,
        report_type: str = "monthly",
        days: int = None,
        start_date: datetime = None,
        end_date: datetime = None,
    ) -> Dict[str, Any]:
        from models import Order, OrderItem, MenuItem, MenuCategory, Payment
        from models.order import OrderStatus, OrderType, OrderSource
        from models.billing import PaymentMode

        now = datetime.utcnow()
        today = now.date()

        # ── Resolve date range ──
        if start_date and end_date:
            period_start = start_date
            period_end = end_date
            actual_days = (end_date.date() - start_date.date()).days + 1
            report_label = f"Custom Report ({actual_days} days)"
        elif report_type == "daily":
            period_start = datetime.combine(today, datetime.min.time())
            period_end = now
            actual_days = 1
            report_label = f"Daily Sales Report — {today.strftime('%d %b %Y')}"
        elif report_type == "weekly":
            actual_days = days or 7
            period_start = now - timedelta(days=actual_days)
            period_end = now
            report_label = f"Weekly Sales Report — Last {actual_days} Days"
        elif report_type == "quarterly":
            actual_days = days or 90
            period_start = now - timedelta(days=actual_days)
            period_end = now
            report_label = f"Quarterly Sales Report — Last {actual_days} Days"
        else:
            actual_days = days or 30
            period_start = now - timedelta(days=actual_days)
            period_end = now
            report_label = f"Monthly Sales Report — Last {actual_days} Days"

        # ══════════════════════════════════════════════════════════
        #  BASE DATA
        # ══════════════════════════════════════════════════════════
        orders = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= period_start,
            Order.created_at <= period_end,
        ).all()

        cancelled_count = db.query(func.count(Order.id)).filter(
            Order.restaurant_id == restaurant_id,
            Order.status == OrderStatus.CANCELLED,
            Order.created_at >= period_start,
            Order.created_at <= period_end,
        ).scalar() or 0

        total_orders = len(orders)
        all_amounts = [float(o.total_amount or 0) for o in orders]
        total_revenue = sum(all_amounts)
        total_subtotal = sum(float(o.subtotal or 0) for o in orders)
        total_gst = sum(float(o.gst_amount or 0) for o in orders)
        total_discount = sum(float(o.discount_amount or 0) for o in orders)
        aov = round(total_revenue / total_orders, 2) if total_orders else 0
        cancel_rate = round(cancelled_count / (total_orders + cancelled_count) * 100, 1) if (total_orders + cancelled_count) else 0

        # ── Statistical summary ──
        stats = {}
        if all_amounts:
            sorted_amounts = sorted(all_amounts)
            stats = {
                "min_order": round(sorted_amounts[0], 2),
                "max_order": round(sorted_amounts[-1], 2),
                "median_order": round(statistics.median(sorted_amounts), 2),
                "std_dev": round(statistics.stdev(sorted_amounts), 2) if len(sorted_amounts) > 1 else 0,
                "p25": round(sorted_amounts[len(sorted_amounts)//4], 2),
                "p75": round(sorted_amounts[3*len(sorted_amounts)//4], 2),
                "daily_avg_revenue": round(total_revenue / max(actual_days, 1), 2),
                "daily_avg_orders": round(total_orders / max(actual_days, 1), 1),
            }

        # ══════════════════════════════════════════════════════════
        #  1. DAILY REVENUE TREND + MOVING AVERAGE
        # ══════════════════════════════════════════════════════════
        daily_map = defaultdict(lambda: {"revenue": 0.0, "orders": 0, "subtotal": 0.0})
        for o in orders:
            if o.created_at:
                d = o.created_at.strftime("%Y-%m-%d")
                daily_map[d]["revenue"] += float(o.total_amount or 0)
                daily_map[d]["subtotal"] += float(o.subtotal or 0)
                daily_map[d]["orders"] += 1

        daily_trend = []
        cursor_date = period_start.date() if isinstance(period_start, datetime) else period_start
        end_d = period_end.date() if isinstance(period_end, datetime) else period_end
        while cursor_date <= end_d:
            d_str = cursor_date.strftime("%Y-%m-%d")
            day_data = daily_map.get(d_str, {"revenue": 0.0, "orders": 0})
            daily_trend.append({
                "date": d_str,
                "day": cursor_date.strftime("%a"),
                "day_full": cursor_date.strftime("%A"),
                "revenue": round(day_data["revenue"], 2),
                "orders": day_data["orders"],
                "aov": round(day_data["revenue"] / day_data["orders"], 2) if day_data["orders"] else 0,
            })
            cursor_date += timedelta(days=1)

        # Add 3-day and 7-day moving averages
        for i, day in enumerate(daily_trend):
            # 3-day MA
            window_3 = daily_trend[max(0, i-2):i+1]
            day["ma3"] = round(sum(d["revenue"] for d in window_3) / len(window_3), 2)
            # 7-day MA
            window_7 = daily_trend[max(0, i-6):i+1]
            day["ma7"] = round(sum(d["revenue"] for d in window_7) / len(window_7), 2)

        # Best / worst days
        active_days = [d for d in daily_trend if d["orders"] > 0]
        best_day = max(active_days, key=lambda d: d["revenue"]) if active_days else None
        worst_day = min(active_days, key=lambda d: d["revenue"]) if active_days else None

        # ══════════════════════════════════════════════════════════
        #  2. DAY-OF-WEEK ANALYSIS
        # ══════════════════════════════════════════════════════════
        dow_map = defaultdict(lambda: {"revenue": 0.0, "orders": 0, "count": 0})
        for d in daily_trend:
            dow = d["day"]
            dow_map[dow]["revenue"] += d["revenue"]
            dow_map[dow]["orders"] += d["orders"]
            dow_map[dow]["count"] += 1

        day_order = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
        day_of_week_analysis = []
        for dow in day_order:
            data = dow_map.get(dow, {"revenue": 0, "orders": 0, "count": 1})
            cnt = max(data["count"], 1)
            day_of_week_analysis.append({
                "day": dow,
                "total_revenue": round(data["revenue"], 2),
                "total_orders": data["orders"],
                "avg_revenue": round(data["revenue"] / cnt, 2),
                "avg_orders": round(data["orders"] / cnt, 1),
            })

        busiest_dow = max(day_of_week_analysis, key=lambda d: d["avg_revenue"]) if day_of_week_analysis else None
        slowest_dow = min(day_of_week_analysis, key=lambda d: d["avg_revenue"]) if day_of_week_analysis else None

        # ══════════════════════════════════════════════════════════
        #  3. HOURLY ANALYSIS (PEAK HOURS HEATMAP)
        # ══════════════════════════════════════════════════════════
        hour_map = defaultdict(lambda: {"orders": 0, "revenue": 0.0})
        for o in orders:
            if o.created_at:
                h = o.created_at.hour
                hour_map[h]["orders"] += 1
                hour_map[h]["revenue"] += float(o.total_amount or 0)

        peak_hours = []
        for h in range(6, 24):
            data = hour_map.get(h, {"orders": 0, "revenue": 0.0})
            peak_hours.append({
                "hour": h,
                "label": f"{h:02d}:00",
                "display": f"{h}AM" if h < 12 else ("12PM" if h == 12 else f"{h-12}PM"),
                "orders": data["orders"],
                "revenue": round(data["revenue"], 2),
                "aov": round(data["revenue"] / data["orders"], 2) if data["orders"] else 0,
                "pct_orders": round(data["orders"] / total_orders * 100, 1) if total_orders else 0,
            })

        peak_hour = max(peak_hours, key=lambda h: h["orders"]) if peak_hours else None
        lunch_orders = sum(h["orders"] for h in peak_hours if 11 <= h["hour"] <= 14)
        dinner_orders = sum(h["orders"] for h in peak_hours if 18 <= h["hour"] <= 22)

        # ══════════════════════════════════════════════════════════
        #  4. TOP & BOTTOM SELLING ITEMS
        # ══════════════════════════════════════════════════════════
        item_q = db.query(
            MenuItem.name,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
            func.count(func.distinct(OrderItem.order_id)).label("order_count"),
        ).join(
            OrderItem, OrderItem.menu_item_id == MenuItem.id
        ).join(
            Order, Order.id == OrderItem.order_id
        ).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= period_start,
            Order.created_at <= period_end,
        ).group_by(MenuItem.name).order_by(
            func.sum(OrderItem.quantity * OrderItem.unit_price).desc()
        ).all()

        top_items = []
        for rank, row in enumerate(item_q, 1):
            item_rev = float(row.revenue or 0)
            top_items.append({
                "rank": rank,
                "name": row.name,
                "qty": int(row.qty or 0),
                "revenue": round(item_rev, 2),
                "order_count": int(row.order_count or 0),
                "avg_price": round(item_rev / int(row.qty or 1), 2),
                "pct": round(item_rev / total_revenue * 100, 1) if total_revenue else 0,
            })

        bottom_items = list(reversed(top_items[-5:])) if len(top_items) > 5 else []

        # ══════════════════════════════════════════════════════════
        #  5. CATEGORY PERFORMANCE
        # ══════════════════════════════════════════════════════════
        cat_q = db.query(
            func.coalesce(MenuCategory.name, "Uncategorized").label("category"),
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
            func.count(func.distinct(OrderItem.order_id)).label("order_count"),
        ).select_from(OrderItem).join(
            MenuItem, OrderItem.menu_item_id == MenuItem.id
        ).outerjoin(
            MenuCategory, MenuItem.category_id == MenuCategory.id
        ).join(
            Order, Order.id == OrderItem.order_id
        ).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= period_start,
            Order.created_at <= period_end,
        ).group_by(MenuCategory.name).order_by(
            func.sum(OrderItem.quantity * OrderItem.unit_price).desc()
        ).all()

        category_breakdown = []
        for row in cat_q:
            cat_rev = float(row.revenue or 0)
            category_breakdown.append({
                "category": row.category or "Uncategorized",
                "qty": int(row.qty or 0),
                "revenue": round(cat_rev, 2),
                "order_count": int(row.order_count or 0),
                "pct": round(cat_rev / total_revenue * 100, 1) if total_revenue else 0,
                "avg_item_value": round(cat_rev / int(row.qty or 1), 2),
            })

        # ══════════════════════════════════════════════════════════
        #  6. PAYMENT MODE DISTRIBUTION
        # ══════════════════════════════════════════════════════════
        pay_q = db.query(
            Payment.payment_mode,
            func.count(Payment.id).label("count"),
            func.sum(Payment.amount).label("amount"),
        ).join(
            Order, Order.id == Payment.order_id
        ).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Payment.created_at >= period_start,
            Payment.created_at <= period_end,
        ).group_by(Payment.payment_mode).all()

        total_payments = sum(int(r.count or 0) for r in pay_q)
        payment_modes = []
        for row in pay_q:
            pm_count = int(row.count or 0)
            payment_modes.append({
                "mode": row.payment_mode.value.upper() if row.payment_mode else "UNKNOWN",
                "count": pm_count,
                "amount": round(float(row.amount or 0), 2),
                "pct": round(pm_count / total_payments * 100, 1) if total_payments else 0,
                "avg_txn": round(float(row.amount or 0) / pm_count, 2) if pm_count else 0,
            })

        # ══════════════════════════════════════════════════════════
        #  7. ORDER SOURCE ANALYSIS
        # ══════════════════════════════════════════════════════════
        source_map = defaultdict(lambda: {"count": 0, "revenue": 0.0, "amounts": []})
        for o in orders:
            src = o.order_source.value.upper() if o.order_source else "POS"
            source_map[src]["count"] += 1
            source_map[src]["revenue"] += float(o.total_amount or 0)
            source_map[src]["amounts"].append(float(o.total_amount or 0))

        order_sources = []
        for src, data in sorted(source_map.items(), key=lambda x: x[1]["revenue"], reverse=True):
            src_aov = round(data["revenue"] / data["count"], 2) if data["count"] else 0
            order_sources.append({
                "source": src,
                "count": data["count"],
                "revenue": round(data["revenue"], 2),
                "pct": round(data["count"] / total_orders * 100, 1) if total_orders else 0,
                "aov": src_aov,
                "revenue_pct": round(data["revenue"] / total_revenue * 100, 1) if total_revenue else 0,
            })

        # ══════════════════════════════════════════════════════════
        #  8. ORDER TYPE ANALYSIS
        # ══════════════════════════════════════════════════════════
        type_map = defaultdict(lambda: {"count": 0, "revenue": 0.0})
        for o in orders:
            ot = o.order_type.value.replace("_", " ").title() if o.order_type else "Dine In"
            type_map[ot]["count"] += 1
            type_map[ot]["revenue"] += float(o.total_amount or 0)

        order_types = []
        for ot, data in sorted(type_map.items(), key=lambda x: x[1]["revenue"], reverse=True):
            order_types.append({
                "type": ot,
                "count": data["count"],
                "revenue": round(data["revenue"], 2),
                "pct": round(data["count"] / total_orders * 100, 1) if total_orders else 0,
                "revenue_pct": round(data["revenue"] / total_revenue * 100, 1) if total_revenue else 0,
                "aov": round(data["revenue"] / data["count"], 2) if data["count"] else 0,
            })

        # ══════════════════════════════════════════════════════════
        #  9. PERIOD-OVER-PERIOD COMPARISON
        # ══════════════════════════════════════════════════════════
        prev_start = period_start - timedelta(days=actual_days)
        prev_end = period_start

        prev_orders_q = db.query(Order).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= prev_start,
            Order.created_at < prev_end,
        ).all()

        prev_revenue = sum(float(o.total_amount or 0) for o in prev_orders_q)
        prev_order_count = len(prev_orders_q)
        prev_aov = round(prev_revenue / prev_order_count, 2) if prev_order_count else 0

        rev_change = round((total_revenue - prev_revenue) / prev_revenue * 100, 1) if prev_revenue else 0
        ord_change = round((total_orders - prev_order_count) / prev_order_count * 100, 1) if prev_order_count else 0
        aov_change = round((aov - prev_aov) / prev_aov * 100, 1) if prev_aov else 0

        comparison = {
            "prev_revenue": round(prev_revenue, 2),
            "prev_orders": prev_order_count,
            "prev_aov": prev_aov,
            "revenue_change_pct": rev_change,
            "orders_change_pct": ord_change,
            "aov_change_pct": aov_change,
            "revenue_growth": "up" if rev_change > 0 else ("down" if rev_change < 0 else "flat"),
        }

        # ══════════════════════════════════════════════════════════
        #  10. INSIGHTS (auto-generated text highlights)
        # ══════════════════════════════════════════════════════════
        insights = []
        if best_day:
            insights.append(f"📈 Best day: {best_day['day_full']} {best_day['date']} with ₹{best_day['revenue']:,.0f} ({best_day['orders']} orders)")
        if worst_day and worst_day != best_day:
            insights.append(f"📉 Slowest day: {worst_day['day_full']} {worst_day['date']} with ₹{worst_day['revenue']:,.0f}")
        if busiest_dow:
            insights.append(f"🗓️ Busiest weekday on average: {busiest_dow['day']} (₹{busiest_dow['avg_revenue']:,.0f}/day)")
        if peak_hour:
            insights.append(f"⏰ Peak hour: {peak_hour['display']} ({peak_hour['orders']} orders, {peak_hour['pct_orders']}% of total)")
        if lunch_orders and dinner_orders:
            if lunch_orders > dinner_orders:
                insights.append(f"🍽️ Lunch rush dominates ({lunch_orders} vs {dinner_orders} dinner orders)")
            else:
                insights.append(f"🌙 Dinner service stronger ({dinner_orders} vs {lunch_orders} lunch orders)")
        if top_items:
            top1 = top_items[0]
            insights.append(f"🏆 Top seller: {top1['name']} — {top1['qty']} units, ₹{top1['revenue']:,.0f} ({top1['pct']}% of revenue)")
        if rev_change > 10:
            insights.append(f"🚀 Revenue grew {rev_change:+.1f}% vs previous period — strong performance!")
        elif rev_change < -10:
            insights.append(f"⚠️ Revenue declined {rev_change:+.1f}% vs previous period — needs attention")

        # ══════════════════════════════════════════════════════════
        #  CHARTS
        # ══════════════════════════════════════════════════════════
        charts = []

        if len(daily_trend) > 1:
            charts.append({
                "type": "area",
                "title": "📈 Daily Revenue Trend",
                "data": daily_trend,
                "dataKey": "revenue",
                "xAxisKey": "day" if actual_days <= 7 else "date",
                "color": "#6366f1",
            })

        if top_items:
            charts.append({
                "type": "bar",
                "title": "🏆 Top Selling Items (by Revenue)",
                "data": top_items[:10],
                "dataKey": "revenue",
                "xAxisKey": "name",
                "color": "#10b981",
            })

        if payment_modes:
            charts.append({
                "type": "pie",
                "title": "💳 Payment Mode Distribution",
                "data": [{"name": p["mode"], "value": p["count"]} for p in payment_modes],
            })

        if order_sources and len(order_sources) > 1:
            charts.append({
                "type": "pie",
                "title": "📱 Order Source Distribution",
                "data": [{"name": s["source"], "value": s["count"]} for s in order_sources],
            })

        if peak_hours:
            active_hours = [h for h in peak_hours if h["orders"] > 0]
            if active_hours:
                charts.append({
                    "type": "bar",
                    "title": "⏰ Orders by Hour (Peak Hours)",
                    "data": active_hours,
                    "dataKey": "orders",
                    "xAxisKey": "display",
                    "color": "#f59e0b",
                })

        if day_of_week_analysis:
            charts.append({
                "type": "bar",
                "title": "📅 Revenue by Day of Week",
                "data": day_of_week_analysis,
                "dataKey": "avg_revenue",
                "xAxisKey": "day",
                "color": "#8b5cf6",
            })

        if category_breakdown and len(category_breakdown) > 1:
            charts.append({
                "type": "pie",
                "title": "📂 Category Revenue Share",
                "data": [{"name": c["category"], "value": c["revenue"]} for c in category_breakdown],
            })

        # ── FINAL PAYLOAD ──
        report = {
            "meta": {
                "report_type": report_type,
                "report_label": report_label,
                "period_start": period_start.strftime("%Y-%m-%d") if isinstance(period_start, datetime) else str(period_start),
                "period_end": period_end.strftime("%Y-%m-%d") if isinstance(period_end, datetime) else str(period_end),
                "days": actual_days,
                "generated_at": now.isoformat(),
                "restaurant_id": restaurant_id,
            },
            "kpis": {
                "total_revenue": round(total_revenue, 2),
                "total_orders": total_orders,
                "avg_order_value": aov,
                "total_subtotal": round(total_subtotal, 2),
                "total_gst": round(total_gst, 2),
                "total_discount": round(total_discount, 2),
                "cancelled_orders": cancelled_count,
                "cancellation_rate": cancel_rate,
                "total_items_sold": sum(i["qty"] for i in top_items),
                "unique_items_sold": len(top_items),
            },
            "statistics": stats,
            "daily_trend": daily_trend,
            "best_day": best_day,
            "worst_day": worst_day,
            "day_of_week": day_of_week_analysis,
            "busiest_dow": busiest_dow,
            "slowest_dow": slowest_dow,
            "peak_hours": peak_hours,
            "peak_hour": peak_hour,
            "lunch_vs_dinner": {"lunch": lunch_orders, "dinner": dinner_orders},
            "top_items": top_items,
            "bottom_items": bottom_items,
            "category_breakdown": category_breakdown,
            "payment_modes": payment_modes,
            "order_sources": order_sources,
            "order_types": order_types,
            "comparison": comparison,
            "insights": insights,
            "charts": charts,
        }

        logger.info(
            f"Report generated: {report_type} | {total_orders} orders | "
            f"₹{total_revenue:,.2f} revenue | {actual_days} days | {len(charts)} charts"
        )

        return report
