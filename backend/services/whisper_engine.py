"""
WhisperEngine — Speech-to-text using Groq's free Whisper API.
Uses whisper-large-v3 via Groq Cloud.
Converts webm/opus audio to WAV via ffmpeg before sending.
"""
import os
import time
import logging
import subprocess
import tempfile
from dotenv import load_dotenv

load_dotenv()
logger = logging.getLogger(__name__)

# Known Whisper hallucinations when no real speech is detected
HALLUCINATION_PHRASES = {
    "thank you for watching",
    "thanks for watching",
    "subtitles by",
    "amara.org",
    "subscribe",
    "like and subscribe",
    "please subscribe",
    "see you next time",
    "the end",
    "music",
    "applause",
    "you",
    "bye",
    "",
}


def convert_to_wav(input_path: str) -> str:
    """Convert any audio format to 16kHz mono WAV using ffmpeg."""
    output_path = input_path.rsplit(".", 1)[0] + "_converted.wav"
    print(f"[AUDIO-DEBUG] Converting: {input_path} -> {output_path}")
    print(f"[AUDIO-DEBUG] Input exists: {os.path.exists(input_path)}, size: {os.path.getsize(input_path) if os.path.exists(input_path) else 'N/A'}")

    try:
        cmd = [
            "ffmpeg", "-y",
            "-i", input_path,
            "-ar", "16000",
            "-ac", "1",
            "-c:a", "pcm_s16le",
            "-f", "wav",
            output_path,
        ]

        # On Windows, hide the ffmpeg console window
        kwargs = {}
        if os.name == 'nt':
            kwargs['creationflags'] = subprocess.CREATE_NO_WINDOW

        result = subprocess.run(cmd, capture_output=True, timeout=15, **kwargs)

        if result.returncode == 0 and os.path.exists(output_path):
            size = os.path.getsize(output_path)
            print(f"[AUDIO-DEBUG] WAV conversion SUCCESS: {size} bytes")
            return output_path
        else:
            stderr = result.stderr.decode(errors='replace')[:300] if result.stderr else "no error"
            print(f"[AUDIO-DEBUG] ffmpeg FAILED (code {result.returncode}): {stderr}")
            return input_path
    except Exception as e:
        print(f"[AUDIO-DEBUG] Convert exception: {e}")
        return input_path


def is_hallucination(text: str) -> bool:
    """Check if Whisper output is a known hallucination."""
    cleaned = text.strip().lower().rstrip(".!,")
    return cleaned in HALLUCINATION_PHRASES


class WhisperEngine:
    """Uses Groq's free Whisper API for fast, accurate speech-to-text."""

    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance

    def __init__(self):
        self._groq_key = os.getenv("GROQ_API_KEY", "")
        self._local_model = None

    def load_model(self):
        if self._groq_key:
            print("[WHISPER] Using Groq Whisper API (whisper-large-v3) - fastest & most accurate")
        else:
            print("[WHISPER] No GROQ_API_KEY, loading local base model...")
            try:
                import whisper
                self._local_model = whisper.load_model("base")
                print("[WHISPER] Local base model loaded")
            except Exception as e:
                print(f"[WHISPER] Failed: {e}")

    @property
    def is_loaded(self):
        return bool(self._groq_key) or self._local_model is not None

    def transcribe(self, audio_path: str, menu_items: list[str] = None) -> dict:
        """Transcribe audio. Converts to WAV first for reliability."""
        print(f"[WHISPER] transcribe() called with: {audio_path}")
        
        # ALWAYS convert to WAV regardless of format
        wav_path = convert_to_wav(audio_path)
        use_wav = wav_path != audio_path

        try:
            if self._groq_key:
                result = self._transcribe_groq(wav_path, menu_items)
            elif self._local_model:
                result = self._transcribe_local(wav_path, menu_items)
            else:
                raise RuntimeError("No speech-to-text engine available")

            # Check for hallucinations
            if is_hallucination(result["text"]):
                print(f"[WHISPER] HALLUCINATION detected: '{result['text']}'")
                result["text"] = ""
                result["hallucination"] = True

            return result
        finally:
            if use_wav and os.path.exists(wav_path):
                try:
                    os.remove(wav_path)
                except OSError:
                    pass

    def _transcribe_groq(self, audio_path: str, menu_items: list[str] = None) -> dict:
        """Transcribe using Groq's free Whisper API."""
        import httpx

        start = time.time()

        prompt = "This is a restaurant food order. The customer is ordering menu items."
        if menu_items:
            prompt += " Menu: " + ", ".join(menu_items[:30]) + "."

        file_size = os.path.getsize(audio_path) if os.path.exists(audio_path) else 0
        print(f"[WHISPER-GROQ] Sending file: {audio_path} ({file_size} bytes)")

        try:
            with open(audio_path, "rb") as audio_file:
                ext = os.path.splitext(audio_path)[1].lower()
                mime = "audio/wav" if ext == ".wav" else "audio/webm"
                fname = f"audio{ext}"

                response = httpx.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {self._groq_key}"},
                    data={
                        "model": "whisper-large-v3",
                        "language": "en",
                        "temperature": "0.0",
                        "prompt": prompt,
                    },
                    files={
                        "file": (fname, audio_file, mime),
                    },
                    timeout=30.0,
                )

            elapsed_ms = int((time.time() - start) * 1000)

            if response.status_code == 200:
                data = response.json()
                transcript = data.get("text", "").strip()
                print(f"[WHISPER-GROQ] Transcribed in {elapsed_ms}ms: '{transcript}'")
                return {"text": transcript, "language": "en", "duration_ms": elapsed_ms}
            else:
                error = response.text[:300]
                print(f"[WHISPER-GROQ] API error {response.status_code}: {error}")
                if self._local_model:
                    return self._transcribe_local(audio_path, menu_items)
                raise RuntimeError(f"Groq API error: {response.status_code} - {error}")

        except httpx.TimeoutException:
            print("[WHISPER-GROQ] Timeout!")
            if self._local_model:
                return self._transcribe_local(audio_path, menu_items)
            raise RuntimeError("Groq API timed out")

    def _transcribe_local(self, audio_path: str, menu_items: list[str] = None) -> dict:
        """Fallback: local Whisper model."""
        prompt = ("Menu: " + ", ".join(menu_items[:50])) if menu_items else None
        start = time.time()
        result = self._local_model.transcribe(audio_path, language="en", fp16=False, initial_prompt=prompt)
        elapsed_ms = int((time.time() - start) * 1000)
        transcript = result["text"].strip()
        print(f"[WHISPER-LOCAL] '{transcript}' ({elapsed_ms}ms)")
        return {"text": transcript, "language": "en", "duration_ms": elapsed_ms}


# Global singleton
whisper_engine = WhisperEngine()
