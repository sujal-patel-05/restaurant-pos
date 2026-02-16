import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { kdsAPI } from '../services/api';

function KDS() {
    const [kots, setKots] = useState([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState('all');

    useEffect(() => {
        fetchKOTs();
        // Auto-refresh every 10 seconds
        const interval = setInterval(fetchKOTs, 10000);
        return () => clearInterval(interval);
    }, []);

    const fetchKOTs = async () => {
        try {
            const response = await kdsAPI.getAllKOTs(); // Fetch all (including completed)
            setKots(response.data || []);
            setLoading(false);
        } catch (error) {
            console.error('Error fetching KOTs:', error);
            setLoading(false);
        }
    };

    const updateStatus = async (kotId, newStatus) => {
        try {
            await kdsAPI.updateKOTStatus(kotId, newStatus);
            await fetchKOTs(); // Refresh the list
        } catch (error) {
            console.error('Error updating KOT status:', error);
            alert('Failed to update status. Please try again.');
        }
    };

    const getStatusColor = (status) => {
        switch (status) {
            case 'placed': return 'var(--warning)';
            case 'preparing': return 'var(--info)';
            case 'ready': return 'var(--success)';
            case 'completed': return 'var(--text-secondary)';
            default: return 'var(--text-secondary)';
        }
    };

    const getStatusBadge = (status) => {
        switch (status) {
            case 'placed': return 'badge-warning';
            case 'preparing': return 'badge badge-info';
            case 'ready': return 'badge-success';
            case 'completed': return 'badge';
            default: return 'badge';
        }
    };

    const filteredKots = filter === 'all'
        ? kots
        : kots.filter(kot => kot.status === filter);

    const actions = (
        <>
            <button className="btn btn-secondary" onClick={fetchKOTs}>
                <span>🔄</span>
                Refresh
            </button>
            <button className="btn btn-primary">
                <span>⚙️</span>
                Settings
            </button>
        </>
    );

    return (
        <AppLayout
            title="Kitchen Display System"
            subtitle="Real-time order tracking and management"
            actions={actions}
        >
            {/* Status Filter */}
            <div className="mb-xl">
                <div style={{ display: 'flex', gap: 'var(--spacing-md)', overflowX: 'auto', paddingBottom: 'var(--spacing-sm)' }}>
                    <button
                        className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter('all')}
                    >
                        All Orders ({kots.length})
                    </button>
                    <button
                        className={`btn ${filter === 'placed' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter('placed')}
                    >
                        Pending ({kots.filter(k => k.status === 'placed').length})
                    </button>
                    <button
                        className={`btn ${filter === 'preparing' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter('preparing')}
                    >
                        Preparing ({kots.filter(k => k.status === 'preparing').length})
                    </button>
                    <button
                        className={`btn ${filter === 'ready' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter('ready')}
                    >
                        Ready ({kots.filter(k => k.status === 'ready').length})
                    </button>
                    <button
                        className={`btn ${filter === 'completed' ? 'btn-primary' : 'btn-secondary'}`}
                        onClick={() => setFilter('completed')}
                    >
                        Completed ({kots.filter(k => k.status === 'completed').length})
                    </button>
                </div>
            </div>

            {loading ? (
                <div style={{ textAlign: 'center', padding: '4rem' }}>
                    <div className="loader">Loading orders...</div>
                </div>
            ) : filteredKots.length === 0 ? (
                <div className="stat-card" style={{ textAlign: 'center', padding: '4rem' }}>
                    <div style={{ fontSize: '4rem', marginBottom: '1.5rem' }}>👨‍🍳</div>
                    <h2 style={{ marginBottom: '1rem', fontSize: '1.5rem' }}>No Active Orders</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>
                        All caught up! New orders will appear here automatically.
                    </p>
                </div>
            ) : (
                /* Orders Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(400px, 1fr))',
                    gap: '2rem'
                }}>
                    {filteredKots.map(kot => (
                        <div
                            key={kot.id}
                            className="stat-card fade-in-up"
                            style={{
                                borderLeft: `5px solid ${getStatusColor(kot.status)}`,
                                transition: 'all var(--transition-base)',
                                padding: '1.75rem'
                            }}
                        >
                            {/* Order Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'flex-start',
                                marginBottom: '1.5rem',
                                paddingBottom: '1rem',
                                borderBottom: '2px solid var(--border-color)'
                            }}>
                                <div>
                                    <h3 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '0.5rem', color: 'var(--text-main)' }}>
                                        {kot.kot_number}
                                    </h3>
                                    <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                                        Order #{kot.order?.order_number} • {new Date(kot.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                                    </p>
                                </div>
                                <div className={getStatusBadge(kot.status)} style={{
                                    textTransform: 'capitalize',
                                    fontSize: '0.875rem',
                                    padding: '0.5rem 1rem',
                                    fontWeight: 600
                                }}>
                                    {kot.status}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div style={{ marginBottom: '1.5rem' }}>
                                <h4 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                                    Items:
                                </h4>
                                {kot.order_item && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        padding: '1rem',
                                        background: 'var(--bg-main)',
                                        borderRadius: '0.75rem',
                                        marginBottom: '0.75rem',
                                        border: '1px solid var(--border-color)'
                                    }}>
                                        <span style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>
                                            {kot.order_item.menu_item?.name || 'Unknown Item'}
                                        </span>
                                        <span style={{
                                            background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
                                            color: 'white',
                                            padding: '0.5rem 1rem',
                                            borderRadius: '0.5rem',
                                            fontWeight: 700,
                                            fontSize: '1rem',
                                            minWidth: '50px',
                                            textAlign: 'center'
                                        }}>
                                            ×{kot.order_item.quantity}
                                        </span>
                                    </div>
                                )}
                                {kot.order_item?.special_instructions && (
                                    <div style={{
                                        padding: '1rem',
                                        background: 'rgba(251, 191, 36, 0.1)',
                                        border: '1px solid rgba(251, 191, 36, 0.3)',
                                        borderRadius: '0.75rem',
                                        fontSize: '0.875rem',
                                        marginTop: '0.75rem',
                                        color: 'var(--text-main)'
                                    }}>
                                        <strong style={{ color: '#F59E0B' }}>📝 Note:</strong> {kot.order_item.special_instructions}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: '0.75rem' }}>
                                {kot.status === 'placed' && (
                                    <button
                                        onClick={() => updateStatus(kot.id, 'preparing')}
                                        className="btn btn-primary"
                                        style={{
                                            flex: 1,
                                            padding: '0.875rem',
                                            fontSize: '1rem',
                                            fontWeight: 600
                                        }}
                                    >
                                        🔥 Start Preparing
                                    </button>
                                )}
                                {kot.status === 'preparing' && (
                                    <button
                                        onClick={() => updateStatus(kot.id, 'ready')}
                                        className="btn btn-primary"
                                        style={{
                                            flex: 1,
                                            padding: '0.875rem',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            background: 'linear-gradient(135deg, #3B82F6, #1E40AF)'
                                        }}
                                    >
                                        ✅ Mark Ready
                                    </button>
                                )}
                                {kot.status === 'ready' && (
                                    <button
                                        onClick={() => updateStatus(kot.id, 'completed')}
                                        className="btn btn-primary"
                                        style={{
                                            flex: 1,
                                            padding: '0.875rem',
                                            fontSize: '1rem',
                                            fontWeight: 600,
                                            background: 'linear-gradient(135deg, #10B981, #059669)'
                                        }}
                                    >
                                        🎉 Complete
                                    </button>
                                )}
                                {kot.status === 'completed' && (
                                    <div style={{
                                        flex: 1,
                                        textAlign: 'center',
                                        padding: '0.875rem',
                                        color: '#10B981',
                                        fontWeight: 600,
                                        fontSize: '1rem',
                                        background: 'rgba(16, 185, 129, 0.1)',
                                        border: '2px solid rgba(16, 185, 129, 0.3)',
                                        borderRadius: '0.75rem'
                                    }}>
                                        ✓ Completed
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </AppLayout>
    );
}

export default KDS;
