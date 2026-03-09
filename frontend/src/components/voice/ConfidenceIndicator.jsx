/**
 * ConfidenceIndicator.jsx — Shows Whisper's average word confidence.
 * Appears as a small pill below the transcript.
 */
import React from 'react';
import { GROQ_CONFIG } from '../../config/groqConfig';

export default function ConfidenceIndicator({ confidence = null, parseMethod = null }) {
  if (confidence === null && !parseMethod) return null;

  const pct = confidence !== null ? Math.round(confidence * 100) : null;
  const isHigh = pct === null || pct >= 85;
  const isMed = pct !== null && pct >= 65 && pct < 85;
  const isLow = pct !== null && pct < 65;

  const color = isHigh ? '#10B981' : isMed ? '#F59E0B' : '#EF4444';
  const label = isHigh ? 'High accuracy' : isMed ? 'Check items' : 'Low accuracy';

  return (
    <div style={styles.row}>
      {pct !== null && (
        <span style={{ ...styles.pill, background: `${color}22`, color, borderColor: `${color}44` }}>
          <span style={{ ...styles.dot, background: color }} />
          {pct}% — {label}
        </span>
      )}
      {parseMethod === 'local' && (
        <span style={styles.localBadge}>
          ⚡ Offline parser
        </span>
      )}
      {parseMethod === 'groq' && (
        <span style={styles.groqBadge}>
          ✦ Sarvam AI parsed
        </span>
      )}
    </div>
  );
}

const styles = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  pill: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '3px 10px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    border: '1px solid transparent',
    letterSpacing: 0.3,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: '50%',
  },
  localBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: 'rgba(245,158,11,0.15)',
    color: '#F59E0B',
    border: '1px solid rgba(245,158,11,0.3)',
  },
  groqBadge: {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 8px',
    borderRadius: 20,
    fontSize: 11,
    fontWeight: 600,
    background: 'rgba(99,102,241,0.15)',
    color: '#818CF8',
    border: '1px solid rgba(99,102,241,0.3)',
  },
};
