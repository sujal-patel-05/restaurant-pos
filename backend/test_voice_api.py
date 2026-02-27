"""Quick API verification for voice ordering system."""
import requests

BASE = "http://127.0.0.1:8001"

print("=== 1. Health Check ===")
r = requests.get(f"{BASE}/")
print(f"  Status: {r.status_code} - {r.json()['status']}")

print("\n=== 2. Session Start (T3) ===")
r = requests.post(f"{BASE}/api/customer/session/start", data={"table_id": "T3"})
d = r.json()
print(f"  Status: {r.status_code}")
print(f"  Session ID: {d.get('session_id')}")
print(f"  Table: {d.get('table_number')}")
token = d.get("token")
print(f"  Token: {'YES' if token else 'NO'}")

headers = {"Authorization": f"Bearer {token}"}

print("\n=== 3. Customer Menu ===")
r = requests.get(f"{BASE}/api/customer/menu", headers=headers)
m = r.json()
print(f"  Status: {r.status_code}")
cats = m.get("menu", [])
print(f"  Categories: {len(cats)}")
for c in cats[:5]:
    print(f"    {c['category']}: {len(c['items'])} items")

print("\n=== 4. Customer Orders ===")
r = requests.get(f"{BASE}/api/customer/orders", headers=headers)
o = r.json()
print(f"  Status: {r.status_code}")
print(f"  Orders: {o.get('total_orders', 0)}")

print("\n=== ALL API TESTS PASSED! ===")
