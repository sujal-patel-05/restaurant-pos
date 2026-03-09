import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

/* ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ config ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const API = (() => {
    if (typeof window !== 'undefined' && window.location.hostname)
        return `http://${window.location.hostname}:8000`;
    return 'http://127.0.0.1:8000';
})();

/* ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ helpers ΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇΓöÇ */
const api = (path, opts = {}) => {
    const token = sessionStorage.getItem('customer_token');
    const headers = { ...(opts.headers || {}) };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    if (!(opts.body instanceof FormData)) headers['Content-Type'] = 'application/json';
    return fetch(`${API}${path}`, { ...opts, headers });
};

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   MAIN COMPONENT ΓÇö Orchestrates 5 screens
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
export default function TableVoiceOrder() {
    const { tableId } = useParams();
    const [screen, setScreen] = useState('loading');   // loading | home | confirm | success | orders
    const [session, setSession] = useState(null);
    const [error, setError] = useState('');

    /* voice result state */
    const [voiceResult, setVoiceResult] = useState(null);
    const [confirmedOrder, setConfirmedOrder] = useState(null);

    /* ΓöÇΓöÇ Start / Resume session ΓöÇΓöÇ */
    useEffect(() => {
        (async () => {
            try {
                const fd = new FormData();
                fd.append('table_id', tableId || 'T3');
                const res = await fetch(`${API}/api/customer/session/start`, { method: 'POST', body: fd });
                const data = await res.json();
                if (!res.ok) throw new Error(data.detail || 'Failed to start session');
                sessionStorage.setItem('customer_token', data.token);
                setSession(data);
                setScreen('home');
            } catch (e) {
                setError(e.message);
                setScreen('error');
            }
        })();
    }, [tableId]);

    if (screen === 'loading') return <LoadingScreen />;
    if (screen === 'error') return <ErrorScreen message={error} />;
    if (screen === 'home')
        return <HomeScreen session={session} onResult={(r) => { setVoiceResult(r); setScreen('confirm'); }} onOrders={() => setScreen('orders')} />;
    if (screen === 'confirm')
        return <ConfirmScreen result={voiceResult} session={session} onBack={() => setScreen('home')} onSuccess={(o) => { setConfirmedOrder(o); setScreen('success'); }} />;
    if (screen === 'success')
        return <SuccessScreen order={confirmedOrder} onMore={() => setScreen('home')} onOrders={() => setScreen('orders')} />;
    if (screen === 'orders')
        return <OrdersScreen session={session} onBack={() => setScreen('home')} />;
    return null;
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   SCREEN 1 ΓÇö Loading
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
function LoadingScreen() {
    return (
        <div style={S.page}>
            <div style={S.center}>
                <div style={S.spinner} />
                <h2 style={{ color: '#fff', marginTop: 24 }}>SujalPOS</h2>
                <p style={{ color: 'rgba(255,255,255,0.5)' }}>Setting up your table...</p>
            </div>
            <style>{spinnerCSS}</style>
        </div>
    );
}

function ErrorScreen({ message }) {
    return (
        <div style={S.page}>
            <div style={S.center}>
                <div style={{ fontSize: 64 }}>ΓÜá∩╕Å</div>
                <h2 style={{ color: '#fff', marginTop: 16 }}>Something went wrong</h2>
                <p style={{ color: '#f87171', maxWidth: 300, textAlign: 'center' }}>{message}</p>
                <p style={{ color: 'rgba(255,255,255,0.4)', marginTop: 24 }}>Please ask a staff member for help.</p>
            </div>
        </div>
    );
}

/* ΓöÇΓöÇ WAV Encoder: converts raw PCM Float32 samples ΓåÆ WAV Blob ΓöÇΓöÇ */
function encodeWAV(samples, sampleRate) {
    // Downsample to 16kHz for Whisper
    const targetRate = 16000;
    let finalSamples = samples;
    if (sampleRate !== targetRate) {
        const ratio = sampleRate / targetRate;
        const newLen = Math.round(samples.length / ratio);
        finalSamples = new Float32Array(newLen);
        for (let i = 0; i < newLen; i++) {
            finalSamples[i] = samples[Math.round(i * ratio)];
        }
    }
    const buffer = new ArrayBuffer(44 + finalSamples.length * 2);
    const view = new DataView(buffer);
    const writeStr = (o, s) => { for (let i = 0; i < s.length; i++) view.setUint8(o + i, s.charCodeAt(i)); };
    writeStr(0, 'RIFF');
    view.setUint32(4, 36 + finalSamples.length * 2, true);
    writeStr(8, 'WAVE');
    writeStr(12, 'fmt ');
    view.setUint32(16, 16, true);
    view.setUint16(20, 1, true);      // PCM
    view.setUint16(22, 1, true);      // mono
    view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true);
    view.setUint16(32, 2, true);
    view.setUint16(34, 16, true);     // 16-bit
    writeStr(36, 'data');
    view.setUint32(40, finalSamples.length * 2, true);
    for (let i = 0; i < finalSamples.length; i++) {
        const s = Math.max(-1, Math.min(1, finalSamples[i]));
        view.setInt16(44 + i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    return new Blob([buffer], { type: 'audio/wav' });
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   SCREEN 2 ΓÇö Home / Mic  (records WAV directly for reliable Whisper)
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
function HomeScreen({ session, onResult, onOrders }) {
    const [recording, setRecording] = useState(false);
    const [phase, setPhase] = useState('idle');
    const [err, setErr] = useState('');
    const [transcript, setTranscript] = useState('');
    const [liveText, setLiveText] = useState('');
    const audioCtxRef = useRef(null);
    const sourceRef = useRef(null);
    const processorRef = useRef(null);
    const samplesRef = useRef([]);
    const streamRef = useRef(null);
    const recognitionRef = useRef(null);

    // Start browser SpeechRecognition for live preview
    const startLivePreview = useCallback(() => {
        try {
            const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SR) return;
            const recognition = new SR();
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.lang = 'en-IN';
            recognition.onresult = (e) => {
                let interim = '';
                for (let i = e.resultIndex; i < e.results.length; i++) {
                    interim += e.results[i][0].transcript;
                }
                setLiveText(interim);
            };
            recognition.onerror = () => { };
            recognition.start();
            recognitionRef.current = recognition;
        } catch (e) { }
    }, []);

    const stopLivePreview = useCallback(() => {
        if (recognitionRef.current) {
            try { recognitionRef.current.stop(); } catch (e) { }
            recognitionRef.current = null;
        }
    }, []);

    const startRecording = useCallback(async () => {
        setErr('');
        setLiveText('');
        setTranscript('');
        samplesRef.current = [];
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, sampleRate: 16000 }
            });
            streamRef.current = stream;

            const ctx = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
            audioCtxRef.current = ctx;
            const source = ctx.createMediaStreamSource(stream);
            sourceRef.current = source;

            // Use ScriptProcessorNode to capture raw PCM
            const processor = ctx.createScriptProcessor(4096, 1, 1);
            processorRef.current = processor;
            processor.onaudioprocess = (e) => {
                const data = e.inputBuffer.getChannelData(0);
                samplesRef.current.push(new Float32Array(data));
            };
            source.connect(processor);
            processor.connect(ctx.destination);

            setRecording(true);
            startLivePreview();

            // Auto-stop after 15 seconds
            setTimeout(() => {
                if (streamRef.current && streamRef.current.active) {
                    doStopRecording();
                }
            }, 15000);
        } catch (e) {
            setErr('Microphone access denied. Please allow microphone access.');
        }
    }, [startLivePreview]);

    const doStopRecording = useCallback(() => {
        stopLivePreview();
        setRecording(false);

        // Disconnect audio nodes
        if (processorRef.current) {
            processorRef.current.disconnect();
            processorRef.current = null;
        }
        if (sourceRef.current) {
            sourceRef.current.disconnect();
            sourceRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(t => t.stop());
            streamRef.current = null;
        }

        const sampleRate = audioCtxRef.current?.sampleRate || 16000;
        if (audioCtxRef.current) {
            audioCtxRef.current.close().catch(() => { });
            audioCtxRef.current = null;
        }

        // Merge all collected PCM chunks
        const chunks = samplesRef.current;
        if (chunks.length === 0) {
            setErr('No audio captured. Please try again.');
            return;
        }
        const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
        const merged = new Float32Array(totalLen);
        let offset = 0;
        for (const chunk of chunks) {
            merged.set(chunk, offset);
            offset += chunk.length;
        }
        samplesRef.current = [];

        // Check duration (need at least 0.5 seconds)
        const durationSec = totalLen / sampleRate;
        if (durationSec < 0.5) {
            setErr('Recording too short. Hold the button and speak for at least 1-2 seconds.');
            return;
        }

        // Encode to WAV and send
        const wavBlob = encodeWAV(merged, sampleRate);
        console.log(`[VOICE] WAV blob: ${wavBlob.size} bytes, duration: ${durationSec.toFixed(1)}s, sampleRate: ${sampleRate}`);
        sendAudio(wavBlob);
    }, [stopLivePreview]);

    const stopRecording = useCallback(() => {
        if (recording) doStopRecording();
    }, [recording, doStopRecording]);

    const sendAudio = async (blob) => {
        setPhase('transcribing');
        setErr('');
        try {
            const fd = new FormData();
            fd.append('audio', blob, 'order.wav');
            const res = await api('/api/customer/voice-order', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Processing failed');
            if (data.error) { setErr(data.error); setPhase('idle'); return; }

            // Show the Whisper transcript prominently
            setTranscript(data.transcript || '');
            setPhase('showingTranscript');

            if (!data.items || data.items.length === 0) {
                await new Promise(r => setTimeout(r, 2000));
                setErr('No menu items matched. Please try again.');
                setPhase('idle');
                return;
            }

            // Show transcript for 2.5 seconds
            await new Promise(r => setTimeout(r, 2500));
            setPhase('matching');

            await new Promise(r => setTimeout(r, 800));
            onResult(data);
            setPhase('idle');
        } catch (e) {
            setErr(e.message);
            setPhase('idle');
        }
    };

    const isProcessing = phase !== 'idle';

    return (
        <div style={S.page}>
            <div style={{ padding: '24px 20px', textAlign: 'center' }}>
                <h1 style={{ color: '#fff', fontSize: 20, fontWeight: 600, margin: 0 }}>SujalPOS</h1>
                <div style={{ ...S.badge, marginTop: 8 }}>Table {session?.table_number || session?.table_id}</div>
            </div>

            <div style={S.center}>
                {/* ΓöÇΓöÇ Phase: Transcribing ΓöÇΓöÇ */}
                {phase === 'transcribing' && (
                    <>
                        <div style={S.spinner} />
                        <h2 style={{ color: '#fff', marginTop: 24, fontSize: 20 }}>≡ƒÄº Transcribing your speech...</h2>
                        <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: 14 }}>Processing with Whisper AI</p>
                        {liveText && (
                            <div style={{ ...S.transcriptBox, marginTop: 20 }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Preview</span>
                                <p style={{ color: 'rgba(255,255,255,0.6)', margin: '6px 0 0', fontSize: 16, fontStyle: 'italic' }}>"{liveText}"</p>
                            </div>
                        )}
                    </>
                )}

                {/* ΓöÇΓöÇ Phase: Showing Whisper transcript ΓöÇΓöÇ */}
                {phase === 'showingTranscript' && (
                    <>
                        <div style={{ fontSize: 48, marginBottom: 12 }}>≡ƒùú∩╕Å</div>
                        <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 2, marginBottom: 8 }}>Whisper heard you say</div>
                        <div style={S.transcriptReveal}>
                            <span style={{ fontSize: 22, fontWeight: 600, color: '#fff', lineHeight: 1.5 }}>
                                "{transcript}"
                            </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 20 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', animation: 'pulse-dot 1s ease-in-out infinite' }} />
                            <span style={{ color: '#22c55e', fontSize: 14, fontWeight: 500 }}>Matching to menu items...</span>
                        </div>
                    </>
                )}

                {/* ΓöÇΓöÇ Phase: Matching to menu ΓöÇΓöÇ */}
                {phase === 'matching' && (
                    <>
                        <div style={S.spinner} />
                        <h2 style={{ color: '#fff', marginTop: 24, fontSize: 18 }}>≡ƒöì Finding your items on the menu...</h2>
                        <div style={{ ...S.transcriptBox, marginTop: 16, opacity: 0.7 }}>
                            <p style={{ color: 'rgba(255,255,255,0.5)', margin: 0, fontSize: 14 }}>"{transcript}"</p>
                        </div>
                    </>
                )}

                {/* ΓöÇΓöÇ Phase: Idle (mic button) ΓöÇΓöÇ */}
                {phase === 'idle' && !recording && (
                    <>
                        <button
                            onMouseDown={startRecording}
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            onTouchStart={(e) => { e.preventDefault(); startRecording(); }}
                            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                            style={{
                                ...S.micBtn,
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                            }}
                        >
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </button>

                        <p style={{ color: '#fff', fontSize: 18, fontWeight: 500, marginTop: 28 }}>
                            Press and hold to speak your order
                        </p>
                        <p style={{ color: 'rgba(255,255,255,0.35)', fontSize: 14, marginTop: 8 }}>
                            Try: "One aloo tikki burger and two cokes"
                        </p>
                    </>
                )}

                {/* ΓöÇΓöÇ Recording active ΓöÇΓöÇ */}
                {recording && (
                    <>
                        <button
                            onMouseUp={stopRecording}
                            onMouseLeave={stopRecording}
                            onTouchEnd={(e) => { e.preventDefault(); stopRecording(); }}
                            style={{
                                ...S.micBtn,
                                background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                                animation: 'pulse 1s ease-in-out infinite',
                            }}
                        >
                            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                                <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                <line x1="12" y1="19" x2="12" y2="23" />
                                <line x1="8" y1="23" x2="16" y2="23" />
                            </svg>
                        </button>

                        {/* Waveform animation */}
                        <div style={{ display: 'flex', gap: 4, marginTop: 24, height: 40, alignItems: 'center' }}>
                            {[...Array(12)].map((_, i) => (
                                <div key={i} style={{
                                    width: 4, borderRadius: 2, background: '#ef4444',
                                    animation: `wave 0.8s ease-in-out ${i * 0.08}s infinite alternate`,
                                }} />
                            ))}
                        </div>

                        <p style={{ color: '#ef4444', fontSize: 18, fontWeight: 600, marginTop: 16 }}>
                            ≡ƒö┤ Listening... release when done
                        </p>

                        {/* Live browser speech preview */}
                        {liveText && (
                            <div style={{ ...S.transcriptBox, marginTop: 16, maxWidth: 340 }}>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1 }}>Live preview</span>
                                <p style={{ color: '#fff', margin: '6px 0 0', fontSize: 16 }}>"{liveText}"</p>
                            </div>
                        )}
                    </>
                )}

                {err && (
                    <div style={{ ...S.errorBox, marginTop: 24, maxWidth: 340 }}>
                        {err}
                    </div>
                )}
            </div>

            {/* View Orders link */}
            {!isProcessing && !recording && (
                <div style={{ padding: 24, textAlign: 'center' }}>
                    <button onClick={onOrders} style={S.linkBtn}>View My Orders</button>
                </div>
            )}

            <style>{`${spinnerCSS}\n${pulseCSS}\n${waveCss}\n${pulseDotCss}`}</style>
        </div>
    );
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   SCREEN 3 ΓÇö Confirmation
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
function ConfirmScreen({ result, session, onBack, onSuccess }) {
    const [items, setItems] = useState(result?.items || []);
    const [loading, setLoading] = useState(false);
    const [err, setErr] = useState('');

    const updateQty = (idx, delta) => {
        setItems(prev => prev.map((it, i) => i === idx ? { ...it, qty: Math.max(0, it.qty + delta), total: Math.round(Math.max(0, it.qty + delta) * it.price * 100) / 100 } : it).filter(it => it.qty > 0));
    };

    const removeItem = (idx) => {
        setItems(prev => prev.filter((_, i) => i !== idx));
    };

    const subtotal = items.reduce((s, it) => s + it.total, 0);
    const gst = Math.round(subtotal * 0.05 * 100) / 100;
    const total = Math.round((subtotal + gst) * 100) / 100;
    const hasLow = items.some(it => it.confidence_label === 'LOW');
    const wasEdited = JSON.stringify(items) !== JSON.stringify(result?.items);

    const placeOrder = async () => {
        if (items.length === 0) return;
        setLoading(true);
        setErr('');
        try {
            const fd = new FormData();
            fd.append('log_id', result.log_id);
            fd.append('final_items', JSON.stringify(items));
            fd.append('was_edited', wasEdited);
            const res = await api('/api/customer/confirm-order', { method: 'POST', body: fd });
            const data = await res.json();
            if (!res.ok) throw new Error(data.detail || 'Failed to place order');
            onSuccess(data);
        } catch (e) {
            setErr(e.message);
        } finally {
            setLoading(false);
        }
    };

    const confColor = (label) => label === 'HIGH' ? '#22c55e' : label === 'MEDIUM' ? '#eab308' : '#ef4444';

    return (
        <div style={S.page}>
            <div style={{ padding: '20px 20px 0' }}>
                <button onClick={onBack} style={S.backBtn}>ΓåÉ Back</button>
                <h2 style={{ color: '#fff', margin: '12px 0 4px', fontSize: 20 }}>Confirm Your Order</h2>

                {/* Transcript */}
                <div style={{ ...S.card, padding: '12px 16px', marginBottom: 12, background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.2)' }}>
                    <span style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>You said:</span>
                    <p style={{ color: '#fff', margin: '4px 0 0', fontSize: 14 }}>"{result?.transcript}"</p>
                </div>

                {hasLow && (
                    <div style={{ ...S.errorBox, marginBottom: 12, fontSize: 13 }}>
                        ΓÜá∩╕Å Some items may not be correct ΓÇö please review
                    </div>
                )}
            </div>

            {/* Items */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 20px' }}>
                {items.map((item, idx) => (
                    <div key={idx} style={{ ...S.card, marginBottom: 10, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                            <div style={{ flex: 1 }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                                    <div style={{ width: 10, height: 10, borderRadius: '50%', background: confColor(item.confidence_label), flexShrink: 0 }} />
                                    <span style={{ color: '#fff', fontWeight: 600, fontSize: 15 }}>{item.name}</span>
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 12 }}>{item.category}</span>
                                {item.original_speech !== item.name && (
                                    <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 11, marginTop: 2, fontStyle: 'italic' }}>
                                        Heard: "{item.original_speech}"
                                    </div>
                                )}
                            </div>
                            <button onClick={() => removeItem(idx)} style={{ background: 'none', border: 'none', color: '#f87171', fontSize: 20, cursor: 'pointer', padding: '0 4px' }}>├ù</button>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                                <button onClick={() => updateQty(idx, -1)} style={S.qtyBtn}>ΓêÆ</button>
                                <span style={{ color: '#fff', fontSize: 18, fontWeight: 600, minWidth: 24, textAlign: 'center' }}>{item.qty}</span>
                                <button onClick={() => updateQty(idx, 1)} style={S.qtyBtn}>+</button>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 12 }}>Γé╣{item.price} ├ù {item.qty}</div>
                                <div style={{ color: '#fff', fontWeight: 700, fontSize: 16 }}>Γé╣{item.total.toFixed(2)}</div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Totals + Actions */}
            <div style={{ padding: '16px 20px 24px', background: 'rgba(0,0,0,0.3)', borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 4 }}>
                    <span>Subtotal</span><span>Γé╣{subtotal.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: 'rgba(255,255,255,0.5)', fontSize: 14, marginBottom: 8 }}>
                    <span>GST (5%)</span><span>Γé╣{gst.toFixed(2)}</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#fff', fontSize: 20, fontWeight: 700, marginBottom: 16 }}>
                    <span>Total</span><span>Γé╣{total.toFixed(2)}</span>
                </div>

                {err && <div style={{ ...S.errorBox, marginBottom: 12 }}>{err}</div>}

                <div style={{ display: 'flex', gap: 12 }}>
                    <button onClick={onBack} style={{ ...S.btnSecondary, flex: 1 }}>≡ƒÄñ Speak Again</button>
                    <button onClick={placeOrder} disabled={loading || items.length === 0} style={{ ...S.btnPrimary, flex: 2, opacity: loading ? 0.7 : 1 }}>
                        {loading ? 'Placing...' : 'Γ£à Place Order'}
                    </button>
                </div>
            </div>

            <style>{spinnerCSS}</style>
        </div>
    );
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   SCREEN 4 ΓÇö Success
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
function SuccessScreen({ order, onMore, onOrders }) {
    return (
        <div style={S.page}>
            <div style={S.center}>
                <div style={{ fontSize: 80, marginBottom: 16 }}>≡ƒÄë</div>
                <h1 style={{ color: '#fff', fontSize: 28, fontWeight: 700, margin: '0 0 8px' }}>Order Placed!</h1>
                <p style={{ color: 'rgba(255,255,255,0.5)', margin: '0 0 24px' }}>
                    {order?.order_number}
                </p>

                <div style={{ ...S.card, padding: '24px 32px', textAlign: 'center', marginBottom: 32 }}>
                    <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: 14 }}>Estimated wait time</div>
                    <div style={{ color: '#6366f1', fontSize: 48, fontWeight: 700, margin: '8px 0' }}>
                        ~{order?.estimated_wait_minutes || 15}<span style={{ fontSize: 20, fontWeight: 400 }}> min</span>
                    </div>
                    <div style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                        {order?.items_count || 0} items ┬╖ Γé╣{order?.total?.toFixed(2) || '0.00'}
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 12, width: '100%', maxWidth: 300 }}>
                    <button onClick={onMore} style={S.btnPrimary}>≡ƒÄñ Add More Items</button>
                    <button onClick={onOrders} style={S.btnSecondary}>≡ƒôï View Order Status</button>
                </div>
            </div>
        </div>
    );
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   SCREEN 5 ΓÇö Order Tracking
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
function OrdersScreen({ session, onBack }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchOrders = useCallback(async () => {
        try {
            const res = await api('/api/customer/orders');
            const d = await res.json();
            setData(d);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetchOrders();
        const iv = setInterval(fetchOrders, 15000);
        return () => clearInterval(iv);
    }, [fetchOrders]);

    const statusColor = (s) => {
        switch (s) { case 'placed': return '#eab308'; case 'preparing': return '#6366f1'; case 'ready': return '#22c55e'; case 'served': return '#06b6d4'; default: return '#888'; }
    };

    return (
        <div style={S.page}>
            <div style={{ padding: '20px 20px 0' }}>
                <button onClick={onBack} style={S.backBtn}>ΓåÉ Back to Mic</button>
                <h2 style={{ color: '#fff', margin: '12px 0 4px', fontSize: 20 }}>My Orders</h2>
                {data && (
                    <div style={{ display: 'flex', gap: 16, marginBottom: 16 }}>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>{data.total_orders} orders</span>
                        <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>Total: Γé╣{data.session_total?.toFixed(2)}</span>
                    </div>
                )}
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '0 20px 24px' }}>
                {loading && <div style={S.center}><div style={S.spinner} /></div>}
                {!loading && (!data?.orders || data.orders.length === 0) && (
                    <div style={{ textAlign: 'center', paddingTop: 60 }}>
                        <div style={{ fontSize: 48 }}>≡ƒô¡</div>
                        <p style={{ color: 'rgba(255,255,255,0.4)' }}>No orders yet. Go back and speak your order!</p>
                    </div>
                )}
                {data?.orders?.map((order, i) => (
                    <div key={i} style={{ ...S.card, marginBottom: 12, padding: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
                            <span style={{ color: '#fff', fontWeight: 600, fontSize: 14 }}>{order.order_number}</span>
                            <span style={{ background: statusColor(order.status), color: '#fff', padding: '2px 10px', borderRadius: 12, fontSize: 12, fontWeight: 600, textTransform: 'uppercase' }}>{order.status}</span>
                        </div>
                        {order.items.map((item, j) => (
                            <div key={j} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', color: 'rgba(255,255,255,0.7)', fontSize: 14 }}>
                                <span>{item.quantity}├ù {item.name}</span>
                                <span>Γé╣{(item.price * item.quantity).toFixed(2)}</span>
                            </div>
                        ))}
                        <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', marginTop: 8, paddingTop: 8, display: 'flex', justifyContent: 'space-between' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: 13 }}>
                                {order.created_at ? new Date(order.created_at).toLocaleTimeString() : ''}
                            </span>
                            <span style={{ color: '#fff', fontWeight: 600 }}>Γé╣{order.total.toFixed(2)}</span>
                        </div>
                    </div>
                ))}
            </div>

            <style>{spinnerCSS}</style>
        </div>
    );
}

/* ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ
   STYLES
   ΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉΓòÉ */
const S = {
    page: {
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
        background: 'linear-gradient(135deg, #0f0f23 0%, #1a1a2e 50%, #16162a 100%)',
        fontFamily: "'Inter', -apple-system, sans-serif", color: '#fff',
    },
    center: {
        flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 20,
    },
    card: {
        background: 'rgba(255,255,255,0.05)', borderRadius: 16,
        border: '1px solid rgba(255,255,255,0.08)',
    },
    badge: {
        display: 'inline-block', padding: '6px 20px', borderRadius: 20,
        background: 'rgba(99,102,241,0.15)', border: '1px solid rgba(99,102,241,0.3)',
        color: '#a5b4fc', fontSize: 14, fontWeight: 600,
    },
    micBtn: {
        width: 160, height: 160, borderRadius: '50%', border: 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        cursor: 'pointer', boxShadow: '0 8px 32px rgba(99,102,241,0.4)',
        transition: 'all 0.2s', touchAction: 'none',
    },
    errorBox: {
        padding: '12px 16px', borderRadius: 12,
        background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
        color: '#f87171', fontSize: 13, textAlign: 'center',
    },
    backBtn: {
        background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)',
        fontSize: 14, cursor: 'pointer', padding: 0,
    },
    linkBtn: {
        background: 'none', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 12,
        color: 'rgba(255,255,255,0.5)', fontSize: 14, padding: '10px 24px', cursor: 'pointer',
    },
    qtyBtn: {
        width: 36, height: 36, borderRadius: '50%', border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.05)', color: '#fff', fontSize: 20,
        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
    },
    btnPrimary: {
        padding: '16px 24px', borderRadius: 14, border: 'none',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff',
        fontSize: 16, fontWeight: 600, cursor: 'pointer', transition: 'all 0.2s',
    },
    btnSecondary: {
        padding: '16px 24px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.15)',
        background: 'rgba(255,255,255,0.05)', color: '#fff',
        fontSize: 16, fontWeight: 500, cursor: 'pointer',
    },
    spinner: {
        width: 40, height: 40, border: '3px solid rgba(255,255,255,0.15)',
        borderTopColor: '#6366f1', borderRadius: '50%', animation: 'spin 0.7s linear infinite',
    },
    transcriptBox: {
        padding: '16px 24px', borderRadius: 16, textAlign: 'center',
        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        maxWidth: 400, width: '100%',
    },
    transcriptReveal: {
        padding: '24px 32px', borderRadius: 20, textAlign: 'center',
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(139,92,246,0.1))',
        border: '1px solid rgba(99,102,241,0.3)',
        maxWidth: 420, width: '100%',
        animation: 'fadeInUp 0.5s ease-out',
    },
};

const spinnerCSS = `@keyframes spin { to { transform: rotate(360deg); } }`;
const pulseCSS = `@keyframes pulse { 0%,100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(239,68,68,0.4); } 50% { transform: scale(1.05); box-shadow: 0 0 0 20px rgba(239,68,68,0); } }`;
const waveCss = `@keyframes wave { 0% { height: 8px; } 100% { height: 32px; } }`;
const pulseDotCss = `@keyframes pulse-dot { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.4; transform: scale(0.8); } }
@keyframes fadeInUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }`;
