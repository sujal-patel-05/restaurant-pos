/**
 * LiveTranscription.jsx — Animated word-by-word transcript display.
 * New words from the latest Whisper chunk animate in with a fade+slide.
 * Low-confidence words are shown at reduced opacity.
 * Shows animated dots while recording but no transcript yet.
 */
import React, { useEffect, useRef, useState } from 'react';
import { GROQ_CONFIG } from '../../config/groqConfig';

export default function LiveTranscription({
  phase           = 'idle',
  liveTranscript  = '',
  displayWords    = [],
  pendingDots     = '',
  isTranscribing  = false,
  confidence      = null,
}) {
  const endRef = useRef(null);
  const [prevWordCount, setPrevWordCount] = useState(0);

  // Auto-scroll as transcript grows
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscript, pendingDots]);

  // Track previous word count for animation
  useEffect(() => {
    setPrevWordCount(displayWords.length);
  }, [displayWords.length]);

  // ── Render states ──────────────────────────────────────────────────────

  if (phase === 'idle') {
    return (
      <div style={styles.box}>
        <div style={styles.placeholder}>
          <MicPlaceholderIcon />
          <p style={styles.placeholderText}>Tap the mic and speak your order…</p>
          <p style={styles.hint}>e.g. "Two masala dosas, one lassi and a chai"</p>
        </div>
      </div>
    );
  }

  if (phase === 'requesting-permission') {
    return (
      <div style={styles.box}>
        <div style={styles.placeholder}>
          <p style={styles.placeholderText}>Requesting microphone access…</p>
        </div>
      </div>
    );
  }

  if (phase === 'error') {
    return null; // Error is shown by parent
  }

  const hasText = liveTranscript.trim().length > 0;

  return (
    <div style={styles.box}>
      {/* Processing spinner badge */}
      {isTranscribing && (
        <div style={styles.spinnerBadge}>
          <SpinnerIcon />
          <span>Processing…</span>
        </div>
      )}

      {/* Words or dots */}
      <div style={styles.scrollArea}>
        {hasText && displayWords.length > 0 ? (
          <div style={styles.wordsContainer}>
            {displayWords.map((w, idx) => (
              <span
                key={idx}
                style={{
                  ...styles.word,
                  opacity: (w.probability ?? 1) >= GROQ_CONFIG.LOW_CONFIDENCE_THRESHOLD ? 1 : 0.55,
                  animation: idx >= prevWordCount ? 'wordAppear 0.18s ease-out forwards' : 'none',
                }}
              >
                {w.word}{' '}
              </span>
            ))}
          </div>
        ) : hasText ? (
          <p style={styles.plainText}>{liveTranscript}</p>
        ) : phase === 'recording' ? (
          <div style={styles.dots}>
            <span style={styles.dotChar}>●</span>
            <span style={{ ...styles.dotChar, animationDelay: '0.2s' }}>●</span>
            <span style={{ ...styles.dotChar, animationDelay: '0.4s' }}>●</span>
          </div>
        ) : phase === 'transcribing' ? (
          <p style={{ ...styles.placeholderText, margin: 0 }}>Finalizing transcript…</p>
        ) : phase === 'parsing' ? (
          <p style={{ ...styles.placeholderText, margin: 0 }}>Analyzing your order…</p>
        ) : null}

        <div ref={endRef} />
      </div>

      <style>{`
        @keyframes wordAppear {
          from { opacity: 0; transform: translateY(5px); }
          to   { opacity: 1; transform: translateY(0);   }
        }
        @keyframes dotPulse {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40%            { transform: scale(1.0); opacity: 1;   }
        }
      `}</style>
    </div>
  );
}

function MicPlaceholderIcon() {
  return (
    <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="23" strokeLinecap="round"/>
      <line x1="8" y1="23" x2="16" y2="23" strokeLinecap="round"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <style>{`@keyframes spin { from{transform:rotate(0deg)} to{transform:rotate(360deg)} }`}</style>
    </svg>
  );
}

const styles = {
  box: {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 16,
    padding: 20,
    minHeight: 120,
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
    position: 'relative',
  },
  scrollArea: {
    maxHeight: 160,
    overflowY: 'auto',
    flex: 1,
  },
  placeholder: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: '12px 0',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.35)',
    fontSize: 15,
    textAlign: 'center',
    margin: 0,
  },
  hint: {
    color: 'rgba(255,255,255,0.2)',
    fontSize: 12,
    textAlign: 'center',
    margin: 0,
    fontStyle: 'italic',
  },
  wordsContainer: {
    lineHeight: 1.7,
  },
  word: {
    display: 'inline',
    color: '#fff',
    fontSize: 17,
    fontWeight: 500,
  },
  plainText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: 500,
    lineHeight: 1.6,
    margin: 0,
  },
  spinnerBadge: {
    position: 'absolute',
    top: 12,
    right: 12,
    display: 'flex',
    alignItems: 'center',
    gap: 5,
    background: 'rgba(99,102,241,0.25)',
    border: '1px solid rgba(99,102,241,0.3)',
    borderRadius: 20,
    padding: '3px 8px',
    fontSize: 11,
    color: '#A5B4FC',
    fontWeight: 500,
  },
  dots: {
    display: 'flex',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px 0',
  },
  dotChar: {
    color: 'rgba(99,102,241,0.8)',
    fontSize: 10,
    animation: 'dotPulse 1.2s ease-in-out infinite',
  },
};
