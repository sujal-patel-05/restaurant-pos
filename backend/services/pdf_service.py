from reportlab.lib.pagesizes import A4
from reportlab.pdfgen import canvas
from reportlab.lib.units import mm
import os
from datetime import datetime

class PDFService:
    @staticmethod
    def generate_a4_invoice(order, filepath):
        """Generates a standard A4 invoice PDF."""
        c = canvas.Canvas(filepath, pagesize=A4)
        width, height = A4
        
        # Header
        c.setFont("Helvetica-Bold", 24)
        c.drawString(50, height - 50, "INVOICE")
        
        c.setFont("Helvetica", 12)
        c.drawString(50, height - 80, f"Order #: {order.order_number}")
        c.drawString(50, height - 100, f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}")
        
        # Items Table Header
        y = height - 150
        c.setFont("Helvetica-Bold", 12)
        c.drawString(50, y, "Item")
        c.drawString(300, y, "Qty")
        c.drawString(400, y, "Price")
        c.drawString(500, y, "Total")
        
        # Items
        y -= 20
        c.setFont("Helvetica", 12)
        for item in order.order_items:
            c.drawString(50, y, item.menu_item.name[:30])
            c.drawString(300, y, str(item.quantity))
            c.drawString(400, y, f"{item.price:.2f}")
            c.drawString(500, y, f"{item.price * item.quantity:.2f}")
            y -= 20
            
        # Totals
        y -= 20
        c.line(50, y, 550, y)
        y -= 20
        c.drawString(400, y, "Subtotal:")
        c.drawString(500, y, f"{order.subtotal:.2f}")
        y -= 20
        c.drawString(400, y, "Tax:")
        c.drawString(500, y, f"{order.gst_amount:.2f}")
        y -= 20
        c.setFont("Helvetica-Bold", 14)
        c.drawString(400, y, "Grand Total:")
        c.drawString(500, y, f"{order.total_amount:.2f}")
        
        c.save()
        return filepath

    @staticmethod
    def generate_thermal_receipt(order, filepath):
        """Generates an 80mm thermal receipt PDF."""
        # 80mm width, dynamic height based on items
        width = 80 * mm
        height = 200 * mm # Approximate, usually dynamic
        
        c = canvas.Canvas(filepath, pagesize=(width, height))
        
        y = height - 10 * mm
        left_margin = 5 * mm
        
        # Header
        c.setFont("Helvetica-Bold", 12)
        c.drawString(left_margin, y, "POS SYSTEM")
        y -= 5 * mm
        c.setFont("Helvetica", 8)
        c.drawString(left_margin, y, "123 Main St, City")
        y -= 5 * mm
        c.drawString(left_margin, y, f"Order: {order.order_number}")
        y -= 5 * mm
        c.drawString(left_margin, y, f"Date: {order.created_at.strftime('%Y-%m-%d %H:%M')}")
        y -= 5 * mm
        c.line(left_margin, y, width - 5 * mm, y)
        y -= 5 * mm
        
        # Items
        c.setFont("Helvetica", 9)
        for item in order.order_items:
            name = item.menu_item.name[:20]
            line = f"{name} x{item.quantity}  {item.price * item.quantity:.2f}"
            c.drawString(left_margin, y, line)
            y -= 4 * mm
            
        c.line(left_margin, y, width - 5 * mm, y)
        y -= 5 * mm
        
        # Totals
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left_margin, y, f"Total: {order.total_amount:.2f}")
        
        c.save()
        return filepath
