import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { inventoryAPI } from '../services/api';

function InventoryDashboard() {
    const [ingredients, setIngredients] = useState([]);
    const [lowStockAlerts, setLowStockAlerts] = useState([]);
    const [expiryAlerts, setExpiryAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingItem, setEditingItem] = useState(null);

    const [ingredientForm, setIngredientForm] = useState({
        name: '',
        unit: 'kg',
        current_stock: '',
        reorder_level: '',
        cost_per_unit: '',
        supplier: '',
        expiry_date: ''
    });

    useEffect(() => {
        fetchInventoryData();
    }, []);

    const fetchInventoryData = async () => {
        try {
            setLoading(true);
            const [ingredientsRes, alertsRes, expiryRes] = await Promise.all([
                inventoryAPI.getIngredients(),
                inventoryAPI.getLowStockAlerts(),
                inventoryAPI.getExpiryAlerts ? inventoryAPI.getExpiryAlerts(30) : Promise.resolve({ data: [] })
            ]);

            setIngredients(ingredientsRes.data || []);
            setLowStockAlerts(alertsRes.data || []);
            setExpiryAlerts(expiryRes.data || []);
        } catch (error) {
            console.error('Error fetching inventory data:', error);
            alert('Error loading inventory. Please refresh the page.');
        } finally {
            setLoading(false);
        }
    };

    const handleCreateIngredient = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...ingredientForm,
                current_stock: parseFloat(ingredientForm.current_stock),
                reorder_level: parseFloat(ingredientForm.reorder_level),
                cost_per_unit: parseFloat(ingredientForm.cost_per_unit) || 0,
                supplier: ingredientForm.supplier,
                expiry_date: ingredientForm.expiry_date || null
            };

            await inventoryAPI.createIngredient(data);
            alert('Ingredient added successfully!');
            resetForm();
            setShowAddModal(false);
            fetchInventoryData();
        } catch (error) {
            console.error('Error creating ingredient:', error);
            alert(error.response?.data?.detail || 'Failed to add ingredient');
        }
    };

    const handleUpdateIngredient = async (e) => {
        e.preventDefault();
        try {
            const data = {
                ...ingredientForm,
                current_stock: parseFloat(ingredientForm.current_stock),
                reorder_level: parseFloat(ingredientForm.reorder_level),
                cost_per_unit: parseFloat(ingredientForm.cost_per_unit) || 0,
                supplier: ingredientForm.supplier,
                expiry_date: ingredientForm.expiry_date || null
            };

            await inventoryAPI.updateIngredient(editingItem.id, data);
            alert('Ingredient updated successfully!');
            resetForm();
            setShowEditModal(false);
            setEditingItem(null);
            fetchInventoryData();
        } catch (error) {
            console.error('Error updating ingredient:', error);
            alert(error.response?.data?.detail || 'Failed to update ingredient');
        }
    };

    const openEditModal = (ingredient) => {
        setEditingItem(ingredient);
        setIngredientForm({
            name: ingredient.name,
            unit: ingredient.unit,
            current_stock: ingredient.current_stock.toString(),
            reorder_level: ingredient.reorder_level.toString(),
            cost_per_unit: ingredient.cost_per_unit?.toString() || '0',
            supplier: ingredient.supplier || '',
            expiry_date: ingredient.expiry_date || ''
        });
        setShowEditModal(true);
    };

    const handleDeleteIngredient = async (ingredientId, ingredientName) => {
        if (!confirm(`Are you sure you want to delete "${ingredientName}"? This action cannot be undone.`)) {
            return;
        }

        try {
            await inventoryAPI.deleteIngredient(ingredientId);
            alert(`Ingredient "${ingredientName}" deleted successfully!`);
            fetchInventoryData();
        } catch (error) {
            console.error('Error deleting ingredient:', error);
            alert(error.response?.data?.detail || 'Failed to delete ingredient. It may be used in menu items.');
        }
    };

    const resetForm = () => {
        setIngredientForm({
            name: '',
            unit: 'kg',
            current_stock: '',
            reorder_level: '',
            cost_per_unit: '',
            supplier: '',
            expiry_date: ''
        });
    };

    // Expiry helpers
    const getExpiryStatus = (expiryDate) => {
        if (!expiryDate) return { label: 'No Expiry', color: 'var(--text-secondary)', bg: 'transparent', icon: '—' };
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const expiry = new Date(expiryDate);
        const diffDays = Math.ceil((expiry - today) / (1000 * 60 * 60 * 24));
        if (diffDays < 0) return { label: 'Expired', color: '#dc2626', bg: '#fef2f2', icon: '🔴', days: diffDays };
        if (diffDays <= 3) return { label: `${diffDays}d left`, color: '#dc2626', bg: '#fef2f2', icon: '🔴', days: diffDays };
        if (diffDays <= 7) return { label: `${diffDays}d left`, color: '#ea580c', bg: '#fff7ed', icon: '🟠', days: diffDays };
        if (diffDays <= 30) return { label: `${diffDays}d left`, color: '#d97706', bg: '#fffbeb', icon: '🟡', days: diffDays };
        return { label: `${diffDays}d left`, color: '#16a34a', bg: '#f0fdf4', icon: '🟢', days: diffDays };
    };

    const expiredCount = ingredients.filter(i => {
        if (!i.expiry_date) return false;
        return new Date(i.expiry_date) < new Date();
    }).length;

    const expiringSoonCount = ingredients.filter(i => {
        if (!i.expiry_date) return false;
        const diff = Math.ceil((new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
        return diff >= 0 && diff <= 7;
    }).length;

    const inventoryValue = ingredients.reduce((sum, item) =>
        sum + (item.current_stock * (item.cost_per_unit || 0)), 0
    );

    const actions = (
        <>
            <button className="btn btn-secondary" onClick={fetchInventoryData}>
                <span>🔄</span>
                Refresh
            </button>
            <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
                <span>➕</span>
                Add Ingredient
            </button>
        </>
    );

    return (
        <AppLayout
            title="Inventory Management"
            subtitle="Track ingredients and stock levels"
            actions={actions}
        >
            {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
                    <div className="loader"></div>
                </div>
            ) : (
                <>
                    {/* Alerts */}
                    {lowStockAlerts.length > 0 && (
                        <div className="fade-in-up" style={{
                            marginBottom: '2rem',
                            background: 'var(--warning-bg)',
                            border: '1px solid var(--warning)',
                            borderRadius: 'var(--radius-lg)',
                            padding: '1rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            color: '#92400E'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                            <div>
                                <strong style={{ fontWeight: 600 }}>Low Stock Alert:</strong> {lowStockAlerts.length} item(s) need reordering
                                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.9 }}>
                                    {lowStockAlerts.slice(0, 3).map(alert => alert.name).join(', ')}
                                    {lowStockAlerts.length > 3 && ` and ${lowStockAlerts.length - 3} more`}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Expiry Alerts */}
                    {(expiredCount > 0 || expiringSoonCount > 0) && (
                        <div className="fade-in-up" style={{
                            marginBottom: '2rem',
                            background: expiredCount > 0 ? '#fef2f2' : '#fff7ed',
                            border: `1px solid ${expiredCount > 0 ? '#fca5a5' : '#fdba74'}`,
                            borderRadius: 'var(--radius-lg)',
                            padding: '1rem 1.5rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '1rem',
                            color: expiredCount > 0 ? '#991b1b' : '#92400E'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>{expiredCount > 0 ? '🔴' : '🟠'}</span>
                            <div>
                                <strong style={{ fontWeight: 600 }}>Expiry Alert:</strong>
                                {expiredCount > 0 && ` ${expiredCount} item(s) expired!`}
                                {expiringSoonCount > 0 && ` ${expiringSoonCount} item(s) expiring within 7 days.`}
                                <div style={{ fontSize: '0.875rem', marginTop: '0.25rem', opacity: 0.9 }}>
                                    {ingredients.filter(i => {
                                        if (!i.expiry_date) return false;
                                        const diff = Math.ceil((new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                        return diff <= 7;
                                    }).slice(0, 4).map(i => i.name).join(', ')}
                                    {ingredients.filter(i => {
                                        if (!i.expiry_date) return false;
                                        const diff = Math.ceil((new Date(i.expiry_date) - new Date()) / (1000 * 60 * 60 * 24));
                                        return diff <= 7;
                                    }).length > 4 && ' and more'}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="stats-grid mb-xl">
                        <div className="stat-card fade-in-up" style={{ animationDelay: '0ms' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="stat-card-label">Total Items</div>
                                    <div className="stat-card-value">{ingredients.length}</div>
                                </div>
                                <div className="stat-card-icon green" style={{ marginBottom: 0 }}>📦</div>
                            </div>
                        </div>
                        <div className="stat-card fade-in-up" style={{ animationDelay: '100ms' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="stat-card-label">Low Stock</div>
                                    <div className="stat-card-value">{lowStockAlerts.length}</div>
                                </div>
                                <div className="stat-card-icon orange" style={{ marginBottom: 0 }}>⚠️</div>
                            </div>
                        </div>
                        <div className="stat-card fade-in-up" style={{ animationDelay: '200ms' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="stat-card-label">Total Value</div>
                                    <div className="stat-card-value">
                                        ₹{inventoryValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                </div>
                                <div className="stat-card-icon blue" style={{ marginBottom: 0 }}>💰</div>
                            </div>
                        </div>
                        <div className="stat-card fade-in-up" style={{ animationDelay: '300ms' }}>
                            <div className="flex justify-between items-start">
                                <div>
                                    <div className="stat-card-label">Expiring Soon</div>
                                    <div className="stat-card-value" style={{ color: (expiredCount + expiringSoonCount) > 0 ? '#dc2626' : 'inherit' }}>
                                        {expiredCount + expiringSoonCount}
                                    </div>
                                </div>
                                <div className="stat-card-icon red" style={{ marginBottom: 0 }}>📅</div>
                            </div>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    {ingredients.length === 0 ? (
                        <div className="stat-card" style={{ textAlign: 'center', padding: '4rem 2rem' }}>
                            <div style={{ fontSize: '4rem', marginBottom: '1.5rem', opacity: 0.5 }}>📦</div>
                            <h2 style={{ marginBottom: '0.5rem', fontSize: '1.5rem', fontWeight: 700 }}>No Ingredients Yet</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
                                Start by adding your first ingredient to track inventory
                            </p>
                            <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
                                <span>➕</span> Add First Ingredient
                            </button>
                        </div>
                    ) : (
                        <div className="stat-card fade-in-up" style={{ animationDelay: '300ms', padding: '0', overflow: 'hidden' }}>
                            <div style={{ padding: '1.5rem', borderBottom: '1px solid var(--border-color)' }}>
                                <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Ingredient Stock</h2>
                            </div>
                            <div className="table-container" style={{ border: 'none', boxShadow: 'none', borderRadius: 0 }}>
                                <table className="modern-table">
                                    <thead>
                                        <tr>
                                            <th>Ingredient</th>
                                            <th>Current Stock</th>
                                            <th>Unit</th>
                                            <th>Reorder Level</th>
                                            <th>Cost/Unit</th>
                                            <th>Expiry Date</th>
                                            <th>Supplier</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ingredients.map(item => {
                                            const isLowStock = item.current_stock <= item.reorder_level;
                                            const expiry = getExpiryStatus(item.expiry_date);
                                            return (
                                                <tr key={item.id}>
                                                    <td style={{ fontWeight: 500 }}>{item.name}</td>
                                                    <td style={{ fontWeight: 600, fontFamily: 'var(--font-mono)' }}>
                                                        {item.current_stock.toFixed(2)}
                                                    </td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{item.unit}</td>
                                                    <td style={{ color: 'var(--text-secondary)' }}>{item.reorder_level}</td>
                                                    <td style={{ fontFamily: 'var(--font-mono)' }}>
                                                        ₹{item.cost_per_unit ? parseFloat(item.cost_per_unit).toFixed(2) : '0.00'}
                                                    </td>
                                                    <td>
                                                        {item.expiry_date ? (
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span style={{ fontSize: '0.75rem' }}>{expiry.icon}</span>
                                                                <div>
                                                                    <div style={{ fontSize: '0.85rem', fontFamily: 'var(--font-mono)', color: expiry.color, fontWeight: 600 }}>
                                                                        {new Date(item.expiry_date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                                    </div>
                                                                    <div style={{ fontSize: '0.7rem', color: expiry.color, opacity: 0.8 }}>
                                                                        {expiry.label}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ) : (
                                                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>—</span>
                                                        )}
                                                    </td>
                                                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                                                        {item.supplier || '-'}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${isLowStock ? 'badge-warning' : 'badge-success'}`}>
                                                            {isLowStock ? 'Low Stock' : 'In Stock'}
                                                        </span>
                                                    </td>
                                                    <td>
                                                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}
                                                                onClick={() => openEditModal(item)}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', color: 'var(--error)', borderColor: 'var(--error-bg)' }}
                                                                onClick={() => handleDeleteIngredient(item.id, item.name)}
                                                            >
                                                                Delete
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </>
            )}

            {/* Add Ingredient Modal */}
            {showAddModal && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowAddModal(false); }}>
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div className="flex justify-between items-center mb-xl">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Add Ingredient</h2>
                            <button onClick={() => setShowAddModal(false)} className="btn btn-secondary" style={{ padding: '0.5rem', border: 'none' }}>✕</button>
                        </div>
                        <form onSubmit={handleCreateIngredient}>
                            <div className="form-group">
                                <label className="form-label">Ingredient Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    value={ingredientForm.name}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                                    placeholder="e.g., Tomatoes, Cheese"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Current Stock *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="form-input"
                                        value={ingredientForm.current_stock}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Unit *</label>
                                    <select
                                        required
                                        className="form-select"
                                        value={ingredientForm.unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                                    >
                                        <option value="kg">Kilograms (kg)</option>
                                        <option value="g">Grams (g)</option>
                                        <option value="l">Liters (l)</option>
                                        <option value="ml">Milliliters (ml)</option>
                                        <option value="pcs">Pieces (pcs)</option>
                                        <option value="dozen">Dozen</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Reorder Level *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="form-input"
                                        value={ingredientForm.reorder_level}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, reorder_level: e.target.value })}
                                        placeholder="10.00"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cost per Unit (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={ingredientForm.cost_per_unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, cost_per_unit: e.target.value })}
                                        placeholder="0.00"
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Supplier Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={ingredientForm.supplier}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, supplier: e.target.value })}
                                        placeholder="e.g., ABC Suppliers"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Expiry Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={ingredientForm.expiry_date}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, expiry_date: e.target.value })}
                                    />
                                </div>
                            </div>


                            <div className="flex gap-md" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Add Ingredient
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Ingredient Modal */}
            {showEditModal && (
                <div className="modal-overlay" onClick={(e) => { if (e.target === e.currentTarget) setShowEditModal(false); }}>
                    <div className="modal-content" style={{ maxWidth: '600px' }}>
                        <div className="flex justify-between items-center mb-xl">
                            <h2 style={{ fontSize: '1.5rem', fontWeight: 700 }}>Edit Ingredient</h2>
                            <button onClick={() => setShowEditModal(false)} className="btn btn-secondary" style={{ padding: '0.5rem', border: 'none' }}>✕</button>
                        </div>
                        <form onSubmit={handleUpdateIngredient}>
                            <div className="form-group">
                                <label className="form-label">Ingredient Name *</label>
                                <input
                                    type="text"
                                    required
                                    className="form-input"
                                    value={ingredientForm.name}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Current Stock *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="form-input"
                                        value={ingredientForm.current_stock}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Unit *</label>
                                    <select
                                        required
                                        className="form-select"
                                        value={ingredientForm.unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                                    >
                                        <option value="kg">Kilograms (kg)</option>
                                        <option value="g">Grams (g)</option>
                                        <option value="l">Liters (l)</option>
                                        <option value="ml">Milliliters (ml)</option>
                                        <option value="pcs">Pieces (pcs)</option>
                                        <option value="dozen">Dozen</option>
                                    </select>
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Reorder Level *</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        className="form-input"
                                        value={ingredientForm.reorder_level}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, reorder_level: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Cost per Unit (₹)</label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        className="form-input"
                                        value={ingredientForm.cost_per_unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, cost_per_unit: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1rem' }}>
                                <div className="form-group">
                                    <label className="form-label">Supplier Name</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        value={ingredientForm.supplier}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, supplier: e.target.value })}
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Expiry Date</label>
                                    <input
                                        type="date"
                                        className="form-input"
                                        value={ingredientForm.expiry_date}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, expiry_date: e.target.value })}
                                    />
                                </div>
                            </div>


                            <div className="flex gap-md" style={{ justifyContent: 'flex-end' }}>
                                <button type="button" className="btn btn-secondary" onClick={() => { setShowEditModal(false); setEditingItem(null); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Update Ingredient
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </AppLayout>
    );
}

export default InventoryDashboard;
