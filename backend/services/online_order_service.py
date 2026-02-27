"""
Online Order Simulation Service
Generates realistic Zomato/Swiggy orders every few minutes
Handles approve/reject flow with KOT generation
"""

import random
import logging
from datetime import datetime
from decimal import Decimal
from typing import Dict, List, Optional
from uuid import uuid4
from sqlalchemy.orm import Session
from sqlalchemy import and_

from models import (
    Order, OrderItem, KOT, MenuItem, Restaurant,
    OrderStatus, OrderType, OrderSource
)
from models.billing import Payment, PaymentMode
from utils.helpers import generate_order_number, generate_kot_number
from services.inventory_service import InventoryService

logger = logging.getLogger(__name__)

# ─── Realistic Data Pools ───────────────────────────────────────

INDIAN_NAMES = [
    "Aarav Sharma", "Priya Patel", "Rohan Mehta", "Sneha Gupta",
    "Vikram Singh", "Ananya Reddy", "Karthik Nair", "Pooja Iyer",
    "Arjun Desai", "Meera Joshi", "Rahul Verma", "Kavya Rao",
    "Aditya Kumar", "Nisha Chauhan", "Siddharth Bhat", "Divya Mishra",
    "Amit Tiwari", "Riya Kapoor", "Harsh Agarwal", "Sakshi Dubey",
    "Nikhil Pandey", "Swati Chopra", "Gaurav Saxena", "Trisha Das",
    "Manish Yadav", "Anjali Bhatt", "Deepak Rawat", "Pallavi Shah",
]

DELIVERY_ADDRESSES = [
    "Flat 401, Sunrise Apartments, MG Road",
    "B-12, Green Valley Society, Satellite Road",
    "302, Shreeji Tower, CG Road",
    "A-7, Panchsheel Enclave, SG Highway",
    "Plot 23, Shanti Nagar, Vastrapur",
    "Flat 1102, Riviera Heights, Bodakdev",
    "C-5, Golden Residency, Prahladnagar",
    "201, Rajhans Elanza, Dumas Road",
    "Flat 803, The Meadows, Thaltej",
    "D-14, Saffron Complex, Navrangpura",
    "506, Crystal Plaza, Andheri West",
    "B-22, Royal Palms, Goregaon East",
    "Flat 1504, Oberoi Garden, Powai",
    "G-3, Lotus Court, Vastrapur Lake",
    "901, Skyline Tower, Drive-in Road",
]

SPECIAL_INSTRUCTIONS_ONLINE = [
    "Extra spicy please", "No onion no garlic", "Less salt",
    "Pack extra chutney", "Ring the bell, don't call",
    "Leave at the door", "Add extra napkins",
    "Make it Jain-friendly", "Extra cheese on top",
    "No mayo please", "Pack cutlery", "Gate code: 4521",
    None, None, None, None, None,  # Most orders have no special instructions
]


