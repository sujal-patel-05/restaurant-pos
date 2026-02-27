
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
        wastage: null,
        onlineVsOffline: null,
    });

    useEffect(() => {
        fetchReports();
    }, [dateRange]);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const [salesData, itemsData, peakHoursData, ingredientsData, wastageData, onlineOfflineData] = await Promise.all([
                reportsAPI.getSalesReport(dateRange),
                reportsAPI.getItemWiseSales(dateRange),
                reportsAPI.getPeakHours(dateRange),
                reportsAPI.getIngredientUsage(dateRange),
                reportsAPI.getWastageReport(dateRange),
                reportsAPI.getOnlineVsOffline(dateRange),
            ]);

            setStats({
                sales: salesData.data,
                items: itemsData.data.items,
                peakHours: peakHoursData.data.peak_hours,
                ingredients: ingredientsData.data.ingredients,
                wastage: wastageData.data,
                onlineVsOffline: onlineOfflineData.data,
            });
        } catch (error) {
            console.error("Error fetching reports:", error);
        } finally {
            setLoading(false);
        }
    };

    const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];
    const ONLINE_COLORS = ['#6366f1', '#E23744', '#FC8019'];  // POS, Zomato, Swiggy

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
            <div className="stats-grid mb-xl">
                <div className="stat-card fade-in-up" style={{ animationDelay: '0ms' }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="stat-card-label">Total Revenue</div>
                            <div className="stat-card-value">₹{stats.sales?.total_sales?.toLocaleString() || 0}</div>
                        </div>
                        <div className="stat-card-icon green" style={{ marginBottom: 0 }}>₹</div>
                    </div>
                    <div className="stat-card-trend up">
                        <span>↑</span>
                        <span>12.5%</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>vs last period</span>
                    </div>
                </div>

                <div className="stat-card fade-in-up" style={{ animationDelay: '100ms' }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="stat-card-label">Total Orders</div>
                            <div className="stat-card-value">{stats.sales?.total_orders || 0}</div>
                        </div>
                        <div className="stat-card-icon blue" style={{ marginBottom: 0 }}>📦</div>
                    </div>
                    <div className="stat-card-trend up">
                        <span>↑</span>
                        <span>5.2%</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>vs last period</span>
                    </div>
                </div>

                <div className="stat-card fade-in-up" style={{ animationDelay: '200ms' }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="stat-card-label">Avg Order Value</div>
                            <div className="stat-card-value">₹{Math.round(stats.sales?.average_order_value || 0)}</div>
                        </div>
                        <div className="stat-card-icon orange" style={{ marginBottom: 0 }}>💎</div>
                    </div>
                    <div className="stat-card-trend down">
                        <span>↓</span>
                        <span>2.1%</span>
                        <span style={{ fontSize: '0.8rem', fontWeight: 400, opacity: 0.8 }}>vs last period</span>
                    </div>
                </div>

                <div className="stat-card fade-in-up" style={{ animationDelay: '300ms' }}>
                    <div className="flex justify-between items-start">
                        <div>
                            <div className="stat-card-label">Total Wastage</div>
                            <div className="stat-card-value" style={{ color: 'var(--error)' }}>
                                ₹{stats.wastage?.total_wastage_cost?.toLocaleString() || 0}
                            </div>
                        </div>
                        <div className="stat-card-icon" style={{ background: 'var(--error-bg)', color: 'var(--error)', marginBottom: 0 }}>🗑️</div>
                    </div>
                    <div className="stat-card-trend down" style={{ background: 'var(--error-bg)', color: 'var(--error)' }}>
                        <span>Alert</span>
                    </div>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(500px, 1fr))', gap: '2rem' }}>

                {/* Top Selling Items */}
                <div className="stat-card fade-in-up" style={{ animationDelay: '400ms', padding: '1.5rem', height: '100%' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>Top Selling Items</h3>
                    <div style={{ height: '350px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.items.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" opacity={0.3} />
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
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow-lg)'
                                    }}
                                />
                                <Bar dataKey="quantity_sold" radius={[0, 6, 6, 0]} barSize={24}>
                                    {stats.items.slice(0, 5).map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Peak Hours */}
                <div className="stat-card fade-in-up" style={{ animationDelay: '500ms', padding: '1.5rem', height: '100%' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>Peak Hours</h3>
                    <div style={{ height: '350px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="0%" stopColor="var(--primary)" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="var(--primary)" stopOpacity={0.2} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
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
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow-lg)'
                                    }}
                                />
                                <Bar dataKey="order_count" fill="url(#barGradient)" radius={[6, 6, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Ingredient Usage */}
                <div className="stat-card fade-in-up" style={{ animationDelay: '600ms', padding: '1.5rem', height: '100%' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>Ingredient Usage (Top 5)</h3>
                    <div style={{ height: '350px', width: '100%' }}>
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={stats.ingredients.slice(0, 5)} layout="vertical" margin={{ left: 0, right: 20 }}>
                                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" opacity={0.3} />
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
                                    cursor={{ fill: 'rgba(99, 102, 241, 0.05)' }}
                                    contentStyle={{
                                        backgroundColor: 'var(--bg-surface)',
                                        border: '1px solid var(--border-color)',
                                        borderRadius: 'var(--radius-lg)',
                                        boxShadow: 'var(--shadow-lg)'
                                    }}
                                />
                                <Bar dataKey="total_used" fill="#8B5CF6" radius={[0, 6, 6, 0]} barSize={24} name="Units Used" />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Wastage Breakdown */}
                <div className="stat-card fade-in-up" style={{ animationDelay: '700ms', padding: '1.5rem', height: '100%' }}>
                    <h3 style={{ marginBottom: '1.5rem', fontSize: '1.125rem', fontWeight: 700 }}>Wastage Cost Analysis</h3>
                    <div style={{ height: '350px', width: '100%' }}>
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
                                            backgroundColor: 'var(--bg-surface)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-lg)',
                                            boxShadow: 'var(--shadow-lg)'
                                        }}
                                    />
                                    <Legend wrapperStyle={{ paddingTop: '10px' }} />
                                </PieChart>
                            ) : (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', flexDirection: 'column', gap: '1rem' }}>
                                    <div style={{ fontSize: '2rem', opacity: 0.5 }}>✨</div>
                                    <div>No wastage recorded in this period</div>
                                </div>
                            )}
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* ── Online vs Offline Section ── */}
            {stats.onlineVsOffline && (
                <>
                    <h2 style={{ fontSize: '1.3rem', fontWeight: 700, marginTop: '2rem', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        🌐 Online vs Offline Orders
                    </h2>

                    {/* Stat Cards Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1.5rem' }}>
                        {/* Online % Card */}
                        <div className="stat-card" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Online Share</div>
                            <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#6366f1' }}>{stats.onlineVsOffline.online_percentage}%</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                {stats.onlineVsOffline.online?.count || 0} of {stats.onlineVsOffline.total_orders} orders
                            </div>
                        </div>
                        {/* Zomato Card */}
                        <div className="stat-card" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', border: '1px solid rgba(226, 55, 68, 0.2)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>🔴 Zomato</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#E23744' }}>₹{(stats.onlineVsOffline.zomato?.revenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stats.onlineVsOffline.zomato?.count || 0} orders</div>
                        </div>
                        {/* Swiggy Card */}
                        <div className="stat-card" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', border: '1px solid rgba(252, 128, 25, 0.2)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>🟠 Swiggy</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#FC8019' }}>₹{(stats.onlineVsOffline.swiggy?.revenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stats.onlineVsOffline.swiggy?.count || 0} orders</div>
                        </div>
                        {/* Offline Card */}
                        <div className="stat-card" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: '1.2rem', border: '1px solid var(--border-color)' }}>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>🏪 POS / Walk-in</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#6366f1' }}>₹{(stats.onlineVsOffline.offline?.revenue || 0).toLocaleString()}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{stats.onlineVsOffline.offline?.count || 0} orders</div>
                        </div>
                    </div>

                    {/* Charts Row */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
                        {/* Platform Distribution Pie Chart */}
                        <div className="card" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Order Source Distribution</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <PieChart>
                                    <Pie
                                        data={stats.onlineVsOffline.platform_split?.data || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={100}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="label"
                                        label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {(stats.onlineVsOffline.platform_split?.data || []).map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={ONLINE_COLORS[index % ONLINE_COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--card-bg)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-lg)',
                                            boxShadow: 'var(--shadow-lg)'
                                        }}
                                    />
                                    <Legend />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>

                        {/* Daily Online vs Offline Trend */}
                        <div className="card" style={{ background: 'var(--card-bg)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', border: '1px solid var(--border-color)' }}>
                            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-primary)' }}>Daily Online vs Offline Trend</h3>
                            <ResponsiveContainer width="100%" height={280}>
                                <BarChart data={stats.onlineVsOffline.daily_trend || []}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                    <XAxis
                                        dataKey="date"
                                        tick={{ fontSize: 11, fill: 'var(--text-secondary)' }}
                                        tickFormatter={d => d ? d.slice(5) : ''}
                                    />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: 'var(--card-bg)',
                                            border: '1px solid var(--border-color)',
                                            borderRadius: 'var(--radius-lg)'
                                        }}
                                    />
                                    <Legend />
                                    <Bar dataKey="offline" name="POS / Walk-in" fill="#6366f1" stackId="a" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="zomato" name="Zomato" fill="#E23744" stackId="a" radius={[0, 0, 0, 0]} />
                                    <Bar dataKey="swiggy" name="Swiggy" fill="#FC8019" stackId="a" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </>
            )}
        </AppLayout>
    );
}


export default ReportsDashboard;
