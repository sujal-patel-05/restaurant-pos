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

    const SILENCE_THRESHOLD = 12;  // Lower → catches softer/quieter voices
    const SILENCE_FRAMES = 15;     // 15 × 100ms = 1.5s — gives natural pause time
    const MIN_SPEECH_SIZE = 2500;  // Lower → catches short commands like "ek chai"

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

    // ── Save / Print Chat ────────────────────────────────────────────
    const saveChat = useCallback(() => {
        if (messages.length === 0) return;
        const now = new Date();
        const ts = `${now.toLocaleDateString('en-IN')} ${now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;

        const msgsHtml = messages.map(m => {
            if (m.role === 'bot') {
                return `
                <div style="display:flex;justify-content:flex-start;">
                  <div style="max-width:82%;padding:14px 18px;border-radius:20px 20px 20px 6px;
                    background:rgba(255,255,255,0.06);border:1px solid rgba(139,92,246,0.12);
                    font-size:15px;line-height:1.6;color:#e2e8f0;display:flex;flex-direction:column;gap:4px;">
                    <span style="font-size:11px;font-weight:800;text-transform:uppercase;letter-spacing:1px;
                      background:linear-gradient(135deg,#A78BFA,#818CF8);
                      -webkit-background-clip:text;-webkit-text-fill-color:transparent;">Eva</span>
                    <span>${m.text}</span>
                  </div>
                </div>`;
            } else {
                return `
                <div style="display:flex;justify-content:flex-end;">
                  <div style="max-width:82%;padding:14px 18px;border-radius:20px 20px 6px 20px;
                    background:linear-gradient(135deg,#6366F1 0%,#8B5CF6 50%,#A855F7 100%);
                    font-size:15px;line-height:1.6;color:#fff;
                    box-shadow:0 6px 24px rgba(99,102,241,0.35);">
                    <span>${m.text}</span>
                  </div>
                </div>`;
            }
        }).join('');

        let orderHtml = '';
        if (orderItems.length > 0) {
            const total = orderResult?.total || orderItems.reduce((s, i) => s + i.price * i.qty, 0);
            orderHtml = `
            <div style="margin:20px 0;padding:18px;border-radius:20px;background:rgba(255,255,255,0.04);
              border:1px solid rgba(139,92,246,0.15);">
              <div style="font-weight:800;font-size:14px;color:#e2e8f0;margin-bottom:10px;">🛒 Order Summary</div>
              ${orderItems.map(i => `
                <div style="display:flex;align-items:center;gap:10px;padding:4px 0;font-size:14px;color:#cbd5e1;">
                  <span style="width:30px;height:24px;border-radius:8px;background:rgba(99,102,241,0.15);
                    display:flex;align-items:center;justify-content:center;font-size:12px;
                    font-weight:800;color:#A5B4FC;flex-shrink:0">${i.qty}×</span>
                  <span style="flex:1">${i.name}</span>
                  <span style="font-weight:700;color:#94a3b8;font-size:13px">₹${(i.price * i.qty).toFixed(0)}</span>
                </div>
              `).join('')}
              <div style="display:flex;justify-content:space-between;border-top:1px solid rgba(139,92,246,0.12);
                padding-top:12px;margin-top:12px;font-weight:900;font-size:16px;color:#e2e8f0;">
                <span>Total</span>
                <span style="color:#10B981">₹${total.toFixed?.(0) || total}</span>
              </div>
            </div>`;
        }

        const html = `<!DOCTYPE html>
<html><head>
  <title>Eva Conversation — ${ts}</title>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @media print { body { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }
    * { margin:0; padding:0; box-sizing:border-box; }
  </style>
</head><body style="background:linear-gradient(135deg,#0a0118 0%,#0d1224 40%,#0c0a1e 100%);
  font-family:'Plus Jakarta Sans',-apple-system,sans-serif;color:#f8fafc;min-height:100vh;padding:0;">
  <div style="max-width:520px;margin:0 auto;padding:24px 20px;">
    <div style="text-align:center;padding:16px 0 20px;border-bottom:1px solid rgba(139,92,246,0.1);margin-bottom:20px;">
      <div style="font-size:13px;font-weight:800;letter-spacing:3px;text-transform:uppercase;
        background:linear-gradient(135deg,#A78BFA,#818CF8);
        -webkit-background-clip:text;-webkit-text-fill-color:transparent;">RESTAURANT AI CALL</div>
      <div style="font-size:24px;font-weight:900;margin:12px 0 4px;">🤖 Eva — AI Hostess</div>
      <div style="font-size:13px;color:#64748b;">${ts} • Table ${tableId || 'T1'}${callDuration ? ` • Duration: ${formatDuration(callDuration)}` : ''}</div>
    </div>
    <div style="display:flex;flex-direction:column;gap:14px;">
      ${msgsHtml}
    </div>
    ${orderHtml}
    <div style="text-align:center;padding:20px 0 0;border-top:1px solid rgba(139,92,246,0.08);margin-top:20px;">
      <div style="font-size:12px;color:#475569;">Generated by 5ive POS • Eva Voice Bot</div>
    </div>
  </div>
</body></html>`;

        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
            // Auto-trigger print after a small delay
            setTimeout(() => win.print(), 600);
        }
    }, [messages, orderItems, orderResult, tableId, callDuration, formatDuration]);


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
                                {messages.length > 0 && (
                                    <button onClick={saveChat} style={S.saveChatBtn} title="Save / Print Chat">
                                        💾
                                    </button>
                                )}
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
                        <div style={{ display: 'flex', gap: 10, width: '100%' }}>
                            <button onClick={() => window.location.reload()} style={{ ...S.mainCallBtn, flex: 1 }} id="new-call-btn">
                                <div style={{ fontWeight: 800, width: '100%', textAlign: 'center', fontSize: 16 }}>NEW ORDER</div>
                            </button>
                            {messages.length > 0 && (
                                <button onClick={saveChat} style={S.saveChatBtnLarge} title="Save / Print Chat">
                                    💾 Save Chat
                                </button>
                            )}
                        </div>
                    ) : null}
                </div>
            </div>

            <style>{`
                @keyframes breathe { 0%,100%{transform:scale(1)} 50%{transform:scale(1.08)} }
                @keyframes ring1 { 0%{transform:scale(1);opacity:0.6} 100%{transform:scale(1.8);opacity:0} }
                @keyframes ring2 { 0%{transform:scale(1);opacity:0.4} 100%{transform:scale(2.2);opacity:0} }
                @keyframes confettiFall { 0%{transform:translateY(0) rotate(0deg);opacity:1} 100%{transform:translateY(100vh) rotate(720deg);opacity:0} }
                @keyframes dotBounce1 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
                @keyframes dotBounce2 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
                @keyframes dotBounce3 { 0%,80%,100%{transform:translateY(0)} 40%{transform:translateY(-8px)} }
                @keyframes fadeSlideUp {
                    from { opacity:0; transform:translateY(12px) }
                    to   { opacity:1; transform:translateY(0) }
                }
                /* Premium scrollbar */
                ::-webkit-scrollbar { width: 5px }
                ::-webkit-scrollbar-track { background: transparent }
                ::-webkit-scrollbar-thumb { background: rgba(139,92,246,0.2); border-radius: 10px }
                ::-webkit-scrollbar-thumb:hover { background: rgba(139,92,246,0.35) }
            `}</style>
        </div>
    );
}

const S = {
    // ── Page & Frame ──────────────────────────────────────────────────────
    page: {
        minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(135deg, #0a0118 0%, #0d1224 40%, #0c0a1e 100%)',
        fontFamily: "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif",
        padding: 0, overflow: 'hidden', color: '#f8fafc',
    },
    phoneFrame: {
        width: '100%', maxWidth: 520, height: '100dvh',
        display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(180deg, rgba(15,23,42,0.97) 0%, rgba(10,10,30,0.98) 100%)',
        position: 'relative', overflow: 'hidden',
        borderLeft: '1px solid rgba(139,92,246,0.08)',
        borderRight: '1px solid rgba(139,92,246,0.08)',
    },
    confettiContainer: { position: 'absolute', inset: 0, zIndex: 20, pointerEvents: 'none', overflow: 'hidden' },
    aura: {
        position: 'absolute', top: '50%', left: '50%',
        transform: 'translate(-50%,-50%)', width: '160%', height: '90%',
        borderRadius: '50%', pointerEvents: 'none',
        transition: 'background 1s cubic-bezier(0.4,0,0.2,1)', zIndex: 0, filter: 'blur(60px)',
    },

    // ── Header ────────────────────────────────────────────────────────────
    header: {
        padding: '20px 24px 16px', textAlign: 'center', zIndex: 1,
        background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
    },
    headerTitle: {
        fontSize: 13, fontWeight: 800, letterSpacing: 3,
        textTransform: 'uppercase',
        background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    headerSub: { fontSize: 12, color: '#64748b', marginTop: 5, fontWeight: 500, letterSpacing: 0.5 },

    // ── Content ───────────────────────────────────────────────────────────
    contentArea: { flex: 1, display: 'flex', flexDirection: 'column', zIndex: 1, position: 'relative', minHeight: 0 },

    // ── Idle / Welcome Screen ─────────────────────────────────────────────
    idleScreen: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '32px 44px',
    },
    avatarOuter: {
        width: 140, height: 140, borderRadius: 70, padding: 12,
        background: 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(168,85,247,0.2))',
        border: '2px solid rgba(139,92,246,0.3)',
        marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 0 40px rgba(139,92,246,0.15), 0 0 80px rgba(99,102,241,0.08)',
    },
    ringingAvatar: {
        position: 'relative', width: 140, height: 140,
        marginBottom: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
    },
    ringPulse1: { position: 'absolute', width: '100%', height: '100%', borderRadius: 70, border: '3px solid #10B981', animation: 'ring1 1.5s infinite' },
    ringPulse2: { position: 'absolute', width: '100%', height: '100%', borderRadius: 70, border: '2px solid #8B5CF6', animation: 'ring2 1.5s 0.3s infinite' },
    avatarInner: {
        width: 110, height: 110, borderRadius: 55,
        background: 'linear-gradient(160deg, #1E293B, #1a1a3e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 16px 48px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.05)',
        position: 'relative', zIndex: 2,
    },
    idleTitle: {
        fontSize: 36, fontWeight: 900, margin: '0 0 4px', letterSpacing: -0.8,
        background: 'linear-gradient(135deg, #f8fafc, #cbd5e1)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    idleSubtitle: {
        fontSize: 15, fontWeight: 700, margin: '0 0 20px', letterSpacing: 1,
        background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    idleDesc: { fontSize: 15, color: '#94a3b8', lineHeight: 1.8, maxWidth: 300, letterSpacing: 0.2 },

    // ── Active Call Display ───────────────────────────────────────────────
    activeDisplay: { flex: 1, display: 'flex', flexDirection: 'column', minHeight: 0 },
    miniAvatarRow: {
        display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 24px',
        background: 'rgba(15,23,42,0.7)', backdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(139,92,246,0.1)',
    },
    miniAvatar: {
        width: 48, height: 48, borderRadius: 24,
        background: 'linear-gradient(160deg, #1E293B, #1a1a3e)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        border: '2.5px solid transparent', transition: 'all 0.5s cubic-bezier(0.4,0,0.2,1)',
        flexShrink: 0,
    },
    callStatusInfo: { flex: 1 },
    callStatusName: { fontSize: 16, fontWeight: 800, color: '#f1f5f9', letterSpacing: -0.2 },
    callStatusLabel: { fontSize: 13, fontWeight: 600, color: '#818CF8', marginTop: 2 },
    timer: {
        fontSize: 14, fontFamily: "'JetBrains Mono', monospace", fontWeight: 700,
        color: '#64748b', background: 'rgba(255,255,255,0.04)',
        padding: '4px 10px', borderRadius: 8,
    },

    // ── Waveform ──────────────────────────────────────────────────────────
    waveformContainer: {
        display: 'flex', justifyContent: 'center',
        padding: '10px 24px',
        background: 'rgba(99,102,241,0.03)',
        borderBottom: '1px solid rgba(139,92,246,0.06)',
    },
    waveformCanvas: { width: '100%', maxWidth: 420, height: 55 },

    // ── Chat ──────────────────────────────────────────────────────────────
    chatArea: {
        flex: 1, overflowY: 'auto', padding: '20px 24px',
        display: 'flex', flexDirection: 'column', gap: 14,
        minHeight: 0,
    },
    msgRow: { display: 'flex', width: '100%', animation: 'fadeSlideUp 0.35s ease-out' },
    botBubble: {
        maxWidth: '85%', padding: '14px 18px',
        borderRadius: '20px 20px 20px 6px',
        background: 'rgba(255,255,255,0.06)',
        border: '1px solid rgba(139,92,246,0.12)',
        backdropFilter: 'blur(10px)',
        fontSize: 15, lineHeight: 1.6, color: '#e2e8f0',
        display: 'flex', flexDirection: 'column', gap: 4,
        boxShadow: '0 4px 16px rgba(0,0,0,0.15)',
    },
    customerBubble: {
        maxWidth: '82%', padding: '14px 18px',
        borderRadius: '20px 20px 6px 20px',
        background: 'linear-gradient(135deg, #6366F1 0%, #8B5CF6 50%, #A855F7 100%)',
        fontSize: 15, lineHeight: 1.6, color: '#fff',
        boxShadow: '0 6px 24px rgba(99,102,241,0.35), 0 2px 8px rgba(139,92,246,0.2)',
    },
    botLabel: {
        fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: 1,
        background: 'linear-gradient(135deg, #A78BFA, #818CF8)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    },
    thinking: { display: 'flex', gap: 6, padding: '5px 0' },
    dot1: { color: '#A78BFA', animation: 'dotBounce1 1.4s infinite', fontSize: 16 },
    dot2: { color: '#A78BFA', animation: 'dotBounce2 1.4s 0.2s infinite', fontSize: 16 },
    dot3: { color: '#A78BFA', animation: 'dotBounce3 1.4s 0.4s infinite', fontSize: 16 },

    // ── Order Card ────────────────────────────────────────────────────────
    orderCard: {
        margin: '0 20px', padding: 18, borderRadius: 20,
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(139,92,246,0.15)',
        backdropFilter: 'blur(16px)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.2)',
    },
    orderCardHeader: { display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12, fontSize: 15 },
    orderCardTitle: { fontSize: 14, fontWeight: 800, color: '#e2e8f0', flex: 1, letterSpacing: 0.2 },
    orderCardCount: {
        fontSize: 12, fontWeight: 700, color: '#A78BFA',
        background: 'rgba(139,92,246,0.15)', padding: '3px 10px', borderRadius: 12,
    },
    orderCardItems: { display: 'flex', flexDirection: 'column', gap: 8 },
    orderCardRow: {
        display: 'flex', alignItems: 'center', gap: 10,
        fontSize: 14, color: '#cbd5e1',
        padding: '4px 0',
    },
    orderItemQty: {
        width: 30, height: 24, borderRadius: 8,
        background: 'rgba(99,102,241,0.15)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 12, fontWeight: 800, color: '#A5B4FC', flexShrink: 0,
    },
    orderItemName: { flex: 1, fontWeight: 500 },
    orderItemPrice: { fontWeight: 700, color: '#94a3b8', fontSize: 13 },
    orderCardTotal: {
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        borderTop: '1px solid rgba(139,92,246,0.12)',
        paddingTop: 12, marginTop: 12, fontWeight: 900, fontSize: 16,
    },

    // ── Success ───────────────────────────────────────────────────────────
    successOverlay: {
        position: 'absolute', inset: 0,
        background: 'rgba(2,6,23,0.88)', backdropFilter: 'blur(12px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 15, padding: 32,
    },
    successCard: {
        background: 'linear-gradient(160deg, #1E293B, #1a1a3e)',
        padding: '36px 28px', borderRadius: 28, textAlign: 'center',
        border: '1px solid rgba(16,185,129,0.25)', width: '100%',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 40px rgba(16,185,129,0.1)',
    },
    successCheck: {
        width: 72, height: 72, borderRadius: 36,
        background: 'linear-gradient(135deg, #10B981, #059669)',
        color: '#fff', fontSize: 36, display: 'flex', alignItems: 'center', justifyContent: 'center',
        margin: '0 auto',
        boxShadow: '0 10px 40px rgba(16,185,129,0.4), 0 0 20px rgba(16,185,129,0.2)',
    },

    // ── Action Area ───────────────────────────────────────────────────────
    actionArea: { padding: '18px 24px 40px', display: 'flex', justifyContent: 'center', zIndex: 2 },
    mainCallBtn: {
        width: '100%', display: 'flex', alignItems: 'center', gap: 16,
        padding: '14px 14px 14px 22px', borderRadius: 60,
        border: 'none',
        background: 'linear-gradient(135deg, #f8fafc 0%, #e2e8f0 100%)',
        color: '#020617', cursor: 'pointer',
        transition: 'all 0.3s cubic-bezier(0.4,0,0.2,1)',
        boxShadow: '0 10px 40px rgba(255,255,255,0.12), 0 0 0 1px rgba(255,255,255,0.1)',
    },
    btnIconBg: {
        width: 54, height: 54, borderRadius: 27,
        background: 'linear-gradient(135deg, #10B981, #059669)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        color: '#fff',
        boxShadow: '0 6px 20px rgba(16,185,129,0.4)',
    },
    btnText: { textAlign: 'left', flex: 1, color: '#0F172A' },
    endCallCircle: {
        width: 72, height: 72, borderRadius: 36,
        border: 'none',
        background: 'linear-gradient(135deg, #EF4444, #DC2626)',
        color: '#fff', cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 12px 40px rgba(239,68,68,0.4), 0 0 20px rgba(239,68,68,0.15)',
        transition: 'all 0.3s ease',
    },
    saveChatBtn: {
        width: 40, height: 40, borderRadius: 12,
        background: 'rgba(139,92,246,0.12)', border: '1px solid rgba(139,92,246,0.2)',
        color: '#A78BFA', fontSize: 18, cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        transition: 'all 0.2s ease', flexShrink: 0,
    },
    saveChatBtnLarge: {
        padding: '14px 20px', borderRadius: 60,
        background: 'rgba(139,92,246,0.15)', border: '1px solid rgba(139,92,246,0.25)',
        color: '#A78BFA', fontSize: 14, fontWeight: 700, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 8,
        transition: 'all 0.2s ease', whiteSpace: 'nowrap',
    },
};
