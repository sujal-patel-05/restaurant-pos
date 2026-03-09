from sqlalchemy.orm import Session
from models import Order, OrderItem, MenuItem, Payment, Invoice, Discount, PaymentMode
from utils.helpers import generate_invoice_number
from typing import Dict
from uuid import UUID
from datetime import datetime
from decimal import Decimal

class BillingService:
    """
    Billing and payment processing service
    """
    
    @staticmethod
    def calculate_bill(db: Session, order_id: UUID, discount_code: str = None) -> Dict:
        """
        Calculate bill with GST and discounts
        """
        order = db.query(Order).filter(Order.id == order_id).first()
        
        if not order:
            return {"success": False, "error": "Order not found"}
        
        subtotal = order.subtotal
        gst_amount = order.gst_amount
        discount_amount = Decimal(0)
        
        # Apply discount if code provided
        if discount_code:
            discount = db.query(Discount).filter(
                Discount.code == discount_code,
                Discount.is_active == True,
                Discount.restaurant_id == order.restaurant_id
            ).first()
            
            if discount:
                # Check validity
                now = datetime.utcnow()
                if discount.valid_from and now < discount.valid_from:
                    return {"success": False, "error": "Discount not yet valid"}
                if discount.valid_until and now > discount.valid_until:
                    return {"success": False, "error": "Discount expired"}
                
                # Check minimum order amount
                if subtotal < discount.min_order_amount:
                    return {
                        "success": False, 
                        "error": f"Minimum order amount ${discount.min_order_amount} required"
                    }
                
                # Calculate discount
                if discount.discount_type == "percentage":
                    discount_amount = (subtotal * discount.discount_value) / 100
                    if discount.max_discount_amount:
                        discount_amount = min(discount_amount, discount.max_discount_amount)
                else:  # fixed
                    discount_amount = discount.discount_value
        
        total_amount = subtotal + gst_amount - discount_amount
        
        # Update order
        order.discount_amount = discount_amount
        order.total_amount = total_amount
        db.commit()
        
        return {
            "success": True,
            "bill": {
                "order_number": order.order_number,
                "subtotal": float(subtotal),
                "gst_amount": float(gst_amount),
                "discount_amount": float(discount_amount),
                "total_amount": float(total_amount)
            }
        }
    
    @staticmethod
    def process_payment(
        db: Session,
        order_id: UUID,
        payment_mode: str,
        amount: float,
        transaction_id: str = None
    ) -> Dict:
        """
        Process payment for an order
        """
        try:
            order = db.query(Order).filter(Order.id == order_id).first()
            
            if not order:
                return {"success": False, "error": "Order not found"}
            
            # Create payment record
            payment = Payment(
                order_id=order_id,
                payment_mode=PaymentMode(payment_mode),
                amount=Decimal(amount),
                transaction_id=transaction_id,
                payment_status="completed"
            )
            db.add(payment)
            
            # Update order status
            order.status = "completed"
            order.completed_at = datetime.utcnow()
            
            db.commit()
            db.refresh(payment)
            
            return {
                "success": True,
                "payment_id": str(payment.id),
                "message": "Payment processed successfully"
            }
            
        except Exception as e:
            db.rollback()
            return {"success": False, "error": str(e)}
    
    @staticmethod
    def generate_invoice(db: Session, order_id: UUID, invoice_type: str = "thermal") -> Dict:
        """
        Generate invoice for an order
        invoice_type: 'thermal' or 'a4'
        """
        from services.pdf_service import PDFService
        from sqlalchemy.orm import joinedload
        import os

        try:
            oid = str(order_id)
            order = db.query(Order).options(
                joinedload(Order.restaurant),
                joinedload(Order.order_items).joinedload(OrderItem.menu_item),
                joinedload(Order.payments)
            ).filter(Order.id == oid).first()
            
            if not order:
                return {"success": False, "error": "Order not found"}
            
            # Use existing invoice number if available, else generate new
            existing_invoice = db.query(Invoice).filter(
                Invoice.order_id == oid
            ).first()
            
            invoice_number = existing_invoice.invoice_number if existing_invoice else generate_invoice_number(str(order.restaurant_id))
            
            if not existing_invoice:
                invoice = Invoice(
                    order_id=oid,
                    invoice_number=invoice_number,
                    pdf_url="" # Will update after generation
                )
                db.add(invoice)
                db.flush()
            else:
                invoice = existing_invoice

            # PDF Generation
            # Ensure static/invoices directory exists
            output_dir = "static/invoices"
            os.makedirs(output_dir, exist_ok=True)
            
            filename = f"{invoice_number}_{invoice_type}.pdf"
            filepath = os.path.join(output_dir, filename)
            
            if invoice_type == "a4":
                PDFService.generate_a4_invoice(
                    order,
                    filepath,
                    restaurant=order.restaurant,
                    invoice_number=invoice_number
                )
            else:
                PDFService.generate_thermal_receipt(
                    order,
                    filepath,
                    restaurant=order.restaurant,
                    invoice_number=invoice_number
                )
            
            # Update PDF URL
            invoice.pdf_url = f"/invoices/{filename}"
            db.commit()
            
            return {
                "success": True,
                "invoice_number": invoice_number,
                "invoice_id": str(invoice.id),
                "pdf_url": invoice.pdf_url,
                "type": invoice_type
            }
            
        except Exception as e:
            db.rollback()
            import traceback
            traceback.print_exc()
            return {"success": False, "error": str(e)}

    @staticmethod
    def email_invoice(db: Session, order_id: UUID, email: str) -> Dict:
        """
        Email the invoice to the customer
        """
        from services.email_service import EmailService
        import os

        try:
            # Generate A4 invoice first to ensure we have a standard format to email
            result = BillingService.generate_invoice(db, order_id, "a4")
            if not result["success"]:
                return result
            
            pdf_path = os.path.join("static", result["pdf_url"].lstrip("/"))
            
            success = EmailService.send_invoice(email, pdf_path, result["invoice_number"])
            
            if success:
                return {"success": True, "message": f"Invoice sent to {email}"}
            else:
                return {"success": False, "error": "Failed to send email"}
                
        except Exception as e:
            return {"success": False, "error": str(e)}
