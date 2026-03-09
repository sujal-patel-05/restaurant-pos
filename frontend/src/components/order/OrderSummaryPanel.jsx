/**
 * OrderSummaryPanel.jsx
 * Shows the current pending order items with quantity +/− controls.
 * Displays subtotal + estimated GST + total.
 * "Place Order" button triggers the submit flow.
 */
import React from 'react';

export default function OrderSummaryPanel({
  items = [],
  gstPct = 5,
  isSubmitting = false,
  onQtyChange,        // (itemIndex, newQty) — newQty=0 means remove
  onSubmit,
  onClear,
}) {
  const subtotal = items.reduce((s, it) => s + it.price * it.qty, 0);
  const gst      = Math.round(subtotal * gstPct / 100 * 100) / 100;
  const total    = Math.round((subtotal + gst) * 100) / 100;

  if (items.length === 0) {
    return (
      <div style={styles.empty}>
        <CartIcon />
        <p style={styles.emptyText}>Your order will appear here</p>
        <p style={styles.emptyHint}>Speak or tap items below</p>
      </div>
    );
  }

  return (
    <div style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Your Order</span>
        <button onClick={onClear} style={styles.clearBtn} title="Clear order">
          ✕ Clear
        </button>
      </div>

      <div style={styles.itemsList}>
        {items.map((item, idx) => (
          <div key={idx} style={styles.itemRow}>
            <div style={styles.itemName}>{item.name}</div>
            <div style={styles.qtyControls}>
              <button
                style={styles.qtyBtn}
                onClick={() => onQtyChange?.(idx, item.qty - 1)}
              >−</button>
              <span style={styles.qtyNum}>{item.qty}</span>
              <button
                style={styles.qtyBtn}
                onClick={() => onQtyChange?.(idx, item.qty + 1)}
              >+</button>
            </div>
            <div style={styles.itemPrice}>
              ₹{(item.price * item.qty).toFixed(2)}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.divider} />

      <div style={styles.totalsBlock}>
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>Subtotal</span>
          <span style={styles.totalValue}>₹{subtotal.toFixed(2)}</span>
        </div>
        <div style={styles.totalRow}>
          <span style={styles.totalLabel}>GST ({gstPct}%)</span>
          <span style={styles.totalValue}>₹{gst.toFixed(2)}</span>
        </div>
        <div style={{ ...styles.totalRow, marginTop: 4 }}>
          <span style={styles.grandLabel}>Total</span>
          <span style={styles.grandValue}>₹{total.toFixed(2)}</span>
        </div>
      </div>

      <button
        onClick={onSubmit}
        disabled={isSubmitting || items.length === 0}
        style={{
          ...styles.submitBtn,
          opacity: isSubmitting ? 0.7 : 1,
        }}
      >
        {isSubmitting ? (
          <>
            <SpinnerIcon />
            Placing Order…
          </>
        ) : (
          <>
            <CheckIcon />
            Place Order · ₹{total.toFixed(2)}
          </>
        )}
      </button>
    </div>
  );
}

// ── Icons ──────────────────────────────────────────────────────────────────────

function CartIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.2)" strokeWidth="1.5">
      <path d="M6 2 L3 6 v14 a2 2 0 0 0 2 2 h14 a2 2 0 0 0 2-2 V6 l-3-4z" strokeLinecap="round" strokeLinejoin="round"/>
      <line x1="3" y1="6" x2="21" y2="6"/>
      <path d="M16 10 a4 4 0 0 1-8 0"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

function SpinnerIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ animation: 'spin 0.8s linear infinite' }}>
      <circle cx="12" cy="12" r="10" stroke="rgba(255,255,255,0.3)" strokeWidth="3"/>
      <path d="M12 2a10 10 0 0 1 10 10" stroke="white" strokeWidth="3" strokeLinecap="round"/>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </svg>
  );
}

// ── Styles ──────────────────────────────────────────────────────────────────────

const styles = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    gap: 0,
    height: '100%',
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  headerTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    letterSpacing: 0.2,
  },
  clearBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 6,
    transition: 'color 0.2s',
  },
  itemsList: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    maxHeight: 220,
  },
  itemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '7px 0',
    borderBottom: '1px solid rgba(255,255,255,0.06)',
  },
  itemName: {
    flex: 1,
    color: 'rgba(255,255,255,0.9)',
    fontSize: 14,
    fontWeight: 500,
    lineHeight: 1.3,
  },
  qtyControls: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    background: 'rgba(255,255,255,0.08)',
    borderRadius: 8,
    padding: '2px 4px',
  },
  qtyBtn: {
    background: 'none',
    border: 'none',
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    lineHeight: 1,
    cursor: 'pointer',
    padding: '2px 6px',
    borderRadius: 6,
    transition: 'background 0.15s',
    fontWeight: 700,
  },
  qtyNum: {
    color: '#fff',
    fontSize: 14,
    fontWeight: 700,
    minWidth: 20,
    textAlign: 'center',
  },
  itemPrice: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: 500,
    minWidth: 58,
    textAlign: 'right',
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.1)',
    margin: '12px 0 10px',
  },
  totalsBlock: {
    display: 'flex',
    flexDirection: 'column',
    gap: 5,
    marginBottom: 14,
  },
  totalRow: {
    display: 'flex',
    justifyContent: 'space-between',
  },
  totalLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
  },
  totalValue: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 13,
    fontWeight: 500,
  },
  grandLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 700,
  },
  grandValue: {
    color: '#6EE7B7',
    fontSize: 16,
    fontWeight: 800,
  },
  submitBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    padding: '14px 20px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'opacity 0.2s, transform 0.15s',
    boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
    letterSpacing: 0.2,
  },
  empty: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    padding: 24,
    textAlign: 'center',
  },
  emptyText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    margin: 0,
    fontWeight: 500,
  },
  emptyHint: {
    color: 'rgba(255,255,255,0.18)',
    fontSize: 12,
    margin: 0,
  },
};
