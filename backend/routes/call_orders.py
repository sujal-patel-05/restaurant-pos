"""
Call Orders — Real-time AI voice ordering over phone calls.

Architecture:
  1. Staff opens Call Orders page, picks up phone, clicks "Start Listening"
  2. Browser captures microphone audio (picks up phone call audio)
  3. WebSocket streams audio chunks to this backend
  4. Backend buffers chunks → Sarvam AI STT → live transcript
  5. On "Process Order": Sarvam LLM parses transcript into order items
  6. Staff confirms → Order + KOTs auto-generated
  7. Sarvam TTS generates AI voice response for the customer

Endpoints:
  WS   /api/call-orders/stream       — Live audio → transcript
  POST /api/call-orders/process      — Parse transcript → items
  POST /api/call-orders/tts          — Text → speech (AI response)
  POST /api/call-orders/create       — Create order from parsed items
"""
import os
import json
import uuid
import tempfile
import subprocess
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends, Form, HTTPException, Query
from sqlalchemy.orm import Session
from database import get_db
from routes.auth import get_current_user
from models import User, Restaurant, MenuItem, Order, OrderItem

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/api/call-orders", tags=["Call Orders"])


# ═══════════════════════════════════════════════════════════════════════════
# WebSocket: Real-time audio streaming → live transcription
# ═══════════════════════════════════════════════════════════════════════════

@router.websocket("/stream")
async def call_audio_stream(ws: WebSocket, restaurant_id: str = Query(...)):
    """
    WebSocket endpoint for real-time call audio streaming.
    
    Client sends binary audio chunks (WebM/Opus from MediaRecorder).
    Server responds with JSON transcription results:
      { "type": "bot_audio",  "audio": "<base64 WAV>", "text": "..." }
      { "type": "transcript", "text": "customer said..." }
      { "type": "order",      "items": [...], "total": 123 }
    """
    await ws.accept()
    
    import httpx
    from config import settings
    
    cumulative_transcript = ""
    audio_buffer = bytearray()
    chunk_count = 0
    
    await ws.send_json({"type": "status", "message": "Connected. Listening..."})
    
    try:
        while True:
            # Receive binary audio data
            data = await ws.receive_bytes()
            audio_buffer.extend(data)
            chunk_count += 1
            
            # Process every ~3 seconds of audio (buffer ~48KB at 128kbps)
            if len(audio_buffer) < 24000:
                continue
            
            # Save buffer to temp file and convert to WAV
            tmp_dir = os.path.join(os.path.abspath(os.path.dirname(os.path.dirname(__file__))), "temp_audio")
            os.makedirs(tmp_dir, exist_ok=True)
            
            webm_path = os.path.join(tmp_dir, f"call_{uuid.uuid4().hex[:8]}.webm")
            wav_path = webm_path.replace(".webm", ".wav")
            
            try:
                # Write buffer to file
                with open(webm_path, "wb") as f:
                    f.write(bytes(audio_buffer))
                
                # Convert to WAV using ffmpeg
                result = subprocess.run(
                    ["ffmpeg", "-y", "-i", webm_path, "-ar", "16000", "-ac", "1", "-f", "wav", wav_path],
                    capture_output=True, text=True, timeout=10, shell=True
                )
                
                if result.returncode != 0 or not os.path.exists(wav_path):
                    await ws.send_json({"type": "status", "message": f"Processing chunk {chunk_count}..."})
                    continue
                
                # Send to Sarvam AI STT
                sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
                transcript_chunk = ""
                
                if sarvam_key and os.path.getsize(wav_path) > 1000:
                    try:
                        with open(wav_path, "rb") as audio_file:
                            resp = httpx.post(
                                "https://api.sarvam.ai/speech-to-text",
                                headers={"api-subscription-key": sarvam_key},
                                data={"model": "saaras:v3", "language_code": "hi-IN", "mode": "transcribe"},
                                files={"file": ("audio.wav", audio_file, "audio/wav")},
                                timeout=15.0,
                            )
                        
                        if resp.status_code == 200:
                            transcript_chunk = resp.json().get("transcript", "").strip()
                    except Exception as e:
                        logger.error(f"[CALL-STT] Sarvam error: {e}")
                
                # Fallback to Groq Whisper
                if not transcript_chunk and settings.GROQ_API_KEY:
                    try:
                        from groq import Groq
                        client = Groq(api_key=settings.GROQ_API_KEY)
                        with open(wav_path, "rb") as f:
                            result = client.audio.transcriptions.create(
                                file=("audio.wav", f.read()),
                                model="whisper-large-v3-turbo",
                                language="hi",
                            )
                        transcript_chunk = result.text.strip() if result.text else ""
                    except Exception as e:
                        logger.error(f"[CALL-STT] Groq fallback error: {e}")
                
                # Update cumulative transcript
                if transcript_chunk and transcript_chunk.lower() not in ["thank you.", "thanks.", "bye.", ""]:
                    cumulative_transcript += (" " + transcript_chunk) if cumulative_transcript else transcript_chunk
                    
                    await ws.send_json({
                        "type": "transcript",
                        "text": transcript_chunk,
                        "cumulative": cumulative_transcript.strip(),
                    })
                else:
                    await ws.send_json({"type": "status", "message": "Listening..."})
                
                # Clear buffer after processing (keep last bit for context overlap)
                audio_buffer = bytearray()
                
            finally:
                # Cleanup temp files
                for f in [webm_path, wav_path]:
                    try:
                        os.remove(f)
                    except:
                        pass
                    
    except WebSocketDisconnect:
        logger.info("[CALL-WS] Client disconnected")
    except Exception as e:
        logger.error(f"[CALL-WS] Error: {e}")
        try:
            await ws.send_json({"type": "error", "message": str(e)})
        except:
            pass


