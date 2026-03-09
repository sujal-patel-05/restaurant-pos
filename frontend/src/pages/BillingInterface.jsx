import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ordersAPI, billingAPI } from '../services/api';

function BillingInterface() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(null); // orderId being generated
    const [emailModal, setEmailModal] = useState({ open: false, orderId: null, email: '' });

    useEffect(() => {
        fetchCompletedOrders();
    }, []);

    const fetchCompletedOrders = async () => {
        setLoading(true);
        try {
            const response = await ordersAPI.getOrders('completed');
            setOrders(response.data);
        } catch (error) {
            console.error("Error fetching orders:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleDownloadInvoice = async (orderId, type, orderNumber) => {
        setGenerating(orderId + type);
        try {
            const response = await billingAPI.downloadInvoice(orderId, type);
            // Create a blob URL and trigger download
            const blob = new Blob([response.data], { type: 'application/pdf' });
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = `Invoice_${orderNumber}_${type}.pdf`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
        } catch (error) {
            console.error("Error downloading invoice:", error);
            alert("Failed to download invoice. Please try again.");
        } finally {
            setGenerating(null);
        }
    };

    const handlePreviewInvoice = async (orderId, type) => {
        setGenerating(orderId + type + 'preview');
        try {
            const response = await billingAPI.generateInvoice(orderId, type);
            if (response.data.success) {
                const baseUrl = import.meta.env.VITE_API_URL || `http://${window.location.hostname}:8000`;
                window.open(`${baseUrl}/static${response.data.pdf_url}`, '_blank');
            } else {
                alert("Failed to generate invoice: " + response.data.error);
            }
        } catch (error) {
            console.error("Error previewing invoice:", error);
            alert("Error generating invoice preview");
        } finally {
            setGenerating(null);
        }
    };

    const handleEmailInvoice = async () => {
        try {
            const response = await billingAPI.emailInvoice(emailModal.orderId, emailModal.email);
            if (response.data.success) {
                alert("Invoice email sent successfully!");
                setEmailModal({ open: false, orderId: null, email: '' });
            } else {
                alert("Failed to send email: " + response.data.error);
            }
        } catch (error) {
            console.error("Error sending email:", error);
            alert("Error sending email");
        }
    };

    const actions = (
        <button className="btn btn-secondary" onClick={fetchCompletedOrders}>
            <span>🔄</span> Refresh
        </button>
    );

    return (
        <AppLayout
            title="Billing & Invoices"
            subtitle="Generate GST-compliant invoices and manage payments"
            actions={actions}
        >
            <style>{billingStyles}</style>
            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Date & Time</th>
                                <th>Table</th>
                                <th>Items</th>
                                <th>Total</th>
                                <th>Status</th>
                                <th style={{ minWidth: 280 }}>Invoice Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '40px' }}>
                                        <div className="billing-loading">Loading orders...</div>
                                    </td>
                                </tr>
                            ) : orders.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '60px' }}>
                                        <div style={{ fontSize: 48, marginBottom: 12 }}>📋</div>
                                        <div style={{ color: 'var(--text-secondary)', fontSize: 15 }}>
                                            No completed orders found.
                                        </div>
                                        <div style={{ color: 'var(--text-tertiary, #9CA3AF)', fontSize: 13, marginTop: 4 }}>
                                            Complete an order to generate invoices.
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id}>
                                        <td>
                                            <span className="billing-order-number">#{order.order_number}</span>
                                        </td>
                                        <td>
                                            <div style={{ fontSize: 13 }}>{new Date(order.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}</div>
                                            <div style={{ fontSize: 11, color: 'var(--text-secondary)' }}>{new Date(order.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</div>
                                        </td>
                                        <td>{order.table_number || '—'}</td>
                                        <td>{order.order_items?.length || 0}</td>
                                        <td>
                                            <span className="billing-total">₹{parseFloat(order.total_amount).toFixed(2)}</span>
                                        </td>
                                        <td>
                                            <span className="billing-badge billing-badge-success">Paid</span>
                                        </td>
                                        <td>
                                            <div className="billing-actions">
                                                {/* A4 Invoice Download */}
                                                <button
                                                    className="billing-btn billing-btn-primary"
                                                    onClick={() => handleDownloadInvoice(order.id, 'a4', order.order_number)}
                                                    disabled={generating === order.id + 'a4'}
                                                    title="Download A4 GST Invoice"
                                                >
                                                    {generating === order.id + 'a4' ? '⏳' : '📄'} A4 Invoice
                                                </button>

                                                {/* Thermal Receipt Download */}
                                                <button
                                                    className="billing-btn billing-btn-secondary"
                                                    onClick={() => handleDownloadInvoice(order.id, 'thermal', order.order_number)}
                                                    disabled={generating === order.id + 'thermal'}
                                                    title="Download Thermal Receipt"
                                                >
                                                    {generating === order.id + 'thermal' ? '⏳' : '🧾'} Thermal
                                                </button>

                                                {/* Preview */}
                                                <button
                                                    className="billing-btn billing-btn-ghost"
                                                    onClick={() => handlePreviewInvoice(order.id, 'a4')}
                                                    disabled={generating === order.id + 'a4preview'}
                                                    title="Preview invoice in new tab"
                                                >
                                                    👁️
                                                </button>

                                                {/* Email */}
                                                <button
                                                    className="billing-btn billing-btn-ghost"
                                                    onClick={() => setEmailModal({ open: true, orderId: order.id, email: '' })}
                                                    title="Email invoice to customer"
                                                >
                                                    ✉️
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Email Modal */}
            {emailModal.open && (
                <div className="billing-modal-overlay" onClick={() => setEmailModal({ open: false, orderId: null, email: '' })}>
                    <div className="billing-modal" onClick={e => e.stopPropagation()}>
                        <h3 style={{ marginBottom: 4, fontSize: 18 }}>📧 Email Invoice</h3>
                        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 20 }}>
                            Send a GST-compliant A4 invoice to the customer's email.
                        </p>
                        <div className="form-group">
                            <label>Customer Email</label>
                            <input
                                type="email"
                                className="input"
                                value={emailModal.email}
                                onChange={(e) => setEmailModal({ ...emailModal, email: e.target.value })}
                                placeholder="customer@example.com"
                                autoFocus
                            />
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 24 }}>
                            <button className="btn btn-secondary" onClick={() => setEmailModal({ open: false, orderId: null, email: '' })}>
                                Cancel
                            </button>
                            <button
                                className="btn btn-primary"
                                onClick={handleEmailInvoice}
                                disabled={!emailModal.email}
                            >
                                Send Invoice
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

