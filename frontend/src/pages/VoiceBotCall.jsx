/**
 * VoiceBotCall.jsx — Customer-facing AI Voice Bot
 *
 * A phone-like UI where customers "call" the restaurant AI.
 * The bot greets, takes order, confirms, and places it — all by voice.
 *
 * Route: /order-call/:tableId (public, no login)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getSupportedMimeType } from '../utils/audioUtils';

// ═══════════════════════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════════════════════
export default function VoiceBotCall() {
    const { tableId } = useParams();

    // ── State ───────────────────────────────────────────────────────────────
    const [callState, setCallState] = useState('idle'); // idle | connecting | active | done
    const [botState, setBotState] = useState('');      // greeting | listening | processing | confirming | confirmed | done
    const [callDuration, setCallDuration] = useState(0);

    // Transcript
    const [messages, setMessages] = useState([]); // { role: 'bot'|'customer', text: '...' }
    const [isProcessing, setIsProcessing] = useState(false);

    // Order
    const [orderItems, setOrderItems] = useState([]);
    const [unavailableItems, setUnavailable] = useState([]);
    const [orderTotal, setOrderTotal] = useState(0);
    const [orderResult, setOrderResult] = useState(null);

    // Audio playback
    const [isBotSpeaking, setIsBotSpeaking] = useState(false);

    // Refs
    const wsRef = useRef(null);
    const mediaRecorderRef = useRef(null);
    const streamRef = useRef(null);
    const callTimerRef = useRef(null);
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    const chatEndRef = useRef(null);

    // ── Auto-scroll chat ────────────────────────────────────────────────────
    useEffect(() => {
        chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    // ── Cleanup on unmount ──────────────────────────────────────────────────
    useEffect(() => () => endCall(), []);

    // ── Audio queue: play bot audio sequentially ────────────────────────────
    const playNextAudio = useCallback(() => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsBotSpeaking(false);
            // Resume recording after bot finishes speaking
            if (mediaRecorderRef.current?.state === 'paused') {
                try { mediaRecorderRef.current.resume(); } catch (_) { }
            }
            return;
        }

        isPlayingRef.current = true;
        setIsBotSpeaking(true);

        // Pause recording while bot speaks to avoid echo
        if (mediaRecorderRef.current?.state === 'recording') {
            try { mediaRecorderRef.current.pause(); } catch (_) { }
        }

        const audioB64 = audioQueueRef.current.shift();
        try {
            const bytes = atob(audioB64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
            const blob = new Blob([arr], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.onended = () => {
                URL.revokeObjectURL(url);
                playNextAudio();
            };
            audio.onerror = () => {
                URL.revokeObjectURL(url);
                playNextAudio();
            };
            audio.play().catch(() => playNextAudio());
        } catch {
            playNextAudio();
        }
    }, []);

    const enqueueAudio = useCallback((b64) => {
        if (!b64) return;
        audioQueueRef.current.push(b64);
        if (!isPlayingRef.current) playNextAudio();
    }, [playNextAudio]);

    // ── Start call ──────────────────────────────────────────────────────────
    const startCall = useCallback(async () => {
        setCallState('connecting');
        setMessages([]);
        setOrderItems([]);
        setUnavailable([]);
        setOrderResult(null);
        setCallDuration(0);

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            streamRef.current = stream;

            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const ws = new WebSocket(`${wsProtocol}//127.0.0.1:8000/api/voice-bot/call?table_id=${tableId || 'T1'}`);
            wsRef.current = ws;

            ws.onopen = () => {
                setCallState('active');

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
                mr.start(3000);
                mediaRecorderRef.current = mr;

                callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    switch (msg.type) {
                        case 'state':
                            setBotState(msg.state);
                            setIsProcessing(msg.state === 'processing');
                            break;
                        case 'bot_audio':
                            if (msg.text) {
                                setMessages(prev => [...prev, { role: 'bot', text: msg.text }]);
                            }
                            if (msg.audio) enqueueAudio(msg.audio);
                            break;
                        case 'transcript':
                            if (msg.text) {
                                setMessages(prev => [...prev, { role: 'customer', text: msg.text }]);
                            }
                            break;
                        case 'order':
                            setOrderItems(msg.items || []);
                            setUnavailable(msg.unavailable || []);
                            setOrderTotal(msg.total || 0);
                            break;
                        case 'confirmed':
                            setOrderResult(msg);
                            break;
                        case 'error':
                            console.error('[VoiceBot] Error:', msg.message);
                            break;
                    }
                } catch (e) { console.error('WS parse error', e); }
            };

            ws.onerror = () => setCallState('idle');
            ws.onclose = () => {
                if (callState !== 'done') setCallState('idle');
            };

        } catch (err) {
            alert('Microphone access denied.');
            setCallState('idle');
        }
    }, [tableId, enqueueAudio]);

    // ── End call ────────────────────────────────────────────────────────────
    const endCall = useCallback(() => {
        clearInterval(callTimerRef.current);
        audioQueueRef.current = [];
        isPlayingRef.current = false;

        if (mediaRecorderRef.current?.state !== 'inactive') {
            try { mediaRecorderRef.current?.stop(); } catch (_) { }
        }
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
        streamRef.current?.getTracks().forEach(t => t.stop());

        mediaRecorderRef.current = null;
        wsRef.current = null;
        streamRef.current = null;
        setIsBotSpeaking(false);
        setCallState(orderResult ? 'done' : 'idle');
    }, [orderResult]);

    const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    // ═══════════════════════════════════════════════════════════════════════════
    // RENDER
    // ═══════════════════════════════════════════════════════════════════════════
    return (
        <div style={S.page}>
            <div style={S.phoneFrame}>

                {/* ── Header ── */}
                <div style={S.header}>
                    <div style={S.headerTitle}>🤖 AI Order Assistant</div>
                    <div style={S.headerSub}>Table {tableId || 'T1'}</div>
                </div>

                {/* ── Status Bar ── */}
                {callState === 'active' && (
                    <div style={S.statusBar}>
                        <div style={{
                            ...S.statusDot,
                            background: isBotSpeaking ? '#8B5CF6' : botState === 'listening' ? '#10B981' : '#6366F1',
                            animation: 'pulse 1.5s infinite'
                        }} />
                        <span style={S.statusLabel}>
                            {isBotSpeaking ? '🔊 Bot is speaking...' :
                                botState === 'listening' ? '🎤 Listening to you...' :
                                    botState === 'processing' ? '🧠 Processing...' :
                                        botState === 'confirming' ? '✋ Waiting for confirmation...' :
                                            botState === 'confirmed' ? '✅ Order placed!' :
                                                botState === 'done' ? '👋 Call ended' : 'Connecting...'}
                        </span>
                        <span style={S.timer}>{formatDuration(callDuration)}</span>
                    </div>
                )}

                {/* ── Chat Messages ── */}
                <div style={S.chatArea}>
                    {callState === 'idle' && !orderResult && (
                        <div style={S.idleScreen}>
                            <div style={S.phoneIcon}>📞</div>
                            <h2 style={S.idleTitle}>Call AI Waiter</h2>
                            <p style={S.idleDesc}>
                                Tap the call button to talk to our AI assistant.
                                Just speak normally — it understands Hindi, English & Hinglish!
                            </p>
                        </div>
                    )}

                    {messages.map((msg, i) => (
                        <div key={i} style={{ ...S.msgRow, justifyContent: msg.role === 'customer' ? 'flex-end' : 'flex-start' }}>
                            <div style={msg.role === 'bot' ? S.botBubble : S.customerBubble}>
                                {msg.role === 'bot' && <span style={S.botIcon}>🤖</span>}
                                <span>{msg.text}</span>
                            </div>
                        </div>
                    ))}

                    {isProcessing && (
                        <div style={S.msgRow}>
                            <div style={S.botBubble}>
                                <span style={S.botIcon}>🤖</span>
                                <span style={S.thinking}>Thinking<span className="dots">...</span></span>
                            </div>
                        </div>
                    )}

                    <div ref={chatEndRef} />
                </div>

                {/* ── Order Summary (if items parsed) ── */}
                {orderItems.length > 0 && (
                    <div style={S.orderSummary}>
                        <div style={S.orderHeader}>📋 Your Order</div>
                        {orderItems.map((item, i) => (
                            <div key={i} style={S.orderRow}>
                                <span>{item.qty}× {item.name}</span>
                                <span>₹{(item.price * item.qty).toFixed(0)}</span>
                            </div>
                        ))}
                        {unavailableItems.length > 0 && (
                            <div style={S.unavailable}>❌ Not available: {unavailableItems.join(', ')}</div>
                        )}
                        <div style={S.orderTotal}>
                            <span>Total</span>
                            <span style={{ color: '#10B981', fontWeight: 800 }}>₹{orderTotal.toFixed(0)}</span>
                        </div>
                    </div>
                )}

                {/* ── Order Confirmed ── */}
                {orderResult && (
                    <div style={S.confirmedBanner}>
                        <span style={{ fontSize: 28 }}>✅</span>
                        <div>
                            <div style={{ fontWeight: 800, color: '#10B981' }}>Order Confirmed!</div>
                            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)' }}>
                                Total ₹{orderResult.total?.toFixed(0)} • KOTs sent to kitchen
                            </div>
                        </div>
                    </div>
                )}

                {/* ── Call Button ── */}
                <div style={S.callArea}>
                    {callState === 'idle' ? (
                        <button onClick={startCall} style={S.callBtn}>
                            <span style={S.callBtnIcon}>📞</span>
                            <span>Call AI Waiter</span>
                        </button>
                    ) : callState === 'connecting' ? (
                        <button disabled style={{ ...S.callBtn, background: '#6B7280', cursor: 'wait' }}>
                            <span>Connecting...</span>
                        </button>
                    ) : callState === 'active' ? (
                        <button onClick={endCall} style={S.endCallBtn}>
                            <span>End Call</span>
                        </button>
                    ) : (
                        <button onClick={() => { setCallState('idle'); setMessages([]); setOrderItems([]); setOrderResult(null); }}
                            style={S.callBtn}>
                            <span>New Call</span>
                        </button>
                    )}
                </div>
            </div>

            <style>{`
        @keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }
        .dots { animation: blink 1.5s steps(3,end) infinite; }
        @keyframes blink { 0% { content: ''; } 33% { content: '.'; } 66% { content: '..'; } 100% { content: '...'; } }
      `}</style>
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════════
// Styles — Premium phone-call UI
// ═══════════════════════════════════════════════════════════════════════════════
const S = {
    page: {
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(160deg, #0F172A 0%, #1E1033 50%, #0F172A 100%)',
        fontFamily: "'Inter', -apple-system, sans-serif", padding: 16,
    },
    phoneFrame: {
        width: '100%', maxWidth: 420, minHeight: '85dvh', maxHeight: '95dvh',
        display: 'flex', flexDirection: 'column',
        background: 'rgba(15, 23, 42, 0.95)', borderRadius: 28,
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        overflow: 'hidden',
    },
    header: {
        padding: '20px 20px 12px', textAlign: 'center',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
    },
    headerTitle: { fontSize: 18, fontWeight: 800, color: '#fff', letterSpacing: -0.3 },
    headerSub: { fontSize: 12, color: 'rgba(255,255,255,0.4)', marginTop: 2 },

    statusBar: {
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '8px 16px', background: 'rgba(255,255,255,0.03)',
        borderBottom: '1px solid rgba(255,255,255,0.05)',
    },
    statusDot: { width: 8, height: 8, borderRadius: '50%' },
    statusLabel: { flex: 1, fontSize: 12, color: 'rgba(255,255,255,0.6)', fontWeight: 600 },
    timer: { fontSize: 12, color: 'rgba(255,255,255,0.3)', fontFamily: 'monospace' },

    // Chat
    chatArea: { flex: 1, overflowY: 'auto', padding: 16, display: 'flex', flexDirection: 'column', gap: 10 },
    idleScreen: {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', gap: 12, padding: 24,
    },
    phoneIcon: { fontSize: 64, filter: 'drop-shadow(0 4px 20px rgba(99,102,241,0.4))' },
    idleTitle: { margin: 0, fontSize: 22, fontWeight: 800, color: '#fff' },
    idleDesc: { margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.4)', lineHeight: 1.6, maxWidth: 280 },

    msgRow: { display: 'flex', width: '100%' },
    botBubble: {
        maxWidth: '85%', padding: '10px 14px', borderRadius: '16px 16px 16px 4px',
        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.2)',
        color: '#C7D2FE', fontSize: 14, lineHeight: 1.5, display: 'flex', gap: 8, alignItems: 'flex-start',
    },
    customerBubble: {
        maxWidth: '80%', padding: '10px 14px', borderRadius: '16px 16px 4px 16px',
        background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.2)',
        color: '#A7F3D0', fontSize: 14, lineHeight: 1.5,
    },
    botIcon: { fontSize: 16, flexShrink: 0 },
    thinking: { color: 'rgba(255,255,255,0.4)', fontStyle: 'italic' },

    // Order summary
    orderSummary: {
        margin: '0 12px', padding: 12, borderRadius: 14,
        background: 'rgba(99,102,241,0.08)', border: '1px solid rgba(99,102,241,0.15)',
    },
    orderHeader: { fontSize: 13, fontWeight: 700, color: '#A5B4FC', marginBottom: 8 },
    orderRow: {
        display: 'flex', justifyContent: 'space-between', fontSize: 13,
        color: 'rgba(255,255,255,0.7)', padding: '3px 0',
    },
    orderTotal: {
        display: 'flex', justifyContent: 'space-between', fontSize: 15, fontWeight: 800,
        color: '#fff', borderTop: '1px solid rgba(255,255,255,0.1)', paddingTop: 8, marginTop: 6,
    },
    unavailable: {
        fontSize: 12, color: '#FCD34D', padding: '4px 0',
        borderTop: '1px solid rgba(255,255,255,0.05)', marginTop: 4,
    },

    // Confirmed
    confirmedBanner: {
        display: 'flex', alignItems: 'center', gap: 12, margin: '0 12px',
        padding: '12px 16px', borderRadius: 14,
        background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.25)',
    },

    // Call button
    callArea: { padding: '12px 16px 20px', display: 'flex', justifyContent: 'center' },
    callBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #10B981, #059669)', color: '#fff',
        fontSize: 17, fontWeight: 800, letterSpacing: -0.3,
        boxShadow: '0 8px 32px rgba(16,185,129,0.4)',
        transition: 'transform 0.15s, box-shadow 0.15s',
    },
    callBtnIcon: { fontSize: 22 },
    endCallBtn: {
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10,
        width: '100%', padding: '16px 24px', borderRadius: 16, border: 'none', cursor: 'pointer',
        background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: '#fff',
        fontSize: 17, fontWeight: 800,
        boxShadow: '0 8px 32px rgba(239,68,68,0.4)',
    },
};
