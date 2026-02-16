import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
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
    const [chartData, setChartData] = useState({
        revenueTrend: [],
        topItems: [],
        orderStatus: []
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
            const [statsRes, chartsRes] = await Promise.all([
                api.get('/api/reports/dashboard-stats'),
                api.get('/api/reports/dashboard-charts')
            ]);

            if (statsRes.data) {
                setStats({
                    totalRevenue: statsRes.data.total_revenue || 0,
                    revenueTrend: statsRes.data.revenue_trend || 0,
                    totalOrders: statsRes.data.total_orders || 0,
                    ordersTrend: statsRes.data.orders_trend || 0,
                    menuItems: statsRes.data.menu_items || 0,
                    activeStaff: statsRes.data.active_staff || 0
                });
            }

            if (chartsRes.data) {
                // Format order status for pie chart
                const statusData = Object.entries(chartsRes.data.order_status || {})
                    .filter(([key, value]) => key !== 'cancelled' && value > 0)
                    .map(([key, value]) => ({
                        name: key.charAt(0).toUpperCase() + key.slice(1),
                        value: value
                    }));

                setChartData({
                    revenueTrend: chartsRes.data.revenue_trend || [],
                    topItems: chartsRes.data.top_items || [],
                    orderStatus: statusData
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

    // Chart colors
    const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

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
                            title={item.label}
                        >
                            <span className="nav-item-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                {/* Sidebar Footer with Logout and Toggle */}
                <div className="sidebar-footer">
                    <button
                        className="nav-item"
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                        }}
                        title="Logout"
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span className="nav-item-icon">🚪</span>
                        <span>Logout</span>
                    </button>
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
                        <p className="page-subtitle">Overview of your business performance</p>
                    </div>
                    <div className="flex items-center gap-md">
                        <ThemeToggle />
                        <button className="btn btn-secondary" onClick={fetchDashboardData}>
                            <span>🔄</span>
                        </button>
                        <Link to="/pos" className="btn btn-primary">
                            <span>➕</span> New Order
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
                            <div className="stats-grid" style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                                gap: '1.5rem',
                                marginBottom: '2rem'
                            }}>
                                {statCards.map((stat, index) => (
                                    <div
                                        key={index}
                                        className="stat-card fade-in-up"
                                        style={{ animationDelay: `${index * 100}ms` }}
                                    >
                                        <div className="flex justify-between items-start">
                                            <div>
                                                <div className="stat-card-label">{stat.label}</div>
                                                <div className="stat-card-value">{stat.value}</div>
                                            </div>
                                            <div className={`stat-card-icon ${stat.colorClass}`} style={{ marginBottom: 0 }}>
                                                {stat.icon}
                                            </div>
                                        </div>

                                        <div className={`stat-card-trend ${stat.trendUp ? 'up' : 'down'}`}>
                                            <span>{stat.trendUp ? '↑' : '↓'}</span>
                                            <span>{stat.trend}</span>
                                            <span style={{ fontWeight: 400, opacity: 0.8, marginLeft: '4px' }}>{stat.trendLabel}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Charts Section */}
                            <div style={{
                                display: 'grid',
                                gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))',
                                gap: '1.5rem',
                                marginBottom: '2rem'
                            }}>
                                {/* Revenue Trend Chart */}
                                <div className="stat-card fade-in-up" style={{ animationDelay: '400ms', padding: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                                        Revenue Trend (Last 7 Days)
                                    </h2>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <AreaChart data={chartData.revenueTrend}>
                                            <defs>
                                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                                    <stop offset="5%" stopColor="#6366F1" stopOpacity={0.8} />
                                                    <stop offset="95%" stopColor="#8B5CF6" stopOpacity={0.1} />
                                                </linearGradient>
                                            </defs>
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                            <XAxis
                                                dataKey="date"
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                                tickFormatter={(value) => new Date(value).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}
                                            />
                                            <YAxis
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                                tickFormatter={(value) => `₹${value.toLocaleString()}`}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--card-bg)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-main)'
                                                }}
                                                formatter={(value) => [`₹${value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`, 'Revenue']}
                                                labelFormatter={(label) => new Date(label).toLocaleDateString('en-IN', { weekday: 'short', month: 'short', day: 'numeric' })}
                                            />
                                            <Area
                                                type="monotone"
                                                dataKey="revenue"
                                                stroke="#6366F1"
                                                strokeWidth={2}
                                                fillOpacity={1}
                                                fill="url(#colorRevenue)"
                                            />
                                        </AreaChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Top Selling Items Chart */}
                                <div className="stat-card fade-in-up" style={{ animationDelay: '500ms', padding: '1.5rem' }}>
                                    <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                                        Top Selling Items
                                    </h2>
                                    <ResponsiveContainer width="100%" height={300}>
                                        <BarChart data={chartData.topItems} layout="vertical">
                                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                            <XAxis
                                                type="number"
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                            />
                                            <YAxis
                                                type="category"
                                                dataKey="name"
                                                stroke="var(--text-secondary)"
                                                tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                                width={120}
                                            />
                                            <Tooltip
                                                contentStyle={{
                                                    backgroundColor: 'var(--card-bg)',
                                                    border: '1px solid var(--border-color)',
                                                    borderRadius: '8px',
                                                    color: 'var(--text-main)'
                                                }}
                                                formatter={(value, name) => [
                                                    name === 'quantity' ? `${value} sold` : `₹${value.toLocaleString('en-IN')}`,
                                                    name === 'quantity' ? 'Quantity' : 'Revenue'
                                                ]}
                                            />
                                            <Bar dataKey="quantity" radius={[0, 8, 8, 0]}>
                                                {chartData.topItems.map((entry, index) => (
                                                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                ))}
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>

                                {/* Order Status Breakdown */}
                                {chartData.orderStatus.length > 0 && (
                                    <div className="stat-card fade-in-up" style={{ animationDelay: '600ms', padding: '1.5rem' }}>
                                        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: '1.5rem' }}>
                                            Today's Order Status
                                        </h2>
                                        <ResponsiveContainer width="100%" height={300}>
                                            <PieChart>
                                                <Pie
                                                    data={chartData.orderStatus}
                                                    cx="50%"
                                                    cy="50%"
                                                    innerRadius={60}
                                                    outerRadius={100}
                                                    paddingAngle={5}
                                                    dataKey="value"
                                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                >
                                                    {chartData.orderStatus.map((entry, index) => (
                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip
                                                    contentStyle={{
                                                        backgroundColor: 'var(--card-bg)',
                                                        border: '1px solid var(--border-color)',
                                                        borderRadius: '8px',
                                                        color: 'var(--text-main)'
                                                    }}
                                                />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                )}
                            </div>

                            {/* Quick Actions Section */}
                            <div className="mb-xl">
                                <h2 style={{
                                    marginBottom: '1.5rem',
                                    fontSize: '1.25rem',
                                    fontWeight: 700,
                                    color: 'var(--text-main)'
                                }}>
                                    Quick Access
                                </h2>
                                <div className="modules-grid">
                                    {modules.map((module, index) => (
                                        <Link
                                            key={index}
                                            to={module.path}
                                            className="module-card fade-in-up"
                                            style={{ animationDelay: `${(index + 7) * 100}ms` }}
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
