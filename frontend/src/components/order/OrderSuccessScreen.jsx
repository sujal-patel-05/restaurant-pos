/**
 * OrderSuccessScreen.jsx — Shown after order is placed.
 * Displays order number + estimated wait + 10-second countdown before auto-reset.
 */
import React, { useEffect, useState } from 'react';

export default function OrderSuccessScreen({ order, onOrderMore, onViewOrders }) {
  const [countdown, setCountdown] = useState(12);

  useEffect(() => {
    if (countdown <= 0) {
      onOrderMore?.();
      return;
    }
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown, onOrderMore]);

  return (
    <div style={styles.screen}>
      <div style={styles.card}>
        {/* Success icon */}
        <div style={styles.iconRing}>
          <CheckIcon />
        </div>

        <h2 style={styles.title}>Order Sent to Kitchen! 🎉</h2>

        {order && (
          <>
            <div style={styles.orderNum}>#{order.order_number}</div>

            <div style={styles.infoRow}>
              <div style={styles.infoBlock}>
                <div style={styles.infoLabel}>Total</div>
                <div style={styles.infoValue}>₹{order.total?.toFixed(2)}</div>
              </div>
              <div style={styles.separator} />
              <div style={styles.infoBlock}>
                <div style={styles.infoLabel}>Est. Wait</div>
                <div style={styles.infoValue}>{order.estimated_wait_minutes ?? '~15'} min</div>
              </div>
              <div style={styles.separator} />
              <div style={styles.infoBlock}>
                <div style={styles.infoLabel}>Items</div>
                <div style={styles.infoValue}>{order.items_count ?? '—'}</div>
              </div>
            </div>

            <p style={styles.note}>
              Our kitchen is preparing your order. You'll be notified when it's ready.
            </p>
          </>
        )}

        <div style={styles.buttons}>
          <button onClick={onOrderMore} style={styles.primaryBtn}>
            + Add More Items
          </button>
          <button onClick={onViewOrders} style={styles.secondaryBtn}>
            View My Orders
          </button>
        </div>

        <p style={styles.countdown}>
          Returning to menu in {countdown}s…
        </p>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

const styles = {
  screen: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  card: {
    background: 'rgba(255,255,255,0.05)',
    border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 24,
    padding: '36px 28px',
    maxWidth: 400,
    width: '100%',
    textAlign: 'center',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
  },
  iconRing: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 0 12px rgba(16,185,129,0.15), 0 8px 24px rgba(16,185,129,0.4)',
  },
  title: {
    color: '#fff',
    fontSize: 22,
    fontWeight: 800,
    margin: 0,
    lineHeight: 1.2,
  },
  orderNum: {
    color: '#6EE7B7',
    fontSize: 18,
    fontWeight: 700,
    letterSpacing: 1,
  },
  infoRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    padding: '12px 0',
    width: '100%',
    justifyContent: 'center',
  },
  infoBlock: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 4,
  },
  infoLabel: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  infoValue: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 800,
  },
  separator: {
    width: 1,
    height: 36,
    background: 'rgba(255,255,255,0.12)',
  },
  note: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    lineHeight: 1.5,
    margin: '4px 0',
    maxWidth: 320,
  },
  buttons: {
    display: 'flex',
    flexDirection: 'column',
    gap: 10,
    width: '100%',
    marginTop: 4,
  },
  primaryBtn: {
    padding: '13px 24px',
    borderRadius: 12,
    background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 100%)',
    border: 'none',
    color: '#fff',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
  },
  secondaryBtn: {
    padding: '12px 24px',
    borderRadius: 12,
    background: 'rgba(255,255,255,0.07)',
    border: '1px solid rgba(255,255,255,0.15)',
    color: 'rgba(255,255,255,0.75)',
    fontSize: 14,
    fontWeight: 600,
    cursor: 'pointer',
  },
  countdown: {
    color: 'rgba(255,255,255,0.25)',
    fontSize: 12,
    margin: 0,
  },
};
