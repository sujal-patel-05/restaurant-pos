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
                <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div className="loader">Loading orders...</div>
                </div>
            ) : filteredKots.length === 0 ? (
                <div className="stat-card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-lg)' }}>👨‍🍳</div>
                    <h2 style={{ marginBottom: 'var(--spacing-md)' }}>No Active Orders</h2>
                    <p style={{ color: 'var(--text-secondary)' }}>
                        All caught up! New orders will appear here automatically.
                    </p>
                </div>
            ) : (
                /* Orders Grid */
                <div style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))',
                    gap: 'var(--spacing-xl)'
                }}>
                    {filteredKots.map(kot => (
                        <div
                            key={kot.id}
                            className="stat-card"
                            style={{
                                borderLeft: `4px solid ${getStatusColor(kot.status)}`,
                                transition: 'all var(--transition-base)'
                            }}
                        >
                            {/* Order Header */}
                            <div style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: 'var(--spacing-lg)',
                                paddingBottom: 'var(--spacing-md)',
                                borderBottom: '1px solid var(--border-light)'
                            }}>
                                <div>
                                    <h3 style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, marginBottom: '0.25rem' }}>
                                        {kot.kot_number}
                                    </h3>
                                    <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                        Order #{kot.order?.order_number} • {new Date(kot.created_at).toLocaleTimeString()}
                                    </p>
                                </div>
                                <div className={getStatusBadge(kot.status)} style={{ textTransform: 'capitalize' }}>
                                    {kot.status}
                                </div>
                            </div>

                            {/* Order Items */}
                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <h4 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--spacing-md)' }}>
                                    Items:
                                </h4>
                                {kot.order_item && (
                                    <div style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        padding: 'var(--spacing-sm)',
                                        background: 'var(--bg-main)',
                                        borderRadius: 'var(--radius-md)',
                                        marginBottom: 'var(--spacing-sm)'
                                    }}>
                                        <span style={{ fontWeight: 500 }}>{kot.order_item.menu_item?.name || 'Unknown Item'}</span>
                                        <span style={{
                                            background: 'var(--bg-white)',
                                            padding: '0.25rem 0.75rem',
                                            borderRadius: 'var(--radius-sm)',
                                            fontWeight: 600,
                                            fontSize: 'var(--font-size-sm)'
                                        }}>
                                            ×{kot.order_item.quantity}
                                        </span>
                                    </div>
                                )}
                                {kot.order_item?.special_instructions && (
                                    <div style={{
                                        padding: 'var(--spacing-sm)',
                                        background: '#FEF3C7',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        marginTop: 'var(--spacing-sm)'
                                    }}>
                                        <strong>Note:</strong> {kot.order_item.special_instructions}
                                    </div>
                                )}
                            </div>

                            {/* Action Buttons */}
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                {kot.status === 'placed' && (
                                    <button
                                        onClick={() => updateStatus(kot.id, 'preparing')}
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                    >
                                        Start Preparing
                                    </button>
                                )}
                                {kot.status === 'preparing' && (
                                    <button
                                        onClick={() => updateStatus(kot.id, 'ready')}
                                        className="btn btn-primary"
                                        style={{ flex: 1 }}
                                    >
                                        Mark Ready
                                    </button>
                                )}
                                {kot.status === 'ready' && (
                                    <button
                                        onClick={() => updateStatus(kot.id, 'completed')}
                                        className="btn btn-primary"
                                        style={{ flex: 1, background: 'var(--success)' }}
                                    >
                                        Complete
                                    </button>
                                )}
                                {kot.status === 'completed' && (
                                    <div style={{
                                        flex: 1,
                                        textAlign: 'center',
                                        padding: 'var(--spacing-md)',
                                        color: 'var(--success)',
                                        fontWeight: 600,
                                        background: 'var(--bg-main)',
                                        borderRadius: 'var(--radius-md)'
                                    }}>
                                        Completed
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
