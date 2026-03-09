/**
 * WaveformVisualizer.jsx — Animated volume-reactive bars.
 * Shows real-time audio level while recording.
 */
import React, { useEffect, useRef } from 'react';

const BAR_COUNT = 20;

export default function WaveformVisualizer({ volumeLevel = 0, isActive = false, color = '#6366F1' }) {
  const barsRef = useRef([]);

  useEffect(() => {
    if (!isActive) {
      barsRef.current.forEach((bar) => {
        if (bar) bar.style.height = '4px';
      });
      return;
    }

    barsRef.current.forEach((bar, i) => {
      if (!bar) return;
      // Create natural waveform shape: center bars taller
      const center = BAR_COUNT / 2;
      const distFromCenter = Math.abs(i - center) / center; // 0 at center, 1 at edges
      const shapeFactor = 1 - distFromCenter * 0.5;         // 1.0 at center, 0.5 at edges

      // Add per-bar randomness for organic feel
      const jitter = 0.7 + Math.random() * 0.6;
      const height = Math.max(4, Math.round((volumeLevel / 100) * 48 * shapeFactor * jitter));
      bar.style.height = `${height}px`;
    });
  }, [volumeLevel, isActive]);

  return (
    <div style={styles.container}>
      {Array.from({ length: BAR_COUNT }, (_, i) => (
        <div
          key={i}
          ref={(el) => (barsRef.current[i] = el)}
          style={{
            ...styles.bar,
            background: isActive ? color : 'rgba(255,255,255,0.15)',
            transition: isActive ? 'height 0.1s ease-out' : 'height 0.3s ease',
          }}
        />
      ))}
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    alignItems: 'center',
    gap: 3,
    height: 52,
    padding: '0 4px',
  },
  bar: {
    width: 4,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    flexShrink: 0,
  },
};
