"""
Report PDF Service
──────────────────
Generates production-quality A4 PDF sales reports with
embedded matplotlib charts and branded styling.

Uses:
  - matplotlib for chart rendering (PNG → embedded in PDF)
  - ReportLab for PDF composition with branded layout
"""

import os
import uuid
import logging
from datetime import datetime
from typing import Dict, Any, List

logger = logging.getLogger(__name__)

# ── Color Palette ──
BRAND_HEX = "#6366f1"
BRAND_DARK_HEX = "#312E81"
BRAND_LIGHT_HEX = "#EEF2FF"
SUCCESS_HEX = "#10b981"
WARNING_HEX = "#f59e0b"
DANGER_HEX = "#ef4444"
GRAY_50_HEX = "#F9FAFB"
GRAY_100_HEX = "#F3F4F6"
GRAY_200_HEX = "#E5E7EB"
GRAY_500_HEX = "#6B7280"
GRAY_700_HEX = "#374151"
GRAY_900_HEX = "#111827"

CHART_COLORS = ["#6366f1", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#14b8a6", "#f97316"]


def _render_chart_to_png(chart_type: str, chart_data: Dict[str, Any], filepath: str, width=6.5, height=3.2):
    """Render a chart using matplotlib and save as PNG."""
    import matplotlib
    matplotlib.use('Agg')  # Non-interactive backend
    import matplotlib.pyplot as plt
    import matplotlib.ticker as ticker

    fig, ax = plt.subplots(figsize=(width, height))
    fig.patch.set_facecolor('#FFFFFF')
    ax.set_facecolor('#FAFBFC')

    data = chart_data.get("data", [])
    title = chart_data.get("title", "")
    
    if not data:
        plt.close(fig)
        return False

    if chart_type == "bar":
        data_key = chart_data.get("dataKey", "revenue")
        x_key = chart_data.get("xAxisKey", "name")
        color = chart_data.get("color", BRAND_HEX)

        labels = [str(d.get(x_key, ""))[:12] for d in data]
        values = [float(d.get(data_key, 0)) for d in data]

        bars = ax.bar(labels, values, color=color, width=0.6, edgecolor='white', linewidth=0.5)
        ax.set_title(title, fontsize=11, fontweight='bold', color=GRAY_900_HEX, pad=12)
        ax.tick_params(axis='x', rotation=30, labelsize=7)
        ax.tick_params(axis='y', labelsize=7)
        ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f'₹{x:,.0f}' if data_key == 'revenue' else f'{x:,.0f}'))
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#E5E7EB')
        ax.spines['bottom'].set_color('#E5E7EB')
        ax.grid(axis='y', alpha=0.3, color='#E5E7EB')

        # Value labels on bars
        for bar, val in zip(bars, values):
            if val > 0:
                label = f'₹{val:,.0f}' if data_key == 'revenue' else f'{val:,.0f}'
                ax.text(bar.get_x() + bar.get_width() / 2, bar.get_height() + max(values) * 0.02,
                        label, ha='center', va='bottom', fontsize=6, color=GRAY_700_HEX)

    elif chart_type == "area":
        data_key = chart_data.get("dataKey", "revenue")
        x_key = chart_data.get("xAxisKey", "date")
        color = chart_data.get("color", BRAND_HEX)

        labels = [str(d.get(x_key, "")) for d in data]
        values = [float(d.get(data_key, 0)) for d in data]

        ax.fill_between(range(len(labels)), values, alpha=0.15, color=color)
        ax.plot(range(len(labels)), values, color=color, linewidth=2, marker='o', markersize=3)
        ax.set_title(title, fontsize=11, fontweight='bold', color=GRAY_900_HEX, pad=12)
        ax.set_xticks(range(len(labels)))
        ax.set_xticklabels(labels, rotation=30, fontsize=6)
        ax.tick_params(axis='y', labelsize=7)
        ax.yaxis.set_major_formatter(ticker.FuncFormatter(lambda x, _: f'₹{x:,.0f}'))
        ax.spines['top'].set_visible(False)
        ax.spines['right'].set_visible(False)
        ax.spines['left'].set_color('#E5E7EB')
        ax.spines['bottom'].set_color('#E5E7EB')
        ax.grid(axis='y', alpha=0.3, color='#E5E7EB')

    elif chart_type == "pie":
        labels_list = [d.get("name", "?") for d in data]
        values_list = [float(d.get("value", 0)) for d in data]
        colors = CHART_COLORS[:len(data)]

        wedges, texts, autotexts = ax.pie(
            values_list, labels=None, autopct='%1.1f%%',
            colors=colors, startangle=90, pctdistance=0.8,
            wedgeprops=dict(width=0.55, edgecolor='white', linewidth=2)
        )
        for t in autotexts:
            t.set_fontsize(7)
            t.set_color(GRAY_700_HEX)

        ax.legend(labels_list, loc='center left', bbox_to_anchor=(1, 0.5), fontsize=7, frameon=False)
        ax.set_title(title, fontsize=11, fontweight='bold', color=GRAY_900_HEX, pad=12)

    plt.tight_layout()
    fig.savefig(filepath, dpi=150, bbox_inches='tight', facecolor='white')
    plt.close(fig)
    return True


