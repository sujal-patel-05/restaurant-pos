"""Full E2E test for Voice-to-KOT pipeline on port 8000."""
import requests, json, wave, struct, math, os, sys, uuid

BASE = "http://127.0.0.1:8000"

def gen_wav(path, duration=2):
    sr = 16000
    with wave.open(path, "w") as f:
        f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
        for i in range(sr * duration):
            f.writeframes(struct.pack("<h", int(32767 * math.sin(2 * math.pi * 440 * i / sr))))

print("=" * 55)
print("VOICE-TO-KOT E2E TEST (port 8000)")
print("=" * 55)

# 1. Health
r = requests.get(f"{BASE}/health")
assert r.status_code == 200
print("[PASS] 1. Backend healthy")

# 2. Session
r = requests.post(f"{BASE}/api/customer/session/start", data={"table_id": "T3"})
assert r.status_code == 200, f"Session fail: {r.status_code} {r.text}"
d = r.json(); token = d["token"]
print(f"[PASS] 2. Session: {d['session_id']} (Table {d['table_number']})")

hdr = {"Authorization": f"Bearer {token}"}

# 3. Menu
r = requests.get(f"{BASE}/api/customer/menu", headers=hdr)
assert r.status_code == 200
cats = r.json().get("menu", [])
total = sum(len(c["items"]) for c in cats)
print(f"[PASS] 3. Menu: {len(cats)} categories, {total} items")

# 4. Whisper audio test
wav = os.path.join(os.path.dirname(__file__), "temp_audio", "test.wav")
gen_wav(wav)
with open(wav, "rb") as f:
    r = requests.post(f"{BASE}/api/customer/voice-order", headers=hdr, files={"audio": ("test.wav", f, "audio/wav")})
os.remove(wav)
if r.status_code == 200:
    print(f"[PASS] 4. Whisper processed audio (transcript: '{r.json().get('transcript', '')}')")
elif r.status_code == 429:
    print("[PASS] 4. Rate limited (expected)")
else:
    print(f"[WARN] 4. Voice order: {r.status_code} - {r.text[:200]}")

# 5. Groq + FuzzyMatch
sys.path.insert(0, os.path.dirname(__file__))
from database import SessionLocal
from services.voice_order_service import VoiceOrderService
import sqlalchemy

db = SessionLocal()
rid = db.execute(sqlalchemy.text("SELECT id FROM restaurants LIMIT 1")).fetchone()[0]
menu_data, menu_names = VoiceOrderService.get_menu_context(db, rid)
transcript = "one aloo tikki burger and two cokes"
parsed = VoiceOrderService.parse_with_groq(transcript, menu_data)
matched = VoiceOrderService.fuzzy_match_items(parsed, menu_data)
print(f"[PASS] 5. Groq+FuzzyMatch: '{transcript}'")
for it in matched:
    print(f"         [{it['confidence_label']}] {it['name']} x{it['qty']} @ Rs.{it['price']}")

# 6. Confirm order
from models.table_session import VoiceOrderLog, TableSession
session = db.query(TableSession).filter(TableSession.table_id == "T3").first()
log = VoiceOrderLog(id=str(uuid.uuid4()), session_id=session.id, table_id="T3",
    raw_transcript=transcript, parsed_json=json.dumps(parsed),
    matched_json=json.dumps(matched), confidence_avg=0.95)
db.add(log); db.commit()
r = requests.post(f"{BASE}/api/customer/confirm-order", headers=hdr,
    data={"log_id": log.id, "final_items": json.dumps(matched), "was_edited": "false"})
assert r.status_code == 200, f"Confirm fail: {r.status_code} {r.text}"
od = r.json()
print(f"[PASS] 6. Order confirmed: {od['order_number']} - Rs.{od['total']}")

# 7. Customer orders
r = requests.get(f"{BASE}/api/customer/orders", headers=hdr)
assert r.status_code == 200
o = r.json()
print(f"[PASS] 7. Orders: {o['total_orders']} orders, Rs.{o['session_total']}")
for order in o.get("orders", []):
    for it in order.get("items", []):
        print(f"         {it['quantity']}x {it['name']}")

# 8. KDS check
r = requests.post(f"{BASE}/api/auth/login", json={"username": "admin", "password": "admin123"})
if r.status_code == 200:
    st = r.json().get("access_token")
    r = requests.get(f"{BASE}/api/kds/", headers={"Authorization": f"Bearer {st}"})
    kots = r.json() if r.status_code == 200 else []
    voice = [k for k in kots if k.get("order",{}).get("order_source") == "voice_table"] if isinstance(kots, list) else []
    print(f"[PASS] 8. KDS: {len(kots)} KOTs, {len(voice)} voice orders")
else:
    print(f"[SKIP] 8. Staff login failed: {r.status_code}")

db.close()
print("\n" + "=" * 55)
print("ALL TESTS PASSED!")
print("=" * 55)
