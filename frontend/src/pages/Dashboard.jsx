import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import api from '../services/api';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { AppLayout } from '../components/AppLayout';
import {
    IndianRupee,
    ShoppingBag,
    Utensils,
    Users,
    ShoppingCart,
    ChefHat,
    ClipboardList,
    Package,
    CreditCard,
    BarChart3
} from 'lucide-react';

function Dashboard() {
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

    useEffect(() => {
        fetchDashboardData();
    }, []);

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

    const statCards = [
        {
            label: 'Total Revenue',
            value: `₹${stats.totalRevenue.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
            icon: <IndianRupee size={24} color="var(--success)" />,
            trend: `${stats.revenueTrend > 0 ? '+' : ''}${stats.revenueTrend}%`,
            trendUp: stats.revenueTrend >= 0,
            colorClass: stats.revenueTrend >= 0 ? 'green' : 'red',
            trendLabel: 'from yesterday'
        },
        {
            label: 'Total Orders',
            value: stats.totalOrders.toLocaleString(),
            icon: <ShoppingBag size={24} color="var(--primary)" />,
            trend: `${stats.ordersTrend > 0 ? '+' : ''}${stats.ordersTrend}%`,
            trendUp: stats.ordersTrend >= 0,
            colorClass: stats.ordersTrend >= 0 ? 'blue' : 'red',
            trendLabel: 'from yesterday'
        },
        {
            label: 'Menu Items',
            value: stats.menuItems.toString(),
            icon: <Utensils size={24} color="#9333EA" />,
            trend: 'Active',
            trendUp: true,
            colorClass: 'purple',
            trendLabel: 'items'
        },
        {
            label: 'Active Staff',
            value: stats.activeStaff.toString(),
            icon: <Users size={24} color="var(--warning)" />,
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
            icon: <ShoppingCart size={32} color="white" />,
            path: '/pos',
            gradient: 'linear-gradient(135deg, #F63049, #D02752)'
        },
        {
            title: 'Kitchen Display System',
            description: 'Real-time order tracking and kitchen workflow management',
            icon: <ChefHat size={32} color="white" />,
            path: '/kds',
            gradient: 'linear-gradient(135deg, #3B82F6, #1E40AF)'
        },
        {
            title: 'Menu Management',
            description: 'Create and manage menu items, categories, and pricing',
            icon: <ClipboardList size={32} color="white" />,
            path: '/menu',
            gradient: 'linear-gradient(135deg, #8B5CF6, #6D28D9)'
        },
        {
            title: 'Inventory Control',
            description: 'Track ingredients, stock levels, and automated alerts',
            icon: <Package size={32} color="white" />,
            path: '/inventory',
            gradient: 'linear-gradient(135deg, #F59E0B, #D97706)'
        },
        {
            title: 'Billing & Payments',
            description: 'Process payments, generate invoices, and manage transactions',
            icon: <CreditCard size={32} color="white" />,
            path: '/billing',
            gradient: 'linear-gradient(135deg, #EC4899, #BE185D)'
        },
        {
            title: 'Reports & Analytics',
            description: 'Comprehensive insights, sales reports, and business analytics',
            icon: <BarChart3 size={32} color="white" />,
            path: '/reports',
            gradient: 'linear-gradient(135deg, #06B6D4, #0891B2)'
        },
    ];

    // Chart colors
    const COLORS = ['#6366F1', '#8B5CF6', '#EC4899', '#F59E0B', '#10B981'];

    const actions = (
        <>
            <button className="btn btn-secondary" onClick={fetchDashboardData}>
                <span>🔄</span>
            </button>
            <Link to="/pos" className="btn btn-primary">
                <span>➕</span> New Order
            </Link>
        </>
    );

    return (
        <AppLayout
            title="Dashboard"
            subtitle="Overview of your business performance"
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
        </AppLayout>
    );
}

export default Dashboard;
