/**
 * TableVoiceOrder.jsx — Customer-facing voice ordering kiosk.
 *
 * Route: /table/:tableId
 *
 * Full pipeline:
 *   Browser mic → MediaRecorder chunks → Groq Whisper (backend proxy)
 *   → live transcript → Groq LLM parse (backend proxy)
 *   → structured order items → customer confirms → KOT created in kitchen
 */
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';

import { useVoiceOrder } from '../hooks/useVoiceOrder';
import MicButton from '../components/voice/MicButton';
import LiveTranscription from '../components/voice/LiveTranscription';
import WaveformVisualizer from '../components/voice/WaveformVisualizer';
import ConfidenceIndicator from '../components/voice/ConfidenceIndicator';
import OrderSummaryPanel from '../components/order/OrderSummaryPanel';
import QuickAddChips from '../components/order/QuickAddChips';
import OrderSuccessScreen from '../components/order/OrderSuccessScreen';

// ── API helper ────────────────────────────────────────────────────────────────
const API_BASE = (() => {
  if (typeof window !== 'undefined' && window.location.hostname)
    return `http://${window.location.hostname}:8000`;
  return 'http://127.0.0.1:8000';
})();

function customerApi(path, opts = {}) {
  const token = sessionStorage.getItem('customer_token');
  const headers = { ...(opts.headers || {}) };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
  return fetch(`${API_BASE}${path}`, { ...opts, headers });
}

// ══════════════════════════════════════════════════════════════════════════════

