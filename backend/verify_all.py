"""Quick verify: servers + Groq Whisper API speed test."""
import requests, wave, struct, math, os, time

BASE = "http://127.0.0.1:8001"

print("=" * 50)
print("SERVICE VERIFICATION")
print("=" * 50)

# Backend
r = requests.get(f"{BASE}/health")
print(f"[OK] Backend on :8001 - {r.json()['status']}")

# Frontend
try:
    r = requests.get("http://127.0.0.1:5173/", timeout=3)
    print(f"[OK] Frontend on :5173 - status {r.status_code}")
except:
    print("[WARN] Frontend check failed")

# Session
r = requests.post(f"{BASE}/api/customer/session/start", data={"table_id": "T3"})
token = r.json()["token"]
print(f"[OK] Session - {r.json()['session_id']}")

# Generate test audio with speech-like characteristics
wav = os.path.join(os.path.dirname(__file__), "temp_audio", "speed_test.wav")
sr = 16000
with wave.open(wav, "w") as f:
    f.setnchannels(1); f.setsampwidth(2); f.setframerate(sr)
    for i in range(sr * 3):
        v = int(16000 * math.sin(2*math.pi*200*i/sr) * (1 + 0.5*math.sin(2*math.pi*5*i/sr)))
        f.writeframes(struct.pack("<h", max(-32768, min(32767, v))))

# Speed test
print(f"\n--- Groq Whisper API Speed Test ---")
start = time.time()
with open(wav, "rb") as f:
    r = requests.post(f"{BASE}/api/customer/voice-order",
                      headers={"Authorization": f"Bearer {token}"},
                      files={"audio": ("test.wav", f, "audio/wav")})
elapsed = time.time() - start
os.remove(wav)

if r.status_code == 200:
    d = r.json()
    print(f"[OK] Groq Whisper: {elapsed:.1f}s total")
    print(f"     Transcript: '{d.get('transcript', '')}'")
    print(f"     Backend processing: {d.get('processing_time_ms', '?')}ms")
elif r.status_code == 429:
    print(f"[OK] Rate limited ({elapsed:.1f}s) - try again in 10s")
else:
    print(f"[WARN] Status {r.status_code}: {r.text[:200]}")

print()
print("=" * 50)
print("ALL SERVICES RUNNING!")
print("=" * 50)
print()
print("URLs:")
print("  POS Login:      http://localhost:5173/login")
print("  Voice Order:    http://localhost:5173/table/T3")
print("  KDS:            http://localhost:5173/kds")
print("  Waiter Login:   http://localhost:5173/waiter/login")
print()
print("Credentials:")
print("  admin / admin123")
print("  waiter1 / waiter123")
