from database import SessionLocal
from models import User

def check_user():
    db = SessionLocal()
    try:
        users = db.query(User).all()
        print(f"Total users: {len(users)}")
        for user in users:
            print(f"User: {user.username}, ID: {user.id}, Role: {user.role}, Restaurant: {user.restaurant_id}")
            
    except Exception as e:
        print(f"Error: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    check_user()