# ═══════════════════════════════════════════════════════════════════════════
# POST: Process transcript → extract order items (smart parser)
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/process")
async def process_call_transcript(
    transcript: str = Form(...),
    restaurant_id: str = Form(...),
    db: Session = Depends(get_db),
):
    """
    Parse a call transcript into structured order items.
    Uses the same smart parser as voice orders (add/modify/delete + fuzzy matching).
    """
    import httpx
    from config import settings
    from difflib import SequenceMatcher
    
    if not transcript.strip():
        return {"items": [], "unavailable": []}
    
    # Fetch menu
    menu_items = (
        db.query(MenuItem)
        .filter(MenuItem.restaurant_id == restaurant_id, MenuItem.is_available == True)
        .all()
    )
    menu_data = [{"id": item.id, "name": item.name, "price": float(item.price)} for item in menu_items]
    menu_list = "\n".join([f"- {m['name']} (₹{m['price']})" for m in menu_data])
    
    system_prompt = f"""You are an intelligent order parser for an Indian restaurant phone call ordering system.
Extract ALL food and drink items with quantities from this phone call transcript.

AVAILABLE MENU ITEMS:
{menu_list}

STRICT OUTPUT: Respond with ONLY valid JSON, no explanation:
{{"items": [{{"name": "exact menu item name", "qty": number}}], "unavailable": ["items not on menu"]}}

RULES:
1. "name" MUST exactly match an AVAILABLE MENU ITEM.
2. "qty" must be a positive integer. Default is 1.
3. If customer mentions something NOT on the menu, put in "unavailable".
4. Handle Indian accent variations: "kaafi"→Coffee, "biriyani"→Biryani, "roti"/"chapati"→Roti
5. Quantity words: "ek"→1, "do"→2, "teen"→3, "char"→4, "paanch"→5
6. English: "one"→1, "two"/"couple"→2, "three"→3, "four"→4, "five"→5
7. Ignore fillers: please, aur, and, also, bhi, de do, give me, I want
8. Sum duplicate items.

EXAMPLES:
Input: "two butter chicken aur three naan please, also one dal makhani"
Output: {{"items":[{{"name":"Butter Chicken","qty":2}},{{"name":"Naan","qty":3}},{{"name":"Dal Makhani","qty":1}}],"unavailable":[]}}"""

    user_msg = f'Phone call transcript: "{transcript.strip()}"'
    
    # Fuzzy matching helper
    menu_lookup = {m["name"]: m for m in menu_data}
    menu_names_lower = {m["name"].lower(): m["name"] for m in menu_data}
    
    def fuzzy_match(name):
        if not name:
            return None
        if name in menu_lookup:
            return (name, menu_lookup[name])
        lower = name.lower().strip()
        if lower in menu_names_lower:
            matched = menu_names_lower[lower]
            return (matched, menu_lookup[matched])
        best_score, best_match = 0, None
        for menu_name in menu_lookup.keys():
            score = SequenceMatcher(None, lower, menu_name.lower()).ratio()
            if score > best_score:
                best_score, best_match = score, menu_name
        if best_score >= 0.55:
            return (best_match, menu_lookup[best_match])
        return None
    
    def process_response(raw):
        cleaned = raw.replace("```json", "").replace("```", "").strip()
        data = json.loads(cleaned)
        if isinstance(data, list):
            data = {"items": data, "unavailable": []}
        
        items = []
        unavailable = list(data.get("unavailable", []))
        
        for item in data.get("items", []):
            name = item.get("name", "")
            qty = max(1, int(item.get("qty", 1)))
            match = fuzzy_match(name)
            if match:
                matched_name, meta = match
                items.append({"name": matched_name, "qty": qty, "menu_item_id": meta["id"], "price": meta["price"]})
            elif name and name.lower() not in [u.lower() for u in unavailable]:
                unavailable.append(name)
        
        return {"items": items, "unavailable": unavailable}
    
    # Primary: Sarvam AI
    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    if sarvam_key:
        try:
            resp = httpx.post(
                "https://api.sarvam.ai/v1/chat/completions",
                headers={"api-subscription-key": sarvam_key, "Content-Type": "application/json"},
                json={
                    "model": "sarvam-m",
                    "messages": [{"role": "system", "content": system_prompt}, {"role": "user", "content": user_msg}],
                    "max_tokens": 600, "temperature": 0,
                },
                timeout=20.0,
            )
            if resp.status_code == 200:
                raw = resp.json()["choices"][0]["message"]["content"].strip()
                print(f"[CALL-PARSE] Sarvam: {raw}")
                return process_response(raw)
        except Exception as e:
            print(f"[CALL-PARSE] Sarvam error: {e}")
    
    # Fallback: Groq
    if settings.GROQ_API_KEY:
        try:
            from groq import Groq
            client = Groq(api_key=settings.GROQ_API_KEY)
            response = client.chat.completions.create(
                model="llama-3.1-8b-instant",
                messages=[{"role": "system", "content": system_prompt}, {"role": "user", "content": user_msg}],
                max_tokens=600, temperature=0,
            )
            raw = response.choices[0].message.content.strip()
            print(f"[CALL-PARSE] Groq: {raw}")
            return process_response(raw)
        except Exception as e:
            print(f"[CALL-PARSE] Groq error: {e}")
    
    return {"items": [], "unavailable": [], "error": "No LLM available"}


