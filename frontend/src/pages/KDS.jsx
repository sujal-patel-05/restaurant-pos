import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { kdsAPI } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';

// Error Boundary Component
class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null, errorInfo: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true };
    }

    componentDidCatch(error, errorInfo) {
        console.error("KDS Error:", error, errorInfo);
        this.setState({ error, errorInfo });
    }

    render() {
        if (this.state.hasError) {
            return (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
                    <h2>Something went wrong in KDS.</h2>
                    <details style={{ whiteSpace: 'pre-wrap', marginTop: '1rem', textAlign: 'left', background: '#f0f0f0', padding: '1rem' }}>
                        {this.state.error && this.state.error.toString()}
                        <br />
                        {this.state.errorInfo && this.state.errorInfo.componentStack}
                    </details>
                </div>
            );
        }

        return this.props.children;
    }
}

function KDSContent() {
    const [kots, setKots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchKOTs();

        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchKOTs, 30000);

        // Clock timer
        const clockInterval = setInterval(() => setCurrentTime(new Date()), 1000);

        return () => {
            clearInterval(interval);
            clearInterval(clockInterval);
        };
    }, []);

    const fetchKOTs = async () => {
        try {
            const response = await kdsAPI.getActiveKOTs();
            setKots(response.data || []);
            setError(null);
        } catch (error) {
            console.error('Error fetching KDS data:', error);
            setError("Failed to load orders");
        } finally {
            setLoading(false);
        }
    };

    const handleStatusUpdate = async (kotId, newStatus) => {
        try {
            await kdsAPI.updateKOTStatus(kotId, newStatus);
            fetchKOTs(); // Refresh immediately
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update order status');
        }
    };

    const getElapsedTime = (createdStr) => {
        const created = new Date(createdStr);
        const diff = Math.floor((currentTime - created) / 1000 / 60); // minutes
        return diff;
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'placed': return 'var(--warning)';
            case 'pending': return 'var(--warning)'; // Fallback
            case 'preparing': return 'var(--primary)';
            case 'ready': return 'var(--success)';
            default: return 'var(--text-secondary)';
        }
    };

    const getStatusBadgeClass = (status) => {
        switch (status) {
            case 'placed': return 'badge-warning';
            case 'pending': return 'badge-warning'; // Fallback
            case 'preparing': return 'badge-primary';
            case 'ready': return 'badge-success';
            default: return 'badge';
        }
    };

    const actions = (
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                {currentTime.toLocaleTimeString()}
            </div>
            <button className="btn btn-secondary" onClick={fetchKOTs}>
                🔄 Refresh
            </button>
        </div>
    );

    if (error) {
        return (
            <AppLayout title="Kitchen Display System" actions={actions}>
                <div className="error-message">{error}</div>
            </AppLayout>
        );
    }

    return (
        <AppLayout
            title="Kitchen Display System"
            subtitle="Real-time order management"
            actions={actions}
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', height: '400px', alignItems: 'center' }}>
                    <LoadingSpinner size="lg" />
                </div>
            ) : (!kots || kots.length === 0) ? (
                <div className="stat-card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-lg)' }}>👨‍🍳</div>
                    <h2>No Active Orders</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>Kitchen is clear!</p>
                </div>
            ) : (
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                    gap: 'var(--spacing-lg)'
                }}>
                    {(kots || []).map(kot => {
                        const minsWait = getElapsedTime(kot.created_at);
                        const isLate = minsWait > 20;

                        return (
                            <div key={kot.id} className="stat-card" style={{
                                borderLeft: `6px solid ${getStatusColor(kot.status)}`,
                                position: 'relative',
                                overflow: 'hidden',
                                animation: isLate ? 'pulse-border 2s infinite' : 'none'
                            }}>
                                {isLate && (
                                    <div style={{
                                        position: 'absolute',
                                        top: 0,
                                        right: 0,
                                        background: 'var(--error)',
                                        color: 'white',
                                        padding: '0.25rem 0.5rem',
                                        fontSize: '0.75rem',
                                        fontWeight: 'bold',
                                        borderBottomLeftRadius: '8px'
                                    }}>
                                        LATE ({minsWait}m)
                                    </div>
                                )}

                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                    <h3 style={{ margin: 0 }}>#{kot.kot_number || (kot.id && kot.id.toString().slice(0, 6)) || '???'}</h3>
                                    <span className={`badge ${getStatusBadgeClass(kot.status)}`}>
                                        {kot.status?.toUpperCase() || 'UNKNOWN'}
                                    </span>
                                </div>

                                <div style={{
                                    marginBottom: '1rem',
                                    paddingBottom: '1rem',
                                    borderBottom: '1px solid var(--border-light)',
                                    display: 'flex',
                                    justifyContent: 'space-between',
                                    color: 'var(--text-secondary)',
                                    fontSize: '0.9rem'
                                }}>
                                    <span>Wait: {minsWait} mins</span>
                                    <span>Table: {kot.table_number || 'N/A'}</span>
                                </div>

                                <div style={{ marginBottom: '1.5rem', maxHeight: '300px', overflowY: 'auto' }}>
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                                        {(kot.items || []).map((item, idx) => (
                                            <li key={idx} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                marginBottom: '0.5rem',
                                                fontSize: '1.1rem',
                                                fontWeight: 500
                                            }}>
                                                <span>{item.quantity}x {item.name}</span>
                                                {item.notes && (
                                                    <div style={{ fontSize: '0.85rem', color: 'var(--text-light)', fontStyle: 'italic', marginLeft: '1rem' }}>
                                                        {item.notes}
                                                    </div>
                                                )}
                                            </li>
                                        ))}
                                    </ul>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '0.5rem' }}>
                                    {(kot.status === 'placed' || kot.status === 'pending') && (
                                        <button
                                            className="btn btn-primary"
                                            onClick={() => handleStatusUpdate(kot.id, 'preparing')}
                                        >
                                            Start Preparing
                                        </button>
                                    )}
                                    {kot.status === 'preparing' && (
                                        <button
                                            className="btn btn-success"
                                            style={{ backgroundColor: 'var(--success)', borderColor: 'var(--success)', color: 'white' }}
                                            onClick={() => handleStatusUpdate(kot.id, 'ready')}
                                        >
                                            Mark Ready
                                        </button>
                                    )}
                                    {kot.status === 'ready' && (
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => handleStatusUpdate(kot.id, 'completed')}
                                        >
                                            Complete Order
                                        </button>
                                    )}
                                    <button
                                        className="btn btn-secondary"
                                        style={{ fontSize: '0.8rem', padding: '0.4rem' }}
                                        onClick={() => handleStatusUpdate(kot.id, 'cancelled')}
                                    >
                                        Cancel
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
            <style>{`
                @keyframes pulse-border {
                    0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4); }
                    70% { box-shadow: 0 0 0 10px rgba(239, 68, 68, 0); }
                    100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
                }
            `}</style>
        </AppLayout>
    );
}

export default function KDS() {
    return (
        <ErrorBoundary>
            <KDSContent />
        </ErrorBoundary>
    );
}
