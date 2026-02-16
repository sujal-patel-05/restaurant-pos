from sqlalchemy.orm import Session
from sqlalchemy.exc import SQLAlchemyError
from models import Order, OrderItem, KOT, OrderStatus, MenuItem
from services.inventory_service import InventoryService
from utils.helpers import generate_order_number, generate_kot_number
from typing import List, Dict
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class OrderService:
    """
    Order management service handling order lifecycle and KOT generation
    """
    
    @staticmethod
    def create_order(
        db: Session,
        restaurant_id: UUID,
        order_data: Dict,
        user_id: UUID
    ) -> Dict:
        """
        Create a new order with inventory validation and KOT generation
        """
        try:
            # Validate stock availability for all items
            for item in order_data.get("items", []):
                stock_check = InventoryService.check_stock_availability(
                    db, 
                    UUID(str(item["menu_item_id"])), 
                    item["quantity"]
                )
                
                if not stock_check.get("available"):
                    return {
                        "success": False,
                        "error": "Insufficient stock",
                        "details": stock_check
                    }
            
            # Generate order number
            order_number = generate_order_number(str(restaurant_id))
            
            # Create order
            order = Order(
                restaurant_id=restaurant_id,
                order_number=order_number,
                order_type=order_data.get("order_type", "dine_in"),
                status=OrderStatus.PLACED,
                table_number=order_data.get("table_number"),
                customer_name=order_data.get("customer_name"),
                customer_phone=order_data.get("customer_phone"),
                special_instructions=order_data.get("special_instructions"),
                created_by=user_id
            )
            db.add(order)
            db.flush()  # Get order ID
            
            # Create order items and KOTs
            subtotal = Decimal(0)
            
            for idx, item_data in enumerate(order_data.get("items", [])):
                menu_item = db.query(MenuItem).filter(
                    MenuItem.id == str(item_data["menu_item_id"])
                ).first()
                
                if not menu_item:
                    raise ValueError(f"Menu item not found: {item_data['menu_item_id']}")
                
                # Create order item
                order_item = OrderItem(
                    order_id=order.id,
                    menu_item_id=menu_item.id,
                    quantity=item_data["quantity"],
                    unit_price=menu_item.price,
                    special_instructions=item_data.get("special_instructions"),
                    item_status=OrderStatus.PLACED
                )
                db.add(order_item)
                db.flush()  # Get order_item ID
                
                # Calculate subtotal
                subtotal += menu_item.price * item_data["quantity"]
                
                # Generate KOT
                kot_number = generate_kot_number(order_number, idx + 1)
                kot = KOT(
                    order_id=order.id,
                    kot_number=kot_number,
                    order_item_id=order_item.id,
                    status=OrderStatus.PLACED
                )
                db.add(kot)
                
                # Deduct inventory
                InventoryService.deduct_inventory(
                    db,
                    menu_item.id,
                    item_data["quantity"],
                    order.id,
                    user_id
                )
            
            # Calculate totals
            restaurant = db.query(MenuItem).filter(
                MenuItem.id == str(order_data["items"][0]["menu_item_id"])
            ).first().restaurant
            
            gst_percentage = restaurant.gst_percentage if restaurant else Decimal(5)
            gst_amount = (subtotal * gst_percentage) / 100
            discount_amount = Decimal(order_data.get("discount_amount", 0))
            total_amount = subtotal + gst_amount - discount_amount
            
            # Update order totals
            order.subtotal = subtotal
            order.gst_amount = gst_amount
            order.discount_amount = discount_amount
            order.total_amount = total_amount
            
            db.commit()
            db.refresh(order)
            
            return {
                "success": True,
                "order_id": str(order.id),
                "order_number": order.order_number,
                "total_amount": float(total_amount)
            }
            
        except SQLAlchemyError as e:
            db.rollback()
            return {
                "success": False,
                "error": str(e)
            }
    
    @staticmethod
    def cancel_order(db: Session, order_id: UUID) -> Dict:
        """
        Cancel an order and rollback inventory
        """
        try:
            order = db.query(Order).filter(Order.id == str(order_id)).first()
            
            if not order:
                return {"success": False, "error": "Order not found"}
            
            if order.status in [OrderStatus.COMPLETED, OrderStatus.CANCELLED]:
                return {"success": False, "error": "Cannot cancel completed or already cancelled order"}
            
            # Rollback inventory
            InventoryService.rollback_inventory(db, order_id)
            
            # Update order status
            order.status = OrderStatus.CANCELLED
            order.updated_at = datetime.utcnow()
            
            # Update all order items
            for item in order.order_items:
                item.item_status = OrderStatus.CANCELLED
            
            # Update all KOTs
            for kot in order.kot_items:
                kot.status = OrderStatus.CANCELLED
            
            db.commit()
            
            return {"success": True, "message": "Order cancelled successfully"}
            
        except SQLAlchemyError as e:
            db.rollback()
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def update_order_status(db: Session, order_id: UUID, new_status: str) -> Dict:
        """
        Update order status
        """
        try:
            order = db.query(Order).filter(Order.id == str(order_id)).first()
            
            if not order:
                return {"success": False, "error": "Order not found"}
            
            order.status = OrderStatus(new_status)
            order.updated_at = datetime.utcnow()
            
            if new_status == "completed":
                order.completed_at = datetime.utcnow()
            
            db.commit()
            
            return {"success": True, "message": "Order status updated"}
            
        except SQLAlchemyError as e:
            db.rollback()
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def update_kot_status(db: Session, kot_id: UUID, new_status: str) -> Dict:
        """
        Update KOT status (for kitchen display)
        """
        try:
            kot = db.query(KOT).filter(KOT.id == str(kot_id)).first()
            
            if not kot:
                return {"success": False, "error": "KOT not found"}
            
            kot.status = OrderStatus(new_status)
            
            if new_status == "preparing" and not kot.started_at:
                kot.started_at = datetime.utcnow()
            elif new_status in ["ready", "completed"]:
                kot.completed_at = datetime.utcnow()
            
            # Update corresponding order item status
            order_item = db.query(OrderItem).filter(
                OrderItem.id == kot.order_item_id
            ).first()
            if order_item:
                order_item.item_status = OrderStatus(new_status)
            
            db.commit()
            
            return {"success": True, "message": "KOT status updated"}
            
        except SQLAlchemyError as e:
            db.rollback()
            return {"success": False, "error": str(e)}
