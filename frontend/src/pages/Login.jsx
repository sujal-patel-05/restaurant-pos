import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Hls from 'hls.js';
import { useEffect, useRef } from 'react';

function Login() {
    const [isLogin, setIsLogin] = useState(true);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        email: '',
        full_name: '',
        restaurant_id: ''
    });
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    // Video Ref
    const videoRef = useRef(null);
    const videoUrl = 'https://stream.mux.com/NcU3HlHeF7CUL86azTTzpy3Tlb00d6iF3BmCdFslMJYM.m3u8';

    useEffect(() => {
        let hls;
        if (Hls.isSupported() && videoRef.current) {
            hls = new Hls();
            hls.loadSource(videoUrl);
            hls.attachMedia(videoRef.current);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
            });
        } else if (videoRef.current && videoRef.current.canPlayType('application/vnd.apple.mpegurl')) {
            // Native HLS support (Safari)
            videoRef.current.src = videoUrl;
            videoRef.current.addEventListener('loadedmetadata', () => {
                videoRef.current.play().catch(e => console.log("Autoplay blocked", e));
            });
        }

        return () => {
            if (hls) {
                hls.destroy();
            }
        };
    }, []);

    const { login, register } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            const result = isLogin
                ? await login({ username: formData.username, password: formData.password })
                : await register(formData);

            if (result.success) {
                navigate('/pos');
            } else {
                setError(result.error);
            }
        } catch (err) {
            setError('An error occurred. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    // Google Logo SVG


    return (
        <div style={{
            display: 'flex',
            height: '100vh',
            width: '100vw',
            overflow: 'hidden',
            background: '#ffffff',
            fontFamily: "'Playfair Display', serif" // Using a classy serif for headings if avail, else fallback
        }}>
            {/* Left Side - Artistic Visual */}
            <div style={{
                flex: '1.2',
                position: 'relative',
                overflow: 'hidden',
                background: '#000',
                flexDirection: 'column',
                justifyContent: 'space-between',
                padding: '4rem',
                color: 'white',
                display: window.innerWidth < 900 ? 'none' : 'flex'
            }}>
                {/* CSS Abstract Background */}
                {/* Video Background */}
                <video
                    ref={videoRef}
                    autoPlay
                    muted
                    loop
                    playsInline
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        zIndex: 0
                    }}
                />

                {/* Overlay to ensure text readability */}
                <div style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    background: 'linear-gradient(to bottom, rgba(0,0,0,0.3), rgba(0,0,0,0.7))',
                    zIndex: 1
                }}></div>

                {/* Mesh Gradient Overlay for texture - kept for style */}
                <div style={{
                    position: 'absolute',
                    inset: 0,
                    opacity: 0.4,
                    background: 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 200 200\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noiseFilter\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.6\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noiseFilter)\' opacity=\'0.1\'/%3E%3C/svg%3E")',
                    zIndex: 2,
                    mixBlendMode: 'overlay'
                }}></div>

                <div style={{ position: 'relative', zIndex: 10 }}>
                    <div style={{
                        fontSize: '0.85rem',
                        letterSpacing: '0.2em',
                        textTransform: 'uppercase',
                        opacity: 0.8,
                        marginBottom: '1rem',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '1rem'
                    }}>
                        <span>Sujal 05</span>
                        <div style={{ height: '1px', width: '50px', background: 'rgba(255,255,255,0.3)' }}></div>
                    </div>
                </div>

                <div style={{ position: 'relative', zIndex: 10 }}>
                    <h1 style={{
                        fontSize: '4.5rem', // Increased to "little big" per request
                        fontWeight: 300,
                        lineHeight: 1.15,
                        fontFamily: "var(--font-sans)",
                        marginBottom: '1.5rem',
                        background: 'linear-gradient(to right, #fff, #ccc)',
                        WebkitBackgroundClip: 'text',
                        WebkitTextFillColor: 'transparent'
                    }}>
                        Built for real<br />
                        <span style={{ fontStyle: 'italic', fontFamily: 'serif' }}>Restaurant</span><br />
                        Workflow.
                    </h1>
                    <p style={{
                        maxWidth: '450px',
                        fontSize: '1.1rem',
                        lineHeight: 1.6,
                        opacity: 0.8,
                        color: '#d4d4d8'
                    }}>
                        Fast. Reliable. Industry-ready POS.
                    </p>
                </div>
            </div>

            {/* Right Side - Form */}
            <div style={{
                flex: '1',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'center',
                alignItems: 'center',
                padding: '4rem',
                background: '#fff',
                position: 'relative'
            }}>
                <div style={{ position: 'absolute', top: '2rem', right: '2rem', display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <div style={{ fontSize: '1.5rem' }}>🤖</div>
                    <span style={{ fontWeight: 600, fontSize: '1.1rem' }}>5ive AI</span>
                </div>

                <div style={{ width: '100%', maxWidth: '420px' }}>
                    <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
                        <h2 style={{
                            fontSize: '3rem',
                            fontWeight: 700,
                            marginBottom: '0.75rem',
                            color: '#18181b',
                            fontFamily: 'serif'
                        }}>
                            {isLogin ? 'Welcome Back' : 'Create Account'}
                        </h2>
                        <p style={{ color: '#71717a' }}>
                            {isLogin ? 'Enter your username & password to access your account' : 'Enter your details to get started'}
                        </p>
                    </div>

                    <form onSubmit={handleSubmit}>
                        {error && (
                            <div style={{
                                padding: '0.75rem',
                                marginBottom: '1.5rem',
                                borderRadius: '0.5rem',
                                background: '#fee2e2',
                                color: '#ef4444',
                                fontSize: '0.875rem',
                                textAlign: 'center'
                            }}>
                                {error}
                            </div>
                        )}

                        <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#3f3f46', marginBottom: '0.5rem' }}>
                                Username
                            </label>
                            <input
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleChange}
                                placeholder="Enter your username"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #e4e4e7',
                                    background: '#f4f4f5',
                                    fontSize: '0.95rem',
                                    outline: 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        </div>

                        {!isLogin && (
                            <>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#3f3f46', marginBottom: '0.5rem' }}>
                                        Email
                                    </label>
                                    <input
                                        type="email"
                                        name="email"
                                        value={formData.email}
                                        onChange={handleChange}
                                        placeholder="name@example.com"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #e4e4e7',
                                            background: '#f4f4f5',
                                            fontSize: '0.95rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#3f3f46', marginBottom: '0.5rem' }}>
                                        Full Name
                                    </label>
                                    <input
                                        type="text"
                                        name="full_name"
                                        value={formData.full_name}
                                        onChange={handleChange}
                                        placeholder="John Doe"
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #e4e4e7',
                                            background: '#f4f4f5',
                                            fontSize: '0.95rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                                <div className="form-group" style={{ marginBottom: '1.25rem' }}>
                                    <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#3f3f46', marginBottom: '0.5rem' }}>
                                        Restaurant ID
                                    </label>
                                    <input
                                        type="text"
                                        name="restaurant_id"
                                        value={formData.restaurant_id}
                                        onChange={handleChange}
                                        placeholder="REST-001"
                                        required
                                        style={{
                                            width: '100%',
                                            padding: '0.875rem 1rem',
                                            borderRadius: '0.5rem',
                                            border: '1px solid #e4e4e7',
                                            background: '#f4f4f5',
                                            fontSize: '0.95rem',
                                            outline: 'none'
                                        }}
                                    />
                                </div>
                            </>
                        )}

                        <div className="form-group" style={{ marginBottom: '1.5rem' }}>
                            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, color: '#3f3f46', marginBottom: '0.5rem' }}>
                                Password
                            </label>
                            <input
                                type="password"
                                name="password"
                                value={formData.password}
                                onChange={handleChange}
                                placeholder="Enter your password"
                                required
                                style={{
                                    width: '100%',
                                    padding: '0.875rem 1rem',
                                    borderRadius: '0.5rem',
                                    border: '1px solid #e4e4e7',
                                    background: '#f4f4f5',
                                    fontSize: '0.95rem',
                                    outline: 'none'
                                }}
                            />
                        </div>



                        <button
                            type="submit"
                            disabled={loading}
                            style={{
                                width: '100%',
                                padding: '1rem',
                                borderRadius: '0.5rem',
                                background: '#000',
                                color: '#fff',
                                fontWeight: 600,
                                fontSize: '1rem',
                                border: 'none',
                                cursor: loading ? 'not-allowed' : 'pointer',
                                transition: 'transform 0.2s',
                                marginBottom: '1rem'
                            }}
                            onMouseOver={(e) => !loading && (e.currentTarget.style.transform = 'translateY(-1px)')}
                            onMouseOut={(e) => !loading && (e.currentTarget.style.transform = 'translateY(0)')}
                        >
                            {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                        </button>


                    </form>
                </div>
            </div>
        </div>
    );
}

export default Login;