export default function TableVoiceOrder() {
  const { tableId } = useParams();

  const [screen, setScreen] = useState('loading');
  const [session, setSession] = useState(null);
  const [sessionError, setSessionError] = useState('');
  const [menuItems, setMenuItems] = useState([]);
  const [gstPct, setGstPct] = useState(5);
  const [currentOrder, setCurrentOrder] = useState([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [completedOrder, setCompletedOrder] = useState(null);
  const [sessionOrders, setSessionOrders] = useState([]);

  // ── Session init ───────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      try {
        const fd = new FormData();
        fd.append('table_id', tableId || 'T1');
        const res = await fetch(`${API_BASE}/api/customer/session/start`, {
          method: 'POST', body: fd,
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.detail || 'Could not start session');
        sessionStorage.setItem('customer_token', data.token);
        setSession(data);
        await fetchMenu(data.token);
        setScreen('home');
      } catch (e) {
        setSessionError(e.message);
        setScreen('error');
      }
    })();
  }, [tableId]);

  const fetchMenu = async (token) => {
    try {
      const res = await fetch(`${API_BASE}/api/customer/menu`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const flat = [];
      for (const cat of data.menu || []) {
        for (const item of cat.items || []) flat.push({ ...item, category: cat.category });
      }
      setMenuItems(flat);
    } catch (_) { }
  };

  // ── Smart order management (add/modify/delete) ─────────────────────────────
  const [actionFeedback, setActionFeedback] = useState([]);

  const applyActions = useCallback((actions, _transcript, unavailable) => {
    if (!actions?.length && !unavailable?.length) return;

    const feedback = [];

    setCurrentOrder((prev) => {
      const result = prev.map((r) => ({ ...r }));

      for (const action of (actions || [])) {
        const { op, name, qty, menu_item_id, price } = action;
        const existingIdx = result.findIndex((r) => r.menu_item_id === menu_item_id || r.name === name);

        switch (op) {
          case 'add': {
            if (existingIdx >= 0) {
              result[existingIdx].qty += (qty || 1);
              feedback.push({ type: 'add', text: `Added ${qty || 1} more ${name}` });
            } else {
              result.push({ name, qty: qty || 1, menu_item_id, price });
              feedback.push({ type: 'add', text: `Added ${qty || 1}× ${name}` });
            }
            break;
          }
          case 'modify': {
            if (existingIdx >= 0) {
              const oldQty = result[existingIdx].qty;
              result[existingIdx].qty = qty || 1;
              feedback.push({ type: 'modify', text: `Changed ${name}: ${oldQty} → ${qty}` });
            } else {
              // If not in order, treat as add
              result.push({ name, qty: qty || 1, menu_item_id, price });
              feedback.push({ type: 'add', text: `Added ${qty || 1}× ${name}` });
            }
            break;
          }
          case 'delete': {
            if (existingIdx >= 0) {
              feedback.push({ type: 'delete', text: `Removed ${result[existingIdx].name}` });
              result.splice(existingIdx, 1);
            } else {
              feedback.push({ type: 'warn', text: `${name} not in your order` });
            }
            break;
          }
          default:
            break;
        }
      }

      return result;
    });

    // Add unavailable items to feedback
    if (unavailable?.length) {
      for (const item of unavailable) {
        feedback.push({ type: 'unavailable', text: `"${item}" is not available` });
      }
    }

    setActionFeedback(feedback);
    // Auto-dismiss feedback after 4 seconds
    setTimeout(() => setActionFeedback([]), 4000);
  }, []);

  const handleQuickAdd = useCallback((item) => {
    setCurrentOrder((prev) => {
      const result = prev.map((r) => ({ ...r }));
      const existing = result.find((r) => r.menu_item_id === item.id);
      if (existing) existing.qty += 1;
      else result.push({ name: item.name, qty: 1, menu_item_id: item.id, price: item.price });
      return result;
    });
  }, []);

  const handleQtyChange = useCallback((idx, newQty) => {
    setCurrentOrder((prev) => {
      const result = prev.map((r) => ({ ...r }));
      if (newQty <= 0) result.splice(idx, 1);
      else result[idx].qty = newQty;
      return result;
    });
  }, []);

  // ── Submit order ───────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    if (!currentOrder.length || isSubmitting) return;
    setIsSubmitting(true);
    setSubmitError('');
    try {
      const fd = new FormData();
      fd.append('items_json', JSON.stringify(currentOrder));
      const res = await customerApi('/api/customer/submit-order', { method: 'POST', body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'Order failed');
      setCompletedOrder(data);
      setCurrentOrder([]);
      voice.reset();
      setScreen('success');
    } catch (e) {
      setSubmitError(e.message);
    } finally {
      setIsSubmitting(false);
    }
  }, [currentOrder, isSubmitting]);

  // ── Orders history ─────────────────────────────────────────────────────────
  const handleViewOrders = useCallback(async () => {
    try {
      const res = await customerApi('/api/customer/orders');
      const data = await res.json();
      setSessionOrders(data.orders || []);
    } catch (_) { }
    setScreen('orders');
  }, []);

  // ── Voice hook — pass currentOrder for context ────────────────────────────
  const voice = useVoiceOrder({
    menuItems,
    customerToken: sessionStorage.getItem('customer_token'),
    currentOrder,
    onOrderParsed: applyActions,
  });

  // ── Screen routing ─────────────────────────────────────────────────────────
  if (screen === 'loading') return <LoadingScreen />;
  if (screen === 'error') return <ErrorScreen message={sessionError} />;

  if (screen === 'success') {
    return (
      <PageShell session={session} onViewOrders={handleViewOrders}>
        <OrderSuccessScreen
          order={completedOrder}
          onOrderMore={() => setScreen('home')}
          onViewOrders={handleViewOrders}
        />
      </PageShell>
    );
  }

  if (screen === 'orders') {
    return (
      <PageShell session={session} onViewOrders={handleViewOrders}>
        <OrdersHistoryScreen orders={sessionOrders} onBack={() => setScreen('home')} />
      </PageShell>
    );
  }

  // ── Home screen ─────────────────────────────────────────────────────────────
  return (
    <PageShell session={session} onViewOrders={handleViewOrders}>
      <div style={homeS.layout}>

        {/* LEFT: voice panel */}
        <div style={homeS.voicePanel}>
          {voice.errorType && (
            <VoiceErrorBanner errorType={voice.errorType} onDismiss={voice.reset} />
          )}

          <LiveTranscription
            phase={voice.phase}
            liveTranscript={voice.liveTranscript}
            displayWords={voice.displayWords}
            pendingDots={voice.pendingDots}
            isTranscribing={voice.isTranscribing}
            confidence={voice.confidence}
          />

          <WaveformVisualizer
            volumeLevel={voice.volumeLevel}
            isActive={voice.phase === 'recording'}
            color="#6366F1"
          />

          {(voice.confidence !== null || voice.parseMethod) && (
            <ConfidenceIndicator
              confidence={voice.confidence}
              parseMethod={voice.parseMethod}
            />
          )}

          <div style={homeS.micArea}>
            <MicButton
              phase={voice.phase}
              onClick={voice.toggle}
              disabled={voice.errorType === 'browser-unsupported'}
            />
          </div>

          {submitError && (
            <div style={homeS.errorBanner}>⚠ {submitError}</div>
          )}
          {voice.transcribeError && (
            <div style={homeS.warnBanner}>
              🔌 STT: {voice.transcribeError}
            </div>
          )}

          {/* Action feedback toasts */}
          {actionFeedback.length > 0 && (
            <div style={homeS.feedbackContainer}>
              {actionFeedback.map((fb, i) => (
                <div key={i} style={{
                  ...homeS.feedbackToast,
                  ...(fb.type === 'add' ? homeS.feedbackAdd :
                    fb.type === 'modify' ? homeS.feedbackModify :
                      fb.type === 'delete' ? homeS.feedbackDelete :
                        fb.type === 'unavailable' ? homeS.feedbackUnavailable :
                          homeS.feedbackWarn),
                }}>
                  <span style={{ fontSize: 14 }}>
                    {fb.type === 'add' ? '✅' :
                      fb.type === 'modify' ? '🔄' :
                        fb.type === 'delete' ? '🗑️' :
                          fb.type === 'unavailable' ? '❌' : '⚠️'}
                  </span>
                  <span>{fb.text}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* RIGHT: order panel */}
        <div style={homeS.orderPanel}>
          <OrderSummaryPanel
            items={currentOrder}
            gstPct={gstPct}
            isSubmitting={isSubmitting}
            onQtyChange={handleQtyChange}
            onSubmit={handleSubmit}
            onClear={() => { setCurrentOrder([]); voice.reset(); setActionFeedback([]); }}
          />
        </div>
      </div>

      {/* Quick Add chips */}
      <div style={homeS.chipsArea}>
        <QuickAddChips menuItems={menuItems} onAdd={handleQuickAdd} />
      </div>

      {/* Global keyframes */}
      <style>{`
        @keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeInUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
    </PageShell>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Sub-components
// ══════════════════════════════════════════════════════════════════════════════

function PageShell({ session, onViewOrders, children }) {
  return (
    <div style={S.page}>
      <header style={S.header}>
        <div style={S.brand}>
          <div style={S.logo}>S</div>
          <span style={S.brandName}>SujalPOS</span>
        </div>
        <div style={S.headerMid}>
          {session && (
            <div style={S.tableBadge}>
              Table {session.table_number || session.table_id}
            </div>
          )}
        </div>
        <button onClick={onViewOrders} style={S.ordersBtn}>My Orders</button>
      </header>
      <main style={S.main}>{children}</main>
    </div>
  );
}

function LoadingScreen() {
  return (
    <div style={S.fullCenter}>
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
      <div style={S.spinner} />
      <p style={{ color: 'rgba(255,255,255,0.45)', marginTop: 14 }}>Setting up your table…</p>
    </div>
  );
}

function ErrorScreen({ message }) {
  return (
    <div style={S.fullCenter}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>⚠</div>
      <h2 style={{ color: '#fff', margin: '0 0 8px' }}>Something went wrong</h2>
      <p style={{ color: 'rgba(255,255,255,0.5)', maxWidth: 340, textAlign: 'center', margin: 0 }}>
        {message || 'Could not connect. Please ask staff for assistance.'}
      </p>
    </div>
  );
}

function VoiceErrorBanner({ errorType, onDismiss }) {
  const msgs = {
    'permission-denied': { icon: '🎙', title: 'Microphone access denied', body: 'Tap the lock icon → allow microphone → reload.' },
    'browser-unsupported': { icon: '🌐', title: 'Voice not supported', body: 'Use Chrome/Edge for voice. Quick Add chips below still work.' },
    'no-microphone': { icon: '🔇', title: 'No microphone found', body: 'Connect a microphone or use Quick Add chips.' },
    'mic-error': { icon: '⚠', title: 'Microphone error', body: 'Please try again.' },
  };
  const m = msgs[errorType] || { icon: '⚠', title: 'Voice error', body: 'Please try again.' };
  return (
    <div style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ fontSize: 20 }}>{m.icon}</span>
        <div style={{ flex: 1 }}>
          <div style={{ color: '#FCA5A5', fontSize: 13, fontWeight: 700, marginBottom: 3 }}>{m.title}</div>
          <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12, lineHeight: 1.4 }}>{m.body}</div>
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>
    </div>
  );
}

function OrdersHistoryScreen({ orders, onBack }) {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 14, maxWidth: 600, margin: '0 auto', width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <button onClick={onBack} style={{ ...S.ordersBtn, fontSize: 13 }}>← Back</button>
        <h2 style={{ color: '#fff', fontSize: 18, fontWeight: 700, margin: 0 }}>My Orders</h2>
        <div style={{ width: 70 }} />
      </div>
      {orders.length === 0 ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, padding: 40 }}>
          <p style={{ color: 'rgba(255,255,255,0.4)' }}>No orders placed yet.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' }}>
          {orders.map((order) => (
            <div key={order.order_id} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '14px 16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ color: '#A5B4FC', fontSize: 13, fontWeight: 700, flex: 1 }}>#{order.order_number}</span>
                <span style={{ padding: '2px 8px', borderRadius: 10, fontSize: 11, fontWeight: 700, background: 'rgba(99,102,241,0.2)', color: '#A5B4FC', textTransform: 'capitalize' }}>{order.status}</span>
                <span style={{ color: '#6EE7B7', fontSize: 14, fontWeight: 700 }}>₹{order.total?.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {order.items?.map((item, i) => (
                  <span key={i} style={{ padding: '3px 8px', borderRadius: 8, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.6)', fontSize: 12 }}>
                    {item.quantity}× {item.name}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  Styles
// ══════════════════════════════════════════════════════════════════════════════

const S = {
  page: {
    minHeight: '100dvh',
    display: 'flex',
    flexDirection: 'column',
    background: 'linear-gradient(160deg,#0F172A 0%,#1E1033 50%,#0F172A 100%)',
    fontFamily: "'Inter',-apple-system,BlinkMacSystemFont,sans-serif",
    color: '#fff',
  },
  header: {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '14px 20px',
    background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(10px)',
    borderBottom: '1px solid rgba(255,255,255,0.07)',
    position: 'sticky', top: 0, zIndex: 10,
  },
  brand: { display: 'flex', alignItems: 'center', gap: 8 },
  logo: {
    width: 30, height: 30, borderRadius: 8,
    background: 'linear-gradient(135deg,#6366F1,#8B5CF6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 14, color: '#fff',
  },
  brandName: { fontWeight: 700, fontSize: 16, letterSpacing: -0.3 },
  headerMid: { flex: 1, display: 'flex', justifyContent: 'center' },
  tableBadge: {
    padding: '4px 14px', borderRadius: 20,
    background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.35)',
    color: '#A5B4FC', fontSize: 13, fontWeight: 600,
  },
  ordersBtn: {
    padding: '6px 14px', borderRadius: 10,
    background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)',
    color: 'rgba(255,255,255,0.7)', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  main: { flex: 1, display: 'flex', flexDirection: 'column', padding: '16px 16px 8px', gap: 12 },
  fullCenter: {
    minHeight: '100dvh', display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    background: 'linear-gradient(160deg,#0F172A 0%,#1E1033 50%,#0F172A 100%)',
    fontFamily: "'Inter',-apple-system,sans-serif", padding: 24,
  },
  spinner: {
    width: 44, height: 44, borderRadius: '50%',
    border: '3px solid rgba(255,255,255,0.1)', borderTopColor: '#6366F1',
    animation: 'spin 0.8s linear infinite',
  },
};

const homeS = {
  layout: {
    display: 'grid',
    gridTemplateColumns: 'minmax(0,1fr) 300px',
    gap: 14,
    flex: 1,
    minHeight: 0,
  },
  voicePanel: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 20, display: 'flex', flexDirection: 'column',
    gap: 14, minHeight: 380,
  },
  micArea: {
    display: 'flex', justifyContent: 'center',
    padding: '8px 0 4px', marginTop: 'auto',
  },
  orderPanel: {
    background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 20, padding: 18, display: 'flex', flexDirection: 'column',
  },
  chipsArea: { paddingBottom: 8 },
  errorBanner: {
    padding: '8px 12px', borderRadius: 8,
    background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5', fontSize: 13,
  },
  warnBanner: {
    padding: '7px 12px', borderRadius: 8,
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
    color: '#FCD34D', fontSize: 12,
  },
  // ── Action feedback toast styles ────────────────
  feedbackContainer: {
    display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4,
  },
  feedbackToast: {
    display: 'flex', alignItems: 'center', gap: 8,
    padding: '8px 12px', borderRadius: 10, fontSize: 13, fontWeight: 600,
    backdropFilter: 'blur(8px)',
    animation: 'fadeInUp 0.3s ease-out',
  },
  feedbackAdd: {
    background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)',
    color: '#6EE7B7',
  },
  feedbackModify: {
    background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
    color: '#A5B4FC',
  },
  feedbackDelete: {
    background: 'rgba(239,68,68,0.15)', border: '1px solid rgba(239,68,68,0.3)',
    color: '#FCA5A5',
  },
  feedbackUnavailable: {
    background: 'rgba(245,158,11,0.15)', border: '1px solid rgba(245,158,11,0.3)',
    color: '#FCD34D',
  },
  feedbackWarn: {
    background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.2)',
    color: '#FCD34D',
  },
};
