import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { authAPI } from '../services/api';

export default function WaiterLogin() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setLoading(true);
        setError('');
        try {
            const cleanUsername = username.trim();
            const res = await authAPI.login({ username: cleanUsername, password });
            const { access_token, user } = res.data;
            if (user?.role?.toLowerCase() !== 'waiter') {
                setError('Only waiter accounts can access this app.');
                setLoading(false);
                return;
            }
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(user));
            navigate('/waiter');
        } catch (err) {
            if (err.response) setError(err.response.data?.detail || 'Invalid credentials');
            else if (err.request) setError('Cannot connect to server. Check if backend is running.');
            else setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={sx.page}>
            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');

                * { box-sizing: border-box; }

                .waiter-login-input {
                    width: 100%;
                    padding: 14px 16px;
                    padding-left: 48px;
                    border: 1.5px solid #e5e7eb;
                    border-radius: 14px;
                    font-size: 15px;
                    font-family: 'Inter', sans-serif;
                    color: #1f2937;
                    background: #fff;
                    outline: none;
                    transition: all 0.2s ease;
                }
                .waiter-login-input::placeholder { color: #9ca3af; }
                .waiter-login-input:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 4px rgba(99,102,241,0.08);
                }

                .waiter-login-btn {
                    width: 100%;
                    padding: 15px;
                    border: none;
                    border-radius: 14px;
                    font-size: 16px;
                    font-weight: 600;
                    font-family: 'Inter', sans-serif;
                    color: #fff;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    cursor: pointer;
                    transition: all 0.2s ease;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    gap: 8px;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
                }
                .waiter-login-btn:hover:not(:disabled) {
                    transform: translateY(-1px);
                    box-shadow: 0 6px 20px rgba(99,102,241,0.4);
                }
                .waiter-login-btn:active:not(:disabled) {
                    transform: translateY(0);
                }
                .waiter-login-btn:disabled {
                    opacity: 0.7;
                    cursor: not-allowed;
                }

                .eye-btn {
                    position: absolute;
                    right: 14px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    cursor: pointer;
                    color: #9ca3af;
                    padding: 4px;
                    display: flex;
                    align-items: center;
                }
                .eye-btn:hover { color: #6366f1; }

                @keyframes fadeInUp {
                    from { opacity: 0; transform: translateY(24px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                @keyframes float {
                    0%, 100% { transform: translateY(0px) rotate(0deg); }
                    50% { transform: translateY(-8px) rotate(2deg); }
                }
                @keyframes spin-slow {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `}</style>

            {/* Decorative blobs */}
            <div style={sx.blob1} />
            <div style={sx.blob2} />
            <div style={sx.blob3} />

            {/* Card */}
            <div style={sx.card}>
                {/* Icon */}
                <div style={sx.iconWrap}>
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2" />
                        <path d="M7 2v20" />
                        <path d="M21 15V2v0a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3Zm0 0v7" />
                    </svg>
                </div>

                <h1 style={sx.title}>Waiter Login</h1>
                <p style={sx.subtitle}>Sign in to start taking orders</p>

                {error && (
                    <div style={sx.errorBox}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><line x1="15" y1="9" x2="9" y2="15" /><line x1="9" y1="9" x2="15" y2="15" /></svg>
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} style={sx.form}>
                    <div style={sx.fieldGroup}>
                        <label style={sx.label}>Username</label>
                        <div style={{ position: 'relative' }}>
                            <svg style={sx.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                            </svg>
                            <input
                                className="waiter-login-input"
                                value={username}
                                onChange={e => setUsername(e.target.value)}
                                placeholder="e.g. waiter1"
                                autoFocus
                                required
                            />
                        </div>
                    </div>

                    <div style={sx.fieldGroup}>
                        <label style={sx.label}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <svg style={sx.inputIcon} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                            </svg>
                            <input
                                type={showPassword ? 'text' : 'password'}
                                className="waiter-login-input"
                                value={password}
                                onChange={e => setPassword(e.target.value)}
                                placeholder="Enter password"
                                required
                            />
                            <button type="button" className="eye-btn" onClick={() => setShowPassword(!showPassword)} tabIndex={-1}>
                                {showPassword ? (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></svg>
                                ) : (
                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" /></svg>
                                )}
                            </button>
                        </div>
                    </div>

                    <button type="submit" className="waiter-login-btn" disabled={loading || !username || !password}>
                        {loading ? (
                            <>
                                <div style={sx.btnSpinner} />
                                Signing in...
                            </>
                        ) : (
                            <>
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>
                                Sign In
                            </>
                        )}
                    </button>
                </form>

                <div style={sx.footer}>
                    <div style={sx.footerDivider}>
                        <span style={sx.footerDividerLine} />
                        <span style={sx.footerDividerText}>SujalPOS</span>
                        <span style={sx.footerDividerLine} />
                    </div>
                    <p style={sx.footerText}>
                        Admin? <a href="/login" style={sx.footerLink}>Login here</a>
                    </p>
                </div>
            </div>
        </div>
    );
}

/* ── Styles ── */
const sx = {
    page: {
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f0f4ff 0%, #faf5ff 50%, #fdf2f8 100%)',
        fontFamily: "'Inter', sans-serif",
        padding: '20px',
        position: 'relative',
        overflow: 'hidden',
    },
    blob1: {
        position: 'absolute',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(99,102,241,0.12) 0%, transparent 70%)',
        top: -100,
        right: -100,
        animation: 'float 6s ease-in-out infinite',
    },
    blob2: {
        position: 'absolute',
        width: 300,
        height: 300,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139,92,246,0.10) 0%, transparent 70%)',
        bottom: -80,
        left: -80,
        animation: 'float 8s ease-in-out infinite 1s',
    },
    blob3: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(236,72,153,0.08) 0%, transparent 70%)',
        top: '40%',
        left: '10%',
        animation: 'float 7s ease-in-out infinite 2s',
    },
    card: {
        width: '100%',
        maxWidth: 420,
        background: 'rgba(255,255,255,0.85)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderRadius: 24,
        padding: '40px 32px 32px',
        boxShadow: '0 8px 40px rgba(0,0,0,0.06), 0 1px 3px rgba(0,0,0,0.04)',
        border: '1px solid rgba(255,255,255,0.7)',
        animation: 'fadeInUp 0.5s ease-out',
        position: 'relative',
        zIndex: 2,
    },
    iconWrap: {
        width: 64,
        height: 64,
        borderRadius: 18,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        margin: '0 auto 20px',
        boxShadow: '0 4px 16px rgba(99,102,241,0.3)',
    },
    title: {
        textAlign: 'center',
        fontSize: 26,
        fontWeight: 800,
        color: '#111827',
        margin: '0 0 4px',
        letterSpacing: '-0.5px',
    },
    subtitle: {
        textAlign: 'center',
        fontSize: 14,
        color: '#6b7280',
        margin: '0 0 28px',
        fontWeight: 400,
    },
    errorBox: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '12px 16px',
        borderRadius: 12,
        background: '#fef2f2',
        color: '#dc2626',
        fontSize: 13,
        fontWeight: 500,
        marginBottom: 20,
        border: '1px solid #fee2e2',
    },
    form: {
        display: 'flex',
        flexDirection: 'column',
        gap: 18,
    },
    fieldGroup: {
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
    },
    label: {
        fontSize: 13,
        fontWeight: 600,
        color: '#374151',
        paddingLeft: 2,
    },
    inputIcon: {
        position: 'absolute',
        left: 16,
        top: '50%',
        transform: 'translateY(-50%)',
        pointerEvents: 'none',
    },
    btnSpinner: {
        width: 18,
        height: 18,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin-slow 0.6s linear infinite',
    },
    footer: {
        marginTop: 24,
    },
    footerDivider: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 12,
    },
    footerDividerLine: {
        flex: 1,
        height: 1,
        background: '#e5e7eb',
    },
    footerDividerText: {
        fontSize: 11,
        fontWeight: 700,
        color: '#9ca3af',
        letterSpacing: 1.5,
        textTransform: 'uppercase',
    },
    footerText: {
        textAlign: 'center',
        fontSize: 13,
        color: '#9ca3af',
        margin: 0,
    },
    footerLink: {
        color: '#6366f1',
        fontWeight: 600,
        textDecoration: 'none',
    },
};