const billingStyles = `
.billing-order-number {
    font-weight: 700;
    color: var(--text-primary);
    font-size: 13px;
    font-family: 'SF Mono', 'Fira Code', monospace;
}
.billing-total {
    font-weight: 700;
    font-size: 15px;
    color: var(--text-primary);
}
.billing-badge {
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: 20px;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.5px;
}
.billing-badge-success {
    background: #ECFDF5;
    color: #059669;
}
.billing-actions {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: nowrap;
}
.billing-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    border: none;
    transition: all 0.15s ease;
    white-space: nowrap;
}
.billing-btn:disabled {
    opacity: 0.5;
    cursor: not-allowed;
}
.billing-btn-primary {
    background: linear-gradient(135deg, #4F46E5, #6366F1);
    color: white;
    box-shadow: 0 1px 3px rgba(79, 70, 229, 0.3);
}
.billing-btn-primary:hover:not(:disabled) {
    background: linear-gradient(135deg, #4338CA, #4F46E5);
    box-shadow: 0 2px 6px rgba(79, 70, 229, 0.4);
    transform: translateY(-1px);
}
.billing-btn-secondary {
    background: #F3F4F6;
    color: #374151;
    border: 1px solid #E5E7EB;
}
.billing-btn-secondary:hover:not(:disabled) {
    background: #E5E7EB;
    transform: translateY(-1px);
}
.billing-btn-ghost {
    background: transparent;
    color: #6B7280;
    padding: 6px 8px;
    font-size: 14px;
}
.billing-btn-ghost:hover:not(:disabled) {
    background: #F3F4F6;
    border-radius: 8px;
}
.billing-modal-overlay {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    backdrop-filter: blur(4px);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1000;
    animation: fadeIn 0.15s ease;
}
.billing-modal {
    background: white;
    border-radius: 16px;
    padding: 28px;
    width: 420px;
    max-width: 90vw;
    box-shadow: 0 20px 60px rgba(0, 0, 0, 0.15);
    animation: slideUp 0.2s ease;
}
.billing-loading {
    color: var(--text-secondary);
    font-size: 14px;
}
@keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
}
@keyframes slideUp {
    from { opacity: 0; transform: translateY(12px); }
    to { opacity: 1; transform: translateY(0); }
}
`;

export default BillingInterface;
