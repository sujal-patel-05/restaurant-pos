/**
 * MicButton.jsx — 5-state mic button with pulse/ripple animation.
 * States: idle | requesting-permission | recording | processing | error
 */
import React from 'react';

const SIZE = 88; // px — minimum 80×80 for tablet touch targets

const PHASE_STYLES = {
  idle: {
    bg: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    border: 'rgba(99,102,241,0.4)',
    pulse: false,
    icon: <MicIcon />,
    label: 'Tap to speak',
  },
  'requesting-permission': {
    bg: 'linear-gradient(135deg, #F59E0B 0%, #F97316 100%)',
    border: 'rgba(245,158,11,0.4)',
    pulse: false,
    icon: <SpinnerIcon />,
    label: 'Requesting mic…',
  },
  recording: {
    bg: 'linear-gradient(135deg, #F43F5E 0%, #E11D48 100%)',
    border: 'rgba(244,63,94,0.5)',
    pulse: true,
    icon: <StopIcon />,
    label: 'Tap to finish',
  },
  transcribing: {
    bg: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    border: 'rgba(99,102,241,0.4)',
    pulse: false,
    icon: <SpinnerIcon />,
    label: 'Transcribing…',
  },
  parsing: {
    bg: 'linear-gradient(135deg, #6366F1 0%, #4F46E5 100%)',
    border: 'rgba(99,102,241,0.4)',
    pulse: false,
    icon: <SpinnerIcon />,
    label: 'Analyzing order…',
  },
  done: {
    bg: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: 'rgba(16,185,129,0.4)',
    pulse: false,
    icon: <MicIcon />,
    label: 'Tap to add more',
  },
  error: {
    bg: 'linear-gradient(135deg, #EF4444 0%, #DC2626 100%)',
    border: 'rgba(239,68,68,0.4)',
    pulse: false,
    icon: <MicIcon />,
    label: 'Tap to retry',
  },
};

export default function MicButton({ phase = 'idle', onClick, disabled = false }) {
  const s = PHASE_STYLES[phase] || PHASE_STYLES.idle;
  const canClick = !disabled && !['requesting-permission', 'transcribing', 'parsing'].includes(phase);

  return (
    <div style={styles.wrapper}>
      {/* Pulse rings (recording state) */}
      {s.pulse && (
        <>
          <div style={{ ...styles.ring, animation: 'micRing 1.6s ease-out infinite' }} />
          <div style={{ ...styles.ring, animation: 'micRing 1.6s ease-out 0.5s infinite' }} />
        </>
      )}

      <button
        onClick={canClick ? onClick : undefined}
        disabled={!canClick}
        aria-label={s.label}
        style={{
          ...styles.button,
          background: s.bg,
          boxShadow: `0 0 0 3px ${s.border}, 0 8px 24px rgba(0,0,0,0.4)`,
          cursor: canClick ? 'pointer' : 'default',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        {s.icon}
      </button>

      <span style={styles.label}>{s.label}</span>

      <style>{`
        @keyframes micRing {
          0%   { transform: scale(1);   opacity: 0.7; }
          100% { transform: scale(2.2); opacity: 0;   }
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

// ── Icon components ──────────────────────────────────────────────────────────

function MicIcon() {
  return (
    <svg width="32" height="32" viewBox="0 0 24 24" fill="white">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/>
      <line x1="12" y1="19" x2="12" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
      <line x1="8" y1="23" x2="16" y2="23" stroke="white" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  );
}

function StopIcon() {
  return (
    <svg width="28" height="28" viewBox="0 0 24 24" fill="white">
      <rect x="6" y="6" width="12" height="12" rx="2" />
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg
      width="28" height="28" viewBox="0 0 24 24" fill="none"
      style={{ animation: 'spin 0.8s linear infinite' }}
    >
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3" />
      <path d="M12 2 a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
    </svg>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = {
  wrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 12,
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: SIZE,
    height: SIZE,
    marginTop: -SIZE / 2,
    marginLeft: -SIZE / 2,
    borderRadius: '50%',
    background: 'rgba(244,63,94,0.3)',
    pointerEvents: 'none',
  },
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: '50%',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'transform 0.15s, box-shadow 0.15s',
    position: 'relative',
    zIndex: 1,
    WebkitTapHighlightColor: 'transparent',
  },
  label: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 13,
    fontWeight: 500,
    letterSpacing: 0.2,
    textAlign: 'center',
  },
};
