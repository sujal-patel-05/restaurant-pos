import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { ordersAPI, billingAPI } from '../services/api';

function BillingInterface() {
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
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

    const handleGenerateInvoice = async (orderId, type) => {
        try {
            const response = await billingAPI.generateInvoice(orderId, type);
            if (response.data.success) {
                // Open PDF in new tab
                window.open(`${import.meta.env.VITE_API_URL}${response.data.pdf_url}`, '_blank');
            } else {
                alert("Failed to generate invoice: " + response.data.error);
            }
        } catch (error) {
            console.error("Error generating invoice:", error);
            alert("Error generating invoice");
        }
    };

    const handleEmailInvoice = async () => {
        try {
            const response = await billingAPI.emailInvoice(emailModal.orderId, emailModal.email);
            if (response.data.success) {
                alert("Email sent successfully!");
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
            title="Billing & Archive"
            subtitle="Manage invoices and past orders"
            actions={actions}
        >
            <div className="card">
                <div className="table-container">
                    <table>
                        <thead>
                            <tr>
                                <th>Order #</th>
                                <th>Date</th>
                                <th>Total</th>
                                <th>Payment</th>
                                <th>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {orders.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: 'var(--spacing-xl)' }}>
                                        No completed orders found.
                                    </td>
                                </tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id}>
                                        <td className="font-medium">#{order.order_number}</td>
                                        <td>{new Date(order.created_at).toLocaleString()}</td>
                                        <td className="font-bold">₹{order.total_amount}</td>
                                        <td>
                                            <span className="sc-status sc-status-success">
                                                Paid
                                            </span>
                                        </td>
                                        <td>
                                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleGenerateInvoice(order.id, 'thermal')}
                                                    title="Thermal Receipt"
                                                >
                                                    📜 Thermal
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => handleGenerateInvoice(order.id, 'a4')}
                                                    title="A4 Invoice"
                                                >
                                                    📄 A4
                                                </button>
                                                <button
                                                    className="btn btn-sm btn-secondary"
                                                    onClick={() => setEmailModal({ open: true, orderId: order.id, email: '' })}
                                                    title="Email Invoice"
                                                >
                                                    📧 Email
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

            {/* Simple Email Modal */}
            {emailModal.open && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000
                }}>
                    <div className="card" style={{ width: '400px', padding: 'var(--spacing-xl)' }}>
                        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Send Invoice</h3>
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
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 'var(--spacing-md)', marginTop: 'var(--spacing-lg)' }}>
                            <button className="btn btn-secondary" onClick={() => setEmailModal({ open: false, orderId: null, email: '' })}>
                                Cancel
                            </button>
                            <button className="btn btn-primary" onClick={handleEmailInvoice}>
                                Send
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

export default BillingInterface;
