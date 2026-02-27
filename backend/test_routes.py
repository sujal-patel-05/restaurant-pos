"""Quick test to check all routes registered in the app."""
import traceback
try:
    from main import app
    routes = []
    for route in app.routes:
        if hasattr(route, 'path'):
            routes.append(route.path)
    
    customer = [r for r in routes if 'customer' in r or 'table' in r]
    print(f"Total routes: {len(routes)}")
    print(f"Customer/Table routes: {customer}")
    
    if not customer:
        print("\n[FAIL] No customer routes found! Checking import directly...")
        from routes.customer import router as cr
        print(f"  Router prefix: {cr.prefix}")
        print(f"  Router routes: {[r.path for r in cr.routes]}")
except Exception:
    traceback.print_exc()
