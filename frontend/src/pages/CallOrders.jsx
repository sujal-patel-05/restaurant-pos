/**
 * CallOrders.jsx — AI Call Ordering Terminal
 * 
 * 3-Panel Production Layout:
 *   LEFT:   Live transcript (real-time from WebSocket)
 *   CENTER: Extracted order items (editable)
 *   RIGHT:  Call controls + customer details + AI voice
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { getSupportedMimeType } from '../utils/audioUtils';

const API_BASE = '';

export default function CallOrders() {
    // ── Connection / Recording state ──────────────────────────────────────
    const [isListening, setIsListening] = useState(false);
    const [callDuration, setCallDuration] = useState(0);
    const [wsStatus, setWsStatus] = useState('disconnected'); // connected | disconnected | error

    // ── Transcript ────────────────────────────────────────────────────────
    const [liveTranscript, setLiveTranscript] = useState('');
    const [transcriptChunks, setTranscriptChunks] = useState([]);

    // ── Order ─────────────────────────────────────────────────────────────
    const [orderItems, setOrderItems] = useState([]);
    const [unavailableItems, setUnavailableItems] = useState([]);
    const [isParsing, setIsParsing] = useState(false);

    // ── Customer details ──────────────────────────────────────────────────
    const [orderType, setOrderType] = useState('delivery');
    const [customerName, setCustomerName] = useState('');
    const [customerPhone, setCustomerPhone] = useState('');
    const [deliveryAddress, setDeliveryAddress] = useState('');

    // ── Submission ────────────────────────────────────────────────────────
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [orderResult, setOrderResult] = useState(null);

    // ── AI Voice ──────────────────────────────────────────────────────────
    const [isSpeaking, setIsSpeaking] = useState(false);

    // ── Refs ───────────────────────────────────────────────────────────────
    const wsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const callTimerRef = useRef(null);
    const transcriptEndRef = useRef(null);

    // Get restaurant_id from stored user
    const getRestaurantId = () => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            return user.restaurant_id || '';
        } catch { return ''; }
    };

    // ── Auto-scroll transcript ────────────────────────────────────────────
    useEffect(() => {
        transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [liveTranscript, transcriptChunks]);

    // ── Cleanup on unmount ────────────────────────────────────────────────
    useEffect(() => () => stopListening(), []);

    // ── Start listening ───────────────────────────────────────────────────
    const startListening = useCallback(async () => {
        const restaurantId = getRestaurantId();
        if (!restaurantId) {
            alert('Restaurant ID not found. Please log in again.');
            return;
        }

        try {
            // Get microphone
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true }
            });
            streamRef.current = stream;

            // Connect WebSocket
            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsUrl = `${wsProtocol}//127.0.0.1:8000/api/call-orders/stream?restaurant_id=${restaurantId}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                setWsStatus('connected');
                console.log('[CallOrders] WebSocket connected');

                // Start MediaRecorder
                const mimeType = getSupportedMimeType();
                const mr = new MediaRecorder(stream, {
                    ...(mimeType ? { mimeType } : {}),
                    audioBitsPerSecond: 128000,
                });

                mr.ondataavailable = (e) => {
                    if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                        ws.send(e.data);
                    }
                };

                mr.start(3000); // Send chunks every 3 seconds
                mediaRecorderRef.current = mr;
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    if (msg.type === 'transcript') {
                        setLiveTranscript(msg.cumulative || '');
                        setTranscriptChunks(prev => [...prev, { text: msg.text, time: new Date().toLocaleTimeString() }]);
                    } else if (msg.type === 'status') {
                        console.log('[CallOrders] Status:', msg.message);
                    } else if (msg.type === 'error') {
                        console.error('[CallOrders] WS Error:', msg.message);
                    }
                } catch (err) {
                    console.error('[CallOrders] Parse error:', err);
                }
            };

            ws.onerror = () => setWsStatus('error');
            ws.onclose = () => setWsStatus('disconnected');

            setIsListening(true);
            setCallDuration(0);
            setOrderResult(null);

            // Start call timer
            callTimerRef.current = setInterval(() => {
                setCallDuration(prev => prev + 1);
            }, 1000);

        } catch (err) {
            console.error('[CallOrders] Mic error:', err);
            alert('Microphone access denied. Please allow microphone access.');
        }
    }, []);

    // ── Stop listening ────────────────────────────────────────────────────
    const stopListening = useCallback(() => {
        clearInterval(callTimerRef.current);

        if (mediaRecorderRef.current?.state !== 'inactive') {
            try { mediaRecorderRef.current?.stop(); } catch (_) { }
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) {
            wsRef.current.close();
        }
        streamRef.current?.getTracks().forEach(t => t.stop());

        mediaRecorderRef.current = null;
        wsRef.current = null;
        streamRef.current = null;

        setIsListening(false);
        setWsStatus('disconnected');
    }, []);

    // ── Process transcript → extract items ────────────────────────────────
    const processOrder = useCallback(async () => {
        if (!liveTranscript.trim()) return;

        setIsParsing(true);
        try {
            const fd = new FormData();
            fd.append('transcript', liveTranscript);
            fd.append('restaurant_id', getRestaurantId());

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/call-orders/process`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: fd,
            });

            const data = await res.json();
            setOrderItems(data.items || []);
            setUnavailableItems(data.unavailable || []);
        } catch (err) {
            console.error('[CallOrders] Parse error:', err);
        } finally {
            setIsParsing(false);
        }
    }, [liveTranscript]);

    // ── AI Voice Response (TTS) ───────────────────────────────────────────
    const speakResponse = useCallback(async (text) => {
        setIsSpeaking(true);
        try {
            const fd = new FormData();
            fd.append('text', text);
            fd.append('language', 'hi-IN');

            const res = await fetch(`${API_BASE}/api/call-orders/tts`, { method: 'POST', body: fd });
            const data = await res.json();

            if (data.audio) {
                // Play base64 audio
                const audioBytes = atob(data.audio);
                const byteArray = new Uint8Array(audioBytes.length);
                for (let i = 0; i < audioBytes.length; i++) byteArray[i] = audioBytes.charCodeAt(i);
                const blob = new Blob([byteArray], { type: 'audio/wav' });
                const url = URL.createObjectURL(blob);
                const audio = new Audio(url);
                audio.onended = () => { setIsSpeaking(false); URL.revokeObjectURL(url); };
                audio.play();
            } else {
                // Fallback to browser speech synthesis
                const utterance = new SpeechSynthesisUtterance(text);
                utterance.lang = 'hi-IN';
                utterance.rate = 1.1;
                utterance.onend = () => setIsSpeaking(false);
                speechSynthesis.speak(utterance);
            }
        } catch (err) {
            // Fallback
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'hi-IN';
            utterance.onend = () => setIsSpeaking(false);
            speechSynthesis.speak(utterance);
        }
    }, []);

    // ── Confirm order summary via voice ───────────────────────────────────
    const confirmOrderVoice = useCallback(() => {
        if (!orderItems.length) return;
        const itemList = orderItems.map(i => `${i.qty} ${i.name}`).join(', ');
        const total = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
        const text = `Aapka order confirm karta hoon. ${itemList}. Total amount ${Math.round(total)} rupees hai. Kya yeh sahi hai?`;
        speakResponse(text);
    }, [orderItems, speakResponse]);

    // ── Submit order ──────────────────────────────────────────────────────
    const submitOrder = useCallback(async () => {
        if (!orderItems.length || isSubmitting) return;
        setIsSubmitting(true);

        try {
            const fd = new FormData();
            fd.append('items_json', JSON.stringify(orderItems));
            fd.append('restaurant_id', getRestaurantId());
            fd.append('order_type', orderType);
            fd.append('customer_name', customerName);
            fd.append('customer_phone', customerPhone);
            fd.append('delivery_address', deliveryAddress);
            fd.append('transcript', liveTranscript);

            const token = localStorage.getItem('token');
            const res = await fetch(`${API_BASE}/api/call-orders/create`, {
                method: 'POST',
                headers: token ? { 'Authorization': `Bearer ${token}` } : {},
                body: fd,
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Order failed');

            setOrderResult(data);
            speakResponse(`Order successfully place ho gaya hai. Order number ${data.order_number || ''} hai. Aapka total ${Math.round(data.total)} rupees hai. Dhanyavaad!`);
        } catch (err) {
            alert('Order failed: ' + err.message);
        } finally {
            setIsSubmitting(false);
        }
    }, [orderItems, orderType, customerName, customerPhone, deliveryAddress, liveTranscript, isSubmitting, speakResponse]);

    // ── Modify item qty ───────────────────────────────────────────────────
    const updateQty = (idx, newQty) => {
        setOrderItems(prev => {
            const items = [...prev];
            if (newQty <= 0) items.splice(idx, 1);
            else items[idx] = { ...items[idx], qty: newQty };
            return items;
        });
    };

    // ── Reset all ─────────────────────────────────────────────────────────
    const resetAll = () => {
        stopListening();
        setLiveTranscript('');
        setTranscriptChunks([]);
        setOrderItems([]);
        setUnavailableItems([]);
        setCustomerName('');
        setCustomerPhone('');
        setDeliveryAddress('');
        setOrderResult(null);
        setCallDuration(0);
    };

    // ── Format duration ───────────────────────────────────────────────────
    const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // ── Calculate totals ──────────────────────────────────────────────────
    const subtotal = orderItems.reduce((s, i) => s + i.price * i.qty, 0);
    const gst = Math.round(subtotal * 5 / 100 * 100) / 100;
    const total = subtotal + gst;

    return (
        <AppLayout title="📞 Call Orders" subtitle="AI-powered phone order terminal">
            <div style={styles.container}>

                {/* ── TOP BAR ── */}
                <div style={styles.topBar}>
                    <div style={styles.topLeft}>
                        <div style={{
                            ...styles.statusDot,
                            background: isListening ? '#10B981' : wsStatus === 'error' ? '#EF4444' : '#6B7280'
                        }} />
                        <span style={styles.statusText}>
                            {isListening ? `🔴 Active Call — ${formatDuration(callDuration)}` : 'Ready for call'}
                        </span>
                    </div>
                    <div style={styles.topRight}>
                        {!isListening ? (
                            <button onClick={startListening} style={styles.startBtn}>
                                🎤 Start Listening
                            </button>
                        ) : (
                            <button onClick={stopListening} style={styles.stopBtn}>
                                ⏹ End Call
                            </button>
                        )}
                        <button onClick={resetAll} style={styles.resetBtn}>🔄 New Call</button>
                    </div>
                </div>

                {/* ── 3-PANEL LAYOUT ── */}
                <div style={styles.panels}>

                    {/* LEFT: Live Transcript */}
                    <div style={styles.panel}>
                        <div style={styles.panelHeader}>
                            <span>📝 Live Transcript</span>
                            {isListening && <span style={styles.liveDot}>● LIVE</span>}
                        </div>
                        <div style={styles.transcriptArea}>
                            {!liveTranscript && !transcriptChunks.length ? (
                                <div style={styles.placeholder}>
                                    <p style={{ fontSize: 40, margin: 0 }}>🎧</p>
                                    <p style={styles.placeholderText}>
                                        {isListening ? 'Listening for speech...' : 'Click "Start Listening" to begin'}
                                    </p>
                                    <p style={styles.placeholderHint}>Place the phone near the microphone</p>
                                </div>
                            ) : (
                                <div style={styles.transcriptContent}>
                                    {transcriptChunks.map((chunk, i) => (
                                        <div key={i} style={styles.transcriptChunk}>
                                            <span style={styles.chunkTime}>{chunk.time}</span>
                                            <span style={styles.chunkText}>{chunk.text}</span>
                                        </div>
                                    ))}
                                    <div ref={transcriptEndRef} />
                                </div>
                            )}
                        </div>
                        {liveTranscript && (
                            <button onClick={processOrder} disabled={isParsing} style={styles.processBtn}>
                                {isParsing ? '⏳ Parsing...' : '🧠 Extract Order Items'}
                            </button>
                        )}
                    </div>

                    {/* CENTER: Extracted Order */}
                    <div style={styles.panel}>
                        <div style={styles.panelHeader}>
                            <span>📋 Order Items</span>
                            {orderItems.length > 0 && (
                                <span style={styles.itemCount}>{orderItems.length} items</span>
                            )}
                        </div>
                        <div style={styles.orderArea}>
                            {orderResult ? (
                                <div style={styles.successBox}>
                                    <div style={{ fontSize: 48, marginBottom: 12 }}>✅</div>
                                    <h3 style={{ color: '#10B981', margin: '0 0 8px' }}>Order Placed!</h3>
                                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0' }}>
                                        Total: ₹{orderResult.total?.toFixed(2)}
                                    </p>
                                    <p style={{ color: 'var(--text-secondary)', margin: '4px 0' }}>
                                        {orderResult.item_count} items • KOTs sent to kitchen
                                    </p>
                                </div>
                            ) : orderItems.length === 0 ? (
                                <div style={styles.placeholder}>
                                    <p style={{ fontSize: 40, margin: 0 }}>🛒</p>
                                    <p style={styles.placeholderText}>Extracted items will appear here</p>
                                    <p style={styles.placeholderHint}>Click "Extract Order Items" after recording</p>
                                </div>
                            ) : (
                                <>
                                    <div style={styles.itemsList}>
                                        {orderItems.map((item, idx) => (
                                            <div key={idx} style={styles.itemRow}>
                                                <div style={{ flex: 1 }}>
                                                    <div style={styles.itemName}>{item.name}</div>
                                                    <div style={styles.itemPrice}>₹{item.price}</div>
                                                </div>
                                                <div style={styles.qtyControls}>
                                                    <button onClick={() => updateQty(idx, item.qty - 1)} style={styles.qtyBtn}>−</button>
                                                    <span style={styles.qtyNum}>{item.qty}</span>
                                                    <button onClick={() => updateQty(idx, item.qty + 1)} style={styles.qtyBtn}>+</button>
                                                </div>
                                                <div style={styles.itemTotal}>₹{(item.price * item.qty).toFixed(0)}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {unavailableItems.length > 0 && (
                                        <div style={styles.unavailableBox}>
                                            ❌ Not available: {unavailableItems.join(', ')}
                                        </div>
                                    )}

                                    <div style={styles.totalsBox}>
                                        <div style={styles.totalRow}><span>Subtotal</span><span>₹{subtotal.toFixed(2)}</span></div>
                                        <div style={styles.totalRow}><span>GST (5%)</span><span>₹{gst.toFixed(2)}</span></div>
                                        <div style={{ ...styles.totalRow, fontWeight: 800, fontSize: 16, color: '#10B981' }}>
                                            <span>Total</span><span>₹{total.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>

                    {/* RIGHT: Controls + Customer Details */}
                    <div style={styles.panel}>
                        <div style={styles.panelHeader}>
                            <span>⚙️ Order Details</span>
                        </div>
                        <div style={styles.controlsArea}>
                            {/* Order Type */}
                            <label style={styles.fieldLabel}>Order Type</label>
                            <div style={styles.radioGroup}>
                                {['delivery', 'takeaway', 'dine-in'].map(t => (
                                    <label key={t} style={{ ...styles.radioLabel, ...(orderType === t ? styles.radioActive : {}) }}>
                                        <input type="radio" value={t} checked={orderType === t}
                                            onChange={e => setOrderType(e.target.value)} style={{ display: 'none' }} />
                                        {t === 'delivery' ? '🚚' : t === 'takeaway' ? '🥡' : '🍽️'} {t.charAt(0).toUpperCase() + t.slice(1)}
                                    </label>
                                ))}
                            </div>

                            {/* Customer Info */}
                            <label style={styles.fieldLabel}>Customer Name</label>
                            <input style={styles.input} value={customerName} onChange={e => setCustomerName(e.target.value)}
                                placeholder="e.g. Rahul Sharma" />

                            <label style={styles.fieldLabel}>Phone Number</label>
                            <input style={styles.input} value={customerPhone} onChange={e => setCustomerPhone(e.target.value)}
                                placeholder="e.g. 9876543210" />

                            {orderType === 'delivery' && (
                                <>
                                    <label style={styles.fieldLabel}>Delivery Address</label>
                                    <textarea style={{ ...styles.input, minHeight: 60, resize: 'vertical' }}
                                        value={deliveryAddress} onChange={e => setDeliveryAddress(e.target.value)}
                                        placeholder="e.g. Sector 62, Noida" />
                                </>
                            )}

                            {/* AI Voice Actions */}
                            <div style={styles.voiceActions}>
                                <button onClick={confirmOrderVoice} disabled={!orderItems.length || isSpeaking}
                                    style={{ ...styles.voiceBtn, opacity: !orderItems.length ? 0.5 : 1 }}>
                                    {isSpeaking ? '🔊 Speaking...' : '🗣️ Confirm Order (Voice)'}
                                </button>
                            </div>

                            {/* Submit */}
                            {orderItems.length > 0 && !orderResult && (
                                <button onClick={submitOrder} disabled={isSubmitting} style={styles.submitBtn}>
                                    {isSubmitting ? '⏳ Placing...' : `✅ Place Order · ₹${total.toFixed(0)}`}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.5; } }
      `}</style>
        </AppLayout>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
// Styles
// ═══════════════════════════════════════════════════════════════════════════
const styles = {
    container: { display: 'flex', flexDirection: 'column', gap: 16, height: '100%', minHeight: 'calc(100vh - 120px)' },
    topBar: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', borderRadius: 14,
        background: 'var(--card-bg, rgba(255,255,255,0.05))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
    },
    topLeft: { display: 'flex', alignItems: 'center', gap: 10 },
    topRight: { display: 'flex', gap: 8 },
    statusDot: { width: 10, height: 10, borderRadius: '50%', animation: 'pulse 2s infinite' },
    statusText: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary, #fff)' },
    startBtn: {
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff',
        fontSize: 14, fontWeight: 700, transition: 'transform 0.15s',
    },
    stopBtn: {
        padding: '8px 20px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff',
        fontSize: 14, fontWeight: 700,
    },
    resetBtn: {
        padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border-color, rgba(255,255,255,0.15))',
        background: 'transparent', color: 'var(--text-secondary, rgba(255,255,255,0.6))',
        fontSize: 13, fontWeight: 600, cursor: 'pointer',
    },
    panels: { display: 'grid', gridTemplateColumns: '1fr 1fr 300px', gap: 14, flex: 1, minHeight: 0 },
    panel: {
        display: 'flex', flexDirection: 'column', borderRadius: 16,
        background: 'var(--card-bg, rgba(255,255,255,0.04))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.08))',
        overflow: 'hidden',
    },
    panelHeader: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        padding: '12px 16px', fontWeight: 700, fontSize: 14,
        color: 'var(--text-primary, #fff)',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.08))',
    },
    liveDot: { color: '#EF4444', fontSize: 12, fontWeight: 700, animation: 'pulse 1.5s infinite' },
    itemCount: {
        fontSize: 11, fontWeight: 600, padding: '2px 8px', borderRadius: 10,
        background: 'rgba(99,102,241,0.2)', color: '#A5B4FC',
    },

    // Transcript
    transcriptArea: { flex: 1, padding: 16, overflowY: 'auto', minHeight: 200 },
    transcriptContent: { display: 'flex', flexDirection: 'column', gap: 8 },
    transcriptChunk: { display: 'flex', gap: 8, alignItems: 'flex-start' },
    chunkTime: { fontSize: 10, color: 'var(--text-tertiary, rgba(255,255,255,0.3))', minWidth: 55, paddingTop: 2 },
    chunkText: { fontSize: 14, color: 'var(--text-primary, rgba(255,255,255,0.9))', lineHeight: 1.5 },
    processBtn: {
        margin: 12, padding: '10px 16px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #6366F1, #4F46E5)', color: '#fff',
        fontSize: 14, fontWeight: 700, transition: 'opacity 0.2s',
    },

    // Order
    orderArea: { flex: 1, padding: 16, overflowY: 'auto', display: 'flex', flexDirection: 'column' },
    itemsList: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1 },
    itemRow: {
        display: 'flex', alignItems: 'center', gap: 8, padding: '8px 0',
        borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))',
    },
    itemName: { fontSize: 14, fontWeight: 600, color: 'var(--text-primary, rgba(255,255,255,0.9))' },
    itemPrice: { fontSize: 12, color: 'var(--text-secondary, rgba(255,255,255,0.5))' },
    qtyControls: {
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(255,255,255,0.08)', borderRadius: 8, padding: '2px 4px',
    },
    qtyBtn: {
        background: 'none', border: 'none', color: 'var(--text-secondary, rgba(255,255,255,0.7))',
        fontSize: 16, fontWeight: 700, cursor: 'pointer', padding: '2px 6px',
    },
    qtyNum: { fontSize: 14, fontWeight: 700, color: 'var(--text-primary, #fff)', minWidth: 20, textAlign: 'center' },
    itemTotal: { fontSize: 14, fontWeight: 600, color: 'var(--text-secondary, rgba(255,255,255,0.6))', minWidth: 50, textAlign: 'right' },
    unavailableBox: {
        padding: '8px 12px', borderRadius: 8, marginTop: 8,
        background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)',
        color: '#FCD34D', fontSize: 13, fontWeight: 600,
    },
    totalsBox: {
        marginTop: 12, paddingTop: 12,
        borderTop: '1px solid var(--border-color, rgba(255,255,255,0.1))',
        display: 'flex', flexDirection: 'column', gap: 6,
    },
    totalRow: {
        display: 'flex', justifyContent: 'space-between', fontSize: 13,
        color: 'var(--text-secondary, rgba(255,255,255,0.6))',
    },
    successBox: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' },

    // Controls
    controlsArea: { flex: 1, padding: 16, display: 'flex', flexDirection: 'column', gap: 10, overflowY: 'auto' },
    fieldLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-secondary, rgba(255,255,255,0.5))', textTransform: 'uppercase', letterSpacing: 0.5 },
    input: {
        padding: '8px 12px', borderRadius: 8, fontSize: 14,
        background: 'var(--input-bg, rgba(255,255,255,0.06))',
        border: '1px solid var(--border-color, rgba(255,255,255,0.12))',
        color: 'var(--text-primary, #fff)', outline: 'none', width: '100%', boxSizing: 'border-box',
    },
    radioGroup: { display: 'flex', gap: 6 },
    radioLabel: {
        flex: 1, padding: '8px 6px', borderRadius: 8, textAlign: 'center', cursor: 'pointer',
        fontSize: 12, fontWeight: 600, border: '1px solid var(--border-color, rgba(255,255,255,0.1))',
        background: 'transparent', color: 'var(--text-secondary, rgba(255,255,255,0.5))',
        transition: 'all 0.2s',
    },
    radioActive: {
        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.4)',
        color: '#A5B4FC',
    },
    voiceActions: { marginTop: 8 },
    voiceBtn: {
        width: '100%', padding: '10px 12px', borderRadius: 10, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #8B5CF6, #6D28D9)', color: '#fff',
        fontSize: 13, fontWeight: 700,
    },
    submitBtn: {
        width: '100%', padding: '14px 16px', borderRadius: 12, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff',
        fontSize: 15, fontWeight: 800, marginTop: 'auto',
        boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
    },
    placeholder: {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 8, padding: 24, textAlign: 'center',
    },
    placeholderText: { margin: 0, fontSize: 14, color: 'var(--text-secondary, rgba(255,255,255,0.4))', fontWeight: 500 },
    placeholderHint: { margin: 0, fontSize: 12, color: 'var(--text-tertiary, rgba(255,255,255,0.2))' },
};
