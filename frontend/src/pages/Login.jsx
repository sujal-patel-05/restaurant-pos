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
        <div className="flex items-center justify-center" style={{ minHeight: '100vh', background: 'var(--bg-primary)' }}>
            <div className="card" style={{ maxWidth: '450px', width: '100%' }}>
                <div className="text-center" style={{ marginBottom: 'var(--spacing-xl)' }}>
                    <h1 style={{ color: 'var(--primary-accent)', marginBottom: 'var(--spacing-sm)' }}>
                        SujalPOS
                    </h1>
                    <p className="text-secondary">Production-Grade Point of Sale System</p>
                </div>

                {error && (
                    <div className="alert alert-error">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label className="input-label">Username</label>
                        <input
                            type="text"
                            name="username"
                            className="input"
                            value={formData.username}
                            onChange={handleChange}
                            required
                            placeholder="Enter username"
                        />
                    </div>

                    {!isLogin && (
                        <>
                            <div className="input-group">
                                <label className="input-label">Email</label>
                                <input
                                    type="email"
                                    name="email"
                                    className="input"
                                    value={formData.email}
                                    onChange={handleChange}
                                    required
                                    placeholder="Enter email"
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Full Name</label>
                                <input
                                    type="text"
                                    name="full_name"
                                    className="input"
                                    value={formData.full_name}
                                    onChange={handleChange}
                                    placeholder="Enter full name"
                                />
                            </div>

                            <div className="input-group">
                                <label className="input-label">Restaurant ID</label>
                                <input
                                    type="text"
                                    name="restaurant_id"
                                    className="input"
                                    value={formData.restaurant_id}
                                    onChange={handleChange}
                                    required
                                    placeholder="Enter restaurant ID"
                                />
                            </div>
                        </>
                    )}

                    <div className="input-group">
                        <label className="input-label">Password</label>
                        <input
                            type="password"
                            name="password"
                            className="input"
                            value={formData.password}
                            onChange={handleChange}
                            required
                            placeholder="Enter password"
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn btn-primary"
                        style={{ width: '100%' }}
                        disabled={loading}
                    >
                        {loading ? 'Please wait...' : (isLogin ? 'Login' : 'Register')}
                    </button>
                </form>

                <div className="text-center" style={{ marginTop: 'var(--spacing-lg)' }}>
                    <button
                        onClick={() => setIsLogin(!isLogin)}
                        className="btn btn-outline"
                        style={{ width: '100%' }}
                    >
                        {isLogin ? 'Need an account? Register' : 'Already have an account? Login'}
                    </button>
                </div>
            </div>
        </div>
    );
}

export default Login;
