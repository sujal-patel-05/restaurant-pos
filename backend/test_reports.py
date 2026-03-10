import sys
import os
import pprint
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
from database import SessionLocal
from models import User, Order
from services.report_service import ReportService
from datetime import datetime, timedelta

db = SessionLocal()
user = db.query(User).first()
if not user:
    print("No user found")
    sys.exit(0)

stats = ReportService.get_dashboard_stats(db, user.restaurant_id)
end_date = datetime.utcnow()
start_date = end_date - timedelta(days=7)
sales = ReportService.get_sales_report(db, user.restaurant_id, start_date, end_date)
daily_revenue = ReportService.get_dashboard_charts(db, user.restaurant_id)

total_orders = db.query(Order).count()
recent_orders = db.query(Order).order_by(Order.created_at.desc()).limit(3).all()

out = {
    "user": user.username,
    "restaurant_id": str(user.restaurant_id),
    "dashboard_stats": stats,
    "sales_report": sales,
    "daily_revenue": daily_revenue["revenue_trend"],
    "total_orders": total_orders,
    "recent_orders": [
        {"id": str(o.id), "status": o.status, "created_at": str(o.created_at)}
        for o in recent_orders
    ]
}

with open("test_output.txt", "w") as f:
    f.write(pprint.pformat(out))

print("Saved to test_output.txt")
