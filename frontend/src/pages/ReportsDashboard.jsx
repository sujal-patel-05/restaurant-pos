
import React, { useState, useEffect } from 'react';
import { AppLayout } from '../components/AppLayout';
import { reportsAPI } from '../services/api';
import {
    LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

function ReportsDashboard() {
    const [loading, setLoading] = useState(true);
    const [dateRange, setDateRange] = useState(7); // days
    const [stats, setStats] = useState({
        sales: null,
        items: [],
        peakHours: [],
        ingredients: [],
        wastage: null
    });

    useEffect(() => {
        fetchReports();
    }, [dateRange]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const [salesData, itemsData, peakHoursData, ingredientsData, wastageData] = await Promise.all([
                reportsAPI.getSalesReport(dateRange),
                reportsAPI.getItemWiseSales(dateRange),
                reportsAPI.getPeakHours(dateRange),
                reportsAPI.getIngredientUsage(dateRange),
                reportsAPI.getWastageReport(dateRange)
            ]);

            setStats({
                sales: salesData.data,
                items: itemsData.data.items,
                peakHours: peakHoursData.data.peak_hours,
                ingredients: ingredientsData.data.ingredients,
                wastage: wastageData.data
            });
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

    const actions = (
        <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
            <select
                className="input"
                value={dateRange}
                onChange={(e) => setDateRange(Number(e.target.value))}
                style={{ width: 'auto' }}
            >
                <option value={7}>Last 7 Days</option>
                <option value={30}>Last 30 Days</option>
                <option value={90}>Last 3 Months</option>
            </select>
            <button className="btn btn-secondary" onClick={fetchReports}>
                <span>🔄</span> Refresh
            </button>
        </div>
    );

    if (loading) {
        return (
            <AppLayout title="Reports & Analytics" subtitle="Loading insights...">
                <div style={{ display: 'flex', justifyContent: 'center', padding: 'var(--spacing-2xl)' }}>
                    Loading...
                </div>
            </AppLayout>
        );
    }

    return (
        <AppLayout
            title="Reports & Analytics"
            subtitle={`Insights for the last ${dateRange} days`}
            actions={actions}
        >
            {/* Summary Cards */}
            <div className="stats-grid">
                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon green">
                            <span>₹</span>
                        </div>
                        <div className="stat-card-trend up">
                            <span>+12.5%</span>
                            <span>↗</span>
                        </div>
                    </div>
                    <div className="stat-card-value">₹{stats.sales?.total_sales?.toLocaleString() || 0}</div>
                    <div className="stat-card-label">Total Revenue</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon blue">
                            <span>📦</span>
                        </div>
                        <div className="stat-card-trend up">
                            <span>+5.2%</span>
                            <span>↗</span>
                        </div>
                    </div>
                    <div className="stat-card-value">{stats.sales?.total_orders || 0}</div>
                    <div className="stat-card-label">Total Orders</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon orange">
                            <span>💎</span>
                        </div>
                        <div className="stat-card-trend down">
                            <span>-2.1%</span>
                            <span>↘</span>
                        </div>
                    </div>
                    <div className="stat-card-value">₹{Math.round(stats.sales?.average_order_value || 0)}</div>
                    <div className="stat-card-label">Average Order Value</div>
                </div>

                <div className="stat-card">
                    <div className="stat-card-header">
                        <div className="stat-card-icon" style={{ background: '#FEE2E2', color: '#EF4444' }}>
                            <span>🗑️</span>
                        </div>
                        <div className="stat-card-trend down" style={{ color: '#EF4444', background: 'rgba(239, 68, 68, 0.1)' }}>
                            <span>High Alert</span>
                        </div>
                    </div>
                    <div className="stat-card-value">₹{stats.wastage?.total_wastage_cost?.toLocaleString() || 0}</div>
                    <div className="stat-card-label">Total Wastage Cost</div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: 'var(--spacing-xl)' }}>

                {/* Top Selling Items */}
                <div className="card" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: '700' }}>Top Selling Items</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.items.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="item_name"
                                    type="category"
                                    width={120}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-white)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: 'none',
                                        boxShadow: 'var(--shadow-xl)',
                                        padding: '12px'
                                    }}
                                />
                                <Bar dataKey="quantity_sold" fill="url(#colorGradient)" radius={[0, 8, 8, 0]} barSize={32}>
                                    {stats.items.slice(0, 5).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={[`#F63049`, `#3B82F6`, `#10B981`, `#F59E0B`, `#8B5CF6`][index % 5]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Peak Hours */}
                <div className="card" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: '700' }}>Peak Hours</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.peakHours}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="#F63049" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#F63049" stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                <XAxis
                                    dataKey="hour"
                                    tickFormatter={(hour) => `${hour}:00`}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                    dy={10}
                                />
                                <YAxis hide />
                                <Tooltip
                                    cursor={{ fill: 'var(--bg-main)' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-white)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: 'none',
                                        boxShadow: 'var(--shadow-xl)',
                                        padding: '12px'
                                    }}
                                />
                                <Bar dataKey="order_count" fill="url(#barGradient)" radius={[8, 8, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ingredient Usage */}
                <div className="card" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: '700' }}>Ingredient Usage (Top 5)</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.ingredients.slice(0, 5)} layout="vertical" margin={{ left: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-light)" />
                                <XAxis type="number" hide />
                                <YAxis
                                    dataKey="ingredient_name"
                                    type="category"
                                    width={120}
                                    tick={{ fill: 'var(--text-secondary)', fontSize: 12 }}
                                    axisLine={false}
                                    tickLine={false}
                                />
                                <Tooltip
                                    cursor={{ fill: 'transparent' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-white)',
                                        borderRadius: 'var(--radius-lg)',
                                        border: 'none',
                                        boxShadow: 'var(--shadow-xl)',
                                        padding: '12px'
                                    }}
                                />
                                <Bar dataKey="total_used" fill="#8B5CF6" radius={[0, 8, 8, 0]} barSize={24} name="Units Used" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Wastage Breakdown */}
                <div className="card" style={{ padding: 'var(--spacing-xl)', borderRadius: 'var(--radius-xl)', boxShadow: 'var(--shadow-lg)' }}>
                    <h3 style={{ marginBottom: 'var(--spacing-lg)', fontSize: 'var(--font-size-xl)', fontWeight: '700' }}>Wastage Cost Analysis</h3>
                    <div style={{ height: '350px' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            {stats.wastage && stats.wastage.wastage_details.length > 0 ? (
                                <PieChart>
                                    <Pie
                                        data={stats.wastage.wastage_details}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        fill="#8884d8"
                                        paddingAngle={5}
                                        dataKey="cost"
                                        nameKey="ingredient_name"
                                    >
                                        {stats.wastage.wastage_details.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--bg-white)',
                                            borderRadius: 'var(--radius-lg)',
                                            border: 'none',
                                            boxShadow: 'var(--shadow-xl)',
                                            padding: '12px'
                                        }}
                                    />
                                    <Legend />
                                </PieChart>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)' }}>
                                    No wastage recorded
                                </div>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </AppLayout>
    );

}

export default ReportsDashboard;
