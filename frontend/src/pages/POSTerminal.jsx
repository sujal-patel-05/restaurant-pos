import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { menuAPI, ordersAPI, billingAPI } from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';
import { Utensils } from 'lucide-react';

function POSTerminal() {
    const [menuItems, setMenuItems] = useState([]);
    const [categories, setCategories] = useState([]);
    const [cart, setCart] = useState([]);
    const [orderType, setOrderType] = useState('dine-in');
    const [tableNumber, setTableNumber] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [paymentMode, setPaymentMode] = useState('cash'); // Default to cash

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
    const backendBaseUrl = `http://${window.location.hostname}:8000`;

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
            const billTab = window.open('', '_blank');
            if (billTab && billTab.document) {
                billTab.document.write('<title>Generating Bill...</title><p style="font-family: Arial, sans-serif; padding: 16px;">Generating bill, please wait...</p>');
            }

            const orderData = {
                order_type: orderType.replace('-', '_'), // 'dine-in' -> 'dine_in'
                table_number: orderType === 'dine-in' ? tableNumber : null,
                payment_mode: paymentMode, // Send selected payment mode
                items: cart.map(item => ({
                    menu_item_id: item.id,
                    quantity: item.quantity
                }))
            };

            const response = await ordersAPI.createOrder(orderData);
            const orderResult = response.data;

            // Clear the cart immediately
            setCart([]);
            setTableNumber('');

            // Auto-generate invoice and open in new tab
            if (orderResult.order_id) {
                try {
                    const invoiceRes = await billingAPI.generateInvoice(orderResult.order_id, 'thermal');
                    if (invoiceRes.data?.success && invoiceRes.data?.pdf_url) {
                        const invoiceUrl = `${backendBaseUrl}/static${invoiceRes.data.pdf_url}`;
                        if (billTab && !billTab.closed) {
                            billTab.location.href = invoiceUrl;
                        } else {
                            window.open(invoiceUrl, '_blank');
                        }
                    } else if (billTab && !billTab.closed) {
                        billTab.close();
                    }
                } catch (invoiceErr) {
                    console.warn('Invoice auto-generation failed:', invoiceErr);
                    if (billTab && !billTab.closed) {
                        billTab.close();
                    }
                    // Don't block the user — order was placed successfully
                }
            } else if (billTab && !billTab.closed) {
                billTab.close();
            }

            alert(`✅ Order #${orderResult.order_number} placed successfully! Invoice opened in new tab.`);
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
            <button
                className="btn btn-secondary"
                onClick={() => window.open('/waiter/login', '_blank')}
                style={{ fontSize: '0.8rem', padding: '0.4rem 0.75rem' }}
                title="Open Waiter Login"
            >
                Waiter Login
            </button>
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
                <div className="pos-layout">
                    {/* Menu Items */}
                    <div>
                        {/* Order Type & Filters */}
                        <div className="stat-card mb-xl">
                            <div className="flex justify-between items-center" style={{ gap: '1rem', flexWrap: 'wrap' }}>
                                {/* Order Type */}
                                <div className="flex gap-md">
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

                                {/* Categories */}
                                {categories.length > 0 && (
                                    <div className="flex gap-md" style={{ overflowX: 'auto', paddingBottom: '4px' }}>
                                        <button
                                            onClick={() => setSelectedCategory(null)}
                                            className={`btn ${!selectedCategory ? 'btn-primary' : 'btn-secondary'}`}
                                        >
                                            All
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

                            {/* Table Number Input */}
                            {orderType === 'dine-in' && (
                                <div className="fade-in-up" style={{ marginTop: '1rem', maxWidth: '260px' }}>
                                    <label className="form-label">
                                        Table Number <span style={{ color: 'var(--error)' }}>*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={tableNumber}
                                        onChange={(e) => setTableNumber(e.target.value)}
                                        placeholder="e.g. T-12"
                                        className="form-input"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Menu Grid */}
                        {filteredItems.length === 0 ? (
                            <div className="stat-card" style={{ textAlign: 'center', padding: '3rem' }}>
                                <p style={{ color: 'var(--text-secondary)' }}>
                                    No menu items found.
                                </p>
                            </div>
                        ) : (
                            <div className="modules-grid pos-menu-grid">
                                {filteredItems.map(item => (
                                    <div
                                        key={item.id}
                                        onClick={() => item.is_available && addToCart(item)}
                                        className="module-card"
                                        style={{
                                            cursor: item.is_available ? 'pointer' : 'not-allowed',
                                            opacity: item.is_available ? 1 : 0.6,
                                            padding: 0, // Reset padding for image bleed
                                            overflow: 'hidden',
                                            display: 'flex',
                                            flexDirection: 'column'
                                        }}
                                    >
                                        {/* Product Image */}
                                        <div style={{
                                            height: '138px',
                                            width: '100%',
                                            background: item.image_url ? 'transparent' : 'var(--bg-body)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--text-light)',
                                            fontSize: '2rem',
                                            borderBottom: '1px solid var(--border-light)'
                                        }}>
                                            {item.image_url ? (
                                                <img
                                                    src={`${backendBaseUrl}${item.image_url}`}
                                                    alt={item.name}
                                                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                                />
                                            ) : (
                                                <Utensils size={48} color="var(--text-light)" strokeWidth={1.5} />
                                            )}
                                        </div>

                                        <div style={{ padding: '1rem', display: 'flex', flexDirection: 'column', flex: 1 }}>
                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '0.5rem' }}>
                                                <div className="badge" style={{
                                                    fontSize: '0.7rem',
                                                    background: 'rgba(99, 102, 241, 0.1)',
                                                    color: 'var(--primary)',
                                                    padding: '0.25rem 0.5rem',
                                                    borderRadius: '4px'
                                                }}>
                                                    {categories.find(c => c.id === item.category_id)?.name || 'Item'}
                                                </div>
                                                {!item.is_available && (
                                                    <div className="badge" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
                                                        Out
                                                    </div>
                                                )}
                                            </div>

                                            <h3 className="module-card-title" style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>{item.name}</h3>
                                            <p className="module-card-description" style={{ marginBottom: '1rem', flex: 1 }}>
                                                {item.description || 'No description'}
                                            </p>

                                            <div style={{ marginTop: 'auto', fontSize: '1.15rem', fontWeight: 700, color: 'var(--primary)' }}>
                                                ₹{parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Sticky Cart */}
                    <div className="stat-card pos-cart" style={{ padding: '0' }}>
                        <div style={{ padding: '1.25rem', borderBottom: '1px solid var(--border-color)' }}>
                            <h2 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Current Order</h2>
                        </div>

                        {/* Cart Items List */}
                        <div style={{ flex: 1, overflowY: 'auto', padding: '0.875rem' }}>
                            {cart.length === 0 ? (
                                <div style={{ textAlign: 'center', padding: '2rem 0', opacity: 0.5 }}>
                                    <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🛒</div>
                                    <p>Cart is empty</p>
                                </div>
                            ) : (
                                cart.map(item => (
                                    <div key={item.id} style={{
                                        display: 'flex',
                                        justifyContent: 'space-between',
                                        alignItems: 'center',
                                        marginBottom: '1rem',
                                        paddingBottom: '1rem',
                                        borderBottom: '1px solid var(--border-color)'
                                    }}>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>{item.name}</div>
                                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                                ₹{item.price} x {item.quantity}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-md">
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity - 1)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.25rem 0.6rem', height: '28px' }}
                                            >
                                                -
                                            </button>
                                            <span style={{ fontWeight: 600, width: '20px', textAlign: 'center' }}>{item.quantity}</span>
                                            <button
                                                onClick={() => updateQuantity(item.id, item.quantity + 1)}
                                                className="btn btn-secondary"
                                                style={{ padding: '0.25rem 0.6rem', height: '28px' }}
                                            >
                                                +
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Cart Footer */}
                        <div style={{ padding: '1.25rem', borderTop: '1px solid var(--border-color)', background: 'var(--bg-body)' }}>

                            {/* Payment Method Selection */}
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '0.5rem', color: 'var(--text-secondary)' }}>
                                    Payment Method
                                </label>
                                <div className="flex gap-sm">
                                    {['cash', 'upi', 'card'].map(mode => (
                                        <button
                                            key={mode}
                                            onClick={() => setPaymentMode(mode)}
                                            className={`btn ${paymentMode === mode ? 'btn-primary' : 'btn-secondary'}`}
                                            style={{
                                                flex: 1,
                                                textTransform: 'capitalize',
                                                fontSize: '0.85rem',
                                                padding: '0.5rem',
                                                borderColor: paymentMode === mode ? 'var(--primary)' : 'var(--border-color)'
                                            }}
                                        >
                                            {mode === 'upi' ? 'UPI' : mode}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex justify-between" style={{ marginBottom: '1rem' }}>
                                <span style={{ fontWeight: 600 }}>Total</span>
                                <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--primary)' }}>
                                    ₹{total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                                </span>
                            </div>
                            <button
                                onClick={placeOrder}
                                className="btn btn-primary"
                                style={{ width: '100%' }}
                                disabled={cart.length === 0}
                            >
                                Place Order (₹{total})
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

export default POSTerminal;
