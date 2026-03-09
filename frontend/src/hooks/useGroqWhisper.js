/**
 * useGroqWhisper.js
 * Sends audio chunks to the backend /api/customer/transcribe proxy.
 * Handles:
 *  - Request sequence numbers (prevent race conditions / stale responses)
 *  - Rate limiting (min 1.5s between requests)
 *  - Word-level animated display using verbose_json word timestamps
 */
import { useState, useRef, useCallback } from 'react';
import { GROQ_CONFIG, API_PATHS } from '../config/groqConfig';
import { extensionFromMimeType } from '../utils/audioUtils';

export function useGroqWhisper({ customerToken }) {
  const [liveTranscript, setLiveTranscript]   = useState('');
  const [displayWords, setDisplayWords]         = useState([]);
  const [isTranscribing, setIsTranscribing]     = useState(false);
  const [confidence, setConfidence]             = useState(null);
  const [transcribeError, setTranscribeError]   = useState(null);

  const sequenceRef         = useRef(0);
  const lastProcessedSeqRef = useRef(0);
  const lastRequestTimeRef  = useRef(0);

  /**
   * Sends a blob to the backend Groq Whisper proxy.
   * Thread-safe via sequence numbers — only the freshest response wins.
   */
  const transcribe = useCallback(async (audioBlob) => {
    if (!audioBlob || audioBlob.size < GROQ_CONFIG.MIN_BLOB_SIZE_BYTES) return;

    // Rate limit — skip if called too soon
    const now = Date.now();
    if (now - lastRequestTimeRef.current < GROQ_CONFIG.MIN_REQUEST_INTERVAL_MS) return;
    lastRequestTimeRef.current = now;

    const thisSeq = ++sequenceRef.current;
    setIsTranscribing(true);
    setTranscribeError(null);

    try {
      const ext = extensionFromMimeType(audioBlob.type);
      const formData = new FormData();
      formData.append('audio', audioBlob, `audio.${ext}`);

      const headers = {};
      if (customerToken) headers['Authorization'] = `Bearer ${customerToken}`;

      const res = await fetch(API_PATHS.TRANSCRIBE, {
        method: 'POST',
        headers,
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.detail || `Transcribe error ${res.status}`);
      }

      const data = await res.json();

      // Stale-response guard
      if (thisSeq <= lastProcessedSeqRef.current) return;
      lastProcessedSeqRef.current = thisSeq;

      const text = data.text || '';
      const words = data.words || [];

      setLiveTranscript(text);
      setDisplayWords(words);

      if (words.length > 0) {
        const avg = words.reduce((s, w) => s + (w.probability ?? 1), 0) / words.length;
        setConfidence(avg);
      }

      return { text, words };
    } catch (err) {
      // Only update error state if this is still the most recent request
      if (thisSeq > lastProcessedSeqRef.current) {
        setTranscribeError(err.message);
      }
      return null;
    } finally {
      // Only clear spinner if no newer requests are in-flight
      if (thisSeq >= sequenceRef.current) {
        setIsTranscribing(false);
      }
    }
  }, [customerToken]);

  /** Reset all transcription state (called when recording starts fresh) */
  const reset = useCallback(() => {
    setLiveTranscript('');
    setDisplayWords([]);
    setConfidence(null);
    setTranscribeError(null);
    setIsTranscribing(false);
    sequenceRef.current = 0;
    lastProcessedSeqRef.current = 0;
    lastRequestTimeRef.current = 0;
  }, []);

  return {
    liveTranscript,
    displayWords,
    isTranscribing,
    confidence,
    transcribeError,
    transcribe,
    reset,
  };
}
