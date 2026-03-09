/**
 * groqConfig.js — Tuning constants for the Groq Whisper voice pipeline.
 * Adjust these to change timing and quality characteristics.
 */
export const GROQ_CONFIG = {
  // How often (ms) to force a Whisper transcription request (time-based trigger)
  CHUNK_INTERVAL_MS: 4000,

  // Silence detection: volume (0–100 scale) below which = silence
  SILENCE_THRESHOLD: 12,

  // How long (ms) silence must persist before sending a chunk
  SILENCE_DURATION_MS: 1500,

  // Minimum gap (ms) between consecutive Whisper API requests
  // Protects against rate limiting on the free tier
  MIN_REQUEST_INTERVAL_MS: 1500,

  // Auto-stop recording after this duration (ms) if user hasn't stopped
  MAX_RECORDING_DURATION_MS: 30_000,

  // Minimum audio blob size (bytes) to bother sending to Whisper/Sarvam
  // Increased to 8KB to ensure valid container headers are reached
  MIN_BLOB_SIZE_BYTES: 8192,

  // Low confidence threshold — words below this probability get muted styling
  LOW_CONFIDENCE_THRESHOLD: 0.75,
};

// Backend proxy endpoint paths (relative — proxied by Vite dev server)
export const API_PATHS = {
  TRANSCRIBE: '/api/customer/transcribe',
  PARSE_ORDER: '/api/customer/parse-order',
  SUBMIT_ORDER: '/api/customer/submit-order',
  MENU: '/api/customer/menu',
  ORDERS: '/api/customer/orders',
  SESSION_START: '/api/customer/session/start',
};
