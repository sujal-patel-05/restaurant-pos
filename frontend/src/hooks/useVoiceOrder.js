/**
 * useVoiceOrder.js — Smart Voice Waiter orchestrator.
 *   Microphone → MediaRecorder → SINGLE complete blob on stop
 *   → Sarvam AI STT (backend) → Smart order parsing with intent detection
 *   → Apply operations (add/modify/delete) → Show unavailable items
 *
 * Phase state machine:
 *   idle → requesting-permission → recording → transcribing → parsing → done
 *   (any phase) → error
 */
import { useState, useRef, useCallback, useEffect } from 'react';
import { useAudioCapture } from './useAudioCapture';
import { useGroqWhisper } from './useGroqWhisper';
import { useOrderParser } from './useOrderParser';
import { GROQ_CONFIG } from '../config/groqConfig';

export function useVoiceOrder({ menuItems = [], customerToken, onOrderParsed, currentOrder = [] }) {
  // ── Phase machine ─────────────────────────────────────────────────────
  const [phase, setPhase] = useState('idle');
  const [errorType, setErrorType] = useState(null);
  const [parsedItems, setParsedItems] = useState([]);
  const [volumeLevel, setVolumeLevel] = useState(0);

  // ── Unavailable items feedback ─────────────────────────────────────────
  const [unavailableItems, setUnavailableItems] = useState([]);

  // ── Action feedback (for modifications/deletions) ──────────────────────
  const [lastActions, setLastActions] = useState([]);

  // ── Pending text animation ─────────────────────────────────────────────
  const [pendingDots, setPendingDots] = useState('');

  const autoStopTimerRef = useRef(null);

  // ── Sub-hooks ─────────────────────────────────────────────────────────
  const {
    liveTranscript,
    displayWords,
    isTranscribing,
    confidence,
    transcribeError,
    transcribe,
    reset: resetWhisper,
  } = useGroqWhisper({ customerToken });

  const { parse, isParsingOrder, parseMethod, parseError } = useOrderParser({
    menuItems,
    customerToken,
  });

  const { isCapturing, startCapture, stopCapture, cleanup } = useAudioCapture({
    onChunkReady: null,
    onVolumeChange: setVolumeLevel,
  });

  // ── Animated dots (recording, no transcript yet) ──────────────────────
  useEffect(() => {
    if (phase === 'recording' && !liveTranscript) {
      const dots = ['', '.', '..', '...'];
      let i = 0;
      const id = setInterval(() => {
        setPendingDots(dots[i++ % dots.length]);
      }, 400);
      return () => clearInterval(id);
    } else {
      setPendingDots('');
    }
  }, [phase, liveTranscript]);

  // ── Auto-dismiss unavailable items after 5 seconds ─────────────────────
  useEffect(() => {
    if (unavailableItems.length > 0) {
      const id = setTimeout(() => setUnavailableItems([]), 5000);
      return () => clearTimeout(id);
    }
  }, [unavailableItems]);

  // ── Start recording ───────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setPhase('error');
      setErrorType('browser-unsupported');
      return;
    }
    if (typeof MediaRecorder === 'undefined') {
      setPhase('error');
      setErrorType('browser-unsupported');
      return;
    }

    resetWhisper();
    setParsedItems([]);
    setUnavailableItems([]);
    setLastActions([]);
    setPhase('requesting-permission');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      await startCapture(stream);
      setPhase('recording');

      autoStopTimerRef.current = setTimeout(() => {
        stopRecording();
      }, GROQ_CONFIG.MAX_RECORDING_DURATION_MS);
    } catch (err) {
      console.error('[VoiceOrder] Mic error:', err);
      setPhase('error');
      setErrorType(
        err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError'
          ? 'permission-denied'
          : err.name === 'NotFoundError'
            ? 'no-microphone'
            : 'mic-error'
      );
    }
  }, [resetWhisper, startCapture]);

  // ── Stop recording → send final blob → smart parse → apply actions ───
  const stopRecording = useCallback(async () => {
    clearTimeout(autoStopTimerRef.current);
    setPhase('transcribing');

    const finalBlob = await stopCapture();
    console.log('[VoiceOrder] Final blob:', finalBlob?.size, 'bytes');

    let finalText = '';

    if (finalBlob && finalBlob.size >= 2000) {
      try {
        const result = await transcribe(finalBlob);
        if (result?.text) finalText = result.text;
        console.log('[VoiceOrder] Transcription:', finalText);
      } catch (err) {
        console.error('[VoiceOrder] Transcription failed:', err);
      }
    }

    if (!finalText?.trim()) {
      setPhase('idle');
      setVolumeLevel(0);
      return;
    }

    // Parse with current order context
    setPhase('parsing');
    const parseResult = await parse(finalText, currentOrder);

    const actions = parseResult.actions || [];
    const unavailable = parseResult.unavailable || [];

    console.log('[VoiceOrder] Actions:', actions, 'Unavailable:', unavailable);

    setLastActions(actions);
    setUnavailableItems(unavailable);
    setParsedItems(actions);
    setPhase('done');
    setVolumeLevel(0);

    // Pass actions and unavailable to parent
    onOrderParsed?.(actions, finalText, unavailable);
  }, [stopCapture, transcribe, parse, onOrderParsed, currentOrder]);

  // ── Toggle ───────────────────────────────────────────────────────────
  const toggle = useCallback(() => {
    if (phase === 'idle' || phase === 'done' || phase === 'error') {
      startRecording();
    } else if (phase === 'recording') {
      stopRecording();
    }
  }, [phase, startRecording, stopRecording]);

  // ── Force stop ───────────────────────────────────────────────────────
  const forceStop = useCallback(() => {
    clearTimeout(autoStopTimerRef.current);
    cleanup();
    setVolumeLevel(0);
    setPhase('idle');
  }, [cleanup]);

  // ── Full reset ────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    forceStop();
    resetWhisper();
    setParsedItems([]);
    setErrorType(null);
    setPendingDots('');
    setUnavailableItems([]);
    setLastActions([]);
    setPhase('idle');
  }, [forceStop, resetWhisper]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  useEffect(() => () => { clearTimeout(autoStopTimerRef.current); cleanup(); }, [cleanup]);

  return {
    phase,
    errorType,

    liveTranscript,
    displayWords,
    pendingDots,
    isTranscribing,
    confidence,
    transcribeError,

    volumeLevel,

    parsedItems,
    isParsingOrder,
    parseMethod,
    parseError,

    // Smart waiter extras
    unavailableItems,
    lastActions,

    toggle,
    reset,
    forceStop,

    isRecording: phase === 'recording',
    isBusy: ['requesting-permission', 'recording', 'transcribing', 'parsing'].includes(phase),
  };
}
