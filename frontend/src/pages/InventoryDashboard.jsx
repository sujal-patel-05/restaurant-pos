import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { inventoryAPI } from '../services/api';

function InventoryDashboard() {
    const [ingredients, setIngredients] = useState([]);
    const [lowStockAlerts, setLowStockAlerts] = useState([]);
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
        supplier: ''
    });

    useEffect(() => {
        fetchInventoryData();
    }, []);

    const fetchInventoryData = async () => {
        try {
            setLoading(true);
            const [ingredientsRes, alertsRes] = await Promise.all([
                inventoryAPI.getIngredients(),
                inventoryAPI.getLowStockAlerts()
            ]);

            setIngredients(ingredientsRes.data || []);
            setLowStockAlerts(alertsRes.data || []);
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
                supplier: ingredientForm.supplier
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
                supplier: ingredientForm.supplier
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
            supplier: ingredient.supplier || ''
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
            supplier: ''
        });
    };

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
                                            <th>Supplier</th>
                                            <th>Status</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ingredients.map(item => {
                                            const isLowStock = item.current_stock <= item.reorder_level;
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

                            <div className="form-group mb-xl">
                                <label className="form-label">Supplier Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={ingredientForm.supplier}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, supplier: e.target.value })}
                                    placeholder="e.g., ABC Suppliers"
                                />
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

                            <div className="form-group mb-xl">
                                <label className="form-label">Supplier Name</label>
                                <input
                                    type="text"
                                    className="form-input"
                                    value={ingredientForm.supplier}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, supplier: e.target.value })}
                                />
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
