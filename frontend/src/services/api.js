import axios from 'axios';

// Dynamically determine the backend URL based on where the frontend is hosted
// This prevents IPv4 vs IPv6 'localhost' resolution issues on Windows
const getBaseUrl = () => {
    if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
    // If we're running locally, use the exact same hostname but port 8000
    if (typeof window !== 'undefined' && window.location.hostname) {
        return `http://${window.location.hostname}:8000`;
    }
    return 'http://127.0.0.1:8000';
};

const API_BASE_URL = getBaseUrl();

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

// Online Orders API (Zomato/Swiggy)
export const onlineOrdersAPI = {
    getPending: () => api.get('/api/orders/online/pending'),
    approve: (orderId) => api.post(`/api/orders/online/${orderId}/approve`),
    reject: (orderId, reason = 'Restaurant is busy') => api.post(`/api/orders/online/${orderId}/reject`, null, { params: { reason } }),
};

// Waiter API
export const waiterAPI = {
    getActiveOrders: () => api.get('/api/orders/waiter/active'),
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
    downloadInvoice: (orderId, type = "a4") => api.get(`/api/billing/invoice/${orderId}/download`, { params: { type }, responseType: 'blob' }),
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
    getOnlineVsOffline: (days = 30) => api.get('/api/reports/online-vs-offline', { params: { days } }),
    getDashboardStats: () => api.get('/api/reports/dashboard-stats'),
    getDashboardCharts: () => api.get('/api/reports/dashboard-charts'),
    getSalesForecast: (days = 30, forecastDays = 7) => api.get('/api/reports/sales-forecast', { params: { days, forecast_days: forecastDays } }),
    getDailyRevenueTrend: (days = 30) => api.get('/api/reports/daily-revenue-trend', { params: { days } }),
    getCategorySales: (days = 7) => api.get('/api/reports/category-sales', { params: { days } }),
    getPaymentMethods: (days = 7) => api.get('/api/reports/payment-methods', { params: { days } }),
};

// AI Chatbot API
export const aiAPI = {
    sendMessage: (message, conversationId = null) => api.post('/api/ai/chat', { message, conversation_id: conversationId }),
    getHistory: (conversationId) => api.get(`/api/ai/history/${conversationId}`),
    getConversations: () => api.get('/api/ai/conversations'),
    deleteConversation: (conversationId) => api.delete(`/api/ai/conversations/${conversationId}`),
};

// AI Agents API
export const agentsAPI = {
    getInsights: () => api.get('/api/agents/insights'),
    getStatus: () => api.get('/api/agents/status'),
    getHistory: (limit = 10) => api.get('/api/agents/history', { params: { limit } }),
    runAnalysis: () => api.post('/api/agents/run'),
    getBrief: (runId) => api.get(`/api/agents/brief/${runId}`),
};

// Revenue Intelligence API
export const revenueIntelligenceAPI = {
    getFullReport: (days = 30) => api.get('/api/revenue-intelligence/full-report', { params: { days } }),
    getMargins: (days = 30) => api.get('/api/revenue-intelligence/margins', { params: { days } }),
    getProfitability: (days = 30) => api.get('/api/revenue-intelligence/profitability', { params: { days } }),
    getVelocity: (days = 30) => api.get('/api/revenue-intelligence/velocity', { params: { days } }),
    getCombos: (days = 30) => api.get('/api/revenue-intelligence/combos', { params: { days } }),
    getUpsells: (days = 30) => api.get('/api/revenue-intelligence/upsells', { params: { days } }),
    getPriceRecommendations: (days = 30) => api.get('/api/revenue-intelligence/price-recommendations', { params: { days } }),
};

export default api;
