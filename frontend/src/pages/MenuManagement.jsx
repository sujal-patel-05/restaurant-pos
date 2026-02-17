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
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);


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
        setImageFile(null);
        setImagePreview(item.image_url ? `http://localhost:8000${item.image_url}` : null);
        setShowItemModal(true);
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const uploadImage = async (itemId) => {
        if (!imageFile) return;

        const formData = new FormData();
        formData.append('file', imageFile);

        try {
            await fetch(`http://localhost:8000/api/menu/items/${itemId}/image`, {
                method: 'POST',
                body: formData,
            });
        } catch (error) {
            console.error('Error uploading image:', error);
            alert('Failed to upload image');
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
                        quantity_required: parseFloat(bom.quantity)
                    }))
            };

            let savedItem;
            if (editingItem) {
                savedItem = await menuAPI.updateItem(editingItem.id, itemData);
                if (imageFile) await uploadImage(editingItem.id);
                alert('Menu item updated successfully!');
            } else {
                savedItem = await menuAPI.createItem(itemData);
                if (imageFile && savedItem.data?.id) await uploadImage(savedItem.data.id);
                // The API response structure might be different, let's check. 
                // menuAPI.createItem returns response, response.data usually holds the item.
                // But axios returns data in response.data. So savedItem is the response object.
                // Actually, let's look at api.js if available, but assuming standard axios.
                // Wait, in previous code: savedItem = await menuAPI.createItem(itemData);
                // The backend returns the item object directly. 
                // If using axios, it's response.data.
                // Let's assume standard behavior. If savedItem is the item itself (from response.data), then savedItem.id.
                // If savedItem is the axios response, then savedItem.data.id.
                // menuAPI.createItem calls axios.post.
                // Let's play it safe and check both or rely on what we know.
                // In Line 46: setCategories(categoriesRes.data || []);
                // This implies menuAPI returns the axios response.
                if (imageFile && savedItem?.data?.id) await uploadImage(savedItem.data.id);
                alert('Menu item created successfully!');
            }

            resetItemForm();
            setShowItemModal(false);
            fetchData();
        } catch (error) {
            console.error('Error saving item:', error);
            const errorData = error.response?.data?.detail;
            const errorMsg = typeof errorData === 'object'
                ? JSON.stringify(errorData, null, 2)
                : (errorData || error.message || 'Failed to save menu item');
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
        setImageFile(null);
        setImagePreview(null);
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

                                    {/* Image Display */}
                                    {item.image_url ? (
                                        <div style={{
                                            marginBottom: 'var(--spacing-md)',
                                            borderRadius: 'var(--radius-md)',
                                            overflow: 'hidden',
                                            height: '150px'
                                        }}>
                                            <img
                                                src={`http://localhost:8000${item.image_url}`}
                                                alt={item.name}
                                                style={{
                                                    width: '100%',
                                                    height: '100%',
                                                    objectFit: 'cover',
                                                    transition: 'transform 0.3s'
                                                }}
                                            />
                                        </div>
                                    ) : (
                                        <div style={{
                                            marginBottom: 'var(--spacing-md)',
                                            borderRadius: 'var(--radius-md)',
                                            height: '150px',
                                            background: 'var(--bg-body)',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            color: 'var(--text-light)',
                                            fontSize: '2rem'
                                        }}>
                                            🍽️
                                        </div>
                                    )}

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
            <Modal
                isOpen={showItemModal}
                onClose={() => setShowItemModal(false)}
                title={editingItem ? 'Edit Menu Item' : 'Add Menu Item'}
                size="lg"
            >
                <form onSubmit={handleCreateOrUpdateItem}>
                    <div className="form-group">
                        <label className="form-label">
                            Item Name *
                        </label>
                        <input
                            type="text"
                            required
                            value={itemForm.name}
                            onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })}
                            className="form-input"
                            placeholder="e.g., Margherita Pizza"
                        />
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Description
                        </label>
                        <textarea
                            value={itemForm.description}
                            onChange={(e) => setItemForm({ ...itemForm, description: e.target.value })}
                            rows="2"
                            className="form-input"
                            style={{ resize: 'vertical' }}
                            placeholder="Optional description"
                        />
                    </div>

                    {/* Image Upload */}
                    <div className="form-group">
                        <label className="form-label">
                            Item Image
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                            <div style={{
                                width: '80px',
                                height: '80px',
                                borderRadius: 'var(--radius-md)',
                                background: 'var(--bg-body)',
                                border: '1px dashed var(--border-color)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                overflow: 'hidden'
                            }}>
                                {imagePreview ? (
                                    <img
                                        src={imagePreview}
                                        alt="Preview"
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                                    />
                                ) : (
                                    <span style={{ fontSize: '1.5rem', color: 'var(--text-light)' }}>📷</span>
                                )}
                            </div>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageChange}
                                className="form-input"
                                style={{ flex: 1 }}
                            />
                        </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-md)', marginBottom: '1rem' }}>
                        <div className="form-group">
                            <label className="form-label">
                                Price (₹) *
                            </label>
                            <input
                                type="number"
                                step="0.01"
                                required
                                value={itemForm.price}
                                onChange={(e) => setItemForm({ ...itemForm, price: e.target.value })}
                                className="form-input"
                                placeholder="12.99"
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">
                                Prep Time (mins)
                            </label>
                            <input
                                type="number"
                                value={itemForm.preparation_time}
                                onChange={(e) => setItemForm({ ...itemForm, preparation_time: e.target.value })}
                                className="form-input"
                                placeholder="15"
                            />
                        </div>
                    </div>

                    <div className="form-group">
                        <label className="form-label">
                            Category *
                        </label>
                        <select
                            required
                            value={itemForm.category_id}
                            onChange={(e) => setItemForm({ ...itemForm, category_id: e.target.value })}
                            className="form-select"
                        >
                            <option value="">Select a category</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="form-group">
                        <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}>
                            <input
                                type="checkbox"
                                checked={itemForm.is_available}
                                onChange={(e) => setItemForm({ ...itemForm, is_available: e.target.checked })}
                                style={{ accentColor: 'var(--primary)', width: '1.2rem', height: '1.2rem' }}
                            />
                            <span style={{ fontWeight: 600 }}>Available for sale</span>
                        </label>
                    </div>

                    {/* Bill of Materials */}
                    <div style={{
                        background: 'var(--bg-body)',
                        padding: '1.5rem',
                        borderRadius: 'var(--radius-lg)',
                        marginBottom: '1.5rem',
                        border: '1px solid var(--border-color)'
                    }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                            <label style={{ fontWeight: 600, color: 'var(--text-main)' }}>Bill of Materials (BOM)</label>
                            <button type="button" className="btn btn-secondary" style={{ fontSize: '0.875rem' }} onClick={addBOMMapping}>
                                + Add Ingredient
                            </button>
                        </div>

                        {itemForm.bom_mappings.length === 0 && (
                            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', fontStyle: 'italic', textAlign: 'center', padding: '1rem' }}>
                                No ingredients added. Add ingredients to track inventory.
                            </p>
                        )}

                        {itemForm.bom_mappings.map((bom, index) => (
                            <div key={index} style={{ display: 'grid', gridTemplateColumns: '2fr 1fr auto', gap: '0.75rem', marginBottom: '0.75rem', alignItems: 'center' }}>
                                <select
                                    value={bom.ingredient_id}
                                    onChange={(e) => updateBOMMapping(index, 'ingredient_id', e.target.value)}
                                    className="form-select"
                                    style={{ padding: '0.5rem' }}
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
                                    className="form-input"
                                    style={{ padding: '0.5rem' }}
                                />
                                <button
                                    type="button"
                                    onClick={() => removeBOMMapping(index)}
                                    className="btn btn-secondary"
                                    style={{
                                        padding: '0.5rem',
                                        color: 'var(--error)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        width: '36px',
                                        height: '36px'
                                    }}
                                    title="Remove Ingredient"
                                >
                                    ✕
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: '2rem' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setShowItemModal(false)}>
                            Cancel
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {editingItem ? 'Update Menu Item' : 'Create Menu Item'}
                        </button>
                    </div>
                </form>
            </Modal>

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