class OnlineOrderService:
    """Service to simulate and manage Zomato/Swiggy online orders"""

    @staticmethod
    def generate_online_order(db: Session, restaurant_id: str) -> Optional[Dict]:
        """
        Generate a realistic simulated Zomato/Swiggy order.
        Status = PENDING_ONLINE (awaits manager approval).
        Does NOT deduct inventory — only on approval.
        """
        try:
            # Get available menu items
            menu_items = db.query(MenuItem).filter(
                and_(
                    MenuItem.restaurant_id == restaurant_id,
                    MenuItem.is_available == True
                )
            ).all()

            if not menu_items:
                logger.warning("No menu items found — skipping online order generation")
                return None

            # Pick random source — Zomato 60%, Swiggy 40%
            source = random.choices(
                [OrderSource.ZOMATO, OrderSource.SWIGGY],
                weights=[60, 40]
            )[0]

            # Pick 1-4 random items
            num_items = random.choices([1, 2, 3, 4], weights=[25, 40, 25, 10])[0]
            chosen_items = random.sample(menu_items, min(num_items, len(menu_items)))

            # Generate platform order ID
            prefix = "ZMT" if source == OrderSource.ZOMATO else "SWG"
            platform_id = f"{prefix}-{random.randint(100000, 999999)}"

            # Customer details
            customer_name = random.choice(INDIAN_NAMES)
            customer_phone = f"+91{random.randint(7000000000, 9999999999)}"
            delivery_address = random.choice(DELIVERY_ADDRESSES)
            special_instructions = random.choice(SPECIAL_INSTRUCTIONS_ONLINE)

            # Create order
            order_number = generate_order_number(restaurant_id)
            order = Order(
                restaurant_id=restaurant_id,
                order_number=order_number,
                order_type=OrderType.DELIVERY,
                order_source=source,
                status=OrderStatus.PENDING_ONLINE,
                customer_name=customer_name,
                customer_phone=customer_phone,
                delivery_address=delivery_address,
                platform_order_id=platform_id,
                special_instructions=special_instructions,
            )
            db.add(order)
            db.flush()

            # Create order items (but NO inventory deduction yet)
            subtotal = Decimal(0)
            for item in chosen_items:
                qty = random.choices([1, 2, 3], weights=[60, 30, 10])[0]
                order_item = OrderItem(
                    order_id=order.id,
                    menu_item_id=item.id,
                    quantity=qty,
                    unit_price=item.price,
                    item_status=OrderStatus.PENDING_ONLINE,
                )
                db.add(order_item)
                subtotal += item.price * qty

            # Calculate totals
            restaurant = db.query(Restaurant).filter(
                Restaurant.id == restaurant_id
            ).first()
            gst_pct = restaurant.gst_percentage if restaurant else Decimal(5)
            gst_amount = (subtotal * gst_pct) / 100
            total_amount = subtotal + gst_amount

            order.subtotal = subtotal
            order.gst_amount = gst_amount
            order.total_amount = total_amount

            db.commit()
            db.refresh(order)

            logger.info(
                f"🔔 New {source.value.upper()} order: {order_number} "
                f"({num_items} items, ₹{total_amount:.0f}) — {customer_name}"
            )

            return {
                "order_id": order.id,
                "order_number": order.order_number,
                "source": source.value,
                "platform_order_id": platform_id,
                "customer_name": customer_name,
                "total_amount": float(total_amount),
                "items_count": len(chosen_items),
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to generate online order: {e}")
            import traceback
            traceback.print_exc()
            return None

    @staticmethod
    def get_pending_orders(db: Session, restaurant_id: str) -> List[Dict]:
        """Get all pending online orders awaiting approval"""
        orders = db.query(Order).filter(
            and_(
                Order.restaurant_id == restaurant_id,
                Order.status == OrderStatus.PENDING_ONLINE,
            )
        ).order_by(Order.created_at.desc()).all()

        results = []
        for order in orders:
            items = []
            for oi in order.order_items:
                mi = oi.menu_item
                items.append({
                    "name": mi.name if mi else "Unknown",
                    "quantity": oi.quantity,
                    "unit_price": float(oi.unit_price),
                    "total": float(oi.unit_price * oi.quantity),
                })

            elapsed = (datetime.utcnow() - order.created_at).total_seconds()

            results.append({
                "id": order.id,
                "order_number": order.order_number,
                "source": order.order_source.value if order.order_source else "pos",
                "platform_order_id": order.platform_order_id,
                "customer_name": order.customer_name,
                "customer_phone": order.customer_phone,
                "delivery_address": order.delivery_address,
                "special_instructions": order.special_instructions,
                "items": items,
                "subtotal": float(order.subtotal or 0),
                "gst_amount": float(order.gst_amount or 0),
                "total_amount": float(order.total_amount or 0),
                "created_at": order.created_at.isoformat() if order.created_at else None,
                "elapsed_seconds": int(elapsed),
            })

        return results

    @staticmethod
    def approve_order(db: Session, order_id: str, user_id: str) -> Dict:
        """
        Approve a pending online order:
        1. Change status to PLACED
        2. Generate KOTs for each item
        3. Deduct inventory
        4. Create payment record (online = prepaid)
        """
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return {"success": False, "error": "Order not found"}

            if order.status != OrderStatus.PENDING_ONLINE:
                return {"success": False, "error": "Order is not pending approval"}

            # Check stock availability
            for oi in order.order_items:
                stock_check = InventoryService.check_stock_availability(
                    db, oi.menu_item_id, oi.quantity
                )
                if not stock_check.get("available"):
                    return {
                        "success": False,
                        "error": f"Insufficient stock for {oi.menu_item.name if oi.menu_item else 'item'}",
                        "details": stock_check,
                    }

            # Approve: set status to PLACED
            order.status = OrderStatus.PLACED
            order.updated_at = datetime.utcnow()

            # Generate KOTs and deduct inventory
            for idx, oi in enumerate(order.order_items):
                oi.item_status = OrderStatus.PLACED

                kot_number = generate_kot_number(order.order_number, idx + 1)
                kot = KOT(
                    order_id=order.id,
                    kot_number=kot_number,
                    order_item_id=oi.id,
                    status=OrderStatus.PLACED,
                )
                db.add(kot)

                # Deduct inventory
                InventoryService.deduct_inventory(
                    db, oi.menu_item_id, oi.quantity, order.id, user_id
                )

            # Create payment (online orders are prepaid)
            payment = Payment(
                order_id=order.id,
                payment_mode=PaymentMode.UPI,  # Online orders are digital payments
                amount=order.total_amount,
                payment_status="completed",
                transaction_id=f"TXN-{order.order_number}-ONLINE",
            )
            db.add(payment)

            db.commit()

            logger.info(f"✅ Approved {order.order_source.value.upper()} order: {order.order_number}")

            return {
                "success": True,
                "order_id": order.id,
                "order_number": order.order_number,
                "message": f"Order approved — KOTs sent to kitchen",
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to approve order: {e}")
            return {"success": False, "error": str(e)}

    @staticmethod
    def reject_order(db: Session, order_id: str, reason: str = "Busy") -> Dict:
        """Reject a pending online order"""
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            if not order:
                return {"success": False, "error": "Order not found"}

            if order.status != OrderStatus.PENDING_ONLINE:
                return {"success": False, "error": "Order is not pending approval"}

            order.status = OrderStatus.CANCELLED
            order.rejection_reason = reason
            order.updated_at = datetime.utcnow()

            for oi in order.order_items:
                oi.item_status = OrderStatus.CANCELLED

            db.commit()

            logger.info(
                f"❌ Rejected {order.order_source.value.upper()} order: "
                f"{order.order_number} — Reason: {reason}"
            )

            return {
                "success": True,
                "order_id": order.id,
                "order_number": order.order_number,
                "message": f"Order rejected — Reason: {reason}",
            }

        except Exception as e:
            db.rollback()
            logger.error(f"Failed to reject order: {e}")
            return {"success": False, "error": str(e)}
