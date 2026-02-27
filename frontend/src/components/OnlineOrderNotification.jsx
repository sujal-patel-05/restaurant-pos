import React, { useState, useEffect, useRef, useCallback } from 'react';
import { onlineOrdersAPI } from '../services/api';
import {
    CheckCircle2, XCircle, Clock, MapPin, User, Phone,
    ShoppingBag, Volume2, VolumeX, AlertTriangle
} from 'lucide-react';

// Zomato/Swiggy brand colors
const PLATFORM = {
    zomato: {
        name: 'Zomato',
        color: '#E23744',
        gradient: 'linear-gradient(135deg, #E23744, #ff6b6b)',
        bg: 'rgba(226, 55, 68, 0.08)',
        border: 'rgba(226, 55, 68, 0.3)',
        icon: '🔴',
    },
    swiggy: {
        name: 'Swiggy',
        color: '#FC8019',
        gradient: 'linear-gradient(135deg, #FC8019, #ffb347)',
        bg: 'rgba(252, 128, 25, 0.08)',
        border: 'rgba(252, 128, 25, 0.3)',
        icon: '🟠',
    },
};

const COUNTDOWN_SECONDS = 120; // 2 min auto-reject

export default function OnlineOrderNotification() {
    const [pendingOrders, setPendingOrders] = useState([]);
    const [processing, setProcessing] = useState({});
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [countdowns, setCountdowns] = useState({});
    const prevCountRef = useRef(0);
    const audioCtxRef = useRef(null);
    const pollRef = useRef(null);

    // Play notification sound using Web Audio API
    const playNotificationSound = useCallback(() => {
        if (!soundEnabled) return;
        try {
            if (!audioCtxRef.current) {
                audioCtxRef.current = new (window.AudioContext || window.webkitAudioContext)();
            }
            const ctx = audioCtxRef.current;
            const now = ctx.currentTime;

            // Two-tone chime (like food delivery apps)
            [523.25, 659.25, 783.99].forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                osc.frequency.value = freq;
                gain.gain.setValueAtTime(0.3, now + i * 0.15);
                gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.4);
                osc.connect(gain).connect(ctx.destination);
                osc.start(now + i * 0.15);
                osc.stop(now + i * 0.15 + 0.5);
            });
        } catch (e) {
            console.warn('Audio play failed:', e);
        }
    }, [soundEnabled]);

    // Poll for pending orders every 10s
    const fetchPending = useCallback(async () => {
        try {
            const token = localStorage.getItem('token');
            if (!token) return;

            const { data } = await onlineOrdersAPI.getPending();
            const orders = data?.orders || [];
            setPendingOrders(orders);

            // Play sound when new orders appear
            if (orders.length > prevCountRef.current && orders.length > 0) {
                playNotificationSound();
            }
            prevCountRef.current = orders.length;

            // Initialize countdowns for new orders
            setCountdowns(prev => {
                const next = { ...prev };
                orders.forEach(o => {
                    if (!(o.id in next)) {
                        next[o.id] = Math.max(COUNTDOWN_SECONDS - (o.elapsed_seconds || 0), 0);
                    }
                });
                // Clean up removed orders
                Object.keys(next).forEach(id => {
                    if (!orders.find(o => o.id === id)) delete next[id];
                });
                return next;
            });
        } catch (e) {
            // Silently fail during polling
        }
    }, [playNotificationSound]);

    useEffect(() => {
        fetchPending();
        pollRef.current = setInterval(fetchPending, 10000);
        return () => clearInterval(pollRef.current);
    }, [fetchPending]);

    // Countdown timer
    useEffect(() => {
        const timer = setInterval(() => {
            setCountdowns(prev => {
                const next = {};
                let changed = false;
                Object.entries(prev).forEach(([id, secs]) => {
                    if (secs > 0) {
                        next[id] = secs - 1;
                        changed = true;
                    } else {
                        // Auto-reject on timeout
                        handleReject(id, 'Auto-rejected (timeout)');
                    }
                });
                return changed ? next : prev;
            });
        }, 1000);
        return () => clearInterval(timer);
    }, []);

    const handleApprove = async (orderId) => {
        setProcessing(p => ({ ...p, [orderId]: 'approving' }));
        try {
            await onlineOrdersAPI.approve(orderId);
            setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        } catch (e) {
            console.error('Approve failed:', e);
            alert(`Failed to approve: ${e.response?.data?.detail || e.message}`);
        }
        setProcessing(p => ({ ...p, [orderId]: null }));
    };

    const handleReject = async (orderId, reason = 'Restaurant is busy') => {
        setProcessing(p => ({ ...p, [orderId]: 'rejecting' }));
        try {
            await onlineOrdersAPI.reject(orderId, reason);
            setPendingOrders(prev => prev.filter(o => o.id !== orderId));
        } catch (e) {
            console.error('Reject failed:', e);
        }
        setProcessing(p => ({ ...p, [orderId]: null }));
    };

    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m}:${String(s).padStart(2, '0')}`;
    };

    if (pendingOrders.length === 0) return null;

    return (
        <div style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            zIndex: 10000,
            display: 'flex',
            flexDirection: 'column-reverse',
            gap: '12px',
            maxHeight: '90vh',
            overflowY: 'auto',
            paddingRight: '4px',
        }}>
            {/* Sound toggle */}
            <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                style={{
                    position: 'fixed',
                    bottom: '24px',
                    right: pendingOrders.length > 0 ? '420px' : '24px',
                    zIndex: 10001,
                    padding: '8px',
                    borderRadius: '50%',
                    border: 'none',
                    background: 'var(--card-bg, #1a1a2e)',
                    color: soundEnabled ? '#10b981' : '#6b7280',
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                }}
                title={soundEnabled ? 'Mute notifications' : 'Enable sound'}
            >
                {soundEnabled ? <Volume2 size={18} /> : <VolumeX size={18} />}
            </button>

            {pendingOrders.map(order => {
                const platform = PLATFORM[order.source] || PLATFORM.zomato;
                const countdown = countdowns[order.id] || 0;
                const isUrgent = countdown < 30;
                const isProc = processing[order.id];

                return (
                    <div key={order.id} style={{
                        width: '380px',
                        background: 'var(--card-bg, #1a1a2e)',
                        borderRadius: '16px',
                        border: `2px solid ${isUrgent ? '#ef4444' : platform.border}`,
                        boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px ${platform.border}`,
                        overflow: 'hidden',
                        animation: 'slideInRight 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)',
                        transition: 'all 0.3s ease',
                    }}>
                        {/* Header */}
                        <div style={{
                            background: platform.gradient,
                            padding: '12px 16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                        }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                <span style={{ fontSize: '20px' }}>{platform.icon}</span>
                                <div>
                                    <div style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>
                                        New {platform.name} Order
                                    </div>
                                    <div style={{ color: 'rgba(255,255,255,0.8)', fontSize: '12px' }}>
                                        {order.platform_order_id}
                                    </div>
                                </div>
                            </div>
                            <div style={{
                                background: isUrgent ? '#ef4444' : 'rgba(255,255,255,0.2)',
                                padding: '4px 10px',
                                borderRadius: '20px',
                                color: '#fff',
                                fontSize: '13px',
                                fontWeight: 700,
                                fontFamily: 'monospace',
                                animation: isUrgent ? 'pulse 1s infinite' : 'none',
                            }}>
                                <Clock size={12} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                                {formatTime(countdown)}
                            </div>
                        </div>

                        {/* Customer Info */}
                        <div style={{ padding: '12px 16px 8px', borderBottom: '1px solid var(--border-color, rgba(255,255,255,0.06))' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                                <User size={14} style={{ color: 'var(--text-secondary, #a0a0b0)' }} />
                                <span style={{ color: 'var(--text-primary, #fff)', fontWeight: 600, fontSize: '14px' }}>
                                    {order.customer_name}
                                </span>
                            </div>
                            {order.delivery_address && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '4px' }}>
                                    <MapPin size={14} style={{ color: 'var(--text-secondary, #a0a0b0)', marginTop: '2px', flexShrink: 0 }} />
                                    <span style={{ color: 'var(--text-secondary, #a0a0b0)', fontSize: '12px', lineHeight: '1.3' }}>
                                        {order.delivery_address}
                                    </span>
                                </div>
                            )}
                            {order.special_instructions && (
                                <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginTop: '6px' }}>
                                    <AlertTriangle size={14} style={{ color: '#f59e0b', marginTop: '2px', flexShrink: 0 }} />
                                    <span style={{ color: '#f59e0b', fontSize: '12px', fontStyle: 'italic' }}>
                                        {order.special_instructions}
                                    </span>
                                </div>
                            )}
                        </div>

                        {/* Items */}
                        <div style={{ padding: '10px 16px', maxHeight: '120px', overflowY: 'auto' }}>
                            {order.items?.map((item, i) => (
                                <div key={i} style={{
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    padding: '4px 0',
                                    fontSize: '13px',
                                }}>
                                    <span style={{ color: 'var(--text-primary, #fff)' }}>
                                        {item.quantity}× {item.name}
                                    </span>
                                    <span style={{ color: 'var(--text-secondary, #a0a0b0)', fontFamily: 'monospace' }}>
                                        ₹{item.total?.toFixed(0)}
                                    </span>
                                </div>
                            ))}
                        </div>

                        {/* Total */}
                        <div style={{
                            padding: '10px 16px',
                            borderTop: '1px solid var(--border-color, rgba(255,255,255,0.06))',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                        }}>
                            <span style={{ color: 'var(--text-secondary, #a0a0b0)', fontSize: '13px' }}>
                                Total ({order.items?.length} items)
                            </span>
                            <span style={{
                                color: 'var(--text-primary, #fff)',
                                fontWeight: 700,
                                fontSize: '18px',
                                fontFamily: 'monospace',
                            }}>
                                ₹{order.total_amount?.toFixed(0)}
                            </span>
                        </div>

                        {/* Action Buttons */}
                        <div style={{
                            padding: '10px 16px 14px',
                            display: 'flex',
                            gap: '10px',
                        }}>
                            <button
                                onClick={() => handleReject(order.id)}
                                disabled={!!isProc}
                                style={{
                                    flex: 1,
                                    padding: '10px',
                                    borderRadius: '10px',
                                    border: '1px solid rgba(239, 68, 68, 0.4)',
                                    background: 'rgba(239, 68, 68, 0.1)',
                                    color: '#ef4444',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    cursor: isProc ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    opacity: isProc ? 0.5 : 1,
                                    transition: 'all 0.2s ease',
                                }}
                            >
                                <XCircle size={16} />
                                {isProc === 'rejecting' ? 'Rejecting...' : 'Reject'}
                            </button>
                            <button
                                onClick={() => handleApprove(order.id)}
                                disabled={!!isProc}
                                style={{
                                    flex: 1.5,
                                    padding: '10px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: platform.gradient,
                                    color: '#fff',
                                    fontWeight: 700,
                                    fontSize: '14px',
                                    cursor: isProc ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '6px',
                                    opacity: isProc ? 0.5 : 1,
                                    transition: 'all 0.2s ease',
                                    boxShadow: `0 4px 12px ${platform.color}40`,
                                }}
                            >
                                <CheckCircle2 size={16} />
                                {isProc === 'approving' ? 'Accepting...' : 'Accept Order'}
                            </button>
                        </div>
                    </div>
                );
            })}

            <style>{`
                @keyframes slideInRight {
                    from { transform: translateX(120%); opacity: 0; }
                    to { transform: translateX(0); opacity: 1; }
                }
                @keyframes pulse {
                    0%, 100% { opacity: 1; }
                    50% { opacity: 0.5; }
                }
            `}</style>
        </div>
    );
}
