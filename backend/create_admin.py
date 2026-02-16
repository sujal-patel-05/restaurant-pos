from database import SessionLocal
from models import User, Restaurant, UserRole
from utils.auth import hash_password

def create_admin():
    db = SessionLocal()
    try:
        # Get restaurant
        restaurant = db.query(Restaurant).first()
        if not restaurant:
            print("No restaurant found. Creating one...")
            restaurant = Restaurant(name="Demo Restaurant", address="123 Food St")
            db.add(restaurant)
            db.commit()
            db.refresh(restaurant)
            print(f"Created restaurant: {restaurant.name} ({restaurant.id})")
        else:
             print(f"Using existing restaurant: {restaurant.name} ({restaurant.id})")

        username = "sujal"
        password = "sujal@123"
        hashed_pw = hash_password(password)
        email = "sujal@admin.com" 

        user = db.query(User).filter(User.username == username).first()
        if user:
            print(f"Updating existing user: {username}")
            user.password_hash = hashed_pw
            user.role = UserRole.ADMIN
            user.is_active = True
            user.restaurant_id = restaurant.id 
        else:
            print(f"Creating new user: {username}")
            # Check if email exists to avoid unique constraint error
            if db.query(User).filter(User.email == email).first():
                 email = "sujal_new@admin.com"
            
            user = User(
                username=username,
                email=email,
                password_hash=hashed_pw,
                full_name="Sujal Admin",
                role=UserRole.ADMIN,
                restaurant_id=restaurant.id,
                is_active=True
            )
            db.add(user)
        
        db.commit()
        print(f"Admin user '{username}' setup successfully.")

    except Exception as e:
        print(f"Error: {e}")
        import traceback
        traceback.print_exc()
    finally:
        db.close()

if __name__ == "__main__":
    create_admin()
