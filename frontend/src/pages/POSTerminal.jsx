import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { menuAPI, ordersAPI } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

function POSTerminal() {
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [orderType, setOrderType] = useState('dine-in');
    const [tableNumber, setTableNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);

    useEffect(() => {
        fetchMenuData();
    }, []);

    const fetchMenuData = async () => {
        try {
            setLoading(true);
            const [categoriesRes, itemsRes] = await Promise.all([
                menuAPI.getCategories(),
                menuAPI.getItems()
            ]);

            setCategories(categoriesRes.data || []);
            setMenuItems(itemsRes.data || []);
        } catch (error) {
            console.error('Error fetching menu data:', error);
            alert('Error loading menu. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const addToCart = (item) => {
        const existingItem = cart.find(i => i.id === item.id);
        if (existingItem) {
            setCart(cart.map(i =>
                i.id === item.id ? { ...i, quantity: i.quantity + 1 } : i
            ));
        } else {
            setCart([...cart, { ...item, quantity: 1 }]);
        }
    };

    const removeFromCart = (itemId) => {
        setCart(cart.filter(i => i.id !== itemId));
    };

    const updateQuantity = (itemId, quantity) => {
        if (quantity === 0) {
            removeFromCart(itemId);
        } else {
            setCart(cart.map(i =>
                i.id === itemId ? { ...i, quantity } : i
            ));
        }
    };

    const total = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    const placeOrder = async () => {
        if (cart.length === 0) {
            alert('Cart is empty!');
            return;
        }

        // Check for authentication
        const token = localStorage.getItem('token');
        if (!token) {
            alert('You must be logged in to place an order. Redirecting to login...');
            window.location.href = '/login';
            return;
        }

        if (orderType === 'dine-in' && !tableNumber.trim()) {
            alert('Please enter a table number for Dine-In orders.');
            return;
        }

        try {
            const orderData = {
                order_type: orderType.replace('-', '_'), // 'dine-in' -> 'dine_in'
                table_number: orderType === 'dine-in' ? tableNumber : null,
                items: cart.map(item => ({
                    menu_item_id: item.id,
                    quantity: item.quantity
                }))
            };

            await ordersAPI.createOrder(orderData);
            alert('Order placed successfully!');
            setCart([]);
            setTableNumber('');
        } catch (error) {
            console.error('Error placing order:', error);
            const errorDetail = error.response?.data?.detail;
            let errorMessage = 'Failed to place order. Please try again.';

            if (typeof errorDetail === 'string') {
                errorMessage = errorDetail;
            } else if (Array.isArray(errorDetail)) {
                // Handle Pydantic validation errors
                errorMessage = errorDetail.map(err => `${err.loc.join('.')}: ${err.msg}`).join('\n');
            } else if (typeof errorDetail === 'object') {
                errorMessage = JSON.stringify(errorDetail);
            }

            alert(`Error: ${errorMessage}`);
        }
    };

    const filteredItems = selectedCategory
        ? menuItems.filter(item => item.category_id === selectedCategory)
        : menuItems;

    const actions = (
        <>
            <button className="btn btn-secondary" onClick={fetchMenuData}>
                <span>🔄</span>
            </button>
            <button className="btn btn-primary" onClick={placeOrder} disabled={cart.length === 0}>
                <span>✓</span>
                Place Order
            </button>
        </>
    );

    return (
        <AppLayout
            title="POS Terminal"
            subtitle="Take orders and process sales"
            actions={actions}
        >
            {loading ? (
                <div style={{
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    minHeight: '400px'
                }}>
                    <LoadingSpinner size="lg" />
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 400px', gap: 'var(--spacing-xl)', height: 'calc(100vh - 180px)' }}>
                    {/* Menu Items */}
                    <div>
                        {/* Order Type Selector */}
                        <div className="mb-lg">
                            <div style={{ display: 'flex', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-lg)' }}>
                                {['dine-in', 'takeaway', 'delivery'].map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setOrderType(type)}
                                        className={`btn ${orderType === type ? 'btn-primary' : 'btn-secondary'}`}
                                        style={{ textTransform: 'capitalize' }}
                                    >
                                        {type.replace('-', ' ')}
                                    </button>
                                ))}
                            </div>

                            {/* Table Number Input for Dine-In */}
                            {orderType === 'dine-in' && (
                                <div className="mb-lg fade-in" style={{
                                    animation: 'fadeInUp 0.3s ease-out',
                                    background: 'var(--bg-white)',
                                    padding: 'var(--spacing-lg)',
                                    borderRadius: 'var(--radius-lg)',
                                    border: '1px solid var(--border-light)',
                                    boxShadow: 'var(--shadow-sm)'
                                }}>
                                    <div style={{ position: 'relative' }}>
                                        <label style={{
                                            display: 'block',
                                            marginBottom: 'var(--spacing-sm)',
                                            fontWeight: 600,
                                            color: 'var(--text-secondary)',
                                            fontSize: 'var(--font-size-sm)',
                                            textTransform: 'uppercase',
                                            letterSpacing: '0.05em'
                                        }}>
                                            Table Number <span style={{ color: 'var(--error)' }}>*</span>
                                        </label>
                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                            <span style={{
                                                position: 'absolute',
                                                left: '1rem',
                                                fontSize: '1.25rem',
                                                color: 'var(--primary)'
                                            }}>🪑</span>
                                            <input
                                                type="text"
                                                value={tableNumber}
                                                onChange={(e) => setTableNumber(e.target.value)}
                                                placeholder="e.g. T-12"
                                                className="form-input"
                                                style={{
                                                    width: '100%',
                                                    padding: '0.875rem 1rem 0.875rem 3rem',
                                                    fontSize: 'var(--font-size-lg)',
                                                    fontWeight: 600,
                                                    color: 'var(--text-primary)',
                                                    background: 'var(--bg-main)',
                                                    border: '2px solid var(--border-light)',
                                                    borderRadius: 'var(--radius-md)',
                                                    transition: 'all 0.2s ease',
                                                    outline: 'none'
                                                }}
                                                onFocus={(e) => {
                                                    e.target.style.borderColor = 'var(--primary)';
                                                    e.target.style.boxShadow = '0 0 0 3px rgba(246, 48, 73, 0.1)';
                                                    e.target.style.background = 'var(--bg-white)';
                                                }}
                                                onBlur={(e) => {
                                                    e.target.style.borderColor = 'var(--border-light)';
                                                    e.target.style.boxShadow = 'none';
                                                    e.target.style.background = 'var(--bg-main)';
                                                }}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Category Filter */}
                            {categories.length > 0 && (
                                <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                                    <button
                                        onClick={() => setSelectedCategory(null)}
                                        className={`btn ${!selectedCategory ? 'btn-primary' : 'btn-secondary'}`}
                                    >
                                        All Items
                                    </button>
                                    {categories.map(cat => (
                                        <button
                                            key={cat.id}
                                            onClick={() => setSelectedCategory(cat.id)}
                                            className={`btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* Menu Grid */}
                        {filteredItems.length === 0 ? (
                            <div className="stat-card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    No menu items available. Please add items in Menu Management.
                                </p>
                            </div>
                        ) : (
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
                                gap: 'var(--spacing-lg)',
                                overflowY: 'auto',
                                maxHeight: 'calc(100vh - 350px)'
                            }}>
                                {filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => item.is_available && addToCart(item)}
                                        className="module-card"
                                        style={{
                                            cursor: item.is_available ? 'pointer' : 'not-allowed',
                                            padding: 'var(--spacing-lg)',
                                            opacity: item.is_available ? 1 : 0.5
                                        }}
                                    >
                                        <div className="badge badge-success" style={{ marginBottom: 'var(--spacing-md)' }}>
                                            {categories.find(c => c.id === item.category_id)?.name || 'Uncategorized'}
                                        </div>
                                        <h3 style={{ fontSize: 'var(--font-size-lg)', marginBottom: 'var(--spacing-sm)' }}>
                                            {item.name}
                                        </h3>
                                        {item.description && (
                                            <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-sm)' }}>
                                                {item.description}
                                            </p>
                                        )}
                                        <p style={{ fontSize: 'var(--font-size-xl)', fontWeight: 700, color: 'var(--primary)' }}>
                                            ₹{parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                        </p>
                                        {!item.is_available && (
                                            <div className="badge badge-error" style={{ marginTop: 'var(--spacing-sm)' }}>
                                                Out of Stock
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Cart */}
                    <div className="stat-card" style={{
                        display: 'flex',
                        flexDirection: 'column',
                        height: 'fit-content',
                        position: 'sticky',
                        top: 0,
                        background: 'rgba(255, 255, 255, 0.95)',
                        backdropFilter: 'blur(10px)',
                        WebkitBackdropFilter: 'blur(10px)',
                        boxShadow: 'var(--shadow-xl)'
                    }}>
                        <h2 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)' }}>
                            Current Order
                        </h2>

                        {/* Cart Items */}
                        <div style={{ flex: 1, overflowY: 'auto', marginBottom: 'var(--spacing-lg)', maxHeight: '400px' }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                    <div style={{ fontSize: '3rem', marginBottom: 'var(--spacing-md)' }}>🛒</div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                        Cart is empty
                                    </p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div
                                        key={item.id}
                                        style={{
                                            display: 'flex',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            padding: 'var(--spacing-md)',
                                            borderBottom: '1px solid var(--border-light)',
                                        }}
                                    >
                                        <div style={{ flex: 1 }}>
                                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                                            <div style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)' }}>
                                                ₹{parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-md)' }}>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.25rem 0.75rem' }}
                                            >
                                                -
                                            </button>
                                            <span style={{ fontWeight: 600, minWidth: '20px', textAlign: 'center' }}>
                                                {item.quantity}
                                            </span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.25rem 0.75rem' }}
                                            >
                                                +
                                            </button>
                                            <button
                                                onClick={() => removeFromCart(item.id)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.25rem 0.75rem', color: 'var(--error)' }}
                                            >
                                                ×
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Total */}
                        <div style={{ borderTop: '2px solid var(--border-medium)', paddingTop: 'var(--spacing-lg)' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                                <span style={{ fontSize: 'var(--font-size-lg)', fontWeight: 600 }}>Total</span>
                                <span style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--primary)' }}>
                                    ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                </span>
                            </div>
                            <button
                                onClick={placeOrder}
                                className="btn btn-primary"
                                style={{ width: '100%', padding: 'var(--spacing-lg)' }}
                                disabled={cart.length === 0}
                            >
                                Place Order
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

export default POSTerminal;
