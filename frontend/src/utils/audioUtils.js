/**
 * audioUtils.js — Browser audio helpers for the Groq Whisper voice pipeline.
 */

/**
 * Returns the best audio MIME type supported by this browser.
 * Priority: webm/opus (Chrome/Edge) → webm → ogg/opus (Firefox) → mp4 (Safari)
 * All of these are accepted by Groq Whisper API.
 */
export function getSupportedMimeType() {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/ogg',
    'audio/mp4',
  ];
  return types.find((t) => MediaRecorder.isTypeSupported(t)) || '';
}

/**
 * Returns the file extension from a MIME type string.
 * e.g. 'audio/webm;codecs=opus' → 'webm'
 */
export function extensionFromMimeType(mimeType) {
  if (!mimeType) return 'webm';
  if (mimeType.includes('ogg')) return 'ogg';
  if (mimeType.includes('mp4')) return 'mp4';
  if (mimeType.includes('wav')) return 'wav';
  return 'webm'; // default
}

/**
 * Creates and configures an AudioContext analyser node on top of a MediaStream.
 * Used for silence detection and volume visualisation.
 * Returns { audioContext, analyser, cleanup }.
 */
export function createAnalyser(stream) {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  analyser.fftSize = 512;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
  const cleanup = () => {
    try { source.disconnect(); } catch (_) {}
    try { audioContext.close(); } catch (_) {}
  };
  return { audioContext, analyser, cleanup };
}

/**
 * Reads the current average volume level (0–100) from an AnalyserNode.
 */
export function getAverageVolume(analyser) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const sum = data.reduce((a, b) => a + b, 0);
  // Map 0-255 range → 0-100
  return Math.round((sum / data.length / 255) * 100);
}

/**
 * Beeps on order confirmation (optional, restaurant feedback).
 */
export function playConfirmBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.3);
  } catch (_) {}
}
