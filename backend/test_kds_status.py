from database import SessionLocal
from services.order_service import OrderService
from models import KOT, OrderStatus

def test_update():
    db = SessionLocal()
    try:
        # Get first pending/placed KOT
        kot = db.query(KOT).filter(KOT.status == OrderStatus.PLACED).first()
        if not kot:
            print("No PLACED KOT found to test.")
            # Try finding any KOT
            kot = db.query(KOT).first()
            if not kot:
                print("No KOTs found at all.")
                return

        print(f"Testing update for KOT: {kot.id} (Current Status: {kot.status})")
        
        # Try updating to preparing
        result = OrderService.update_kot_status(db, kot.id, "preparing")
        print(f"Update Result: {result}")
        
    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    test_update()
