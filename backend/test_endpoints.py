import sys
import os
import requests
import json
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

base = "http://localhost:8000"
r = requests.post(f"{base}/api/auth/login", json={"username": "admin", "password": "password"})
if r.status_code != 200:
    r = requests.post(f"{base}/api/auth/login", json={"username": "admin", "password": "password123"})
if r.status_code != 200:
    r = requests.post(f"{base}/api/auth/login", json={"username": "admin", "password": "admin123"})

if r.status_code != 200:
    print("Could not login")
    print(r.text)
    sys.exit()

token = r.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

endpoints = [
    "/api/reports/sales?days=7",
    "/api/reports/sales/items?days=7",
    "/api/reports/peak-hours?days=7",
    "/api/reports/inventory/usage?days=7",
    "/api/reports/wastage?days=7",
    "/api/reports/online-vs-offline?days=30",
    "/api/reports/sales-forecast?days=30&forecast_days=7",
    "/api/reports/daily-revenue-trend?days=30",
    "/api/reports/category-sales?days=7",
    "/api/reports/payment-methods?days=7"
]

results = {}
for ep in endpoints:
    url = base + ep
    try:
        res = requests.get(url, headers=headers)
        if res.status_code == 200:
            results[ep] = "OK"
        else:
            results[ep] = f"FAILED: {res.status_code} - {res.text[:100]}"
    except Exception as e:
        results[ep] = f"ERROR: {e}"

with open("test_endpoints_output.json", "w") as f:
    json.dump(results, f, indent=2)

print("Saved to test_endpoints_output.json")
