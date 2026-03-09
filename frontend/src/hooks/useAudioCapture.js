/**
 * useAudioCapture.js
 * Manages MediaRecorder + volume monitoring.
 * 
 * STRATEGY: Record all audio as a single continuous blob.
 * When user stops, return the complete blob for transcription.
 * This gives STT engines (Sarvam/Groq) the best quality audio
 * with full context, rather than fragmented chunks.
 */
import { useRef, useCallback, useState } from 'react';
import { getSupportedMimeType, createAnalyser, getAverageVolume } from '../utils/audioUtils';

export function useAudioCapture({ onChunkReady, onVolumeChange }) {
  const [isCapturing, setIsCapturing] = useState(false);

  // Refs
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const analyserCleanupRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);
  const isCapturingRef = useRef(false);

  // ── Volume monitoring loop (for waveform visualizer, no silence-based sending) ──
  const startVolumeLoop = useCallback(() => {
    const loop = () => {
      if (!isCapturingRef.current || !analyserRef.current) return;
      const vol = getAverageVolume(analyserRef.current);
      onVolumeChange?.(vol);
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
  }, [onVolumeChange]);

  // ── Start capture on an existing MediaStream ─────────────────────────
  const startCapture = useCallback(async (stream) => {
    streamRef.current = stream;
    audioChunksRef.current = [];

    // Set up analyser for volume visualisation
    const { analyser, cleanup } = createAnalyser(stream);
    analyserRef.current = analyser;
    analyserCleanupRef.current = cleanup;

    // Create MediaRecorder with best supported codec
    const mimeType = getSupportedMimeType();
    console.log('[AudioCapture] Using mimeType:', mimeType);

    const mr = new MediaRecorder(stream, {
      ...(mimeType ? { mimeType } : {}),
      audioBitsPerSecond: 128_000,
    });

    mr.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        audioChunksRef.current.push(event.data);
      }
    };

    // Use timeslice of 1000ms to collect data periodically
    // but we DON'T send chunks during recording anymore
    mr.start(1000);
    mediaRecorderRef.current = mr;
    isCapturingRef.current = true;
    setIsCapturing(true);

    startVolumeLoop();
  }, [onVolumeChange, startVolumeLoop]);

  // ── Stop capture and return the final complete blob ───────────────────
  const stopCapture = useCallback(() => {
    return new Promise((resolve) => {
      isCapturingRef.current = false;
      setIsCapturing(false);

      // Stop monitoring
      cancelAnimationFrame(rafRef.current);
      onVolumeChange?.(0);

      const mr = mediaRecorderRef.current;
      if (mr && mr.state !== 'inactive') {
        mr.onstop = () => {
          // Build ONE complete blob from ALL collected chunks
          const finalBlob = new Blob(audioChunksRef.current, {
            type: mr.mimeType || 'audio/webm',
          });
          console.log('[AudioCapture] Final blob size:', finalBlob.size, 'bytes, type:', finalBlob.type);
          audioChunksRef.current = [];
          resolve(finalBlob);
        };
        mr.stop();
      } else {
        resolve(null);
      }

      // Stop mic (release hardware)
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
      analyserCleanupRef.current?.();
    });
  }, [onVolumeChange]);

  // ── Cleanup on unmount ────────────────────────────────────────────────
  const cleanup = useCallback(() => {
    isCapturingRef.current = false;
    cancelAnimationFrame(rafRef.current);
    if (mediaRecorderRef.current?.state !== 'inactive') {
      try { mediaRecorderRef.current?.stop(); } catch (_) { }
    }
    streamRef.current?.getTracks().forEach((t) => t.stop());
    analyserCleanupRef.current?.();
    audioChunksRef.current = [];
  }, []);

  return {
    isCapturing,
    startCapture,
    stopCapture,
    cleanup,
  };
}
