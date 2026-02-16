import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor for error handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API
export const authAPI = {
    login: (credentials) => api.post('/api/auth/login', credentials),
    register: (userData) => api.post('/api/auth/register', userData),
    getCurrentUser: () => api.get('/api/auth/me'),
    createRestaurant: (data) => api.post('/api/auth/restaurants', data),
};

// Menu API
export const menuAPI = {
    getCategories: () => api.get('/api/menu/categories'),
    createCategory: (data) => api.post('/api/menu/categories', data),
    updateCategory: (id, data) => api.put(`/api/menu/categories/${id}`, data),
    deleteCategory: (id) => api.delete(`/api/menu/categories/${id}`),
    getItems: (categoryId) => api.get('/api/menu/items', { params: { category_id: categoryId } }),
    createItem: (data) => api.post('/api/menu/items', data),
    updateItem: (id, data) => api.put(`/api/menu/items/${id}`, data),
    deleteItem: (id) => api.delete(`/api/menu/items/${id}`),
};

// Inventory API
export const inventoryAPI = {
    getIngredients: () => api.get('/api/inventory/ingredients'),
    createIngredient: (data) => api.post('/api/inventory/ingredients', data),
    updateIngredient: (id, data) => api.put(`/api/inventory/ingredients/${id}`, data),
    deleteIngredient: (id) => api.delete(`/api/inventory/ingredients/${id}`),
    getLowStockAlerts: () => api.get('/api/inventory/alerts/low-stock'),
    getExpiryAlerts: (days = 7) => api.get('/api/inventory/alerts/expiry', { params: { days } }),
    logWastage: (data) => api.post('/api/inventory/wastage', data),
};

// Orders API
export const ordersAPI = {
    createOrder: (data) => api.post('/api/orders/', data),
    getOrders: (status) => api.get('/api/orders/', { params: { status } }),
    getOrder: (id) => api.get(`/api/orders/${id}`),
    updateStatus: (id, status) => api.put(`/api/orders/${id}/status`, null, { params: { status } }),
    cancelOrder: (id) => api.delete(`/api/orders/${id}`),
};

// KDS API
export const kdsAPI = {
    getActiveKOTs: () => api.get('/api/kds/'),
    getAllKOTs: () => api.get('/api/kds/all'),
    updateKOTStatus: (id, status) => api.put(`/api/kds/${id}/status`, null, { params: { status } }),
};

// Billing API
export const billingAPI = {
    calculateBill: (orderId, discountCode) =>
        api.post(`/api/billing/calculate/${orderId}`, null, { params: { discount_code: discountCode } }),
    processPayment: (data) => api.post('/api/billing/payment', data),
    generateInvoice: (orderId, type = "thermal") => api.post(`/api/billing/invoice/${orderId}`, null, { params: { type } }),
    emailInvoice: (orderId, email) => api.post(`/api/billing/email/${orderId}`, null, { params: { email } }),
};

// Reports API
export const reportsAPI = {
    getSalesReport: (days = 7) => api.get('/api/reports/sales', { params: { days } }),
    getItemWiseSales: (days = 7) => api.get('/api/reports/sales/items', { params: { days } }),
    getPeakHours: (days = 7) => api.get('/api/reports/peak-hours', { params: { days } }),
    getIngredientUsage: (days = 7) => api.get('/api/reports/inventory/usage', { params: { days } }),
    getWastageReport: (days = 7) => api.get('/api/reports/wastage', { params: { days } }),
    getCostAnalysis: (menuItemId) => api.get(`/api/reports/cost-analysis/${menuItemId}`),
};

// AI Chatbot API
export const aiAPI = {
    sendMessage: (message, conversationId = null) => api.post('/api/ai/chat', { message, conversation_id: conversationId }),
    getHistory: (conversationId) => api.get(`/api/ai/history/${conversationId}`),
};

export default api;
