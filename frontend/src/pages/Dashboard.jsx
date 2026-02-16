import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import api from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ThemeToggle } from '../components/ThemeToggle';

function Dashboard() {
    const location = useLocation();
    const [stats, setStats] = useState({
        totalRevenue: 0,
        revenueTrend: 0,
        totalOrders: 0,
        ordersTrend: 0,
        menuItems: 0,
        activeStaff: 0
    });
    const [loading, setLoading] = useState(true);
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        fetchDashboardData();
    }, []);

    useEffect(() => {
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const fetchDashboardData = async () => {
        try {
            setLoading(true);
            const response = await api.get('/api/reports/dashboard-stats');

            if (response.data) {
                setStats({
                    totalRevenue: response.data.total_revenue || 0,
                    revenueTrend: response.data.revenue_trend || 0,
                    totalOrders: response.data.total_orders || 0,
                    ordersTrend: response.data.orders_trend || 0,
                    menuItems: response.data.menu_items || 0,
                    activeStaff: response.data.active_staff || 0
                });
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    const navItems = [
        { path: '/', icon: '📊', label: 'Dashboard' },
        { path: '/pos', icon: '🛒', label: 'POS Terminal' },
        { path: '/kds', icon: '👨‍🍳', label: 'Kitchen Display' },
        { path: '/menu', icon: '📋', label: 'Menu' },
        { path: '/inventory', icon: '📦', label: 'Inventory' },
        { path: '/billing', icon: '💳', label: 'Billing' },
        { path: '/reports', icon: '📈', label: 'Reports' },
    ];

    const statCards = [
        {
            label: 'Total Revenue',
            value: `₹${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: '💰',
            trend: `${stats.revenueTrend > 0 ? '+' : ''}${stats.revenueTrend}%`,
            trendUp: stats.revenueTrend >= 0,
            colorClass: stats.revenueTrend >= 0 ? 'green' : 'red',
            trendLabel: 'from yesterday'
        },
        {
            label: 'Total Orders',
            value: stats.totalOrders.toLocaleString(),
            icon: '🛍️',
            trend: `${stats.ordersTrend > 0 ? '+' : ''}${stats.ordersTrend}%`,
            trendUp: stats.ordersTrend >= 0,
            colorClass: stats.ordersTrend >= 0 ? 'blue' : 'red',
            trendLabel: 'from yesterday'
        },
        {
            label: 'Menu Items',
            value: stats.menuItems.toString(),
            icon: '🍽️',
            trend: 'Active',
            trendUp: true,
            colorClass: 'purple',
            trendLabel: 'items'
        },
        {
            label: 'Active Staff',
            value: stats.activeStaff.toString(),
            icon: '👥',
            trend: 'Now',
            trendUp: true,
            colorClass: 'orange',
            trendLabel: 'online'
        },
    ];

    const modules = [
        {
            title: 'POS Terminal',
            description: 'Take orders, manage sales, and process transactions in real-time',
            icon: '🛒',
            path: '/pos',
            gradient: 'linear-gradient(135deg, #F63049, #D02752)'
        },
        {
            title: 'Kitchen Display System',
            description: 'Real-time order tracking and kitchen workflow management',
            icon: '👨‍🍳',
            path: '/kds',
            gradient: 'linear-gradient(135deg, #3B82F6, #1E40AF)'
        },
        {
            title: 'Menu Management',
            description: 'Create and manage menu items, categories, and pricing',
            icon: '📋',
            path: '/menu',
            gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)'
        },
        {
            title: 'Inventory Control',
            description: 'Track ingredients, stock levels, and automated alerts',
            icon: '📦',
            path: '/inventory',
            gradient: 'linear-gradient(135deg, #F59E0B, #D97706)'
        },
        {
            title: 'Billing & Payments',
            description: 'Process payments, generate invoices, and manage transactions',
            icon: '💳',
            path: '/billing',
            gradient: 'linear-gradient(135deg, #EC4899, #BE185D)'
        },
        {
            title: 'Reports & Analytics',
            description: 'Comprehensive insights, sales reports, and business analytics',
            icon: '📊',
            path: '/reports',
            gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)'
        },
    ];

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">🍽️</div>
                        <span>SujalPOS</span>
                    </div>
                </div>
                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                        >
                            <span className="nav-item-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Sidebar Footer with Toggle */}
                <div className="sidebar-footer">
                    <button
                        className="sidebar-toggle"
                        onClick={toggleSidebar}
                        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        {sidebarCollapsed ? '→' : '←'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Top Bar */}
                <div className="top-bar">
                    <div>
                        <h1 className="page-title">Dashboard</h1>
                        <p className="page-subtitle">Welcome back! Here's what's happening today.</p>
                    </div>
                    <div className="flex items-center gap-md">
                        <ThemeToggle />
                        <button className="btn btn-secondary" onClick={fetchDashboardData}>
                            <span>🔄</span>
                        </button>
                        <Link to="/pos" className="btn btn-primary">
                            <span>➕</span>
                            New Order
                        </Link>
                    </div>
                </div>

                {/* Content Area */}
                <div className="content-area">
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
                            {/* Stats Grid */}
                            <div className="stats-grid">
                                {statCards.map((stat, index) => (
                                    <div
                                        key={index}
                                        className="stat-card fade-in-up"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="stat-card-header">
                                            <div className={`stat-card-icon ${stat.colorClass}`}>
                                                {stat.icon}
                                            </div>
                                        </div>
                                        <div className="stat-card-value">{stat.value}</div>
                                        <div className="stat-card-label">{stat.label}</div>
                                        <div className={`stat-card-trend ${stat.trendUp ? 'up' : 'down'}`}>
                                            <span>{stat.trendUp ? '↑' : '↓'}</span>
                                            <span>{stat.trend} {stat.trendLabel}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Quick Actions Section */}
                            <div className="mb-xl">
                                <h2 style={{
                                    marginBottom: 'var(--spacing-xl)',
                                    fontSize: 'var(--font-size-3xl)',
                                    fontWeight: 700,
                                    background: 'linear-gradient(135deg, var(--text-primary), var(--text-secondary))',
                                    WebkitBackgroundClip: 'text',
                                    WebkitTextFillColor: 'transparent',
                                    backgroundClip: 'text',
                                }}>
                                    Quick Access
                                </h2>
                                <div className="modules-grid">
                                    {modules.map((module, index) => (
                                        <Link
                                            key={index}
                                            to={module.path}
                                            className="module-card fade-in-up"
                                            style={{ animationDelay: `${(index + 4) * 100}ms` }}
                                        >
                                            <div className="module-card-icon" style={{ background: module.gradient }}>
                                                {module.icon}
                                            </div>
                                            <h3 className="module-card-title">{module.title}</h3>
                                            <p className="module-card-description">{module.description}</p>
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </main>
        </div>
    );
}

export default Dashboard;
