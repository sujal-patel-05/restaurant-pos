import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { menuAPI, ordersAPI, waiterAPI } from '../services/api';

/* ═══════════════════════════════════════════════════════════════
   WAITER APP — Premium Light Theme
   Tables → Menu → Cart → Send to Kitchen
   ═══════════════════════════════════════════════════════════════ */

// ─── Status Badge Colors ─────────────────────────────────────
const statusConfig = {
    placed: { bg: '#eff6ff', color: '#3b82f6', label: 'Placed' },
    preparing: { bg: '#fffbeb', color: '#f59e0b', label: 'Preparing' },
    ready: { bg: '#f0fdf4', color: '#22c55e', label: 'Ready' },
    served: { bg: '#f5f3ff', color: '#8b5cf6', label: 'Served' },
    completed: { bg: '#f9fafb', color: '#6b7280', label: 'Done' },
};

// ─── Table Config ────────────────────────────────────────────
const TABLES = Array.from({ length: 15 }, (_, i) => `T${i + 1}`);

export default function WaiterApp() {
    const navigate = useNavigate();
    const user = JSON.parse(localStorage.getItem('user') || '{}');

    // ─── State ───────────────────────────────────────────────
    const [view, setView] = useState('tables');
    const [selectedTable, setSelectedTable] = useState(null);
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [search, setSearch] = useState('');
    const [cart, setCart] = useState([]);
    const [specialInstructions, setSpecialInstructions] = useState('');
    const [myOrders, setMyOrders] = useState([]);
    const [loading, setLoading] = useState(false);
    const [placing, setPlacing] = useState(false);
    const [toast, setToast] = useState(null);
    const [editingNote, setEditingNote] = useState(null);

    // ─── Data Fetching ───────────────────────────────────────
    useEffect(() => {
        if (!user.id) { navigate('/waiter/login'); return; }
        fetchMenu();
        fetchMyOrders();
        const interval = setInterval(fetchMyOrders, 15000);
        return () => clearInterval(interval);
    }, []);

    const fetchMenu = async () => {
        setLoading(true);
        try {
            const [catRes, itemRes] = await Promise.all([menuAPI.getCategories(), menuAPI.getItems()]);
            setCategories(catRes.data || []);
            setMenuItems(itemRes.data || []);
        } catch (e) {
            showToast('Failed to load menu', 'error');
        } finally {
            setLoading(false);
        }
    };

    const fetchMyOrders = async () => {
        try {
            const res = await waiterAPI.getActiveOrders();
            setMyOrders(res.data?.orders || []);
        } catch (e) { /* silent */ }
    };

    // ─── Cart Logic ──────────────────────────────────────────
    const addToCart = (item) => {
        const existing = cart.find(c => c.id === item.id);
        if (existing) {
            setCart(cart.map(c => c.id === item.id ? { ...c, quantity: c.quantity + 1 } : c));
        } else {
            setCart([...cart, { ...item, quantity: 1, note: '' }]);
        }
        showToast(`${item.name} added`, 'success');
    };

    const updateQty = (id, delta) => {
        setCart(cart.map(c => {
            if (c.id !== id) return c;
            const newQty = c.quantity + delta;
            return newQty <= 0 ? null : { ...c, quantity: newQty };
        }).filter(Boolean));
    };

    const removeFromCart = (id) => setCart(cart.filter(c => c.id !== id));
    const cartTotal = cart.reduce((s, c) => s + c.price * c.quantity, 0);
    const cartCount = cart.reduce((s, c) => s + c.quantity, 0);

    // ─── Place Order ─────────────────────────────────────────
    const placeOrder = async () => {
        if (cart.length === 0 || !selectedTable) return;
        setPlacing(true);
        try {
            await ordersAPI.createOrder({
                order_type: 'dine_in',
                order_source: 'waiter',
                table_number: selectedTable,
                waiter_name: user.full_name || user.username,
                special_instructions: specialInstructions || undefined,
                items: cart.map(c => ({
                    menu_item_id: c.id,
                    quantity: c.quantity,
                    special_instructions: c.note || undefined,
                })),
            });
            showToast(`Order sent for ${selectedTable}!`, 'success');
            setCart([]);
            setSpecialInstructions('');
            setView('orders');
            fetchMyOrders();
        } catch (e) {
            showToast(e.response?.data?.detail || 'Failed to place order', 'error');
        } finally {
            setPlacing(false);
        }
    };

    const showToast = (msg, type = 'info') => {
        setToast({ msg, type });
        setTimeout(() => setToast(null), 2500);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        navigate('/waiter/login');
    };

    const filteredItems = menuItems.filter(item => {
        if (!item.is_available) return false;
        if (selectedCategory && item.category_id !== selectedCategory) return false;
        if (search && !item.name.toLowerCase().includes(search.toLowerCase())) return false;
        return true;
    });

    // ─── Nav Tabs ────────────────────────────────────────────
    const tabs = [
        { id: 'tables', label: 'Tables', icon: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z' },
        { id: 'menu', label: 'Menu', icon: 'M3 2v7c0 1.1.9 2 2 2h4a2 2 0 0 0 2-2V2M7 2v20M21 15V2a5 5 0 0 0-5 5v6c0 1.1.9 2 2 2h3m0 0v7' },
        { id: 'cart', label: 'Cart', icon: 'M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4zM3 6h18M16 10a4 4 0 0 1-8 0', badge: cartCount },
        { id: 'orders', label: 'Orders', icon: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8', badge: myOrders.length },
    ];

    return (
        <div style={S.shell}>
            <style>{CSS}</style>

            {/* ─── Header ─── */}
            <header style={S.header}>
                <div style={S.headerLeft}>
                    <div style={S.avatar}>{(user.full_name || 'W')[0]}</div>
                    <div>
                        <h1 style={S.headerName}>{user.full_name || user.username}</h1>
                        <p style={S.headerMeta}>
                            {selectedTable ? (
                                <><span style={S.tablePill}>{selectedTable}</span> selected</>
                            ) : 'Select a table to begin'}
                        </p>
                    </div>
                </div>
                <button onClick={handleLogout} style={S.logoutBtn} title="Sign out">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                </button>
            </header>

            {/* ─── Main ─── */}
            <main style={S.main}>
                {view === 'tables' && renderTables()}
                {view === 'menu' && renderMenu()}
                {view === 'cart' && renderCart()}
                {view === 'orders' && renderOrders()}
            </main>

            {/* ─── Bottom Nav ─── */}
            <nav style={S.bottomNav}>
                {tabs.map(t => (
                    <button key={t.id} onClick={() => setView(t.id)} style={{
                        ...S.navBtn,
                        color: view === t.id ? '#6366f1' : '#94a3b8',
                    }}>
                        <div style={{ position: 'relative', display: 'flex' }}>
                            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                <path d={t.icon} />
                            </svg>
                            {t.badge > 0 && <span style={S.navBadge}>{t.badge}</span>}
                        </div>
                        <span style={{ fontSize: 11, fontWeight: view === t.id ? 600 : 500 }}>{t.label}</span>
                        {view === t.id && <div style={S.navIndicator} />}
                    </button>
                ))}
            </nav>

            {/* ─── Toast ─── */}
            {toast && (
                <div className="waiter-toast" style={{
                    ...S.toast,
                    background: toast.type === 'error' ? '#fef2f2' : '#f0fdf4',
                    color: toast.type === 'error' ? '#dc2626' : '#16a34a',
                    borderColor: toast.type === 'error' ? '#fecaca' : '#bbf7d0',
                }}>
                    {toast.type === 'error' ? '⚠️' : '✓'} {toast.msg}
                </div>
            )}
        </div>
    );

    /* ════════════════════════════════════════════════════════════
       VIEW: TABLES
       ════════════════════════════════════════════════════════════ */
    function renderTables() {
        return (
            <div style={S.viewWrap}>
                <div style={S.viewHeader}>
                    <h2 style={S.viewTitle}>Select Table</h2>
                    <p style={S.viewSub}>Tap a table to start taking orders</p>
                </div>
                <div style={S.tableGrid}>
                    {TABLES.map(t => {
                        const hasOrders = myOrders.some(o => o.table_number === t);
                        const selected = selectedTable === t;
                        return (
                            <button
                                key={t}
                                onClick={() => { setSelectedTable(t); setView('menu'); }}
                                className="waiter-table-card"
                                style={{
                                    ...S.tableCard,
                                    ...(selected ? S.tableCardSelected : {}),
                                    ...(hasOrders && !selected ? S.tableCardActive : {}),
                                }}
                            >
                                <span style={S.tableNum}>{t}</span>
                                {hasOrders && <span style={{
                                    ...S.tableStatus,
                                    color: selected ? '#6366f1' : '#f59e0b',
                                }}>● Active</span>}
                                {selected && !hasOrders && <span style={{ ...S.tableStatus, color: '#6366f1' }}>Selected</span>}
                            </button>
                        );
                    })}
                </div>
            </div>
        );
    }

    /* ════════════════════════════════════════════════════════════
       VIEW: MENU
       ════════════════════════════════════════════════════════════ */
    function renderMenu() {
        if (!selectedTable) {
            return (
                <div style={S.emptyState}>
                    <div style={S.emptyIcon}>🍽️</div>
                    <p style={S.emptyText}>Select a table first</p>
                    <button onClick={() => setView('tables')} style={S.primaryBtn}>Go to Tables</button>
                </div>
            );
        }

        return (
            <div style={S.viewWrap}>
                {/* Search */}
                <div style={S.searchWrap}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search menu items..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        className="waiter-search-input"
                    />
                    {search && (
                        <button onClick={() => setSearch('')} style={S.clearBtn}>✕</button>
                    )}
                </div>

                {/* Categories */}
                <div style={S.catScroll}>
                    <button
                        onClick={() => setSelectedCategory(null)}
                        className="waiter-cat-chip"
                        style={{
                            ...S.catChip,
                            ...(selectedCategory === null ? S.catChipActive : {}),
                        }}
                    >All</button>
                    {categories.map(cat => (
                        <button
                            key={cat.id}
                            onClick={() => setSelectedCategory(cat.id)}
                            className="waiter-cat-chip"
                            style={{
                                ...S.catChip,
                                ...(selectedCategory === cat.id ? S.catChipActive : {}),
                            }}
                        >{cat.name}</button>
                    ))}
                </div>

                {/* Items */}
                <div style={S.menuList}>
                    {filteredItems.map(item => {
                        const inCart = cart.find(c => c.id === item.id);
                        return (
                            <div key={item.id} className="waiter-menu-card" style={S.menuCard}>
                                <div style={S.menuCardBody}>
                                    <div style={{ flex: 1 }}>
                                        <h3 style={S.menuName}>{item.name}</h3>
                                        <div style={S.menuMeta}>
                                            <span style={S.menuPrice}>₹{Number(item.price).toFixed(0)}</span>
                                            {item.category_name && <span style={S.menuCat}>{item.category_name}</span>}
                                        </div>
                                    </div>
                                    {inCart ? (
                                        <div style={S.qtyRow}>
                                            <button onClick={() => updateQty(item.id, -1)} style={S.qtyBtn}>−</button>
                                            <span style={S.qtyNum}>{inCart.quantity}</span>
                                            <button onClick={() => updateQty(item.id, 1)} style={S.qtyBtn}>+</button>
                                        </div>
                                    ) : (
                                        <button onClick={() => addToCart(item)} className="waiter-add-btn" style={S.addBtn}>
                                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                        </button>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    {filteredItems.length === 0 && (
                        <div style={S.emptyState}>
                            <p style={S.emptyText}>No items found</p>
                        </div>
                    )}
                </div>
            </div>
        );
    }

    /* ════════════════════════════════════════════════════════════
       VIEW: CART
       ════════════════════════════════════════════════════════════ */
    function renderCart() {
        if (cart.length === 0) {
            return (
                <div style={S.emptyState}>
                    <div style={S.emptyIcon}>🛒</div>
                    <p style={S.emptyText}>Your cart is empty</p>
                    <button onClick={() => setView('menu')} style={S.primaryBtn}>Browse Menu</button>
                </div>
            );
        }

        return (
            <div style={S.viewWrap}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={S.viewTitle}>Cart — <span style={{ color: '#6366f1' }}>{selectedTable || '?'}</span></h2>
                    <button onClick={() => setCart([])} style={S.ghostBtn}>Clear All</button>
                </div>

                {/* Cart Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cart.map(item => (
                        <div key={item.id} className="waiter-menu-card" style={S.cartCard}>
                            <div style={S.cartTop}>
                                <div style={{ flex: 1 }}>
                                    <h4 style={S.cartItemName}>{item.name}</h4>
                                    <span style={{ fontSize: 14, color: '#6366f1', fontWeight: 600 }}>
                                        ₹{(item.price * item.quantity).toFixed(0)}
                                    </span>
                                    {item.note && <p style={S.cartNote}>📝 {item.note}</p>}
                                </div>
                                <div style={S.cartActions}>
                                    <button onClick={() => setEditingNote(editingNote === item.id ? null : item.id)} style={S.iconBtn} title="Add note">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                    <div style={S.qtyRow}>
                                        <button onClick={() => updateQty(item.id, -1)} style={S.qtyBtn}>−</button>
                                        <span style={S.qtyNum}>{item.quantity}</span>
                                        <button onClick={() => updateQty(item.id, 1)} style={S.qtyBtn}>+</button>
                                    </div>
                                    <button onClick={() => removeFromCart(item.id)} style={{ ...S.iconBtn, color: '#ef4444' }} title="Remove">
                                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                            <polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                            {editingNote === item.id && (
                                <input
                                    type="text"
                                    placeholder="e.g. Extra spicy, no onion..."
                                    value={item.note}
                                    onChange={e => setCart(cart.map(c => c.id === item.id ? { ...c, note: e.target.value } : c))}
                                    className="waiter-note-input"
                                    autoFocus
                                />
                            )}
                        </div>
                    ))}
                </div>

                {/* Special Instructions */}
                <div style={S.instrSection}>
                    <label style={S.instrLabel}>Special Instructions</label>
                    <textarea
                        value={specialInstructions}
                        onChange={e => setSpecialInstructions(e.target.value)}
                        placeholder="e.g. Serve all dishes together..."
                        className="waiter-instr-textarea"
                        rows={2}
                    />
                </div>

                {/* Totals */}
                <div style={S.totalCard}>
                    <div style={S.totalRow}>
                        <span style={{ color: '#64748b' }}>Subtotal</span>
                        <span style={{ fontWeight: 600 }}>₹{cartTotal.toFixed(0)}</span>
                    </div>
                    <div style={S.totalRow}>
                        <span style={{ color: '#94a3b8' }}>GST (5%)</span>
                        <span style={{ color: '#94a3b8' }}>₹{(cartTotal * 0.05).toFixed(0)}</span>
                    </div>
                    <div style={S.totalDivider} />
                    <div style={S.totalRow}>
                        <span style={{ fontWeight: 700, fontSize: 17 }}>Total</span>
                        <span style={{ fontWeight: 700, fontSize: 17, color: '#6366f1' }}>₹{(cartTotal * 1.05).toFixed(0)}</span>
                    </div>
                </div>

                {/* Send Button */}
                <button
                    onClick={placeOrder}
                    disabled={placing || !selectedTable}
                    className="waiter-send-btn"
                    style={{ ...S.sendBtn, opacity: placing ? 0.7 : 1 }}
                >
                    {placing ? (
                        <><div style={S.btnSpinner} /> Sending...</>
                    ) : (
                        <><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13" /><polygon points="22 2 15 22 11 13 2 9 22 2" /></svg> Send to Kitchen</>
                    )}
                </button>
            </div>
        );
    }

    /* ════════════════════════════════════════════════════════════
       VIEW: ORDERS
       ════════════════════════════════════════════════════════════ */
    function renderOrders() {
        return (
            <div style={S.viewWrap}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                    <h2 style={S.viewTitle}>My Orders</h2>
                    <button onClick={fetchMyOrders} style={S.ghostBtn}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" /><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" /></svg>
                        Refresh
                    </button>
                </div>
                {myOrders.length === 0 ? (
                    <div style={S.emptyState}>
                        <div style={S.emptyIcon}>📋</div>
                        <p style={S.emptyText}>No active orders</p>
                    </div>
                ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                        {myOrders.map(order => {
                            const sc = statusConfig[order.status] || statusConfig.placed;
                            return (
                                <div key={order.id} className="waiter-menu-card" style={S.orderCard}>
                                    <div style={S.orderHeader}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <span style={S.orderNum}>{order.order_number}</span>
                                            <span style={S.orderTable}>{order.table_number}</span>
                                        </div>
                                        <span style={{ ...S.statusBadge, background: sc.bg, color: sc.color }}>{sc.label}</span>
                                    </div>
                                    <div style={S.orderItems}>
                                        {order.items?.map((item, i) => (
                                            <div key={i} style={S.orderItemRow}>
                                                <span style={{ color: '#334155' }}>{item.quantity}× {item.name}</span>
                                                <span style={{ color: '#94a3b8' }}>₹{(item.unit_price * item.quantity).toFixed(0)}</span>
                                            </div>
                                        ))}
                                    </div>
                                    <div style={S.orderFooter}>
                                        <span style={{ fontSize: 12, color: '#94a3b8' }}>
                                            {order.created_at ? new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                                        </span>
                                        <span style={{ fontWeight: 700, color: '#1e293b' }}>₹{order.total_amount?.toFixed(0)}</span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    }
}

/* ═══════════════════════════════════════════════════════════════
   STYLES — Premium Light Theme
   ═══════════════════════════════════════════════════════════════ */
const S = {
    shell: {
        minHeight: '100vh',
        maxWidth: 480,
        margin: '0 auto',
        background: '#f8fafc',
        fontFamily: "'Inter', sans-serif",
        color: '#1e293b',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
    },

    /* ── Header ── */
    header: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '14px 20px',
        background: '#fff',
        borderBottom: '1px solid #f1f5f9',
        position: 'sticky',
        top: 0,
        zIndex: 50,
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    },
    headerLeft: {
        display: 'flex',
        alignItems: 'center',
        gap: 12,
    },
    avatar: {
        width: 40,
        height: 40,
        borderRadius: 12,
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontWeight: 700,
        fontSize: 16,
        color: '#fff',
    },
    headerName: {
        fontSize: 15,
        fontWeight: 700,
        margin: 0,
        color: '#1e293b',
    },
    headerMeta: {
        fontSize: 12,
        color: '#94a3b8',
        margin: 0,
        display: 'flex',
        alignItems: 'center',
        gap: 4,
    },
    tablePill: {
        display: 'inline-block',
        padding: '1px 6px',
        borderRadius: 6,
        background: '#eef2ff',
        color: '#6366f1',
        fontWeight: 700,
        fontSize: 11,
    },
    logoutBtn: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 10,
        padding: 8,
        color: '#64748b',
        cursor: 'pointer',
        display: 'flex',
    },

    /* ── Main ── */
    main: {
        flex: 1,
        paddingBottom: 88,
        overflowY: 'auto',
    },
    viewWrap: {
        padding: 20,
    },
    viewTitle: {
        fontSize: 20,
        fontWeight: 800,
        margin: '0 0 4px',
        color: '#0f172a',
        letterSpacing: '-0.3px',
    },
    viewSub: {
        fontSize: 13,
        color: '#94a3b8',
        margin: '0 0 20px',
        fontWeight: 400,
    },
    viewHeader: { marginBottom: 4 },

    /* ── Tables ── */
    tableGrid: {
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 12,
    },
    tableCard: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '22px 12px',
        borderRadius: 16,
        border: '1.5px solid #e2e8f0',
        background: '#fff',
        cursor: 'pointer',
        transition: 'all 0.2s ease',
        gap: 4,
        fontFamily: "'Inter', sans-serif",
    },
    tableCardSelected: {
        border: '2px solid #6366f1',
        background: '#eef2ff',
        boxShadow: '0 0 0 4px rgba(99,102,241,0.08)',
    },
    tableCardActive: {
        border: '1.5px solid #fcd34d',
        background: '#fffbeb',
    },
    tableNum: {
        fontSize: 18,
        fontWeight: 800,
        color: '#1e293b',
    },
    tableStatus: {
        fontSize: 10,
        fontWeight: 700,
        textTransform: 'uppercase',
        letterSpacing: 0.5,
    },

    /* ── Search ── */
    searchWrap: {
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '12px 16px',
        borderRadius: 14,
        background: '#fff',
        border: '1.5px solid #e2e8f0',
        marginBottom: 14,
    },
    clearBtn: {
        background: 'none',
        border: 'none',
        color: '#94a3b8',
        cursor: 'pointer',
        padding: 4,
        fontSize: 14,
        fontWeight: 600,
    },

    /* ── Categories ── */
    catScroll: {
        display: 'flex',
        gap: 8,
        overflowX: 'auto',
        paddingBottom: 14,
        marginBottom: 6,
        scrollbarWidth: 'none',
    },
    catChip: {
        padding: '8px 18px',
        borderRadius: 100,
        border: '1.5px solid #e2e8f0',
        fontSize: 13,
        fontWeight: 500,
        fontFamily: "'Inter', sans-serif",
        cursor: 'pointer',
        whiteSpace: 'nowrap',
        transition: 'all 0.2s ease',
        background: '#fff',
        color: '#64748b',
    },
    catChipActive: {
        background: '#6366f1',
        color: '#fff',
        borderColor: '#6366f1',
        boxShadow: '0 2px 8px rgba(99,102,241,0.25)',
    },

    /* ── Menu ── */
    menuList: {
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
    },
    menuCard: {
        padding: 16,
        borderRadius: 14,
        background: '#fff',
        border: '1px solid #f1f5f9',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
    },
    menuCardBody: {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
    menuName: {
        fontSize: 15,
        fontWeight: 600,
        margin: '0 0 4px',
        color: '#1e293b',
    },
    menuMeta: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
    },
    menuPrice: {
        fontSize: 14,
        color: '#6366f1',
        fontWeight: 700,
    },
    menuCat: {
        fontSize: 11,
        color: '#94a3b8',
        padding: '2px 8px',
        borderRadius: 6,
        background: '#f8fafc',
    },
    addBtn: {
        width: 42,
        height: 42,
        borderRadius: 12,
        background: '#eef2ff',
        border: '1.5px solid #c7d2fe',
        color: '#6366f1',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        flexShrink: 0,
    },

    /* ── Qty control ── */
    qtyRow: {
        display: 'flex',
        alignItems: 'center',
        gap: 0,
        background: '#f8fafc',
        borderRadius: 10,
        border: '1.5px solid #e2e8f0',
    },
    qtyBtn: {
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        fontSize: 16,
        fontWeight: 700,
        color: '#6366f1',
        fontFamily: "'Inter', sans-serif",
    },
    qtyNum: {
        minWidth: 24,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: 700,
        color: '#1e293b',
    },

    /* ── Cart ── */
    cartCard: {
        padding: 16,
        borderRadius: 14,
        background: '#fff',
        border: '1px solid #f1f5f9',
    },
    cartTop: {
        display: 'flex',
        alignItems: 'flex-start',
        gap: 12,
    },
    cartItemName: {
        fontSize: 15,
        fontWeight: 600,
        margin: '0 0 4px',
        color: '#1e293b',
    },
    cartNote: {
        fontSize: 12,
        color: '#94a3b8',
        margin: '4px 0 0',
        fontStyle: 'italic',
    },
    cartActions: {
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        flexShrink: 0,
    },
    iconBtn: {
        background: '#f8fafc',
        border: '1px solid #e2e8f0',
        borderRadius: 8,
        padding: 6,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        color: '#64748b',
    },
    ghostBtn: {
        background: 'none',
        border: 'none',
        color: '#6366f1',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 4,
        fontFamily: "'Inter', sans-serif",
    },
    instrSection: {
        marginTop: 20,
    },
    instrLabel: {
        display: 'block',
        fontSize: 13,
        fontWeight: 600,
        color: '#475569',
        marginBottom: 6,
    },
    totalCard: {
        marginTop: 16,
        padding: 16,
        borderRadius: 14,
        background: '#fff',
        border: '1px solid #f1f5f9',
    },
    totalRow: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '4px 0',
        fontSize: 14,
    },
    totalDivider: {
        height: 1,
        background: '#f1f5f9',
        margin: '8px 0',
    },
    sendBtn: {
        width: '100%',
        padding: 15,
        border: 'none',
        borderRadius: 14,
        fontSize: 15,
        fontWeight: 600,
        fontFamily: "'Inter', sans-serif",
        color: '#fff',
        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginTop: 16,
        boxShadow: '0 4px 14px rgba(99,102,241,0.3)',
    },
    btnSpinner: {
        width: 18,
        height: 18,
        border: '2px solid rgba(255,255,255,0.3)',
        borderTopColor: '#fff',
        borderRadius: '50%',
        animation: 'spin 0.6s linear infinite',
    },

    /* ── Orders ── */
    orderCard: {
        padding: 16,
        borderRadius: 14,
        background: '#fff',
        border: '1px solid #f1f5f9',
    },
    orderHeader: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    orderNum: {
        fontSize: 14,
        fontWeight: 700,
        color: '#1e293b',
    },
    orderTable: {
        fontSize: 12,
        fontWeight: 600,
        padding: '2px 8px',
        borderRadius: 6,
        background: '#eef2ff',
        color: '#6366f1',
    },
    statusBadge: {
        fontSize: 11,
        fontWeight: 600,
        padding: '4px 10px',
        borderRadius: 8,
    },
    orderItems: {
        display: 'flex',
        flexDirection: 'column',
        gap: 4,
        paddingBottom: 10,
        borderBottom: '1px solid #f1f5f9',
    },
    orderItemRow: {
        display: 'flex',
        justifyContent: 'space-between',
        fontSize: 13,
    },
    orderFooter: {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingTop: 10,
    },

    /* ── Empty State ── */
    emptyState: {
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '60px 20px',
        gap: 12,
    },
    emptyIcon: {
        fontSize: 48,
        marginBottom: 4,
    },
    emptyText: {
        fontSize: 15,
        color: '#94a3b8',
        fontWeight: 500,
        margin: 0,
    },
    primaryBtn: {
        padding: '10px 24px',
        borderRadius: 12,
        border: 'none',
        background: '#6366f1',
        color: '#fff',
        fontSize: 14,
        fontWeight: 600,
        cursor: 'pointer',
        fontFamily: "'Inter', sans-serif",
        marginTop: 4,
    },

    /* ── Bottom Nav ── */
    bottomNav: {
        position: 'fixed',
        bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 480,
        display: 'flex',
        justifyContent: 'space-around',
        background: '#fff',
        borderTop: '1px solid #f1f5f9',
        padding: '8px 0 12px',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
    },
    navBtn: {
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 2,
        background: 'none',
        border: 'none',
        cursor: 'pointer',
        padding: '4px 0',
        position: 'relative',
        fontFamily: "'Inter', sans-serif",
    },
    navBadge: {
        position: 'absolute',
        top: -4,
        right: -8,
        minWidth: 16,
        height: 16,
        borderRadius: 8,
        background: '#ef4444',
        color: '#fff',
        fontSize: 9,
        fontWeight: 700,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '0 4px',
    },
    navIndicator: {
        position: 'absolute',
        top: -9,
        width: 20,
        height: 3,
        borderRadius: 3,
        background: '#6366f1',
    },

    /* ── Toast ── */
    toast: {
        position: 'fixed',
        bottom: 100,
        left: '50%',
        transform: 'translateX(-50%)',
        padding: '12px 24px',
        borderRadius: 14,
        fontSize: 13,
        fontWeight: 600,
        zIndex: 100,
        border: '1px solid',
        boxShadow: '0 4px 16px rgba(0,0,0,0.06)',
        animation: 'fadeInUp 0.3s ease-out',
        fontFamily: "'Inter', sans-serif",
    },
};

const CSS = `
    @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
    * { box-sizing: border-box; }

    .waiter-search-input {
        flex: 1;
        background: transparent;
        border: none;
        color: #1e293b;
        font-size: 15px;
        font-family: 'Inter', sans-serif;
        outline: none;
    }
    .waiter-search-input::placeholder { color: #94a3b8; }

    .waiter-table-card:hover {
        transform: translateY(-2px);
        box-shadow: 0 4px 12px rgba(0,0,0,0.06);
    }
    .waiter-table-card:active {
        transform: translateY(0);
    }

    .waiter-menu-card {
        transition: all 0.15s ease;
    }
    .waiter-menu-card:hover {
        box-shadow: 0 2px 8px rgba(0,0,0,0.04);
    }

    .waiter-add-btn:hover {
        background: #6366f1 !important;
        color: #fff !important;
        border-color: #6366f1 !important;
    }

    .waiter-cat-chip:hover {
        transform: translateY(-1px);
    }

    .waiter-note-input {
        width: 100%;
        padding: 10px 14px;
        margin-top: 10px;
        border: 1.5px solid #e2e8f0;
        border-radius: 10px;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        color: #1e293b;
        background: #f8fafc;
        outline: none;
    }
    .waiter-note-input:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
    }

    .waiter-instr-textarea {
        width: 100%;
        padding: 12px 14px;
        border: 1.5px solid #e2e8f0;
        border-radius: 12px;
        font-size: 13px;
        font-family: 'Inter', sans-serif;
        color: #1e293b;
        background: #fff;
        outline: none;
        resize: none;
    }
    .waiter-instr-textarea:focus {
        border-color: #6366f1;
        box-shadow: 0 0 0 3px rgba(99,102,241,0.08);
    }

    .waiter-send-btn:hover:not(:disabled) {
        transform: translateY(-1px);
        box-shadow: 0 6px 20px rgba(99,102,241,0.35);
    }
    .waiter-send-btn:active:not(:disabled) {
        transform: translateY(0);
    }

    @keyframes spin {
        to { transform: rotate(360deg); }
    }
    @keyframes fadeInUp {
        from { opacity: 0; transform: translate(-50%, 12px); }
        to { opacity: 1; transform: translate(-50%, 0); }
    }

    /* Hide scrollbars on category scroll */
    ::-webkit-scrollbar { width: 0; height: 0; }
`;