class ReportPDFService:
    """Generates branded A4 PDF sales reports with embedded charts."""

    @staticmethod
    def generate_pdf(report_data: Dict[str, Any], restaurant_name: str = "Restaurant") -> str:
        """
        Generate a complete PDF report from report data.
        Returns the file path of the generated PDF.
        """
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.colors import HexColor, white, black
        from reportlab.lib.units import mm
        from reportlab.pdfgen import canvas
        from reportlab.lib.utils import ImageReader

        # ── File setup ──
        report_id = uuid.uuid4().hex[:8]
        report_type = report_data["meta"]["report_type"]
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"sales_report_{report_type}_{timestamp}_{report_id}.pdf"
        
        os.makedirs("static/reports", exist_ok=True)
        filepath = os.path.join("static", "reports", filename)

        # ── Temp chart images ──
        chart_dir = os.path.join("static", "reports", "temp_charts")
        os.makedirs(chart_dir, exist_ok=True)
        chart_paths = []

        for i, chart in enumerate(report_data.get("charts", [])):
            chart_path = os.path.join(chart_dir, f"chart_{report_id}_{i}.png")
            success = _render_chart_to_png(chart.get("type", "bar"), chart, chart_path)
            if success:
                chart_paths.append((chart.get("title", ""), chart_path))

        # ── PDF Generation ──
        c = canvas.Canvas(filepath, pagesize=A4)
        w, h = A4
        margin = 40
        cw = w - 2 * margin

        meta = report_data["meta"]
        kpis = report_data["kpis"]
        comparison = report_data.get("comparison", {})
        top_items = report_data.get("top_items", [])
        payment_modes = report_data.get("payment_modes", [])
        order_types = report_data.get("order_types", [])
        order_sources = report_data.get("order_sources", [])

        BRAND = HexColor(BRAND_HEX)
        BRAND_DARK = HexColor(BRAND_DARK_HEX)
        GRAY50 = HexColor(GRAY_50_HEX)
        GRAY200 = HexColor(GRAY_200_HEX)
        GRAY500 = HexColor(GRAY_500_HEX)
        GRAY700 = HexColor(GRAY_700_HEX)
        GRAY900 = HexColor(GRAY_900_HEX)
        SUCCESS = HexColor(SUCCESS_HEX)
        DANGER = HexColor(DANGER_HEX)

        def new_page():
            c.showPage()
            # Top accent
            c.setFillColor(BRAND)
            c.rect(0, h - 6, w, 6, fill=True, stroke=False)
            # Bottom accent
            c.rect(0, 0, w, 4, fill=True, stroke=False)
            return h - 50

        # ════════════════════════════════════════════════════════
        # PAGE 1: Cover + KPIs
        # ════════════════════════════════════════════════════════

        # Top accent bar
        c.setFillColor(BRAND)
        c.rect(0, h - 8, w, 8, fill=True, stroke=False)

        y = h - 50

        # Restaurant name
        c.setFont("Helvetica-Bold", 22)
        c.setFillColor(GRAY900)
        c.drawString(margin, y, restaurant_name.upper())

        # Report badge
        badge_text = "SALES REPORT"
        c.setFont("Helvetica-Bold", 10)
        badge_w = c.stringWidth(badge_text, "Helvetica-Bold", 10) + 20
        c.setFillColor(BRAND)
        c.roundRect(w - margin - badge_w, y - 2, badge_w, 22, 4, fill=True, stroke=False)
        c.setFillColor(white)
        c.drawString(w - margin - badge_w + 10, y + 4, badge_text)

        y -= 24
        c.setFont("Helvetica", 9)
        c.setFillColor(GRAY500)
        c.drawString(margin, y, meta["report_label"])
        c.drawString(w - margin - 160, y, f"Generated: {datetime.utcnow().strftime('%d %b %Y, %I:%M %p')}")

        y -= 8
        c.setStrokeColor(GRAY200)
        c.setLineWidth(1)
        c.line(margin, y, w - margin, y)

        # ── KPI Cards ──
        y -= 30
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(GRAY900)
        c.drawString(margin, y, "Key Performance Indicators")
        y -= 6

        kpi_cards = [
            ("Total Revenue", f"Rs. {kpis['total_revenue']:,.2f}", f"{comparison.get('revenue_change_pct', 0):+.1f}% vs prev"),
            ("Total Orders", f"{kpis['total_orders']:,}", f"{comparison.get('orders_change_pct', 0):+.1f}% vs prev"),
            ("Avg Order Value", f"Rs. {kpis['avg_order_value']:,.2f}", f"{comparison.get('aov_change_pct', 0):+.1f}% vs prev"),
            ("Cancellation Rate", f"{kpis['cancellation_rate']}%", f"{kpis['cancelled_orders']} cancelled"),
        ]

        card_w = (cw - 30) / 4
        card_h = 70
        y -= card_h

        for i, (label, value, change) in enumerate(kpi_cards):
            x = margin + i * (card_w + 10)
            # Card background
            c.setFillColor(GRAY50)
            c.roundRect(x, y, card_w, card_h, 6, fill=True, stroke=False)
            # Left accent
            accent_color = BRAND if i < 3 else HexColor(WARNING_HEX)
            c.setFillColor(accent_color)
            c.rect(x, y, 3, card_h, fill=True, stroke=False)

            # Label
            c.setFont("Helvetica", 7)
            c.setFillColor(GRAY500)
            c.drawString(x + 12, y + card_h - 18, label.upper())
            # Value
            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(GRAY900)
            c.drawString(x + 12, y + card_h - 38, value)
            # Change
            change_val = comparison.get(['revenue_change_pct', 'orders_change_pct', 'aov_change_pct', 'revenue_change_pct'][i], 0)
            c.setFont("Helvetica", 7)
            c.setFillColor(SUCCESS if change_val >= 0 else DANGER)
            c.drawString(x + 12, y + 10, change)

        y -= 20

        # ── Financial Summary ──
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(GRAY900)
        c.drawString(margin, y, "Financial Summary")
        y -= 18

        fin_rows = [
            ("Subtotal (before tax)", f"Rs. {kpis['total_subtotal']:,.2f}"),
            ("GST Collected (5%)", f"Rs. {kpis['total_gst']:,.2f}"),
            ("Discounts Given", f"Rs. {kpis['total_discount']:,.2f}"),
            ("Net Revenue", f"Rs. {kpis['total_revenue']:,.2f}"),
        ]
        for label, value in fin_rows:
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY700)
            c.drawString(margin + 10, y, label)
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(margin + 280, y, value)
            y -= 14

        y -= 10

        # ── Top Items Table ──
        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(GRAY900)
        c.drawString(margin, y, "Top Selling Items")
        y -= 6

        # Table header
        y -= 18
        c.setFillColor(BRAND)
        c.roundRect(margin, y - 2, cw, 18, 3, fill=True, stroke=False)
        c.setFillColor(white)
        c.setFont("Helvetica-Bold", 7)
        c.drawString(margin + 8, y + 3, "#")
        c.drawString(margin + 28, y + 3, "ITEM NAME")
        c.drawRightString(margin + cw * 0.55, y + 3, "QTY SOLD")
        c.drawRightString(margin + cw * 0.75, y + 3, "REVENUE")
        c.drawRightString(margin + cw - 8, y + 3, "SHARE %")

        for idx, item in enumerate(top_items[:10], 1):
            y -= 16
            if y < 100:
                y = new_page()
            if idx % 2 == 0:
                c.setFillColor(GRAY50)
                c.rect(margin, y - 3, cw, 16, fill=True, stroke=False)

            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY700)
            c.drawString(margin + 8, y + 1, str(idx))
            c.drawString(margin + 28, y + 1, item["name"][:30])
            c.drawRightString(margin + cw * 0.55, y + 1, f"{item['qty']:,}")
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(margin + cw * 0.75, y + 1, f"Rs. {item['revenue']:,.2f}")
            c.setFont("Helvetica", 8)
            c.drawRightString(margin + cw - 8, y + 1, f"{item['pct']}%")

        y -= 20

        # ── Order Types & Payment Modes side by side ──
        if y < 200:
            y = new_page()

        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(GRAY900)
        c.drawString(margin, y, "Order Type Breakdown")
        c.drawString(margin + cw / 2 + 10, y, "Payment Mode Breakdown")
        y -= 18

        half_w = cw / 2 - 10
        for i, ot in enumerate(order_types[:5]):
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY700)
            c.drawString(margin + 10, y, f"{ot['type']}")
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(margin + half_w * 0.6, y, f"{ot['count']:,} orders")
            c.setFont("Helvetica", 8)
            c.drawRightString(margin + half_w, y, f"Rs. {ot['revenue']:,.2f} ({ot['pct']}%)")
            y -= 14

        y_pm = y + 14 * len(order_types[:5])
        for i, pm in enumerate(payment_modes[:5]):
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY700)
            c.drawString(margin + cw / 2 + 20, y_pm, f"{pm['mode']}")
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(margin + cw / 2 + 10 + half_w * 0.6, y_pm, f"{pm['count']:,} txns")
            c.setFont("Helvetica", 8)
            c.drawRightString(margin + cw, y_pm, f"Rs. {pm['amount']:,.2f} ({pm['pct']}%)")
            y_pm -= 14

        y = min(y, y_pm) - 10

        # ── Order Sources ──
        if y < 120:
            y = new_page()

        c.setFont("Helvetica-Bold", 11)
        c.setFillColor(GRAY900)
        c.drawString(margin, y, "Order Source Analysis")
        y -= 18

        for src in order_sources:
            c.setFont("Helvetica", 8)
            c.setFillColor(GRAY700)
            c.drawString(margin + 10, y, f"{src['source']}")
            c.setFont("Helvetica-Bold", 8)
            c.drawRightString(margin + 200, y, f"{src['count']:,} orders ({src['pct']}%)")
            c.setFont("Helvetica", 8)
            c.drawRightString(margin + 350, y, f"Rs. {src['revenue']:,.2f}")
            y -= 14

        # ════════════════════════════════════════════════════════
        # PAGE 2+: Charts
        # ════════════════════════════════════════════════════════
        if chart_paths:
            y = new_page()
            c.setFont("Helvetica-Bold", 14)
            c.setFillColor(GRAY900)
            c.drawString(margin, y, "Visual Analytics")
            y -= 10

            for title, chart_path in chart_paths:
                if not os.path.exists(chart_path):
                    continue

                img = ImageReader(chart_path)
                iw, ih = img.getSize()
                aspect = ih / iw
                draw_w = cw
                draw_h = draw_w * aspect

                if draw_h > 260:
                    draw_h = 260
                    draw_w = draw_h / aspect

                if y - draw_h < 60:
                    y = new_page()

                y -= draw_h + 8
                c.drawImage(chart_path, margin, y, width=draw_w, height=draw_h)
                y -= 20

        # ── Footer ──
        c.setFillColor(BRAND)
        c.rect(0, 0, w, 4, fill=True, stroke=False)

        c.setFont("Helvetica", 7)
        c.setFillColor(GRAY500)
        c.drawCentredString(w / 2, 14, "Auto-generated sales report — SujalPOS AI Analytics Engine")

        c.save()

        # ── Cleanup temp chart files ──
        for _, chart_path in chart_paths:
            try:
                os.remove(chart_path)
            except Exception:
                pass

        logger.info(f"PDF report generated: {filepath}")
        return filepath
