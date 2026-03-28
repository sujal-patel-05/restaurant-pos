"""
Revenue Intelligence & Menu Optimization Engine
─────────────────────────────────────────────────
Production-level analytics service that transforms raw POS data
into actionable menu optimisation insights.

Modules:
  1. Contribution Margin Calculation
  2. Item-Level Profitability Analysis
  3. Sales Velocity & Popularity Scoring
  4. High-Margin Under-Promoted Detection
  5. Low-Margin High-Volume Risk Detection
  6. Combo Recommendation via Association Analysis
  7. Smart Upsell Prioritisation
  8. Price Optimisation Recommendations
  9. Inventory-Linked Performance Signals
"""

from sqlalchemy.orm import Session
from sqlalchemy import func, and_, case
from models import (
    MenuItem, MenuCategory, OrderItem, Order, OrderStatus,
    Ingredient, BOMMaping, InventoryTransaction
)
from typing import Dict, List, Optional, Tuple
from decimal import Decimal
from datetime import datetime, timedelta
from collections import defaultdict, Counter
import logging
import math

logger = logging.getLogger(__name__)


class RevenueIntelligenceService:
    """
    Core analytics engine for menu revenue intelligence.
    All methods accept a DB session, restaurant_id, and analysis window (days).
    """

    # ─── 1. Contribution Margin ─────────────────────────────────

    @staticmethod
    def get_contribution_margins(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        For every menu item compute:
        Contribution Margin = Selling Price − Food Cost (from BOM).
        """
        items = db.query(MenuItem).filter(
            MenuItem.restaurant_id == restaurant_id,
            MenuItem.is_available == True,
        ).all()

        margins = []
        for item in items:
            food_cost = RevenueIntelligenceService._food_cost(db, item)
            selling = float(item.price)
            margin_abs = selling - food_cost
            margin_pct = (margin_abs / selling * 100) if selling > 0 else 0

            # Get category name
            cat_name = "Uncategorized"
            if item.category_id:
                cat = db.query(MenuCategory).filter(
                    MenuCategory.id == item.category_id
                ).first()
                if cat:
                    cat_name = cat.name

            margins.append({
                "id":             str(item.id),
                "name":           item.name,
                "category":       cat_name,
                "selling_price":  round(selling, 2),
                "food_cost":      round(food_cost, 2),
                "margin":         round(margin_abs, 2),
                "margin_pct":     round(margin_pct, 1),
                "margin_tier":    (
                    "high"   if margin_pct >= 60 else
                    "medium" if margin_pct >= 40 else
                    "low"
                ),
            })

        margins.sort(key=lambda m: m["margin_pct"], reverse=True)
        return margins

    # ─── 2. Item-Level Profitability ────────────────────────────

    @staticmethod
    def get_item_profitability(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        Revenue, units sold, total profit contribution per item.
        """
        end = datetime.utcnow()
        start = end - timedelta(days=days)

        sales = db.query(
            OrderItem.menu_item_id,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
        ).join(Order, Order.id == OrderItem.order_id).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start,
            Order.created_at <= end,
        ).group_by(OrderItem.menu_item_id).all()

        items_map = {
            str(i.id): i
            for i in db.query(MenuItem).filter(
                MenuItem.restaurant_id == restaurant_id
            ).all()
        }

        total_profit = Decimal("0")
        rows = []
        for s in sales:
            item = items_map.get(str(s.menu_item_id))
            if not item:
                continue
            food_cost = RevenueIntelligenceService._food_cost(db, item)
            qty = int(s.qty or 0)
            revenue = float(s.revenue or 0)
            profit = revenue - (food_cost * qty)
            total_profit += Decimal(str(profit))
            rows.append({
                "id":           str(item.id),
                "name":         item.name,
                "qty_sold":     qty,
                "revenue":      round(revenue, 2),
                "food_cost_total": round(food_cost * qty, 2),
                "profit":       round(profit, 2),
                "profit_per_unit": round(profit / qty, 2) if qty > 0 else 0,
            })

        # Rank by profit
        rows.sort(key=lambda r: r["profit"], reverse=True)
        for i, r in enumerate(rows):
            r["rank"] = i + 1
            r["profit_share"] = round(
                r["profit"] / float(total_profit) * 100, 1
            ) if total_profit > 0 else 0

        return rows

    # ─── 3. Sales Velocity & Popularity Scoring ────────────────

    @staticmethod
    def get_sales_velocity(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        Compute orders/day, velocity score (0-100), and BCG-style tier.
        Tiers: Star (high pop, high margin), Workhorse (high pop, low margin),
               Puzzle (low pop, high margin), Dog (low pop, low margin).
        """
        end = datetime.utcnow()
        start = end - timedelta(days=days)

        sales = db.query(
            OrderItem.menu_item_id,
            func.sum(OrderItem.quantity).label("qty"),
            func.sum(OrderItem.quantity * OrderItem.unit_price).label("revenue"),
        ).join(Order, Order.id == OrderItem.order_id).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start,
            Order.created_at <= end,
        ).group_by(OrderItem.menu_item_id).all()

        items_map = {
            str(i.id): i
            for i in db.query(MenuItem).filter(
                MenuItem.restaurant_id == restaurant_id
            ).all()
        }

        rows = []
        for s in sales:
            item = items_map.get(str(s.menu_item_id))
            if not item:
                continue
            qty = int(s.qty or 0)
            per_day = qty / max(days, 1)
            food_cost = RevenueIntelligenceService._food_cost(db, item)
            margin_pct = ((float(item.price) - food_cost) / float(item.price) * 100) \
                if float(item.price) > 0 else 0
            rows.append({
                "id":          str(item.id),
                "name":        item.name,
                "qty_sold":    qty,
                "per_day":     round(per_day, 1),
                "revenue":     round(float(s.revenue or 0), 2),
                "margin_pct":  round(margin_pct, 1),
            })

        if not rows:
            return []

        # Normalise velocity to 0-100 score
        max_per_day = max(r["per_day"] for r in rows) or 1
        avg_velocity = sum(r["per_day"] for r in rows) / len(rows)
        avg_margin = sum(r["margin_pct"] for r in rows) / len(rows)

        for r in rows:
            r["velocity_score"] = round(r["per_day"] / max_per_day * 100, 0)
            high_pop = r["per_day"] >= avg_velocity
            high_margin = r["margin_pct"] >= avg_margin
            if high_pop and high_margin:
                r["tier"] = "Star"
                r["tier_desc"] = "High popularity & high margin — keep promoting"
            elif high_pop and not high_margin:
                r["tier"] = "Workhorse"
                r["tier_desc"] = "Sells well but thin margins — optimise cost or raise price"
            elif not high_pop and high_margin:
                r["tier"] = "Puzzle"
                r["tier_desc"] = "Great margins but low sales — needs promotion"
            else:
                r["tier"] = "Dog"
                r["tier_desc"] = "Low sales & low margins — consider removing"

        rows.sort(key=lambda r: r["velocity_score"], reverse=True)
        return rows

    # ─── 4. Under-Promoted High-Margin Items ───────────────────

    @staticmethod
    def get_underpromoteds(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """Items with margin ≥ 60% but below-average velocity. Hidden Gems."""
        velocity = RevenueIntelligenceService.get_sales_velocity(
            db, restaurant_id, days
        )
        if not velocity:
            return []
        avg_vel = sum(v["per_day"] for v in velocity) / len(velocity)
        gems = [
            {
                **v,
                "opportunity": "High margin item selling below average — "
                               "promote via combos, menu placement, or upsell scripts",
                "potential_daily_revenue": round(
                    avg_vel * float(v["revenue"]) / max(v["qty_sold"], 1), 2
                ),
            }
            for v in velocity
            if v["margin_pct"] >= 60 and v["per_day"] < avg_vel
        ]
        return gems

    # ─── 5. Low-Margin High-Volume Risk ────────────────────────

    @staticmethod
    def get_low_margin_risks(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """Items with margin < 45% and above-average sales volume."""
        velocity = RevenueIntelligenceService.get_sales_velocity(
            db, restaurant_id, days
        )
        if not velocity:
            return []
        avg_vel = sum(v["per_day"] for v in velocity) / len(velocity)
        risks = [
            {
                **v,
                "risk": "Low margin item with high volume — "
                        "eating into profitability",
                "action": (
                    "Consider raising price by ₹10-20, reducing portion, "
                    "or substituting cheaper ingredients"
                ),
                "margin_gap": round(45 - v["margin_pct"], 1),
            }
            for v in velocity
            if v["margin_pct"] < 45 and v["per_day"] >= avg_vel
        ]
        return risks

    # ─── 6. Combo Recommendations (Association Analysis) ───────

    @staticmethod
    def get_combo_recommendations(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        Find items frequently ordered together (same order) and
        recommend combo deals with projected revenue.
        """
        end = datetime.utcnow()
        start = end - timedelta(days=days)

        # Get all order → items for the period
        order_items = db.query(
            OrderItem.order_id,
            OrderItem.menu_item_id,
            MenuItem.name,
            MenuItem.price,
        ).join(MenuItem, MenuItem.id == OrderItem.menu_item_id) \
         .join(Order, Order.id == OrderItem.order_id).filter(
            Order.restaurant_id == restaurant_id,
            Order.status != OrderStatus.CANCELLED,
            Order.created_at >= start,
            Order.created_at <= end,
        ).all()

        # Group items by order
        orders_dict: Dict[str, List[dict]] = defaultdict(list)
        for oi in order_items:
            orders_dict[str(oi.order_id)].append({
                "id":    str(oi.menu_item_id),
                "name":  oi.name,
                "price": float(oi.price),
            })

        # Count pairs
        pair_counts: Counter = Counter()
        pair_info: Dict[tuple, dict] = {}
        total_orders = len(orders_dict)

        for order_id, items in orders_dict.items():
            if len(items) < 2:
                continue
            # Unique item names in this order
            unique = list({i["name"]: i for i in items}.values())
            for i in range(len(unique)):
                for j in range(i + 1, len(unique)):
                    pair_key = tuple(sorted([unique[i]["name"], unique[j]["name"]]))
                    pair_counts[pair_key] += 1
                    if pair_key not in pair_info:
                        pair_info[pair_key] = {
                            "item_a": unique[i],
                            "item_b": unique[j],
                        }

        # Build recommendations — pairs appearing in ≥ 5% of orders
        min_support = max(int(total_orders * 0.03), 5)
        combos = []
        for pair_key, count in pair_counts.most_common(10):
            if count < min_support:
                continue
            info = pair_info[pair_key]
            combo_price = info["item_a"]["price"] + info["item_b"]["price"]
            # Suggest 10-15% discount on combo
            discount_pct = 12
            combo_deal_price = round(combo_price * (1 - discount_pct / 100), 0)
            support_pct = round(count / total_orders * 100, 1)

            combos.append({
                "item_a":            info["item_a"]["name"],
                "item_b":            info["item_b"]["name"],
                "co_occurrence":     count,
                "support_pct":       support_pct,
                "individual_total":  round(combo_price, 2),
                "suggested_combo_price": combo_deal_price,
                "discount_pct":      discount_pct,
                "projected_monthly_orders": round(count * (30 / max(days, 1))),
                "projected_monthly_revenue": round(
                    combo_deal_price * count * (30 / max(days, 1)), 2
                ),
            })

        return combos

    # ─── 7. Upsell Priorities ──────────────────────────────────

    @staticmethod
    def get_upsell_priorities(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        For each popular item suggest a higher-margin add-on or upgrade.
        Ranked by incremental profit impact.
        """
        velocity = RevenueIntelligenceService.get_sales_velocity(
            db, restaurant_id, days
        )
        if not velocity:
            return []

        # Sort by margin descending for targeting
        high_margin = sorted(velocity, key=lambda v: v["margin_pct"], reverse=True)
        popular = sorted(velocity, key=lambda v: v["per_day"], reverse=True)

        upsells = []
        used_targets = set()

        for pop in popular:
            # Find a higher-margin item that hasn't been assigned yet
            for hm in high_margin:
                if hm["name"] == pop["name"]:
                    continue
                if hm["name"] in used_targets:
                    continue
                if hm["margin_pct"] <= pop["margin_pct"]:
                    continue

                incremental_profit = round(
                    (hm["margin_pct"] - pop["margin_pct"]) / 100 *
                    hm["revenue"] / max(hm["qty_sold"], 1) *
                    pop["per_day"] * 0.15 * 30,  # 15% conversion rate assumed
                    2
                )

                price_diff = round(
                    hm["revenue"] / max(hm["qty_sold"], 1) -
                    pop["revenue"] / max(pop["qty_sold"], 1),
                    2
                )

                upsells.append({
                    "base_item":          pop["name"],
                    "base_daily_orders":  pop["per_day"],
                    "upsell_to":          hm["name"],
                    "margin_gain":        round(hm["margin_pct"] - pop["margin_pct"], 1),
                    "price_difference":   price_diff,
                    "conversion_rate":    15,
                    "monthly_profit_impact": incremental_profit,
                    "script": f"Would you like to upgrade to {hm['name']} for just ₹{abs(price_diff):.0f} more?"
                    if price_diff > 0 else
                    f"Can I add a {hm['name']} to your order? It's our best seller!",
                })
                used_targets.add(hm["name"])
                break

        upsells.sort(key=lambda u: u["monthly_profit_impact"], reverse=True)
        return upsells

    # ─── 8. Price Optimisation Recommendations ─────────────────

    @staticmethod
    def get_price_recommendations(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        Suggest price adjustments based on margin tiers and velocity:
        - Low margin + high velocity → increase price
        - High margin + low velocity → decrease price to boost volume
        - Medium → hold
        """
        velocity = RevenueIntelligenceService.get_sales_velocity(
            db, restaurant_id, days
        )
        if not velocity:
            return []

        avg_vel = sum(v["per_day"] for v in velocity) / len(velocity)
        avg_margin = sum(v["margin_pct"] for v in velocity) / len(velocity)

        recs = []
        for v in velocity:
            selling_price = v["revenue"] / max(v["qty_sold"], 1)

            if v["margin_pct"] < avg_margin and v["per_day"] >= avg_vel:
                # Low margin, high demand → price increase opportunity
                increase_pct = min(15, round(avg_margin - v["margin_pct"]))
                increase_amt = round(selling_price * increase_pct / 100, 0)
                new_price = round(selling_price + increase_amt, 0)
                projected_rev = round(new_price * v["qty_sold"] * (30 / max(days, 1)), 2)

                recs.append({
                    "name":               v["name"],
                    "current_price":      round(selling_price, 2),
                    "suggested_price":    new_price,
                    "direction":          "increase",
                    "change_pct":         increase_pct,
                    "change_amount":      increase_amt,
                    "reason":             f"Margin ({v['margin_pct']}%) is below average "
                                         f"({avg_margin:.0f}%) but demand is strong",
                    "projected_monthly_revenue": projected_rev,
                    "current_margin":     v["margin_pct"],
                    "risk_level":         "low",
                })

            elif v["margin_pct"] >= avg_margin and v["per_day"] < avg_vel * 0.6:
                # High margin but slow → consider small decrease
                decrease_pct = min(10, round((avg_margin - v["margin_pct"]) * -0.3))
                decrease_pct = max(5, decrease_pct)
                decrease_amt = round(selling_price * decrease_pct / 100, 0)
                new_price = round(selling_price - decrease_amt, 0)
                # Assume 20% volume boost from price reduction
                boost_qty = round(v["qty_sold"] * 1.2 * (30 / max(days, 1)))
                projected_rev = round(new_price * boost_qty, 2)

                recs.append({
                    "name":               v["name"],
                    "current_price":      round(selling_price, 2),
                    "suggested_price":    new_price,
                    "direction":          "decrease",
                    "change_pct":         decrease_pct,
                    "change_amount":      -decrease_amt,
                    "reason":             f"Strong margin ({v['margin_pct']}%) but low demand "
                                         f"({v['per_day']}/day) — price cut could boost volume",
                    "projected_monthly_revenue": projected_rev,
                    "current_margin":     v["margin_pct"],
                    "risk_level":         "medium",
                })

            else:
                # Hold
                recs.append({
                    "name":               v["name"],
                    "current_price":      round(selling_price, 2),
                    "suggested_price":    round(selling_price, 2),
                    "direction":          "hold",
                    "change_pct":         0,
                    "change_amount":      0,
                    "reason":             "Price is well-positioned for current demand and margins",
                    "projected_monthly_revenue": round(
                        selling_price * v["qty_sold"] * (30 / max(days, 1)), 2
                    ),
                    "current_margin":     v["margin_pct"],
                    "risk_level":         "none",
                })

        # Sort: actionable recommendations first
        priority = {"increase": 0, "decrease": 1, "hold": 2}
        recs.sort(key=lambda r: priority.get(r["direction"], 3))
        return recs

    # ─── 9. Inventory-Linked Performance Signals ───────────────

    @staticmethod
    def get_inventory_signals(
        db: Session, restaurant_id: str, days: int = 30
    ) -> List[Dict]:
        """
        Cross-reference profitability with inventory health.
        Flag stock issues on high-profit items.
        """
        profitability = RevenueIntelligenceService.get_item_profitability(
            db, restaurant_id, days
        )

        items = {
            str(i.id): i
            for i in db.query(MenuItem).filter(
                MenuItem.restaurant_id == restaurant_id
            ).all()
        }

        signals = []
        for p in profitability:
            item = items.get(p["id"])
            if not item:
                continue
            boms = db.query(BOMMaping).filter(
                BOMMaping.menu_item_id == item.id
            ).all()

            for bom in boms:
                ing = db.query(Ingredient).filter(
                    Ingredient.id == bom.ingredient_id
                ).first()
                if not ing:
                    continue

                stock = float(ing.current_stock or 0)
                reorder = float(ing.reorder_level or 0)
                qty_per_item = float(bom.quantity_required or 0)

                # How many servings can we make?
                servings_left = int(stock / qty_per_item) if qty_per_item > 0 else 999
                daily_usage = p["qty_sold"] / max(days, 1) * qty_per_item
                days_until_stockout = int(stock / daily_usage) if daily_usage > 0 else 999

                if stock <= reorder or days_until_stockout <= 3:
                    severity = "critical" if days_until_stockout <= 1 else (
                        "warning" if days_until_stockout <= 3 else "info"
                    )
                    signals.append({
                        "menu_item":         p["name"],
                        "menu_item_profit":  p["profit"],
                        "ingredient":        ing.name,
                        "current_stock":     stock,
                        "unit":              ing.unit.value if ing.unit else "units",
                        "reorder_level":     reorder,
                        "servings_remaining": servings_left,
                        "days_until_stockout": days_until_stockout,
                        "daily_usage":       round(daily_usage, 2),
                        "severity":          severity,
                        "action": (
                            f"URGENT: Reorder {ing.name} immediately — "
                            f"only {servings_left} servings of {p['name']} remaining"
                            if severity == "critical" else
                            f"Reorder {ing.name} soon — "
                            f"{days_until_stockout} days until stockout"
                        ),
                    })

        signals.sort(key=lambda s: (
            {"critical": 0, "warning": 1, "info": 2}.get(s["severity"], 3),
            -s["menu_item_profit"]
        ))
        return signals

    # ─── Master Report ─────────────────────────────────────────

    @staticmethod
    def get_full_report(
        db: Session, restaurant_id: str, days: int = 30
    ) -> Dict:
        """All 9 analyses in a single response."""
        svc = RevenueIntelligenceService

        margins = svc.get_contribution_margins(db, restaurant_id, days)
        profitability = svc.get_item_profitability(db, restaurant_id, days)
        velocity = svc.get_sales_velocity(db, restaurant_id, days)
        underpromoteds = svc.get_underpromoteds(db, restaurant_id, days)
        low_margin_risks = svc.get_low_margin_risks(db, restaurant_id, days)
        combos = svc.get_combo_recommendations(db, restaurant_id, days)
        upsells = svc.get_upsell_priorities(db, restaurant_id, days)
        price_recs = svc.get_price_recommendations(db, restaurant_id, days)
        inv_signals = svc.get_inventory_signals(db, restaurant_id, days)

        # Summary KPIs
        total_revenue = sum(p["revenue"] for p in profitability)
        total_profit = sum(p["profit"] for p in profitability)
        avg_margin = (
            sum(m["margin_pct"] for m in margins) / len(margins)
            if margins else 0
        )
        top_performer = profitability[0]["name"] if profitability else "N/A"

        return {
            "summary": {
                "period_days":     days,
                "total_items":     len(margins),
                "total_revenue":   round(total_revenue, 2),
                "total_profit":    round(total_profit, 2),
                "avg_margin_pct":  round(avg_margin, 1),
                "top_performer":   top_performer,
                "generated_at":    datetime.utcnow().isoformat(),
            },
            "margins":            margins,
            "profitability":      profitability,
            "velocity":           velocity,
            "underpromoteds":     underpromoteds,
            "low_margin_risks":   low_margin_risks,
            "combos":             combos,
            "upsells":            upsells,
            "price_recommendations": price_recs,
            "inventory_signals":  inv_signals,
        }

    # ─── Private helpers ────────────────────────────────────────

    @staticmethod
    def _food_cost(db: Session, item: MenuItem) -> float:
        """Calculate total food cost from BOM for a single unit."""
        boms = db.query(BOMMaping).filter(
            BOMMaping.menu_item_id == item.id
        ).all()
        total = 0.0
        for bom in boms:
            ing = db.query(Ingredient).filter(
                Ingredient.id == bom.ingredient_id
            ).first()
            if ing:
                total += float(bom.quantity_required) * float(ing.cost_per_unit)
        return total
