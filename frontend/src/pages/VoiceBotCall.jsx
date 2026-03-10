/**
 * VoiceBotCall.jsx — "Eva" AI Hostess — Production Digital Call
 *
 * CRITICAL FIX: Uses refs for all VAD/audio functions to avoid
 * React hooks stale closure issues. Records full sentences via
 * silence detection, sends complete audio blobs for accurate STT.
 *
 * Route: /order-call/:tableId (public, no login)
 */
import React, { useState, useRef, useCallback, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { getSupportedMimeType, createAnalyser, getAverageVolume } from '../utils/audioUtils';

export default function VoiceBotCall() {
    const { tableId } = useParams();

    const [callState, setCallState] = useState('idle');
    const [botState, setBotState] = useState('');
    const [callDuration, setCallDuration] = useState(0);
    const [messages, setMessages] = useState([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [orderItems, setOrderItems] = useState([]);
    const [orderTotal, setOrderTotal] = useState(0);
    const [orderResult, setOrderResult] = useState(null);
    const [isBotSpeaking, setIsBotSpeaking] = useState(false);
    const [showConfetti, setShowConfetti] = useState(false);
    const [isRecording, setIsRecording] = useState(false);
    const [micLevel, setMicLevel] = useState(0);

    // Refs
    const wsRef = useRef(null);
    const streamRef = useRef(null);
    const callTimerRef = useRef(null);
    const chatEndRef = useRef(null);
    const canvasRef = useRef(null);
    const analyserRef = useRef(null);
    const analyserCleanupRef = useRef(null);
    const animFrameRef = useRef(null);
    // Audio playback
    const audioQueueRef = useRef([]);
    const isPlayingRef = useRef(false);
    // VAD
    const mediaRecorderRef = useRef(null);
    const vadIntervalRef = useRef(null);
    const silenceCountRef = useRef(0);
    const isListeningRef = useRef(false);
    const recordedChunksRef = useRef([]);

    const SILENCE_THRESHOLD = 15;
    const SILENCE_FRAMES = 10;   // 10 × 100ms = 1.0s of silence
    const MIN_SPEECH_SIZE = 4000;

    useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages]);
    useEffect(() => () => endCallRef.current?.(), []);

    // ══════════════════════════════════════════════════════════════════
    // VAD: Start/Stop listening — using plain functions stored in refs
    // to avoid stale closure issues with useCallback
    // ══════════════════════════════════════════════════════════════════
    const doStartListening = () => {
        console.log('[VAD] doStartListening triggered. stream:', !!streamRef.current, 'playing:', isPlayingRef.current, 'listening:', isListeningRef.current);
        if (!streamRef.current || isPlayingRef.current || isListeningRef.current) return;
        isListeningRef.current = true;
        setIsRecording(true);
        silenceCountRef.current = 0;
        recordedChunksRef.current = [];

        const mimeType = getSupportedMimeType();
        try {
            const mr = new MediaRecorder(streamRef.current, {
                ...(mimeType ? { mimeType } : {}),
                audioBitsPerSecond: 128000,
            });
            mr.ondataavailable = (e) => {
                if (e.data.size > 0) recordedChunksRef.current.push(e.data);
            };
            mr.start(500);
            mediaRecorderRef.current = mr;
        } catch (e) {
            console.error('[VAD] MediaRecorder error:', e);
            isListeningRef.current = false;
            setIsRecording(false);
            return;
        }

        vadIntervalRef.current = setInterval(() => {
            if (!analyserRef.current) return;
            const vol = getAverageVolume(analyserRef.current);
            setMicLevel(vol);

            if (vol < SILENCE_THRESHOLD) {
                silenceCountRef.current++;
            } else {
                silenceCountRef.current = 0;
            }

            if (silenceCountRef.current >= SILENCE_FRAMES && recordedChunksRef.current.length > 0) {
                doFinishAndSend();
            }
        }, 100);
    };

    const doStopListening = () => {
        isListeningRef.current = false;
        setIsRecording(false);
        setMicLevel(0);
        clearInterval(vadIntervalRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            try { mediaRecorderRef.current.stop(); } catch (_) { }
        }
        silenceCountRef.current = 0;
    };

    const doFinishAndSend = () => {
        console.log('[VAD] Silence detected. Stopping VAD & compiling chunks.');
        doStopListening();
        const chunks = [...recordedChunksRef.current];
        recordedChunksRef.current = [];

        if (chunks.length === 0) { doStartListening(); return; }

        const blob = new Blob(chunks, { type: chunks[0]?.type || 'audio/webm' });
        if (blob.size < MIN_SPEECH_SIZE) { doStartListening(); return; }

        console.log(`[VAD] Sending ${(blob.size / 1024).toFixed(1)}KB audio to server`);

        if (wsRef.current?.readyState === WebSocket.OPEN) {
            blob.arrayBuffer().then(buf => {
                wsRef.current.send(buf);
            }).catch(() => doStartListening());
        } else {
            doStartListening();
        }
    };

    // Store in refs for cross-callback access
    const startListeningRef = useRef(doStartListening);
    startListeningRef.current = doStartListening;
    const endCallRef = useRef(null);

    // ══════════════════════════════════════════════════════════════════
    // TTS Audio playback
    // ══════════════════════════════════════════════════════════════════
    const doPlayNext = () => {
        if (audioQueueRef.current.length === 0) {
            isPlayingRef.current = false;
            setIsBotSpeaking(false);
            // Bot finished → start listening
            setTimeout(() => startListeningRef.current(), 300);
            return;
        }
        isPlayingRef.current = true;
        setIsBotSpeaking(true);
        doStopListening();

        const audioB64 = audioQueueRef.current.shift();
        try {
            const bytes = atob(audioB64);
            const arr = new Uint8Array(bytes.length);
            for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
            const blob = new Blob([arr], { type: 'audio/wav' });
            const url = URL.createObjectURL(blob);
            const audio = new Audio(url);
            audio.volume = 1.0;
            audio.onended = () => { URL.revokeObjectURL(url); doPlayNext(); };
            audio.onerror = (e) => { console.error('[TTS] playback error', e); URL.revokeObjectURL(url); doPlayNext(); };
            const playPromise = audio.play();
            if (playPromise) {
                playPromise.catch((e) => {
                    console.error('[TTS] play() rejected:', e);
                    doPlayNext();
                });
            }
        } catch (e) {
            console.error('[TTS] decode error:', e);
            doPlayNext();
        }
    };

    const doEnqueue = (b64) => {
        if (!b64) return;
        audioQueueRef.current.push(b64);
        if (!isPlayingRef.current) doPlayNext();
    };

    // ══════════════════════════════════════════════════════════════════
    // Waveform
    // ══════════════════════════════════════════════════════════════════
    const drawWaveform = useCallback(() => {
        if (!canvasRef.current || !analyserRef.current) return;
        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');
        const analyser = analyserRef.current;
        const bufLen = analyser.frequencyBinCount;
        const dataArr = new Uint8Array(bufLen);
        analyser.getByteFrequencyData(dataArr);

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const barCount = 40;
        const barWidth = canvas.width / barCount;
        const step = Math.floor(bufLen / barCount);
        for (let i = 0; i < barCount; i++) {
            const val = dataArr[i * step] / 255;
            const barH = Math.max(2, val * canvas.height * 0.85);
            const x = i * barWidth + barWidth * 0.15;
            const w = barWidth * 0.7;
            const y = (canvas.height - barH) / 2;
            ctx.fillStyle = isBotSpeaking
                ? `rgba(139, 92, 246, ${0.3 + val * 0.6})`
                : `rgba(16, 185, 129, ${0.3 + val * 0.6})`;
            ctx.beginPath();
            ctx.roundRect(x, y, w, barH, 3);
            ctx.fill();
        }
        animFrameRef.current = requestAnimationFrame(drawWaveform);
    }, [isBotSpeaking]);

    useEffect(() => {
        if (callState === 'active' && analyserRef.current) {
            cancelAnimationFrame(animFrameRef.current);
            drawWaveform();
        }
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [callState, drawWaveform]);

    // ══════════════════════════════════════════════════════════════════
    // START CALL
    // ══════════════════════════════════════════════════════════════════
    const startCall = useCallback(async () => {
        setCallState('connecting');
        setMessages([]); setOrderItems([]); setOrderResult(null);
        setCallDuration(0); setShowConfetti(false);

        try {
            // Unlock audio playback with user gesture
            const unlockCtx = new (window.AudioContext || window.webkitAudioContext)();
            await unlockCtx.resume();
            // Play a tiny silent sound to fully unlock audio on iOS/Chrome
            const osc = unlockCtx.createOscillator();
            const gain = unlockCtx.createGain();
            gain.gain.value = 0.001;
            osc.connect(gain);
            gain.connect(unlockCtx.destination);
            osc.start();
            osc.stop(unlockCtx.currentTime + 0.01);
            setTimeout(() => unlockCtx.close(), 100);

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { channelCount: 1, sampleRate: 16000, echoCancellation: true, noiseSuppression: true, autoGainControl: true }
            });
            streamRef.current = stream;

            const { analyser, cleanup } = createAnalyser(stream);
            analyserRef.current = analyser;
            analyserCleanupRef.current = cleanup;

            const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
            const wsHost = window.location.host.includes('localhost') || window.location.host.includes('127.0.0.1')
                ? '127.0.0.1:8000' : window.location.host;
            const ws = new WebSocket(`${wsProtocol}//${wsHost}/api/voice-bot/call?table_id=${tableId || 'T1'}`);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[WS] Connected!');
                setCallState('active');
                callTimerRef.current = setInterval(() => setCallDuration(p => p + 1), 1000);
            };

            ws.onmessage = (event) => {
                try {
                    const msg = JSON.parse(event.data);
                    console.log('[WS] Received:', msg.type, msg.text ? msg.text.substring(0, 50) : '');

                    switch (msg.type) {
                        case 'state':
                            setBotState(msg.state);
                            setIsProcessing(msg.state === 'processing');
                            break;
                        case 'bot_audio':
                            if (msg.text) setMessages(prev => [...prev, { role: 'bot', text: msg.text }]);
                            if (msg.audio) {
                                console.log('[TTS] Got audio, length:', msg.audio.length);
                                doEnqueue(msg.audio);
                            } else {
                                console.warn('[TTS] No audio returned, starting listening');
                                setTimeout(() => startListeningRef.current(), 500);
                            }
                            break;
                        case 'transcript':
                            if (msg.text) setMessages(prev => [...prev, { role: 'customer', text: msg.text }]);
                            break;
                        case 'order':
                            setOrderItems(msg.items || []);
                            setOrderTotal(msg.total || 0);
                            break;
                        case 'confirmed':
                            setOrderResult(msg);
                            setShowConfetti(true);
                            setTimeout(() => setShowConfetti(false), 4000);
                            break;
                        case 'error':
                            console.error('[WS] Error:', msg.message);
                            break;
                    }
                } catch (e) { console.error('[WS] parse error', e); }
            };

            ws.onerror = (e) => { console.error('[WS] error', e); setCallState('idle'); };
            ws.onclose = () => {
                console.log('[WS] Closed');
                doStopListening();
            };
        } catch (err) {
            console.error('[CALL] Start error:', err);
            alert('Microphone required. Please allow mic access.');
            setCallState('idle');
        }
    }, [tableId]);

    // ── End call ──
    const endCall = useCallback(() => {
        doStopListening();
        clearInterval(callTimerRef.current);
        cancelAnimationFrame(animFrameRef.current);
        audioQueueRef.current = [];
        isPlayingRef.current = false;
        if (wsRef.current?.readyState === WebSocket.OPEN) wsRef.current.close();
        streamRef.current?.getTracks().forEach(t => t.stop());
        if (analyserCleanupRef.current) analyserCleanupRef.current();
        wsRef.current = null; streamRef.current = null; analyserRef.current = null;
        setIsBotSpeaking(false); setIsRecording(false);
    }, []);
    endCallRef.current = endCall;

    const formatDuration = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`;

    const confettiPieces = showConfetti ? Array.from({ length: 50 }, (_, i) => ({
        id: i, left: Math.random() * 100, delay: Math.random() * 2,
        duration: 2 + Math.random() * 2, size: 6 + Math.random() * 6,
        color: ['#10B981', '#6366F1', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'][i % 6],
    })) : [];

    // ═════════════════════════════════════════════════════════════════
    return (
        <div style={S.page}>
            <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
            <div style={S.phoneFrame}>

                {showConfetti && (
                    <div style={S.confettiContainer}>
                        {confettiPieces.map(p => (
                            <div key={p.id} style={{
                                position: 'absolute', left: `${p.left}%`, top: '-10px',
                                width: p.size, height: p.size * 1.5, borderRadius: 2,
                                background: p.color,
                                animation: `confettiFall ${p.duration}s ${p.delay}s ease-in forwards`,
                            }} />
                        ))}
                    </div>
                )}

                <div style={{
                    ...S.aura,
                    background: isBotSpeaking
                        ? 'radial-gradient(circle, rgba(139,92,246,0.18) 0%, transparent 70%)'
                        : isRecording
                            ? 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)'
                            : 'radial-gradient(circle, rgba(99,102,241,0.04) 0%, transparent 70%)'
                }} />

                <div style={S.header}>
                    <div style={S.headerTitle}>RESTAURANT AI CALL</div>
                    <div style={S.headerSub}>
                        {callState === 'active'
                            ? `🔒 Secure Line • ${formatDuration(callDuration)}`
                            : 'Free Digital Voice Ordering'}
                    </div>
                </div>

                <div style={S.contentArea}>
                    {callState === 'idle' && !orderResult && (
                        <div style={S.idleScreen}>
                            <div style={S.avatarOuter}>
                                <div style={S.avatarInner}><span style={{ fontSize: 44 }}>👩‍💼</span></div>
                            </div>
                            <h2 style={S.idleTitle}>Eva</h2>
                            <p style={S.idleSubtitle}>Your AI Hostess</p>
                            <p style={S.idleDesc}>Tap below to start a free call. Talk naturally!</p>
                        </div>
                    )}

                    {callState === 'connecting' && (
                        <div style={S.idleScreen}>
                            <div style={S.ringingAvatar}>
                                <div style={S.ringPulse1} />
                                <div style={S.ringPulse2} />
                                <div style={S.avatarInner}><span style={{ fontSize: 44 }}>👩‍💼</span></div>
                            </div>
                            <h2 style={S.idleTitle}>Calling Eva...</h2>
                            <p style={S.idleDesc}>Setting up your voice line</p>
                        </div>
                    )}

                    {(callState === 'active' || callState === 'done' || orderResult) && (
                        <div style={S.activeDisplay}>
                            <div style={S.miniAvatarRow}>
                                <div style={{
                                    ...S.miniAvatar,
                                    borderColor: isBotSpeaking ? '#8B5CF6' : isRecording ? '#10B981' : '#334155',
                                    boxShadow: isBotSpeaking ? '0 0 20px rgba(139,92,246,0.4)' : isRecording ? '0 0 15px rgba(16,185,129,0.3)' : 'none',
                                    animation: isBotSpeaking ? 'breathe 1.5s ease-in-out infinite' : 'none',
                                }}>
                                    <span style={{ fontSize: 22 }}>👩‍💼</span>
                                </div>
                                <div style={S.callStatusInfo}>
                                    <div style={S.callStatusName}>Eva</div>
                                    <div style={S.callStatusLabel}>
                                        {isBotSpeaking ? '🔊 Speaking...' :
                                            isProcessing ? '🧠 Thinking...' :
                                                isRecording ? '🎤 Listening...' :
                                                    botState === 'done' ? '👋 Done' : '⏳ Wait...'}
                                    </div>
                                </div>
                                <div style={S.timer}>{formatDuration(callDuration)}</div>
                            </div>

                            {callState === 'active' && (
                                <div style={S.waveformContainer}>
                                    <canvas ref={canvasRef} width={350} height={50} style={S.waveformCanvas} />
                                </div>
                            )}

                            <div style={S.chatArea}>
                                {messages.map((msg, i) => (
                                    <div key={i} style={{ ...S.msgRow, justifyContent: msg.role === 'customer' ? 'flex-end' : 'flex-start' }}>
                                        <div style={msg.role === 'bot' ? S.botBubble : S.customerBubble}>
                                            {msg.role === 'bot' && <span style={S.botLabel}>Eva</span>}
                                            <span>{msg.text}</span>
                                        </div>
                                    </div>
                                ))}
                                {isProcessing && (
                                    <div style={S.msgRow}>
                                        <div style={S.botBubble}>
                                            <span style={S.botLabel}>Eva</span>
                                            <span style={S.thinking}>
                                                <span style={S.dot1}>●</span><span style={S.dot2}>●</span><span style={S.dot3}>●</span>
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div ref={chatEndRef} />
                            </div>
                        </div>
                    )}
                </div>

                {orderItems.length > 0 && !orderResult && (
                    <div style={S.orderCard}>
                        <div style={S.orderCardHeader}>
                            <span>🛒</span>
                            <span style={S.orderCardTitle}>Your Order</span>
                            <span style={S.orderCardCount}>{orderItems.reduce((s, i) => s + i.qty, 0)} items</span>
                        </div>
                        <div style={S.orderCardItems}>
                            {orderItems.map((item, i) => (
                                <div key={i} style={S.orderCardRow}>
                                    <span style={S.orderItemQty}>{item.qty}×</span>
                                    <span style={S.orderItemName}>{item.name}</span>
                                    <span style={S.orderItemPrice}>₹{(item.price * item.qty).toFixed(0)}</span>
                                </div>
                            ))}
                        </div>
                        <div style={S.orderCardTotal}>
                            <span>Total</span>
                            <span style={{ color: '#10B981', fontSize: 18 }}>₹{orderTotal.toFixed(0)}</span>
                        </div>
                    </div>
                )}

                {orderResult && (
                    <div style={S.successOverlay}>
                        <div style={S.successCard}>
                            <div style={S.successCheck}>✓</div>
                            <h3 style={{ margin: '12px 0 6px', fontSize: 20, fontWeight: 900 }}>Order Confirmed!</h3>
                            <p style={{ margin: 0, color: '#94a3b8', fontSize: 14 }}>Total ₹{orderResult.total?.toFixed(0)} • KOTs sent</p>
                            <p style={{ margin: '8px 0 0', color: '#64748b', fontSize: 12 }}>⏱ Ready in ~15-20 min</p>
                        </div>
                    </div>
                )}

                <div style={S.actionArea}>
                    {callState === 'idle' && !orderResult ? (
                        <button onClick={startCall} style={S.mainCallBtn} id="start-call-btn">
                            <div style={S.btnIconBg}><span style={{ fontSize: 24 }}>📞</span></div>
                            <div style={S.btnText}>
                                <div style={{ fontWeight: 800, fontSize: 16 }}>CALL EVA</div>
                                <div style={{ fontSize: 11, opacity: 0.6 }}>FREE • AI VOICE ORDERING</div>
                            </div>
                        </button>
                    ) : callState === 'active' ? (
                        <button onClick={endCall} style={S.endCallCircle} id="end-call-btn">
                            <span style={{ fontSize: 28, transform: 'rotate(135deg)', display: 'block' }}>📞</span>
                        </button>
                    ) : (callState === 'done' || orderResult) ? (
                        <button onClick={() => window.location.reload()} style={S.mainCallBtn} id="new-call-btn">
                            <div style={{ fontWeight: 800, width: '100%', textAlign: 'center', fontSize: 16 }}>NEW ORDER</div>
                        </button>
                    ) : null}
                </div>
            </div>

            <style>{`
                @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
                @keyframes ring1 { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.8);opacity:0} }
                @keyframes ring2 { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(2.2);opacity:0} }
                @keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
                @keyframes dotBounce1 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
                @keyframes dotBounce2 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
                @keyframes dotBounce3 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-6px)} }
            `}</style>
        </div>
    );
}

const S = {
    page: { minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#020617', fontFamily: "'Plus Jakarta Sans',sans-serif", padding: 0, overflow: 'hidden', color: '#f8fafc' },
    phoneFrame: { width: '100%', maxWidth: 450, height: '100dvh', display: 'flex', flexDirection: 'column', background: '#0F172A', position: 'relative', overflow: 'hidden' },
    confettiContainer: { position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden' },
    aura: { position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', width: '150%', height: '80%', borderRadius: '50%', pointerEvents: 'none', transition: 'background 0.8s ease', zIndex: 0 },
    header: { padding: '55px 20px 16px', textAlign: 'center', zIndex: 1 },
    headerTitle: { fontSize: 14, fontWeight: 700, color: '#94a3b8', letterSpacing: 2, textTransform: 'uppercase' },
    headerSub: { fontSize: 12, color: '#475569', marginTop: 4, fontWeight: 500 },
    contentArea: { flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, position: 'relative', minHeight: 0 },
    idleScreen: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', padding: '24px 40px' },
    avatarOuter: { width: 130, height: 130, borderRadius: 65, padding: 10, background: 'linear-gradient(135deg,rgba(99,102,241,0.15),rgba(139,92,246,0.15))', border: '1.5px solid rgba(139,92,246,0.25)', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    ringingAvatar: { position: 'relative', width: 130, height: 130, marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'center' },
    ringPulse1: { position: 'absolute', width: '100%', height: '100%', borderRadius: 65, border: '3px solid #10B981', animation: 'ring1 1.5s infinite' },
    ringPulse2: { position: 'absolute', width: '100%', height: '100%', borderRadius: 65, border: '2px solid #6366F1', animation: 'ring2 1.5s 0.3s infinite' },
    avatarInner: { width: 105, height: 105, borderRadius: 53, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 12px 40px rgba(0,0,0,0.5)', position: 'relative', zIndex: 2 },
    idleTitle: { fontSize: 32, fontWeight: 900, margin: '0 0 2px', letterSpacing: -0.5 },
    idleSubtitle: { fontSize: 14, color: '#8B5CF6', fontWeight: 600, margin: '0 0 16px' },
    idleDesc: { fontSize: 14, color: '#64748b', lineHeight: 1.7, maxWidth: 280 },
    activeDisplay: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
    miniAvatarRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 20px', background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid rgba(255,255,255,0.05)' },
    miniAvatar: { width: 44, height: 44, borderRadius: 22, background: '#1E293B', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2.5px solid transparent', transition: 'all 0.4s ease', flexShrink: 0 },
    callStatusInfo: { flex: 1 },
    callStatusName: { fontSize: 15, fontWeight: 800, color: '#f1f5f9' },
    callStatusLabel: { fontSize: 12, fontWeight: 600, color: '#64748b', marginTop: 1 },
    timer: { fontSize: 13, color: '#475569', fontFamily: 'monospace', fontWeight: 700 },
    waveformContainer: { display: 'flex', justifyContent: 'center', padding: '8px 20px', background: 'rgba(99,102,241,0.03)', borderBottom: '1px solid rgba(255,255,255,0.03)' },
    waveformCanvas: { width: '100%', maxWidth: 350, height: 50 },
    chatArea: { flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10, minHeight: 0 },
    msgRow: { display: 'flex', width: '100%' },
    botBubble: { maxWidth: '88%', padding: '10px 16px', borderRadius: '18px 18px 18px 4px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', fontSize: 14, lineHeight: 1.55, color: '#e2e8f0', display: 'flex', flexDirection: 'column', gap: 3 },
    customerBubble: { maxWidth: '85%', padding: '10px 16px', borderRadius: '18px 18px 4px 18px', background: 'linear-gradient(135deg,#6366F1,#8B5CF6)', fontSize: 14, lineHeight: 1.55, color: '#fff', boxShadow: '0 4px 15px rgba(99,102,241,0.25)' },
    botLabel: { fontSize: 11, fontWeight: 800, color: '#8B5CF6', textTransform: 'uppercase', letterSpacing: 0.5 },
    thinking: { display: 'flex', gap: 5, padding: '4px 0' },
    dot1: { color: '#8B5CF6', animation: 'dotBounce1 1.4s infinite', fontSize: 14 },
    dot2: { color: '#8B5CF6', animation: 'dotBounce2 1.4s 0.2s infinite', fontSize: 14 },
    dot3: { color: '#8B5CF6', animation: 'dotBounce3 1.4s 0.4s infinite', fontSize: 14 },
    orderCard: { margin: '0 16px', padding: 14, borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(10px)' },
    orderCardHeader: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, fontSize: 14 },
    orderCardTitle: { fontSize: 13, fontWeight: 800, color: '#e2e8f0', flex: 1 },
    orderCardCount: { fontSize: 11, fontWeight: 700, color: '#8B5CF6', background: 'rgba(139,92,246,0.15)', padding: '2px 8px', borderRadius: 10 },
    orderCardItems: { display: 'flex', flexDirection: 'column', gap: 6 },
    orderCardRow: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: '#cbd5e1' },
    orderItemQty: { width: 28, height: 22, borderRadius: 6, background: 'rgba(99,102,241,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#A5B4FC', flexShrink: 0 },
    orderItemName: { flex: 1 },
    orderItemPrice: { fontWeight: 700, color: '#94a3b8', fontSize: 12 },
    orderCardTotal: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 10, fontWeight: 900, fontSize: 14 },
    successOverlay: { position: 'absolute', inset: 0, background: 'rgba(2,6,23,0.85)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 15, padding: 30 },
    successCard: { background: '#1E293B', padding: '30px 24px', borderRadius: 24, textAlign: 'center', border: '1px solid rgba(16,185,129,0.3)', width: '100%', boxShadow: '0 20px 60px rgba(0,0,0,0.5)' },
    successCheck: { width: 64, height: 64, borderRadius: 32, background: 'linear-gradient(135deg,#10B981,#059669)', color: '#fff', fontSize: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto', boxShadow: '0 8px 30px rgba(16,185,129,0.4)' },
    actionArea: { padding: '16px 20px 45px', display: 'flex', justifyContent: 'center', zIndex: 2 },
    mainCallBtn: { width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 12px 12px 20px', borderRadius: 50, border: 'none', background: '#fff', color: '#020617', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 8px 30px rgba(255,255,255,0.1)' },
    btnIconBg: { width: 50, height: 50, borderRadius: 25, background: 'linear-gradient(135deg,#10B981,#059669)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', boxShadow: '0 4px 15px rgba(16,185,129,0.4)' },
    btnText: { textAlign: 'left', flex: 1, color: '#0F172A' },
    endCallCircle: { width: 70, height: 70, borderRadius: 35, border: 'none', background: 'linear-gradient(135deg,#EF4444,#DC2626)', color: '#fff', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 10px 30px rgba(239,68,68,0.4)' },
};
