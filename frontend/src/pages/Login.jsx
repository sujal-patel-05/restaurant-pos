import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

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

    return (
        <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: 'var(--bg-body)' }}>
            <div className="stat-card fade-in-up" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem' }}>
                <div className="text-center" style={{ marginBottom: '2rem', textAlign: 'center' }}>
                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🍽️</div>
                    <h1 style={{ color: 'var(--primary)', marginBottom: '0.5rem', fontSize: '1.75rem', fontWeight: 700 }}>
                        SujalPOS
                    </h1>
                    <p style={{ color: 'var(--text-secondary)' }}>Production-Grade Point of Sale</p>
                </div>

                {error && (
                    <div style={{
                        background: 'var(--error-bg)',
                        color: 'var(--error)',
                        padding: '0.75rem',
                        borderRadius: 'var(--radius-md)',
                        marginBottom: '1.5rem',
                        fontSize: '0.9rem',
                        textAlign: 'center'
                    }}>
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="form-group">
                        <label className="form-label">Username</label>
                        <input
                            type="text"
                            name="username"
                            className="form-input"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="Enter username"
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="form-group">
                                <label className="form-label">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="form-input"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="Enter email"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Full Name</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    className="form-input"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    placeholder="Enter full name"
                                />
                            </div>

                            <div className="form-group">
                                <label className="form-label">Restaurant ID</label>
                                <input
                                    type="text"
                                    name="restaurant_id"
                                    className="form-input"
                                    value={formData.restaurant_id}
                                    onChange={handleChange}
                                    required
                                    placeholder="Enter restaurant ID"
                                />
                            </div>
                        </>
                    )}

                    <div className="form-group">
                        <label className="form-label">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="form-input"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Enter password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%', marginTop: '1rem', padding: '0.875rem' }}
                        disabled={loading}
                    >
                        {loading ? 'Please wait...' : (isLogin ? 'Sign In' : 'Create Account')}
                    </button>
                </form>

                <div style={{ marginTop: '2rem', textAlign: 'center' }}>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="btn"
                        style={{
                            background: 'transparent',
                            color: 'var(--primary)',
                            border: 'none',
                            fontSize: '0.9rem',
                            textDecoration: 'none'
                        }}
                    >
                        {isLogin ? "Don't have an account? Register" : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;