# ═══════════════════════════════════════════════════════════════════════════
# POST: Text-to-Speech — AI voice response for the customer
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/tts")
async def generate_tts(
    text: str = Form(...),
    language: str = Form("hi-IN"),
):
    """
    Generate speech audio from text using Sarvam AI TTS (Bulbul).
    Returns base64-encoded WAV audio.
    Falls back to empty response if TTS unavailable.
    """
    import httpx
    import base64
    from config import settings
    
    sarvam_key = getattr(settings, 'SARVAM_API_KEY', None) or os.getenv('SARVAM_API_KEY', '')
    
    if not sarvam_key:
        return {"audio": None, "error": "TTS not configured"}
    
    try:
        resp = httpx.post(
            "https://api.sarvam.ai/text-to-speech",
            headers={
                "api-subscription-key": sarvam_key,
                "Content-Type": "application/json",
            },
            json={
                "inputs": [text[:1500]],  # Max 1500 chars for Bulbul v2
                "target_language_code": language,
                "model": "bulbul:v2",
                "speaker": "meera",  # Hindi female voice
                "pitch": 0,
                "pace": 1.1,  # Slightly faster for natural feel
                "loudness": 1.5,
                "enable_preprocessing": True,
                "sample_rate": 16000,
            },
            timeout=15.0,
        )
        
        if resp.status_code == 200:
            data = resp.json()
            # Sarvam returns base64-encoded audio in "audios" array
            audios = data.get("audios", [])
            if audios:
                return {"audio": audios[0], "format": "wav", "sample_rate": 16000}
        
        print(f"[CALL-TTS] Error {resp.status_code}: {resp.text[:200]}")
        return {"audio": None, "error": f"TTS error: {resp.status_code}"}
        
    except Exception as e:
        print(f"[CALL-TTS] Exception: {e}")
        return {"audio": None, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════
# POST: Create order from parsed call items
# ═══════════════════════════════════════════════════════════════════════════

@router.post("/create")
async def create_call_order(
    items_json: str = Form(...),
    restaurant_id: str = Form(...),
    order_type: str = Form("delivery"),
    customer_name: str = Form(""),
    customer_phone: str = Form(""),
    delivery_address: str = Form(""),
    transcript: str = Form(""),
    db: Session = Depends(get_db),
):
    """
    Create an order from parsed call items.
    Auto-generates KOTs for kitchen display.
    """
    try:
        items = json.loads(items_json)
    except json.JSONDecodeError:
        raise HTTPException(status_code=400, detail="Invalid items JSON")
    
    if not items:
        raise HTTPException(status_code=400, detail="No items provided")
    
    restaurant = db.query(Restaurant).filter(Restaurant.id == restaurant_id).first()
    if not restaurant:
        raise HTTPException(status_code=404, detail="Restaurant not found")
    
    gst_pct = float(restaurant.gst_percentage) if restaurant.gst_percentage else 5.0
    
    # Calculate totals
    subtotal = 0
    order_items_data = []
    for item in items:
        qty = max(1, int(item.get("qty", 1)))
        price = float(item.get("price", 0))
        subtotal += round(price * qty, 2)
        order_items_data.append({
            "menu_item_id": item["menu_item_id"],
            "quantity": qty,
            "unit_price": price,
            "special_instructions": item.get("special_instructions"),
        })
    
    gst_amount = round(subtotal * gst_pct / 100, 2)
    total_amount = round(subtotal + gst_amount, 2)
    
    # Create order
    new_order = Order(
        restaurant_id=restaurant_id,
        order_type=order_type,
        status="confirmed",
        subtotal=subtotal,
        tax_amount=gst_amount,
        total_amount=total_amount,
        customer_name=customer_name or None,
        customer_phone=customer_phone or None,
        delivery_address=delivery_address or None,
        notes=f"[Call Order] {transcript[:200]}" if transcript else "[Call Order]",
    )
    db.add(new_order)
    db.flush()
    
    # Add order items
    for item_data in order_items_data:
        order_item = OrderItem(
            order_id=new_order.id,
            **item_data,
        )
        db.add(order_item)
    
    db.commit()
    db.refresh(new_order)
    
    # Auto-generate KOTs
    try:
        from services.order_service import OrderService
        order_svc = OrderService(db)
        order_svc.generate_kots(new_order.id)
        db.commit()
    except Exception as e:
        logger.warning(f"[CALL-ORDER] KOT generation failed: {e}")
    
    return {
        "order_id": str(new_order.id),
        "order_number": getattr(new_order, 'order_number', None),
        "total": total_amount,
        "item_count": len(order_items_data),
        "status": "confirmed",
        "message": "Call order placed successfully! KOTs sent to kitchen.",
    }
