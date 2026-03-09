/**
 * QuickAddChips.jsx — Horizontal scrollable chips for manual item selection.
 * Lets customers tap items directly without speaking.
 * Shows a flat list of available menu items as tappable pills.
 */
import React, { useRef } from 'react';

export default function QuickAddChips({ menuItems = [], onAdd }) {
  const scrollRef = useRef(null);

  if (menuItems.length === 0) return null;

  return (
    <div style={styles.wrapper}>
      <span style={styles.label}>Quick add:</span>
      <div
        ref={scrollRef}
        style={styles.scrollRow}
        // Allow horizontal swipe on touch devices
        onTouchStart={(e) => e.stopPropagation()}
      >
        {menuItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onAdd?.(item)}
            style={styles.chip}
            title={`₹${item.price}`}
          >
            {item.name}
            <span style={styles.price}>₹{item.price}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    alignItems: 'center',
    gap: 10,
    overflow: 'hidden',
  },
  label: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    fontWeight: 600,
    whiteSpace: 'nowrap',
    letterSpacing: 0.3,
    textTransform: 'uppercase',
  },
  scrollRow: {
    display: 'flex',
    gap: 8,
    overflowX: 'auto',
    paddingBottom: 4,
    flex: 1,
    scrollbarWidth: 'none',         // Firefox
    msOverflowStyle: 'none',        // IE
    WebkitOverflowScrolling: 'touch',
  },
  chip: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    padding: '7px 12px',
    borderRadius: 20,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    fontWeight: 500,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
    transition: 'background 0.15s, border-color 0.15s',
    flexShrink: 0,
  },
  price: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    fontWeight: 600,
  },
};
