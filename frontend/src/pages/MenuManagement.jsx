import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { menuAPI, inventoryAPI } from '../services/api';
import { Modal } from '../components/Modal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { EmptyState } from '../components/EmptyState';

function MenuManagement() {
    const [categories, setCategories] = useState([]);
    const [menuItems, setMenuItems] = useState([]);
    const [ingredients, setIngredients] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showCategoryModal, setShowCategoryModal] = useState(false);
    const [showItemModal, setShowItemModal] = useState(false);
    const [selectedCategory, setSelectedCategory] = useState(null);
    const [showManageModal, setShowManageModal] = useState(false);
    const [editingCategory, setEditingCategory] = useState(null);
    const [editingItem, setEditingItem] = useState(null);

    // Form states
    const [categoryForm, setCategoryForm] = useState({ name: '', description: '' });
    const [itemForm, setItemForm] = useState({
        name: '',
        description: '',
        price: '',
        category_id: '',
        preparation_time: '',
        is_available: true,
        bom_mappings: []
    });

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            setLoading(true);
            const [categoriesRes, itemsRes, ingredientsRes] = await Promise.all([
                menuAPI.getCategories(),
                menuAPI.getItems(),
                inventoryAPI.getIngredients()
            ]);

            setCategories(categoriesRes.data || []);
            setMenuItems(itemsRes.data || []);
            setIngredients(ingredientsRes.data || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateCategory = async (e) => {
        e.preventDefault();
        try {
            await menuAPI.createCategory(categoryForm);
            alert('Category created successfully!');
            setCategoryForm({ name: '', description: '' });
            setShowCategoryModal(false);
            fetchData();
        } catch (error) {
            console.error('Error creating category:', error);
            alert(error.response?.data?.detail || 'Failed to create category');
        }
    };

    const handleUpdateCategory = async (categoryId, updatedData) => {
        try {
            await menuAPI.updateCategory(categoryId, updatedData);
            alert('Category updated successfully!');
            fetchData();
        } catch (error) {
            console.error('Error updating category:', error);
            alert(error.response?.data?.detail || 'Failed to update category');
        }
    };

    const handleDeleteCategory = async (categoryId) => {
        if (!confirm('Are you sure you want to delete this category?')) return;

        try {
            await menuAPI.deleteCategory(categoryId);
            alert('Category deleted successfully!');
            fetchData();
        } catch (error) {
            console.error('Error deleting category:', error);
            alert(error.response?.data?.detail || 'Failed to delete category');
        }
    };

    const startEditing = (category) => {
        setEditingCategory({ ...category });
    };

    const cancelEditing = () => {
        setEditingCategory(null);
    };

    const saveEdit = async () => {
        if (!editingCategory) return;
        await handleUpdateCategory(editingCategory.id, {
            name: editingCategory.name,
            description: editingCategory.description
        });
        setEditingCategory(null);
    };

    const handleEditItem = (item) => {
        setEditingItem(item);
        setItemForm({
            name: item.name,
            description: item.description || '',
            price: item.price,
            category_id: item.category_id,
            preparation_time: item.preparation_time,
            is_available: item.is_available,
            bom_mappings: item.bom_mappings ? item.bom_mappings.map(bom => ({
                ingredient_id: bom.ingredient_id,
                quantity: bom.quantity_required
            })) : []
        });
        // Clear image state when editing
        setImageFile(null);
        setImagePreview(null);
        setShowItemModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            // Create preview
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (itemId) => {
        if (!imageFile) return null;

        try {
            const formData = new FormData();
            formData.append('file', imageFile);

            const response = await fetch(`http://localhost:8000/api/menu/items/${itemId}/upload-image`, {
                method: 'POST',
                body: formData,
            });

            if (!response.ok) throw new Error('Image upload failed');

            const data = await response.json();
            return data.image_url;
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image, but item was saved');
            return null;
        }
    };

    const handleCreateOrUpdateItem = async (e) => {
        e.preventDefault();
        try {
            const itemData = {
                ...itemForm,
                price: parseFloat(itemForm.price),
                preparation_time: parseInt(itemForm.preparation_time) || 0,
                bom_mappings: itemForm.bom_mappings
                    .filter(bom => bom.ingredient_id && bom.quantity > 0)
                    .map(bom => ({
                        ingredient_id: bom.ingredient_id,
                        quantity: parseFloat(bom.quantity)
                    }))
            };

            let savedItem;
            if (editingItem) {
                savedItem = await menuAPI.updateItem(editingItem.id, itemData);
                // Upload image if new one selected
                if (imageFile) {
                    await uploadImage(editingItem.id);
                }
                alert('Menu item updated successfully!');
            } else {
                savedItem = await menuAPI.createItem(itemData);
                // Upload image for new item
                if (imageFile && savedItem.data?.id) {
                    await uploadImage(savedItem.data.id);
                }
                alert('Menu item created successfully!');
            }

            resetItemForm();
            setShowItemModal(false);
            fetchData();
        } catch (error) {
            console.error('Error saving item:', error);
            const errorMsg = error.response?.data?.detail || error.message || 'Failed to save menu item';
            alert(`Error: ${errorMsg}`);
        }
    };

    const resetItemForm = () => {
        setEditingItem(null);
        setItemForm({
            name: '',
            description: '',
            price: '',
            category_id: '',
            preparation_time: '',
            is_available: true,
            bom_mappings: []
        });
    };

    const handleDeleteItem = async (itemId) => {
        if (!confirm('Are you sure you want to delete this item?')) return;

        try {
            await menuAPI.deleteItem(itemId);
            alert('Item deleted successfully!');
            fetchData();
        } catch (error) {
            console.error('Error deleting item:', error);
            alert('Failed to delete item');
        }
    };

    const addBOMMapping = () => {
        setItemForm({
            ...itemForm,
            bom_mappings: [...itemForm.bom_mappings, { ingredient_id: '', quantity: '' }]
        });
    };

    const updateBOMMapping = (index, field, value) => {
        const newMappings = [...itemForm.bom_mappings];
        newMappings[index][field] = value;
        setItemForm({ ...itemForm, bom_mappings: newMappings });
    };

    const removeBOMMapping = (index) => {
        setItemForm({
            ...itemForm,
            bom_mappings: itemForm.bom_mappings.filter((_, i) => i !== index)
        });
    };

    const filteredItems = selectedCategory
        ? menuItems.filter(item => item.category_id === selectedCategory)
        : menuItems;

    const actions = (
        <>
            <button className="btn btn-secondary" onClick={() => setShowCategoryModal(true)}>
                <span>📁</span>
                Add Category
            </button>
            <button className="btn btn-secondary" onClick={() => setShowManageModal(true)}>
                <span>⚙️</span>
                Manage Categories
            </button>
            <button className="btn btn-primary" onClick={() => { resetItemForm(); setShowItemModal(true); }}>
                <span>➕</span>
                Add Menu Item
            </button>
        </>
    );

    return (
        <AppLayout
            title="Menu Management"
            subtitle="Manage menu items and categories"
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
                <>
                    {/* Category Filter */}
                    <div className="mb-xl">
                        <h3 style={{ marginBottom: 'var(--spacing-md)' }}>Categories</h3>
                        <div style={{ display: 'flex', gap: 'var(--spacing-md)', flexWrap: 'wrap' }}>
                            <button
                                onClick={() => setSelectedCategory(null)}
                                className={`btn ${!selectedCategory ? 'btn-primary' : 'btn-secondary'}`}
                            >
                                All Items ({menuItems.length})
                            </button>
                            {categories.map(cat => (
                                <button
                                    key={cat.id}
                                    onClick={() => setSelectedCategory(cat.id)}
                                    className={`btn ${selectedCategory === cat.id ? 'btn-primary' : 'btn-secondary'}`}
                                >
                                    {cat.name} ({menuItems.filter(i => i.category_id === cat.id).length})
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Menu Items Grid */}
                    {filteredItems.length === 0 ? (
                        <div className="stat-card" style={{ textAlign: 'center', padding: 'var(--spacing-2xl)' }}>
                            <div style={{ fontSize: '4rem', marginBottom: 'var(--spacing-lg)' }}>📋</div>
                            <h2 style={{ marginBottom: 'var(--spacing-md)' }}>No Menu Items Yet</h2>
                            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--spacing-xl)' }}>
                                Start by adding your first menu item
                            </p>
                            <button className="btn btn-primary" onClick={() => setShowItemModal(true)}>
                                <span>➕</span>
                                Add First Item
                            </button>
                        </div>
                    ) : (
                        <div style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
                            gap: 'var(--spacing-lg)'
                        }}>
                            {filteredItems.map(item => (
                                <div key={item.id} className="stat-card">
                                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 'var(--spacing-md)' }}>
                                        <span className="badge badge-success">
                                            {categories.find(c => c.id === item.category_id)?.name || 'Uncategorized'}
                                        </span>
                                        <span className={item.is_available ? 'badge-success' : 'badge-error'}>
                                            {item.is_available ? 'Available' : 'Unavailable'}
                                        </span>
                                    </div>
                                    <h3 style={{ fontSize: 'var(--font-size-xl)', marginBottom: 'var(--spacing-sm)' }}>
                                        {item.name}
                                    </h3>
                                    {item.description && (
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                            {item.description}
                                        </p>
                                    )}
                                    <div style={{ fontSize: 'var(--font-size-2xl)', fontWeight: 700, color: 'var(--primary)', marginBottom: 'var(--spacing-md)' }}>
                                        ₹{parseFloat(item.price).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                    </div>
                                    {item.preparation_time > 0 && (
                                        <p style={{ fontSize: 'var(--font-size-sm)', color: 'var(--text-secondary)', marginBottom: 'var(--spacing-md)' }}>
                                            ⏱️ {item.preparation_time} mins
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: 'var(--spacing-sm)', marginTop: 'var(--spacing-lg)' }}>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ flex: 1, fontSize: 'var(--font-size-sm)' }}
                                            onClick={() => handleEditItem(item)}
                                        >
                                            Edit
                                        </button>
                                        <button
                                            className="btn btn-secondary"
                                            style={{ flex: 1, fontSize: 'var(--font-size-sm)', color: 'var(--error)' }}
                                            onClick={() => handleDeleteItem(item.id)}
                                        >
                                            Delete
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            )}

            {/* Add Category Modal */}
            <Modal
                isOpen={showCategoryModal}
                onClose={() => setShowCategoryModal(false)}
                title="Add Category"
                size="md"
            >
                <form onSubmit={handleCreateCategory}>
                    <div style={{ marginBottom: 'var(--spacing-md)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                            Category Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={categoryForm.name}
                            onChange={(e) => setCategoryForm({ ...categoryForm, name: e.target.value })}
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-base)'
                            }}
                            placeholder="e.g., Appetizers, Main Course"
                        />
                    </div>
                    <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                        <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                            Description
                        </label>
                        <textarea
                            value={categoryForm.description}
                            onChange={(e) => setCategoryForm({ ...categoryForm, description: e.target.value })}
                            rows="3"
                            style={{
                                width: '100%',
                                padding: 'var(--spacing-md)',
                                border: '1px solid var(--border-medium)',
                                borderRadius: 'var(--radius-md)',
                                fontSize: 'var(--font-size-base)',
                                resize: 'vertical'
                            }}
                            placeholder="Optional description"
                        />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                        <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowCategoryModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                            Create Category
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Add/Edit Menu Item Modal */}
            {showItemModal && (
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
                    <div className="stat-card" style={{ width: '600px', maxWidth: '90%', maxHeight: '90vh', overflowY: 'auto' }}>
                        <h2 style={{ marginBottom: 'var(--spacing-lg)' }}>{editingItem ? 'Edit Menu Item' : 'Add Menu Item'}</h2>
                        <form onSubmit={handleCreateOrUpdateItem}>
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Item Name *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={itemForm.name}
                                    onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                    placeholder="e.g., Margherita Pizza"
                                />
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Description
                                </label>
                                <textarea
                                    value={itemForm.description}
                                    onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                                    rows="2"
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)',
                                        resize: 'vertical'
                                    }}
                                    placeholder="Optional description"
                                />
                            </div>

                            {/* Image Upload */}
                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Menu Item Image
                                </label>
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleImageChange}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                />
                                {(imagePreview || (editingItem?.image_url)) && (
                                    <div style={{ marginTop: 'var(--spacing-md)', textAlign: 'center' }}>
                                        <img
                                            src={imagePreview || `http://localhost:8000${editingItem?.image_url}`}
                                            alt="Preview"
                                            style={{
                                                maxWidth: '200px',
                                                maxHeight: '200px',
                                                borderRadius: 'var(--radius-md)',
                                                objectFit: 'cover',
                                                border: '2px solid var(--border-medium)'
                                            }}
                                        />
                                    </div>
                                )}
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: 'var(--spacing-md)' }}>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Price (₹) *
                                    </label>
                                    <input
                                        type="number"
                                        step="0.01"
                                        required
                                        value={itemForm.price}
                                        onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                        placeholder="12.99"
                                    />
                                </div>
                                <div>
                                    <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                        Prep Time (mins)
                                    </label>
                                    <input
                                        type="number"
                                        value={itemForm.preparation_time}
                                        onChange={(e) => setItemForm({ ...itemForm, preparation_time: e.target.value })}
                                        style={{
                                            width: '100%',
                                            padding: 'var(--spacing-md)',
                                            border: '1px solid var(--border-medium)',
                                            borderRadius: 'var(--radius-md)',
                                            fontSize: 'var(--font-size-base)'
                                        }}
                                        placeholder="15"
                                    />
                                </div>
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-md)' }}>
                                <label style={{ display: 'block', marginBottom: 'var(--spacing-sm)', fontWeight: 600 }}>
                                    Category *
                                </label>
                                <select
                                    required
                                    value={itemForm.category_id}
                                    onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                                    style={{
                                        width: '100%',
                                        padding: 'var(--spacing-md)',
                                        border: '1px solid var(--border-medium)',
                                        borderRadius: 'var(--radius-md)',
                                        fontSize: 'var(--font-size-base)'
                                    }}
                                >
                                    <option value="">Select a category</option>
                                    {categories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </select>
                            </div>

                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <label style={{ display: 'flex', alignItems: 'center', gap: 'var(--spacing-sm)', cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={itemForm.is_available}
                                        onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                                    />
                                    <span style={{ fontWeight: 600 }}>Available for sale</span>
                                </label>
                            </div>

                            {/* Bill of Materials */}
                            <div style={{ marginBottom: 'var(--spacing-lg)' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--spacing-md)' }}>
                                    <label style={{ fontWeight: 600 }}>Bill of Materials (BOM)</label>
                                    <button type="button" className="btn btn-secondary" style={{ fontSize: 'var(--font-size-sm)' }} onClick={addBOMMapping}>
                                        + Add Ingredient
                                    </button>
                                </div>
                                {itemForm.bom_mappings.map((bom, index) => (
                                    <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: 'var(--spacing-sm)', marginBottom: 'var(--spacing-sm)' }}>
                                        <select
                                            value={bom.ingredient_id}
                                            onChange={(e) => updateBOMMapping(index, 'ingredient_id', e.target.value)}
                                            style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--border-medium)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: 'var(--font-size-sm)'
                                            }}
                                        >
                                            <option value="">Select ingredient</option>
                                            {ingredients.map(ing => (
                                                <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                                            ))}
                                        </select>
                                        <input
                                            type="number"
                                            step="0.01"
                                            value={bom.quantity}
                                            onChange={(e) => updateBOMMapping(index, 'quantity', e.target.value)}
                                            placeholder="Qty"
                                            style={{
                                                padding: 'var(--spacing-sm)',
                                                border: '1px solid var(--border-medium)',
                                                borderRadius: 'var(--radius-md)',
                                                fontSize: 'var(--font-size-sm)'
                                            }}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => removeBOMMapping(index)}
                                            className="btn btn-secondary"
                                            style={{ padding: '0.5rem', color: 'var(--error)' }}
                                        >
                                            ×
                                        </button>
                                    </div>
                                ))}
                            </div>

                            <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                                <button type="button" className="btn btn-secondary" style={{ flex: 1 }} onClick={() => setShowItemModal(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary" style={{ flex: 1 }}>
                                    {editingItem ? 'Update Menu Item' : 'Create Menu Item'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Manage Categories Modal */}
            <Modal
                isOpen={showManageModal}
                onClose={() => setShowManageModal(false)}
                title="Manage Categories"
                size="lg"
            >
                <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <p style={{ marginBottom: 'var(--spacing-md)', color: 'var(--text-secondary)' }}>
                        Review, edit, or delete meal categories.
                    </p>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--border-medium)', textAlign: 'left' }}>
                                <th style={{ padding: 'var(--spacing-sm)' }}>Name</th>
                                <th style={{ padding: 'var(--spacing-sm)' }}>Description</th>
                                <th style={{ padding: 'var(--spacing-sm)', textAlign: 'right' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {categories.map(cat => (
                                <tr key={cat.id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                                    <td style={{ padding: 'var(--spacing-sm)' }}>
                                        {editingCategory?.id === cat.id ? (
                                            <input
                                                type="text"
                                                value={editingCategory.name}
                                                onChange={(e) => setEditingCategory({ ...editingCategory, name: e.target.value })}
                                                style={{ padding: '4px', width: '100%' }}
                                            />
                                        ) : (
                                            cat.name
                                        )}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-sm)' }}>
                                        {editingCategory?.id === cat.id ? (
                                            <input
                                                type="text"
                                                value={editingCategory.description || ''}
                                                onChange={(e) => setEditingCategory({ ...editingCategory, description: e.target.value })}
                                                style={{ padding: '4px', width: '100%' }}
                                            />
                                        ) : (
                                            cat.description
                                        )}
                                    </td>
                                    <td style={{ padding: 'var(--spacing-sm)', textAlign: 'right', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                                        {editingCategory?.id === cat.id ? (
                                            <>
                                                <button className="btn btn-primary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={saveEdit}>Save</button>
                                                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={cancelEditing}>Cancel</button>
                                            </>
                                        ) : (
                                            <>
                                                <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => startEditing(cat)}>Edit</button>
                                                <button
                                                    className="btn btn-secondary"
                                                    style={{ padding: '4px 8px', fontSize: '12px', color: 'var(--error)', borderColor: 'var(--error)' }}
                                                    onClick={() => handleDeleteCategory(cat.id)}
                                                >
                                                    Delete
                                                </button>
                                            </>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div style={{ marginTop: 'var(--spacing-lg)', textAlign: 'right' }}>
                    <button className="btn btn-secondary" onClick={() => setShowManageModal(false)}>
                        Close
                    </button>
                </div>
            </Modal>
        </AppLayout>
    );
}

export default MenuManagement;
