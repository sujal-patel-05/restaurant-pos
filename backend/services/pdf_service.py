"""
Production-Level PDF Invoice Generator
Government-standard GST-compliant invoices for Indian restaurants.
Supports A4 and 80mm thermal receipt formats.
"""
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm, cm
from reportlab.lib.colors import HexColor, black, white
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import (
    SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer, HRFlowable
)
from reportlab.pdfgen import canvas
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from datetime import datetime
from decimal import Decimal
import os


# ═══════════════════════════════════════════════════════════════
# Color Palette
# ═══════════════════════════════════════════════════════════════
BRAND_PRIMARY = HexColor("#4F46E5")     # Indigo
BRAND_DARK    = HexColor("#312E81")     # Dark indigo
BRAND_LIGHT   = HexColor("#EEF2FF")    # Very light indigo
GRAY_50       = HexColor("#F9FAFB")
GRAY_100      = HexColor("#F3F4F6")
GRAY_200      = HexColor("#E5E7EB")
GRAY_400      = HexColor("#9CA3AF")
GRAY_500      = HexColor("#6B7280")
GRAY_700      = HexColor("#374151")
GRAY_900      = HexColor("#111827")


def _num_to_words(n):
    """Convert a number to Indian English words for the total amount."""
    if n == 0:
        return "Zero"
    ones = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven",
            "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen",
            "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
    tens = ["", "", "Twenty", "Thirty", "Forty", "Fifty",
            "Sixty", "Seventy", "Eighty", "Ninety"]

    def _chunk(num):
        if num == 0:
            return ""
        elif num < 20:
            return ones[num]
        elif num < 100:
            return tens[num // 10] + (" " + ones[num % 10] if num % 10 else "")
        else:
            return ones[num // 100] + " Hundred" + (" and " + _chunk(num % 100) if num % 100 else "")

    # Indian numbering: Lakh, Thousand, Hundred
    result = ""
    if n >= 10000000:
        result += _chunk(n // 10000000) + " Crore "
        n %= 10000000
    if n >= 100000:
        result += _chunk(n // 100000) + " Lakh "
        n %= 100000
    if n >= 1000:
        result += _chunk(n // 1000) + " Thousand "
        n %= 1000
    result += _chunk(n)
    return result.strip()


def _amount_in_words(amount):
    """Convert a decimal amount to words like 'Rupees Two Hundred Fifty and 00 Paise Only'."""
    amt = float(amount)
    rupees = int(amt)
    paise = round((amt - rupees) * 100)
    words = "Rupees " + _num_to_words(rupees)
    if paise > 0:
        words += " and " + _num_to_words(paise) + " Paise"
    words += " Only"
    return words


class PDFService:
    """Production-level PDF invoice generator with government-standard GST compliance."""

    # ═══════════════════════════════════════════════════════════
    #  A4 INVOICE — Full-page, government-standard format
    # ═══════════════════════════════════════════════════════════
    @staticmethod
    def generate_a4_invoice(order, filepath, restaurant=None, invoice_number=None):
        """Generates a professional, GST-compliant A4 invoice PDF."""
        c = canvas.Canvas(filepath, pagesize=A4)
        width, height = A4
        margin = 40
        content_width = width - 2 * margin

        # ── Restaurant info ──
        r_name = getattr(restaurant, 'name', None) or "SujalPOS Restaurant"
        r_address = getattr(restaurant, 'address', None) or ""
        r_phone = getattr(restaurant, 'phone', None) or ""
        r_email = getattr(restaurant, 'email', None) or ""
        r_gstin = getattr(restaurant, 'gst_number', None) or ""
        r_gst_pct = float(getattr(restaurant, 'gst_percentage', None) or 5)

        # ════════════════════════════════════════════════════════
        # 1. TOP ACCENT BAR
        # ════════════════════════════════════════════════════════
        bar_height = 8
        c.setFillColor(BRAND_PRIMARY)
        c.rect(0, height - bar_height, width, bar_height, fill=True, stroke=False)

        # ════════════════════════════════════════════════════════
        # 2. HEADER SECTION
        # ════════════════════════════════════════════════════════
        y = height - bar_height - 30

        # Restaurant name
        c.setFillColor(GRAY_900)
        c.setFont("Helvetica-Bold", 22)
        c.drawString(margin, y, r_name.upper())

        # "TAX INVOICE" badge on the right
        badge_text = "TAX INVOICE"
        c.setFont("Helvetica-Bold", 11)
        badge_w = c.stringWidth(badge_text, "Helvetica-Bold", 11) + 20
        badge_h = 22
        badge_x = width - margin - badge_w
        badge_y = y - 3
        c.setFillColor(BRAND_PRIMARY)
        c.roundRect(badge_x, badge_y, badge_w, badge_h, 4, fill=True, stroke=False)
        c.setFillColor(white)
        c.drawString(badge_x + 10, badge_y + 6, badge_text)

        # Address line
        y -= 20
        c.setFillColor(GRAY_500)
        c.setFont("Helvetica", 9)
        addr_parts = [p for p in [r_address, r_phone, r_email] if p]
        if addr_parts:
            c.drawString(margin, y, " | ".join(addr_parts))

        # GSTIN line
        if r_gstin:
            y -= 14
            c.setFillColor(GRAY_700)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(margin, y, f"GSTIN: {r_gstin}")

        # Divider line
        y -= 12
        c.setStrokeColor(GRAY_200)
        c.setLineWidth(1)
        c.line(margin, y, width - margin, y)

        # ════════════════════════════════════════════════════════
        # 3. INVOICE META — Two columns
        # ════════════════════════════════════════════════════════
        y -= 22
        col1_x = margin
        col2_x = width / 2 + 20

        meta_items_left = [
            ("Invoice No.", invoice_number or getattr(order, 'order_number', 'N/A')),
            ("Date", order.created_at.strftime("%d %b %Y, %I:%M %p") if order.created_at else "N/A"),
            ("Order Type", str(getattr(order, 'order_type', 'dine_in')).replace('_', ' ').title()),
        ]
        meta_items_right = []
        if getattr(order, 'table_number', None):
            meta_items_right.append(("Table", order.table_number))
        if getattr(order, 'customer_name', None):
            meta_items_right.append(("Customer", order.customer_name))
        if getattr(order, 'customer_phone', None):
            meta_items_right.append(("Phone", order.customer_phone))
        if getattr(order, 'waiter_name', None):
            meta_items_right.append(("Served By", order.waiter_name))

        for label, value in meta_items_left:
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY_400)
            c.drawString(col1_x, y, label.upper())
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(GRAY_900)
            c.drawString(col1_x + 80, y, str(value))
            y -= 16

        y_right = y + 16 * len(meta_items_left)
        for label, value in meta_items_right:
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY_400)
            c.drawString(col2_x, y_right, label.upper())
            c.setFont("Helvetica-Bold", 10)
            c.setFillColor(GRAY_900)
            c.drawString(col2_x + 80, y_right, str(value))
            y_right -= 16

        y = min(y, y_right) - 10

        # ════════════════════════════════════════════════════════
        # 4. ITEMS TABLE
        # ════════════════════════════════════════════════════════
        # Header row
        table_header = ["#", "Item Description", "HSN/SAC", "Qty", "Rate (Rs)", "Amount (Rs)"]
        table_data = [table_header]

        items = getattr(order, 'order_items', []) or []
        for idx, item in enumerate(items, 1):
            menu_item = getattr(item, 'menu_item', None)
            name = menu_item.name if menu_item else f"Item #{idx}"
            qty = int(getattr(item, 'quantity', 1))
            price = float(getattr(item, 'unit_price', 0))
            total = price * qty
            table_data.append([
                str(idx),
                name,
                "996331",  # HSN/SAC for restaurant services
                str(qty),
                f"{price:,.2f}",
                f"{total:,.2f}"
            ])

        col_widths = [25, content_width - 225, 50, 35, 60, 65]
        t = Table(table_data, colWidths=col_widths)

        # Table styling
        style_cmds = [
            # Header row
            ('BACKGROUND', (0, 0), (-1, 0), BRAND_PRIMARY),
            ('TEXTCOLOR', (0, 0), (-1, 0), white),
            ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
            ('FONTSIZE', (0, 0), (-1, 0), 9),
            ('BOTTOMPADDING', (0, 0), (-1, 0), 8),
            ('TOPPADDING', (0, 0), (-1, 0), 8),

            # Data rows
            ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
            ('FONTSIZE', (0, 1), (-1, -1), 9),
            ('BOTTOMPADDING', (0, 1), (-1, -1), 6),
            ('TOPPADDING', (0, 1), (-1, -1), 6),

            # Alignment
            ('ALIGN', (0, 0), (0, -1), 'CENTER'),      # #
            ('ALIGN', (2, 0), (2, -1), 'CENTER'),       # HSN
            ('ALIGN', (3, 0), (3, -1), 'CENTER'),       # QTY
            ('ALIGN', (4, 0), (-1, -1), 'RIGHT'),       # Rate, Amount

            # Grid
            ('LINEBELOW', (0, 0), (-1, 0), 1, BRAND_PRIMARY),
            ('LINEBELOW', (0, -1), (-1, -1), 0.5, GRAY_200),
            ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ]

        # Alternating row colors
        for i in range(1, len(table_data)):
            if i % 2 == 0:
                style_cmds.append(('BACKGROUND', (0, i), (-1, i), GRAY_50))

        t.setStyle(TableStyle(style_cmds))

        # Calculate table height and draw
        tw, th = t.wrap(content_width, 500)
        if y - th < 180:
            # Not enough space, start a new page
            c.showPage()
            y = height - 40
        t.drawOn(c, margin, y - th)
        y = y - th - 15

        # ════════════════════════════════════════════════════════
        # 5. TOTALS SECTION
        # ════════════════════════════════════════════════════════
        subtotal = float(getattr(order, 'subtotal', 0) or 0)
        gst_amount = float(getattr(order, 'gst_amount', 0) or 0)
        discount = float(getattr(order, 'discount_amount', 0) or 0)
        total = float(getattr(order, 'total_amount', 0) or 0)
        half_gst = gst_amount / 2

        # Background box for totals
        totals_x = width - margin - 220
        totals_w = 220
        totals_h = 110 if discount > 0 else 95
        c.setFillColor(GRAY_50)
        c.roundRect(totals_x - 5, y - totals_h, totals_w + 10, totals_h + 5, 6, fill=True, stroke=False)

        # Totals rows
        def draw_total_row(label, value, bold=False, color=GRAY_700, font_size=9):
            nonlocal y
            font = "Helvetica-Bold" if bold else "Helvetica"
            c.setFont(font, font_size)
            c.setFillColor(color)
            c.drawString(totals_x, y, label)
            c.drawRightString(totals_x + totals_w, y, f"Rs. {value:,.2f}")
            y -= 16

        draw_total_row("Subtotal", subtotal)
        draw_total_row(f"CGST ({r_gst_pct/2:.1f}%)", half_gst)
        draw_total_row(f"SGST ({r_gst_pct/2:.1f}%)", half_gst)
        if discount > 0:
            draw_total_row("Discount", -discount)

        # Grand total with accent
        y -= 4
        c.setStrokeColor(BRAND_PRIMARY)
        c.setLineWidth(1.5)
        c.line(totals_x, y + 2, totals_x + totals_w, y + 2)
        y -= 4
        c.setFont("Helvetica-Bold", 14)
        c.setFillColor(BRAND_DARK)
        c.drawString(totals_x, y, "GRAND TOTAL")
        c.drawRightString(totals_x + totals_w, y, f"Rs. {total:,.2f}")
        y -= 20

        # ════════════════════════════════════════════════════════
        # 6. AMOUNT IN WORDS
        # ════════════════════════════════════════════════════════
        y -= 5
        c.setFont("Helvetica-Oblique", 8)
        c.setFillColor(GRAY_500)
        c.drawString(margin, y, f"Amount in words: {_amount_in_words(total)}")

        # ════════════════════════════════════════════════════════
        # 7. FOOTER
        # ════════════════════════════════════════════════════════
        footer_y = 80

        # Divider
        c.setStrokeColor(GRAY_200)
        c.setLineWidth(0.5)
        c.line(margin, footer_y + 20, width - margin, footer_y + 20)

        # Thank you message
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(BRAND_PRIMARY)
        c.drawCentredString(width / 2, footer_y + 5, "Thank you for dining with us!")

        # Signature area
        sig_x = width - margin - 120
        c.setStrokeColor(GRAY_400)
        c.line(sig_x, footer_y - 15, sig_x + 120, footer_y - 15)
        c.setFont("Helvetica", 7)
        c.setFillColor(GRAY_400)
        c.drawCentredString(sig_x + 60, footer_y - 25, "Authorised Signatory")

        # Terms & legal
        c.setFont("Helvetica", 7)
        c.setFillColor(GRAY_400)
        c.drawString(margin, footer_y - 15, "Terms: Goods once sold will not be returned or exchanged.")
        c.drawString(margin, footer_y - 27, "E. & O.E. — This is a computer-generated invoice and does not require a physical signature.")

        # Bottom accent bar
        c.setFillColor(BRAND_PRIMARY)
        c.rect(0, 0, width, 4, fill=True, stroke=False)

        c.save()
        return filepath

    # ═══════════════════════════════════════════════════════════
    #  THERMAL RECEIPT — 80mm, compact and fast
    # ═══════════════════════════════════════════════════════════
    @staticmethod
    def generate_thermal_receipt(order, filepath, restaurant=None, invoice_number=None):
        """Generates a production-level 80mm thermal receipt PDF."""
        # ── Restaurant info ──
        r_name = getattr(restaurant, 'name', None) or "SujalPOS Restaurant"
        r_address = getattr(restaurant, 'address', None) or ""
        r_phone = getattr(restaurant, 'phone', None) or ""
        r_gstin = getattr(restaurant, 'gst_number', None) or ""
        r_gst_pct = float(getattr(restaurant, 'gst_percentage', None) or 5)

        # Dynamic height based on items
        items = getattr(order, 'order_items', []) or []
        item_count = len(items)
        receipt_height = max(210, 145 + item_count * 13 + 80) * mm

        width = 80 * mm
        c = canvas.Canvas(filepath, pagesize=(width, receipt_height))
        left = 5 * mm
        right = width - 5 * mm
        content_w = right - left
        y = receipt_height - 8 * mm

        invoice_ref = invoice_number or getattr(order, 'order_number', 'N/A')
        payment_mode = "N/A"
        if getattr(order, 'payments', None):
            latest_payment = sorted(
                order.payments,
                key=lambda payment: payment.created_at or datetime.min
            )[-1]
            raw_mode = getattr(latest_payment, 'payment_mode', None)
            payment_mode = (raw_mode.value if hasattr(raw_mode, 'value') else str(raw_mode or 'N/A')).upper()

        # ── Header ──
        c.setFont("Helvetica-Bold", 13)
        c.setFillColor(black)
        c.drawCentredString(width / 2, y, r_name.upper())
        y -= 4 * mm

        if r_address:
            c.setFont("Helvetica", 7)
            # Wrap address if needed
            if len(r_address) > 40:
                c.drawCentredString(width / 2, y, r_address[:40])
                y -= 3 * mm
                c.drawCentredString(width / 2, y, r_address[40:])
            else:
                c.drawCentredString(width / 2, y, r_address)
            y -= 3 * mm

        if r_phone:
            c.setFont("Helvetica", 7)
            c.drawCentredString(width / 2, y, f"Tel: {r_phone}")
            y -= 3 * mm

        if r_gstin:
            c.setFont("Helvetica-Bold", 7)
            c.drawCentredString(width / 2, y, f"GSTIN: {r_gstin}")
            y -= 3 * mm

        # ── Dashed divider ──
        y -= 2 * mm
        c.setDash(2, 2)
        c.setStrokeColor(black)
        c.setLineWidth(0.5)
        c.line(left, y, right, y)
        c.setDash()
        y -= 4 * mm

        # ── Invoice meta ──
        c.setFont("Helvetica-Bold", 8)
        c.drawCentredString(width / 2, y, "TAX INVOICE")
        y -= 4 * mm

        c.setFont("Helvetica", 7)
        c.drawString(left, y, f"Invoice: {invoice_ref}")
        c.drawRightString(right, y, order.created_at.strftime("%d/%m/%Y") if order.created_at else "")
        y -= 3 * mm

        c.drawString(left, y, f"Order No: {getattr(order, 'order_number', 'N/A')}")
        c.drawRightString(right, y, order.created_at.strftime("%I:%M %p") if order.created_at else "")
        y -= 3 * mm

        table_num = getattr(order, 'table_number', '')
        order_type = str(getattr(order, 'order_type', 'dine_in')).replace('_', ' ').upper()
        if table_num:
            c.drawString(left, y, f"Table: {table_num}")
        c.drawRightString(right, y, f"Type: {order_type}")
        y -= 3 * mm

        customer_name = getattr(order, 'customer_name', None)
        if customer_name:
            c.drawString(left, y, f"Cust: {customer_name[:22]}")
            y -= 3 * mm

        c.drawString(left, y, f"Payment: {payment_mode}")
        y -= 4 * mm

        # ── Dashed divider ──
        c.setDash(2, 2)
        c.line(left, y, right, y)
        c.setDash()
        y -= 4 * mm

        # ── Items header ──
        c.setFont("Helvetica-Bold", 7)
        c.drawString(left, y, "ITEM")
        c.drawRightString(left + content_w * 0.55, y, "QTY")
        c.drawRightString(left + content_w * 0.75, y, "RATE")
        c.drawRightString(right, y, "AMT")
        y -= 1.5 * mm
        c.setLineWidth(0.3)
        c.line(left, y, right, y)
        y -= 3 * mm

        # ── Items ──
        c.setFont("Helvetica", 7)
        for item in items:
            menu_item = getattr(item, 'menu_item', None)
            name = (menu_item.name if menu_item else "Item")[:22]
            qty = int(getattr(item, 'quantity', 1))
            price = float(getattr(item, 'unit_price', 0))
            amt = price * qty

            c.drawString(left, y, name)
            c.drawRightString(left + content_w * 0.55, y, str(qty))
            c.drawRightString(left + content_w * 0.75, y, f"Rs.{price:.0f}")
            c.drawRightString(right, y, f"Rs.{amt:.2f}")
            y -= 3.5 * mm

        # ── Dashed divider ──
        y -= 1 * mm
        c.setDash(2, 2)
        c.line(left, y, right, y)
        c.setDash()
        y -= 4 * mm

        # ── Totals ──
        subtotal = float(getattr(order, 'subtotal', 0) or 0)
        gst_amount = float(getattr(order, 'gst_amount', 0) or 0)
        discount = float(getattr(order, 'discount_amount', 0) or 0)
        total = float(getattr(order, 'total_amount', 0) or 0)
        half_gst = gst_amount / 2

        c.setFont("Helvetica", 7)
        c.drawString(left, y, "Subtotal")
        c.drawRightString(right, y, f"Rs.{subtotal:.2f}")
        y -= 3 * mm

        c.drawString(left, y, f"CGST ({r_gst_pct/2:.1f}%)")
        c.drawRightString(right, y, f"Rs.{half_gst:.2f}")
        y -= 3 * mm

        c.drawString(left, y, f"SGST ({r_gst_pct/2:.1f}%)")
        c.drawRightString(right, y, f"Rs.{half_gst:.2f}")
        y -= 3 * mm

        if discount > 0:
            c.drawString(left, y, "Discount")
            c.drawRightString(right, y, f"-Rs.{discount:.2f}")
            y -= 3 * mm

        # Grand total
        y -= 1 * mm
        c.setLineWidth(0.8)
        c.line(left, y, right, y)
        y -= 4 * mm
        c.setFont("Helvetica-Bold", 10)
        c.drawString(left, y, "TOTAL")
        c.drawRightString(right, y, f"Rs. {total:.2f}")
        y -= 1 * mm
        c.setLineWidth(0.8)
        c.line(left, y, right, y)
        y -= 5 * mm

        c.setFont("Helvetica", 6)
        amount_words = _amount_in_words(total)
        if len(amount_words) > 42:
            c.drawString(left, y, "Amt in words:")
            y -= 2.8 * mm
            c.drawString(left, y, amount_words[:42])
            y -= 2.8 * mm
            c.drawString(left, y, amount_words[42:84])
            y -= 3 * mm
        else:
            c.drawString(left, y, f"Amt in words: {amount_words}")
            y -= 3 * mm

        # ── Footer ──
        c.setFont("Helvetica", 7)
        c.drawCentredString(width / 2, y, "Thank you! Visit again.")
        y -= 3 * mm
        c.setFont("Helvetica", 6)
        c.drawCentredString(width / 2, y, "Computer generated TAX invoice")
        y -= 2.8 * mm
        c.drawCentredString(width / 2, y, "E.&O.E. | No signature required")

        c.save()
        return filepath
