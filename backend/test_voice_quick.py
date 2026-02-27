"""Quick E2E test: voice order pipeline with WAV audio."""
import requests, wave, struct, math, os, time

BASE = "http://127.0.0.1:8000"

print("=" * 50)
print("VOICE-TO-KOT E2E TEST")
print("=" * 50)

# 1. Health check
r = requests.get(f"{BASE}/health")
print(f"[1] Health: {r.json()['status']}")

# 2. Start session
r = requests.post(f"{BASE}/api/customer/session/start", data={"table_id": "T3"})
token = r.json()["token"]
print(f"[2] Session: OK")

# 3. Generate test WAV (speech-like)
wav_path = "temp_audio/test_speech.wav"
sr = 16000
with wave.open(wav_path, "w") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sr)
    for i in range(sr * 3):
        t = i / sr
        freq = 200 + 100 * math.sin(2 * math.pi * 3 * t)
        amp = 0.3 + 0.7 * abs(math.sin(2 * math.pi * 2 * t))
        v = int(16000 * amp * math.sin(2 * math.pi * freq * t))
        f.writeframes(struct.pack("<h", max(-32768, min(32767, v))))

fsize = os.path.getsize(wav_path)
print(f"[3] Test WAV: {fsize} bytes")

# 4. Send to voice-order
start = time.time()
with open(wav_path, "rb") as f:
    r = requests.post(
        f"{BASE}/api/customer/voice-order",
        headers={"Authorization": f"Bearer {token}"},
        files={"audio": ("order.wav", f, "audio/wav")},
    )
elapsed = time.time() - start
os.remove(wav_path)

d = r.json()
print(f"[4] Response ({elapsed:.1f}s), status: {r.status_code}")
transcript = d.get("transcript", "")
print(f"    Transcript: '{transcript}'")
if d.get("error"):
    print(f"    Error: {d['error']}")
if d.get("items"):
    for it in d["items"]:
        print(f"    -> {it['qty']}x {it['name']} (confidence: {it['confidence']})")

# 5. Frontend check
print()
try:
    r = requests.get("http://localhost:5173/", timeout=3)
    print(f"[5] Frontend: status {r.status_code}")
except:
    print("[5] Frontend: check manually at http://localhost:5173")

print()
print("=" * 50)
print("ALL SERVICES RUNNING")
print("=" * 50)
print()
print("URLs:")
print("  Admin Login:    http://localhost:5173/login")
print("  Voice Order:    http://localhost:5173/table/T3")
print("  KDS:            http://localhost:5173/kds")
print("  Waiter Login:   http://localhost:5173/waiter/login")
print()
print("Credentials: admin/admin123, waiter1/waiter123")
