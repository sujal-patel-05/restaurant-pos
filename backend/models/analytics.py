"""
Analytics Models — Daily/Monthly snapshot tables for historical comparison
"""

from sqlalchemy import Column, String, DateTime, DECIMAL, Integer, Date, ForeignKey, UniqueConstraint
from datetime import datetime
import uuid
from database import Base


class DailySummary(Base):
    """
    Stores aggregated daily metrics for each restaurant.
    One row per restaurant per day — enables fast daily/weekly/monthly comparisons.
    """
    __tablename__ = "daily_summaries"
    __table_args__ = (
        UniqueConstraint('restaurant_id', 'summary_date', name='uix_restaurant_date'),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    restaurant_id = Column(String(36), ForeignKey("restaurants.id", ondelete="CASCADE"), nullable=False)
    summary_date = Column(Date, nullable=False, index=True)

    # Revenue metrics
    total_revenue = Column(DECIMAL(12, 2), default=0)
    total_orders = Column(Integer, default=0)
    completed_orders = Column(Integer, default=0)
    cancelled_orders = Column(Integer, default=0)
    avg_order_value = Column(DECIMAL(10, 2), default=0)

    # Order breakdown
    dine_in_orders = Column(Integer, default=0)
    takeaway_orders = Column(Integer, default=0)
    delivery_orders = Column(Integer, default=0)
    dine_in_revenue = Column(DECIMAL(12, 2), default=0)
    takeaway_revenue = Column(DECIMAL(12, 2), default=0)
    delivery_revenue = Column(DECIMAL(12, 2), default=0)

    # Tax & Discounts
    total_gst = Column(DECIMAL(10, 2), default=0)
    total_discount = Column(DECIMAL(10, 2), default=0)

    # Payment breakdown
    cash_payments = Column(DECIMAL(12, 2), default=0)
    upi_payments = Column(DECIMAL(12, 2), default=0)
    card_payments = Column(DECIMAL(12, 2), default=0)

    # Inventory & Wastage
    total_wastage_entries = Column(Integer, default=0)
    total_wastage_cost = Column(DECIMAL(10, 2), default=0)
    low_stock_count = Column(Integer, default=0)

    # Top item (name of the best seller that day)
    top_selling_item = Column(String(255), nullable=True)
    top_selling_qty = Column(Integer, default=0)

    # Peak hour (hour with most orders, 0-23)
    peak_hour = Column(Integer, nullable=True)
    peak_hour_orders = Column(Integer, default=0)

    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        return f"<DailySummary {self.summary_date} | ₹{self.total_revenue} | {self.total_orders} orders>"
