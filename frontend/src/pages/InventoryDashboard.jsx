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
        supplier_name: '',
        storage_location: ''
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
                cost_per_unit: parseFloat(ingredientForm.cost_per_unit) || 0
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
                cost_per_unit: parseFloat(ingredientForm.cost_per_unit) || 0
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
            supplier_name: ingredient.supplier_name || '',
            storage_location: ingredient.storage_location || ''
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
            supplier_name: '',
            storage_location: ''
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
                <div style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                    <div className="loader">Loading inventory...</div>
                </div>
            ) : (
                <>
                    {/* Alerts */}
                    {lowStockAlerts.length > 0 && (
                        <div className="mb-xl" style={{
                            background: '#FEF3C7',
                            border: '1px solid #F59E0B',
                            borderRadius: 'var(--radius-lg)',
                            padding: 'var(--spacing-lg)',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 'var(--spacing-md)'
                        }}>
                            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
                            <div>
                                <strong>Low Stock Alert:</strong> {lowStockAlerts.length} item(s) need reordering
                                <div style={{ fontSize: 'var(--font-size-sm)', marginTop: '0.25rem' }}>
                                    {lowStockAlerts.slice(0, 3).map(alert => alert.ingredient_name).join(', ')}
                                    {lowStockAlerts.length > 3 && ` and ${lowStockAlerts.length - 3} more`}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats */}
                    <div className="stats-grid mb-xl">
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <div className="stat-card-icon green">📦</div>
                            </div>
                            <div className="stat-card-value">{ingredients.length}</div>
                            <div className="stat-card-label">Total Ingredients</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <div className="stat-card-icon orange">⚠️</div>
                            </div>
                            <div className="stat-card-value">{lowStockAlerts.length}</div>
                            <div className="stat-card-label">Low Stock Items</div>
                        </div>
                        <div className="stat-card">
                            <div className="stat-card-header">
                                <div className="stat-card-icon blue">💰</div>
                            </div>
                            <div className="stat-card-value">₹{inventoryValue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                            <div className="stat-card-label">Inventory Value</div>
                        </div>
                    </div>

                    {/* Inventory Table */}
                    {ingredients.length === 0 ? (
                        <div className="stat-card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                            <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-lg)' }}>📦</div>
                            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>No Ingredients Yet</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                                Start by adding your first ingredient to track inventory
                            </p>
                            <button className="btn btn-primary" onClick={() => { resetForm(); setShowAddModal(true); }}>
                                <span>➕</span>
                                Add First Ingredient
                            </button>
                        </div>
                    ) : (
                        <div className="stat-card">
                            <h2 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)' }}>
                                Ingredient Stock
                            </h2>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '2px solid var(--border-medium)' }}>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Ingredient</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Current Stock</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Unit</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Reorder Level</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Cost/Unit</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Supplier</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Status</th>
                                            <th style={{ padding: 'var(--spacing-md)', textAlign: 'left', fontWeight: 600 }}>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {ingredients.map(item => {
                                            const isLowStock = item.current_stock <= item.reorder_level;
                                            return (
                                                <tr key={item.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 500 }}>{item.name}</td>
                                                    <td style={{ padding: 'var(--spacing-md)', fontWeight: 600 }}>
                                                        {item.current_stock.toFixed(2)}
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{item.unit}</td>
                                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>{item.reorder_level}</td>
                                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                                                        ₹{item.cost_per_unit ? parseFloat(item.cost_per_unit).toFixed(2) : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-md)', color: 'var(--text-secondary)', fontSize: 'var(--font-size-sm)' }}>
                                                        {item.supplier_name || '-'}
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-md)' }}>
                                                        <span className={isLowStock ? 'badge-warning' : 'badge-success'}>
                                                            {isLowStock ? 'Low Stock' : 'In Stock'}
                                                        </span>
                                                    </td>
                                                    <td style={{ padding: 'var(--spacing-md)' }}>
                                                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-size-sm)' }}
                                                                onClick={() => openEditModal(item)}
                                                            >
                                                                Edit
                                                            </button>
                                                            <button
                                                                className="btn btn-secondary"
                                                                style={{ padding: '0.5rem 1rem', fontSize: 'var(--font-size-sm)', color: 'var(--error)' }}
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
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    overflowY: 'auto',
                    padding: 'var(--spacing-xl)'
                }}>
                    <div className="stat-card" style={{ width: '600px', maxWidth: '90%' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Add Ingredient</h2>
                        <form onSubmit={handleCreateIngredient}>
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Ingredient Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={ingredientForm.name}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                    placeholder="e.g., Tomatoes, Cheese, Flour"
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Current Stock *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={ingredientForm.current_stock}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                        placeholder="100"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Unit *
                                    </label>
                                    <select
                                        required
                                        value={ingredientForm.unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Reorder Level *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={ingredientForm.reorder_level}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, reorder_level: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                        placeholder="20"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Cost per Unit (₹)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={ingredientForm.cost_per_unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, cost_per_unit: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                        placeholder="5.50"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Supplier Name
                                </label>
                                <input
                                    type="text"
                                    value={ingredientForm.supplier_name}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, supplier_name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                    placeholder="e.g., ABC Suppliers"
                                />
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Storage Location
                                </label>
                                <input
                                    type="text"
                                    value={ingredientForm.storage_location}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, storage_location: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                    placeholder="e.g., Freezer A, Shelf 3"
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowAddModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    Add Ingredient
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Ingredient Modal */}
            {showEditModal && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.5)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                    overflowY: 'auto',
                    padding: 'var(--spacing-xl)'
                }}>
                    <div className="stat-card" style={{ width: '600px', maxWidth: '90%' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>Edit Ingredient</h2>
                        <form onSubmit={handleUpdateIngredient}>
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Ingredient Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={ingredientForm.name}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Current Stock *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={ingredientForm.current_stock}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, current_stock: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Unit *
                                    </label>
                                    <select
                                        required
                                        value={ingredientForm.unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, unit: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
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

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Reorder Level *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={ingredientForm.reorder_level}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, reorder_level: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Cost per Unit (₹)
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        value={ingredientForm.cost_per_unit}
                                        onChange={(e) => setIngredientForm({ ...ingredientForm, cost_per_unit: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Supplier Name
                                </label>
                                <input
                                    type="text"
                                    value={ingredientForm.supplier_name}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, supplier_name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                />
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Storage Location
                                </label>
                                <input
                                    type="text"
                                    value={ingredientForm.storage_location}
                                    onChange={(e) => setIngredientForm({ ...ingredientForm, storage_location: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                />
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => { setShowEditModal(false); setEditingItem(null); }}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
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
