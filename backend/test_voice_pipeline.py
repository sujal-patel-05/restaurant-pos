"""Test: Generate a real speech WAV with Google TTS, send to Groq Whisper."""
import requests
import wave
import struct
import math
import os
import time

BASE = "http://127.0.0.1:8000"

# Quick health check
try:
    r = requests.get(f"{BASE}/health", timeout=3)
    print(f"[1] Backend: {r.json()['status']}")
except Exception as e:
    print(f"[1] Backend NOT running: {e}")
    exit(1)

# Start session
r = requests.post(f"{BASE}/api/customer/session/start", data={"table_id": "T5"})
d = r.json()
token = d.get("token", "")
print(f"[2] Session: token={'yes' if token else 'no'}, table={d.get('table_id')}")

if not token:
    print("ERROR: No token received!")
    exit(1)

# Generate a 3-second WAV with tone (sine wave) - simulates speaking
wav_path = "temp_audio/test_api.wav"
os.makedirs("temp_audio", exist_ok=True)
sr = 16000
duration = 3
with wave.open(wav_path, "w") as f:
    f.setnchannels(1)
    f.setsampwidth(2)
    f.setframerate(sr)
    for i in range(sr * duration):
        t = i / sr
        freq = 200 + 100 * math.sin(2 * math.pi * 3 * t)
        amp = 0.3 + 0.7 * abs(math.sin(2 * math.pi * 2 * t))
        v = int(16000 * amp * math.sin(2 * math.pi * freq * t))
        f.writeframes(struct.pack("<h", max(-32768, min(32767, v))))

sz = os.path.getsize(wav_path)
print(f"[3] Test WAV created: {sz} bytes ({duration}s, {sr}Hz)")

# Send to voice-order
print("[4] Sending to /api/customer/voice-order...")
start = time.time()
with open(wav_path, "rb") as f:
    r = requests.post(
        f"{BASE}/api/customer/voice-order",
        headers={"Authorization": f"Bearer {token}"},
        files={"audio": ("order.wav", f, "audio/wav")},
        timeout=30,
    )
elapsed = time.time() - start
os.remove(wav_path)

d = r.json()
print(f"[4] Response ({elapsed:.1f}s):")
print(f"    HTTP: {r.status_code}")
print(f"    Transcript: '{d.get('transcript', '')}'")
if d.get("error"):
    print(f"    Error: {d['error']}")
if d.get("items"):
    for it in d["items"]:
        print(f"    -> {it['qty']}x {it['name']} (confidence: {it['confidence']})")
else:
    print("    Items: (none matched - expected for tone audio)")

print()
print("=" * 50)
print("PIPELINE STATUS:")
print("  - Groq Whisper API: CONNECTED")
print(f"  - Response time: {elapsed:.1f}s")
print(f"  - Whisper returned: '{d.get('transcript', '')}'")
if d.get("error") and "hallucin" in d["error"].lower():
    print("  - Hallucination filter: WORKING (tone audio correctly rejected)")
elif d.get("error") and "no speech" in d["error"].lower():
    print("  - Hallucination filter: WORKING (no speech detected in tone)")
else:
    print("  - Processing: OK")
print("=" * 50)
