import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { reportsAPI } from '../services/api';
import {
    LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, CartesianGrid,
    Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell, ComposedChart
} from 'recharts';
import {
    TrendingUp, TrendingDown, IndianRupee, ShoppingCart, Percent, Package,
    Clock, Utensils, AlertTriangle, Globe, Store, Smartphone,
    RefreshCw, Calendar, BarChart3, PieChart as PieChartIcon,
    Activity, Layers, CreditCard, Wallet, Banknote,
    Flame, Award, Target, Zap, Eye
} from 'lucide-react';
import { format, parseISO } from 'date-fns';

/* ──────────────────────────────────────────────
   STYLES
   ────────────────────────────────────────────── */
const S = {
    page: { display: 'flex', flexDirection: 'column', gap: '1.5rem' },
    topBar: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' },
    tabNav: {
        display: 'flex', gap: '2px', background: 'var(--bg-body)',
        border: '1px solid var(--border-color)', borderRadius: 'var(--radius-xl)', padding: '4px',
    },
    tab: (active) => ({
        padding: '8px 18px', borderRadius: 'var(--radius-lg)', border: 'none', cursor: 'pointer',
        fontSize: '0.82rem', fontWeight: 600, fontFamily: 'var(--font-sans)',
        display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s ease',
        background: active ? 'var(--primary)' : 'transparent',
        color: active ? '#fff' : 'var(--text-secondary)',
        boxShadow: active ? '0 2px 8px rgba(99,102,241,0.3)' : 'none',
    }),
    controls: { display: 'flex', alignItems: 'center', gap: '10px' },
    select: {
        padding: '8px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 500,
        fontFamily: 'var(--font-sans)', cursor: 'pointer', outline: 'none',
    },
    refreshBtn: {
        display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px',
        borderRadius: 'var(--radius-lg)', border: '1px solid var(--border-color)',
        background: 'var(--bg-surface)', color: 'var(--text-main)', fontSize: '0.82rem', fontWeight: 600,
        fontFamily: 'var(--font-sans)', cursor: 'pointer', transition: 'all 0.2s ease',
    },
    kpiGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' },
    kpiCard: {
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', padding: '1.25rem 1.5rem',
        border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '0.75rem',
        transition: 'all 0.25s ease', position: 'relative', overflow: 'hidden',
    },
    kpiHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' },
    kpiLabel: { fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' },
    kpiValue: { fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-main)', lineHeight: 1.1, fontFamily: 'var(--font-heading)' },
    kpiIcon: (bg, color) => ({
        width: 40, height: 40, borderRadius: 'var(--radius-lg)', display: 'flex',
        alignItems: 'center', justifyContent: 'center', background: bg, color, flexShrink: 0,
    }),
    kpiBadge: (isUp) => ({
        display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', fontWeight: 700,
        padding: '3px 8px', borderRadius: '20px',
        background: isUp === null ? 'var(--border-color)' : isUp ? 'var(--success-bg)' : 'var(--error-bg)',
        color: isUp === null ? 'var(--text-secondary)' : isUp ? 'var(--success)' : 'var(--error)',
    }),
    chartGrid2: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '1.25rem' },
    chartCard: {
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
    },
    chartFull: {
        background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)', border: '1px solid var(--border-color)',
        padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem',
    },
    chartTitle: {
        display: 'flex', alignItems: 'center', gap: '8px', fontSize: '1rem', fontWeight: 700,
        color: 'var(--text-main)', fontFamily: 'var(--font-heading)',
    },
    chartSubtitle: { fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '-4px' },
    tableWrap: { overflowX: 'auto', borderRadius: 'var(--radius-lg)' },
    table: { width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' },
    th: {
        textAlign: 'left', padding: '10px 14px', fontWeight: 700, color: 'var(--text-secondary)',
        textTransform: 'uppercase', fontSize: '0.7rem', letterSpacing: '0.5px',
        borderBottom: '2px solid var(--border-color)', background: 'var(--bg-body)',
    },
    td: { padding: '10px 14px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-main)' },
    rankBadge: (rank) => ({
        display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 26, height: 26,
        borderRadius: '50%', fontWeight: 800, fontSize: '0.72rem',
        background: rank === 1 ? 'linear-gradient(135deg,#FFD700,#FFA500)' :
            rank === 2 ? 'linear-gradient(135deg,#C0C0C0,#A0A0A0)' :
                rank === 3 ? 'linear-gradient(135deg,#CD7F32,#b5651d)' : 'var(--bg-body)',
        color: rank <= 3 ? '#fff' : 'var(--text-secondary)',
    }),
    empty: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem', gap: '0.75rem', color: 'var(--text-secondary)' },
    spotlightBar: { display: 'flex', alignItems: 'stretch', gap: '1.25rem', marginBottom: '0.25rem', flexWrap: 'wrap' },
    spotlightMain: {
        flex: 2, minWidth: 320, background: 'var(--primary-gradient)', borderRadius: 'var(--radius-xl)',
        padding: '1.75rem 2rem', color: '#fff', display: 'flex', flexDirection: 'column',
        justifyContent: 'center', gap: '0.5rem', position: 'relative', overflow: 'hidden', minHeight: 140,
    },
    spotlightSide: { flex: 1, minWidth: 200, display: 'flex', flexDirection: 'column', gap: '1.25rem' },
    spotlightSideCard: {
        flex: 1, background: 'var(--bg-surface)', borderRadius: 'var(--radius-xl)',
        border: '1px solid var(--border-color)', padding: '1rem 1.25rem',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: '4px',
    },
};

const CHART_COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899', '#14B8A6', '#F97316'];
const CHANNEL_COLORS = { pos: '#6366F1', zomato: '#E23744', swiggy: '#FC8019' };
const TABS = [
    { key: 'overview', label: 'Overview', icon: <Activity size={15} /> },
    { key: 'sales', label: 'Sales', icon: <BarChart3 size={15} /> },
    { key: 'menu', label: 'Menu Analytics', icon: <Utensils size={15} /> },
    { key: 'inventory', label: 'Inventory', icon: <Package size={15} /> },
    { key: 'channels', label: 'Channels', icon: <Globe size={15} /> },
    { key: 'forecast', label: 'Forecast', icon: <TrendingUp size={15} /> },
];

/* Custom Tooltip */
const CustomTooltip = ({ active, payload, label, prefix = '', suffix = '' }) => {
    if (!active || !payload?.length) return null;
    return (
        <div style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-lg)', padding: '10px 14px', boxShadow: 'var(--shadow-lg)', fontSize: '0.8rem' }}>
            <div style={{ fontWeight: 700, color: 'var(--text-main)', marginBottom: 4 }}>{label}</div>
            {payload.map((p, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, color: p.color }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: p.color, display: 'inline-block' }} />
                    <span style={{ color: 'var(--text-secondary)' }}>{p.name}:</span>
                    <span style={{ fontWeight: 600, color: 'var(--text-main)' }}>{prefix}{typeof p.value === 'number' ? p.value.toLocaleString() : p.value}{suffix}</span>
                </div>
            ))}
        </div>
    );
};

/* KPI Card */
function KPICard({ label, value, icon, iconBg, iconColor, trend, subtitle, small }) {
    return (
        <div style={S.kpiCard}
            onMouseEnter={e => { e.currentTarget.style.boxShadow = 'var(--shadow-lg)'; e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
            onMouseLeave={e => { e.currentTarget.style.boxShadow = ''; e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.transform = ''; }}
        >
            <div style={S.kpiHeader}>
                <div>
                    <div style={S.kpiLabel}>{label}</div>
                    <div style={{ ...S.kpiValue, fontSize: small ? '1.15rem' : '1.75rem' }}>{value}</div>
                </div>
                <div style={S.kpiIcon(iconBg, iconColor)}>{icon}</div>
            </div>
            {subtitle && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '-2px' }}>{subtitle}</div>}
            {trend === 'alert' && <div style={S.kpiBadge(false)}><AlertTriangle size={11} /> Needs attention</div>}
        </div>
    );
}

/* Empty */
function EmptyState({ msg }) {
    return <div style={S.empty}><Eye size={28} style={{ opacity: 0.3 }} /><span style={{ fontWeight: 500 }}>{msg}</span></div>;
}

/* ────────── MAIN ────────── */
function ReportsDashboard() {
    const [activeTab, setActiveTab] = useState('overview');
    const [dateRange, setDateRange] = useState(7);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [data, setData] = useState({
        sales: null, items: [], peakHours: [], ingredients: [], wastage: null,
        onlineVsOffline: null, forecast: null, dailyRevenue: [], categorySales: [], paymentMethods: [],
    });

    const fetchReports = useCallback(async () => {
        setLoading(true);
        try {
            const [salesRes, itemsRes, peakRes, ingredientsRes, wastageRes, onlineRes, forecastRes, dailyRes, categoryRes, paymentRes] =
                await Promise.all([
                    reportsAPI.getSalesReport(dateRange),
                    reportsAPI.getItemWiseSales(dateRange),
                    reportsAPI.getPeakHours(dateRange),
                    reportsAPI.getIngredientUsage(dateRange),
                    reportsAPI.getWastageReport(dateRange),
                    reportsAPI.getOnlineVsOffline(dateRange),
                    reportsAPI.getSalesForecast(dateRange, 7),
                    reportsAPI.getDailyRevenueTrend(dateRange),
                    reportsAPI.getCategorySales(dateRange),
                    reportsAPI.getPaymentMethods(dateRange),
                ]);
            setData({
                sales: salesRes.data,
                items: itemsRes.data.items || [],
                peakHours: (peakRes.data.peak_hours || []).sort((a, b) => a.hour - b.hour),
                ingredients: ingredientsRes.data.ingredients || [],
                wastage: wastageRes.data,
                onlineVsOffline: onlineRes.data,
                forecast: forecastRes.data,
                dailyRevenue: dailyRes.data.trend || [],
                categorySales: categoryRes.data.categories || [],
                paymentMethods: paymentRes.data.methods || [],
            });
        } catch (err) {
            console.error('Reports fetch error:', err);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    }, [dateRange]);

    useEffect(() => { fetchReports(); }, [fetchReports]);

    const handleRefresh = () => { setRefreshing(true); fetchReports(); };

    const avgOrderValue = data.sales ? Math.round(data.sales.average_order_value || 0) : 0;
    const totalRevenue = data.sales?.total_sales || 0;
    const totalOrders = data.sales?.total_orders || 0;
    const wastageCost = data.wastage?.total_wastage_cost || 0;
    const peakHour = data.peakHours.length ? data.peakHours.reduce((a, b) => a.order_count > b.order_count ? a : b) : null;
    const forecastAccuracy = data.forecast?.r_squared ? Math.round(data.forecast.r_squared * 100) : 0;
    const totalPayments = data.paymentMethods.reduce((s, m) => s + m.total, 0);

    if (loading && !refreshing) {
        return (
            <AppLayout title="Reports & Analytics" subtitle="Loading business insights...">
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: '1rem' }}>
                    <RefreshCw size={32} style={{ color: 'var(--primary)', animation: 'spin 1s linear infinite' }} />
                    <div style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>Crunching your data...</div>
                    <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                </div>
            </AppLayout>
        );
    }

    /* ── OVERVIEW ── */
    const renderOverview = () => (
        <>
            <div style={S.spotlightBar}>
                <div style={S.spotlightMain}>
                    <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.08)' }} />
                    <div style={{ position: 'absolute', bottom: -20, right: 60, width: 80, height: 80, borderRadius: '50%', background: 'rgba(255,255,255,0.05)' }} />
                    <div style={{ fontSize: '0.8rem', fontWeight: 600, opacity: 0.85, textTransform: 'uppercase', letterSpacing: '1px' }}>Total Revenue</div>
                    <div style={{ fontSize: '2.5rem', fontWeight: 800, fontFamily: 'var(--font-heading)', lineHeight: 1 }}>₹{totalRevenue.toLocaleString()}</div>
                    <div style={{ display: 'flex', gap: '1.5rem', marginTop: '0.25rem', fontSize: '0.82rem', opacity: 0.9 }}>
                        <span>{totalOrders} orders</span><span>•</span><span>Avg ₹{avgOrderValue}</span><span>•</span><span>Last {dateRange} days</span>
                    </div>
                </div>
                <div style={S.spotlightSide}>
                    <div style={S.spotlightSideCard}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Avg Daily Revenue</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-heading)' }}>₹{Math.round(totalRevenue / (dateRange || 1)).toLocaleString()}</div>
                    </div>
                    <div style={S.spotlightSideCard}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{peakHour ? `Peak at ${peakHour.hour}:00` : 'Peak Hour'}</div>
                        <div style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--warning)', fontFamily: 'var(--font-heading)' }}>{peakHour ? `${peakHour.order_count} orders` : 'N/A'}</div>
                    </div>
                </div>
            </div>

            <div style={S.kpiGrid}>
                <KPICard label="Total Orders" value={totalOrders} icon={<ShoppingCart size={18} />} iconBg="var(--primary-light)" iconColor="var(--primary)" />
                <KPICard label="Avg Order Value" value={`₹${avgOrderValue}`} icon={<Target size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
                <KPICard label="Wastage Cost" value={`₹${wastageCost.toLocaleString()}`} icon={<AlertTriangle size={18} />} iconBg="var(--error-bg)" iconColor="var(--error)" trend={wastageCost > 0 ? 'alert' : null} />
                <KPICard label="Menu Items Sold" value={data.items.reduce((s, i) => s + (i.quantity_sold || 0), 0)} icon={<Utensils size={18} />} iconBg="var(--warning-bg)" iconColor="var(--warning)" />
            </div>

            <div style={S.chartGrid2}>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Activity size={18} style={{ color: 'var(--primary)' }} /> Revenue Trend</div><div style={S.chartSubtitle}>Daily revenue over the selected period</div></div>
                    <div style={{ height: 300 }}>
                        {data.dailyRevenue.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={data.dailyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                    <defs><linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366F1" stopOpacity={0.25} /><stop offset="100%" stopColor="#6366F1" stopOpacity={0} /></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.5} />
                                    <XAxis dataKey="date" tickFormatter={d => { try { return format(parseISO(d), 'MMM d'); } catch { return d; } }} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                                    <Area type="monotone" dataKey="revenue" name="Revenue" stroke="#6366F1" fill="url(#revGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 5, fill: '#6366F1', strokeWidth: 2, stroke: '#fff' }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No revenue data" />}
                    </div>
                </div>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Award size={18} style={{ color: '#F59E0B' }} /> Top Selling Items</div><div style={S.chartSubtitle}>Best performers by quantity sold</div></div>
                    <div style={{ height: 300 }}>
                        {data.items.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.items.slice(0, 6)} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" opacity={0.3} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="item_name" type="category" width={110} tick={{ fill: 'var(--text-secondary)', fontSize: 11.5, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="quantity_sold" name="Qty Sold" radius={[0, 8, 8, 0]} barSize={22}>
                                        {data.items.slice(0, 6).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No item data" />}
                    </div>
                </div>
            </div>

            <div style={S.chartGrid2}>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Clock size={18} style={{ color: '#8B5CF6' }} /> Peak Hours</div><div style={S.chartSubtitle}>Busiest hours by order volume</div></div>
                    <div style={{ height: 280 }}>
                        {data.peakHours.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.peakHours} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                                    <defs><linearGradient id="peakGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#8B5CF6" stopOpacity={0.9} /><stop offset="100%" stopColor="#8B5CF6" stopOpacity={0.2} /></linearGradient></defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                    <XAxis dataKey="hour" tickFormatter={h => `${h}:00`} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis hide />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="order_count" name="Orders" fill="url(#peakGrad)" radius={[6, 6, 0, 0]} barSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No peak hour data" />}
                    </div>
                </div>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Layers size={18} style={{ color: '#10B981' }} /> Category Breakdown</div><div style={S.chartSubtitle}>Revenue share by menu category</div></div>
                    <div style={{ height: 280 }}>
                        {data.categorySales.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.categorySales} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="revenue" nameKey="category"
                                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {data.categorySales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No category data" />}
                    </div>
                </div>
            </div>
        </>
    );

    /* ── SALES ── */
    const renderSales = () => (
        <>
            <div style={S.kpiGrid}>
                <KPICard label="Total Revenue" value={`₹${totalRevenue.toLocaleString()}`} icon={<IndianRupee size={18} />} iconBg="var(--primary-light)" iconColor="var(--primary)" />
                <KPICard label="Total Orders" value={totalOrders} icon={<ShoppingCart size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
                <KPICard label="Avg Order Value" value={`₹${avgOrderValue}`} icon={<Target size={18} />} iconBg="var(--warning-bg)" iconColor="var(--warning)" />
                <KPICard label="Revenue / Day" value={`₹${Math.round(totalRevenue / (dateRange || 1)).toLocaleString()}`} icon={<TrendingUp size={18} />} iconBg="#EDE9FE" iconColor="#8B5CF6" />
            </div>
            <div style={S.chartFull}>
                <div><div style={S.chartTitle}><Activity size={18} style={{ color: 'var(--primary)' }} /> Revenue & Orders Trend</div><div style={S.chartSubtitle}>Dual-axis: revenue (area) and orders (bar) per day</div></div>
                <div style={{ height: 340 }}>
                    {data.dailyRevenue.length > 0 ? (
                        <ResponsiveContainer width="100%" height="100%">
                            <ComposedChart data={data.dailyRevenue} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <defs><linearGradient id="revAreaGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366F1" stopOpacity={0.2} /><stop offset="100%" stopColor="#6366F1" stopOpacity={0} /></linearGradient></defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.4} />
                                <XAxis dataKey="date" tickFormatter={d => { try { return format(parseISO(d), 'MMM d'); } catch { return d; } }} tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                <YAxis yAxisId="rev" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                <YAxis yAxisId="ord" orientation="right" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                <Tooltip content={<CustomTooltip />} />
                                <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                                <Area yAxisId="rev" type="monotone" dataKey="revenue" name="Revenue (₹)" stroke="#6366F1" fill="url(#revAreaGrad)" strokeWidth={2.5} dot={false} />
                                <Bar yAxisId="ord" dataKey="orders" name="Orders" fill="#10B981" radius={[4, 4, 0, 0]} barSize={20} opacity={0.7} />
                            </ComposedChart>
                        </ResponsiveContainer>
                    ) : <EmptyState msg="No daily data available" />}
                </div>
            </div>
            <div style={S.chartGrid2}>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><CreditCard size={18} style={{ color: '#EC4899' }} /> Payment Methods</div><div style={S.chartSubtitle}>Revenue distribution by payment type</div></div>
                    <div style={{ height: 280 }}>
                        {data.paymentMethods.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.paymentMethods} cx="50%" cy="50%" innerRadius={50} outerRadius={90} paddingAngle={4} dataKey="total" nameKey="method">
                                        {data.paymentMethods.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                                    <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No payment data" />}
                    </div>
                    {data.paymentMethods.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', paddingTop: '4px' }}>
                            {data.paymentMethods.map((m, i) => {
                                const pct = totalPayments > 0 ? ((m.total / totalPayments) * 100).toFixed(1) : 0;
                                const MethodIcon = m.method === 'upi' ? Smartphone : m.method === 'card' ? CreditCard : m.method === 'cash' ? Banknote : Wallet;
                                return (
                                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '20px', background: 'var(--bg-body)', fontSize: '0.75rem', fontWeight: 600 }}>
                                        <MethodIcon size={13} style={{ color: CHART_COLORS[i] }} /><span style={{ textTransform: 'capitalize' }}>{m.method}</span><span style={{ color: 'var(--text-secondary)' }}>{pct}%</span>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Flame size={18} style={{ color: '#F59E0B' }} /> Top Revenue Items</div><div style={S.chartSubtitle}>Ranked by revenue generated</div></div>
                    <div style={S.tableWrap}>
                        <table style={S.table}>
                            <thead><tr><th style={S.th}>#</th><th style={S.th}>Item</th><th style={{ ...S.th, textAlign: 'right' }}>Qty</th><th style={{ ...S.th, textAlign: 'right' }}>Revenue</th></tr></thead>
                            <tbody>
                                {data.items.slice(0, 8).map((item, i) => (
                                    <tr key={i} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-body)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={S.td}><span style={S.rankBadge(i + 1)}>{i + 1}</span></td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>{item.item_name}</td>
                                        <td style={{ ...S.td, textAlign: 'right' }}>{item.quantity_sold}</td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>₹{item.revenue?.toLocaleString()}</td>
                                    </tr>
                                ))}
                                {data.items.length === 0 && <tr><td colSpan={4} style={{ ...S.td, textAlign: 'center', color: 'var(--text-secondary)' }}>No data</td></tr>}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </>
    );

    /* ── MENU ANALYTICS ── */
    const renderMenu = () => (
        <>
            <div style={S.kpiGrid}>
                <KPICard label="Total Items Sold" value={data.items.reduce((s, i) => s + (i.quantity_sold || 0), 0)} icon={<Utensils size={18} />} iconBg="var(--primary-light)" iconColor="var(--primary)" />
                <KPICard label="Unique Items" value={data.items.length} icon={<Layers size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" />
                <KPICard label="Categories" value={data.categorySales.length} icon={<PieChartIcon size={18} />} iconBg="#FEF3C7" iconColor="#F59E0B" />
                <KPICard label="Top Item Revenue" value={data.items.length > 0 ? `₹${data.items[0].revenue?.toLocaleString()}` : '₹0'} icon={<Award size={18} />} iconBg="#EDE9FE" iconColor="#8B5CF6" />
            </div>
            <div style={S.chartGrid2}>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Layers size={18} style={{ color: '#10B981' }} /> Revenue by Category</div><div style={S.chartSubtitle}>Which category drives the most revenue</div></div>
                    <div style={{ height: 300 }}>
                        {data.categorySales.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.categorySales} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                    <XAxis dataKey="category" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                                    <Bar dataKey="revenue" name="Revenue" radius={[8, 8, 0, 0]} barSize={36}>
                                        {data.categorySales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No category data" />}
                    </div>
                </div>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><PieChartIcon size={18} style={{ color: '#EC4899' }} /> Category Mix</div><div style={S.chartSubtitle}>Proportion of quantity sold per category</div></div>
                    <div style={{ height: 300 }}>
                        {data.categorySales.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.categorySales} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={3} dataKey="quantity" nameKey="category"
                                        label={({ category, percent }) => `${category} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {data.categorySales.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No category data" />}
                    </div>
                </div>
            </div>
            <div style={S.chartFull}>
                <div><div style={S.chartTitle}><BarChart3 size={18} style={{ color: 'var(--primary)' }} /> Complete Item Performance</div><div style={S.chartSubtitle}>All items ranked by revenue</div></div>
                <div style={S.tableWrap}>
                    <table style={S.table}>
                        <thead><tr><th style={S.th}>Rank</th><th style={S.th}>Item Name</th><th style={{ ...S.th, textAlign: 'right' }}>Qty Sold</th><th style={{ ...S.th, textAlign: 'right' }}>Revenue</th><th style={{ ...S.th, textAlign: 'right' }}>% of Total</th></tr></thead>
                        <tbody>
                            {data.items.map((item, i) => {
                                const pct = totalRevenue > 0 ? ((item.revenue / totalRevenue) * 100).toFixed(1) : 0;
                                return (
                                    <tr key={i} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-body)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                        <td style={S.td}><span style={S.rankBadge(i + 1)}>{i + 1}</span></td>
                                        <td style={{ ...S.td, fontWeight: 600 }}>{item.item_name}</td>
                                        <td style={{ ...S.td, textAlign: 'right' }}>{item.quantity_sold}</td>
                                        <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: 'var(--primary)' }}>₹{item.revenue?.toLocaleString()}</td>
                                        <td style={{ ...S.td, textAlign: 'right' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, justifyContent: 'flex-end' }}>
                                                <div style={{ width: 50, height: 6, borderRadius: 3, background: 'var(--bg-body)', overflow: 'hidden' }}>
                                                    <div style={{ width: `${Math.min(pct, 100)}%`, height: '100%', background: CHART_COLORS[i % CHART_COLORS.length], borderRadius: 3 }} />
                                                </div>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{pct}%</span>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })}
                            {data.items.length === 0 && <tr><td colSpan={5} style={{ ...S.td, textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No item data for this period</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    /* ── INVENTORY ── */
    const renderInventory = () => (
        <>
            <div style={S.kpiGrid}>
                <KPICard label="Ingredients Tracked" value={data.ingredients.length} icon={<Package size={18} />} iconBg="var(--primary-light)" iconColor="var(--primary)" />
                <KPICard label="Wastage Cost" value={`₹${wastageCost.toLocaleString()}`} icon={<AlertTriangle size={18} />} iconBg="var(--error-bg)" iconColor="var(--error)" trend={wastageCost > 0 ? 'alert' : null} />
                <KPICard label="Wastage Items" value={data.wastage?.wastage_details?.length || 0} icon={<Layers size={18} />} iconBg="var(--warning-bg)" iconColor="var(--warning)" />
                <KPICard label="Top Ingredient" value={data.ingredients.length > 0 ? data.ingredients[0].ingredient_name : 'N/A'} icon={<Zap size={18} />} iconBg="#EDE9FE" iconColor="#8B5CF6" small />
            </div>
            <div style={S.chartGrid2}>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><Package size={18} style={{ color: '#8B5CF6' }} /> Ingredient Usage</div><div style={S.chartSubtitle}>Top ingredients consumed</div></div>
                    <div style={{ height: 320 }}>
                        {data.ingredients.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={data.ingredients.slice(0, 8)} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="var(--border-color)" opacity={0.3} />
                                    <XAxis type="number" hide />
                                    <YAxis dataKey="ingredient_name" type="category" width={110} tick={{ fill: 'var(--text-secondary)', fontSize: 11, fontWeight: 500 }} axisLine={false} tickLine={false} />
                                    <Tooltip content={<CustomTooltip />} />
                                    <Bar dataKey="total_used" name="Units Used" radius={[0, 8, 8, 0]} barSize={20}>
                                        {data.ingredients.slice(0, 8).map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="No ingredient usage data" />}
                    </div>
                </div>
                <div style={S.chartCard}>
                    <div><div style={S.chartTitle}><AlertTriangle size={18} style={{ color: 'var(--error)' }} /> Wastage Analysis</div><div style={S.chartSubtitle}>Cost breakdown of wasted ingredients</div></div>
                    <div style={{ height: 320 }}>
                        {data.wastage?.wastage_details?.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={data.wastage.wastage_details} cx="50%" cy="50%" innerRadius={55} outerRadius={95} paddingAngle={4} dataKey="cost" nameKey="ingredient_name">
                                        {data.wastage.wastage_details.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                                    <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        ) : <div style={S.empty}><span style={{ fontSize: '2rem' }}>✨</span><span>No wastage recorded — great job!</span></div>}
                    </div>
                </div>
            </div>
            <div style={S.chartFull}>
                <div><div style={S.chartTitle}><Package size={18} style={{ color: 'var(--primary)' }} /> Ingredient Consumption Details</div></div>
                <div style={S.tableWrap}>
                    <table style={S.table}>
                        <thead><tr><th style={S.th}>#</th><th style={S.th}>Ingredient</th><th style={{ ...S.th, textAlign: 'right' }}>Total Used</th><th style={{ ...S.th, textAlign: 'right' }}>Unit</th></tr></thead>
                        <tbody>
                            {data.ingredients.map((ing, i) => (
                                <tr key={i} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-body)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                    <td style={S.td}><span style={S.rankBadge(i + 1)}>{i + 1}</span></td>
                                    <td style={{ ...S.td, fontWeight: 600 }}>{ing.ingredient_name}</td>
                                    <td style={{ ...S.td, textAlign: 'right', fontWeight: 600 }}>{ing.total_used?.toLocaleString()}</td>
                                    <td style={{ ...S.td, textAlign: 'right', color: 'var(--text-secondary)' }}>{ing.unit}</td>
                                </tr>
                            ))}
                            {data.ingredients.length === 0 && <tr><td colSpan={4} style={{ ...S.td, textAlign: 'center', color: 'var(--text-secondary)', padding: '2rem' }}>No data</td></tr>}
                        </tbody>
                    </table>
                </div>
            </div>
        </>
    );

    /* ── CHANNELS ── */
    const renderChannels = () => {
        const oo = data.onlineVsOffline;
        if (!oo) return <EmptyState msg="No channel data available" />;
        return (
            <>
                <div style={S.kpiGrid}>
                    <KPICard label="POS / Walk-in" value={`₹${(oo.offline?.revenue || 0).toLocaleString()}`} icon={<Store size={18} />} iconBg="var(--primary-light)" iconColor="var(--primary)" subtitle={`${oo.offline?.count || 0} orders`} />
                    <KPICard label="Zomato" value={`₹${(oo.zomato?.revenue || 0).toLocaleString()}`} icon={<Globe size={18} />} iconBg="#FEE2E2" iconColor="#E23744" subtitle={`${oo.zomato?.count || 0} orders`} />
                    <KPICard label="Swiggy" value={`₹${(oo.swiggy?.revenue || 0).toLocaleString()}`} icon={<Smartphone size={18} />} iconBg="#FFF7ED" iconColor="#FC8019" subtitle={`${oo.swiggy?.count || 0} orders`} />
                    <KPICard label="Online Share" value={`${oo.online_percentage || 0}%`} icon={<Percent size={18} />} iconBg="var(--success-bg)" iconColor="var(--success)" subtitle={`${oo.online?.count || 0} of ${oo.total_orders || 0}`} />
                </div>
                <div style={S.chartGrid2}>
                    <div style={S.chartCard}>
                        <div><div style={S.chartTitle}><PieChartIcon size={18} style={{ color: 'var(--primary)' }} /> Order Source Distribution</div><div style={S.chartSubtitle}>Breakdown by platform</div></div>
                        <div style={{ height: 300 }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <PieChart>
                                    <Pie data={oo.platform_split?.data || []} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value" nameKey="label"
                                        label={({ label, percent }) => `${label} ${(percent * 100).toFixed(0)}%`}
                                    >
                                        {(oo.platform_split?.data || []).map((_, i) => <Cell key={i} fill={[CHANNEL_COLORS.pos, CHANNEL_COLORS.zomato, CHANNEL_COLORS.swiggy][i] || CHART_COLORS[i]} />)}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                    <Legend wrapperStyle={{ fontSize: '0.8rem' }} />
                                </PieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                    <div style={S.chartCard}>
                        <div><div style={S.chartTitle}><BarChart3 size={18} style={{ color: '#8B5CF6' }} /> Daily Channel Trend</div><div style={S.chartSubtitle}>Stacked view of daily orders by source</div></div>
                        <div style={{ height: 300 }}>
                            {(oo.daily_trend || []).length > 0 ? (
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={oo.daily_trend} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.3} />
                                        <XAxis dataKey="date" tickFormatter={d => { try { return d ? format(parseISO(d), 'MMM d') : ''; } catch { return d; } }} tick={{ fontSize: 10.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                        <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                                        <Bar dataKey="offline" name="POS / Walk-in" fill={CHANNEL_COLORS.pos} stackId="a" />
                                        <Bar dataKey="zomato" name="Zomato" fill={CHANNEL_COLORS.zomato} stackId="a" />
                                        <Bar dataKey="swiggy" name="Swiggy" fill={CHANNEL_COLORS.swiggy} stackId="a" radius={[4, 4, 0, 0]} />
                                    </BarChart>
                                </ResponsiveContainer>
                            ) : <EmptyState msg="No daily trend data" />}
                        </div>
                    </div>
                </div>
            </>
        );
    };

    /* ── FORECAST ── */
    const renderForecast = () => {
        const fc = data.forecast;
        if (!fc) return <EmptyState msg="No forecast data available" />;
        const combined = [
            ...(fc.historical || []).map(d => ({ ...d, date: d.date })),
            ...(fc.forecast || []).map(d => ({ ...d, date: d.date, revenue: undefined })),
        ];
        return (
            <>
                <div style={S.kpiGrid}>
                    <KPICard label="Avg Daily Revenue" value={`₹${Math.round(fc.avg_daily_revenue || 0).toLocaleString()}`} icon={<IndianRupee size={18} />} iconBg="var(--primary-light)" iconColor="var(--primary)" />
                    <KPICard label="Trend Direction" value={fc.trend === 'up' ? 'Upward' : 'Downward'} icon={fc.trend === 'up' ? <TrendingUp size={18} /> : <TrendingDown size={18} />} iconBg={fc.trend === 'up' ? 'var(--success-bg)' : 'var(--error-bg)'} iconColor={fc.trend === 'up' ? 'var(--success)' : 'var(--error)'} />
                    <KPICard label="Model Accuracy" value={`${forecastAccuracy}%`} icon={<Target size={18} />} iconBg="var(--warning-bg)" iconColor="var(--warning)" subtitle={`R² = ${fc.r_squared || 0}`} />
                    <KPICard label="Forecast Model" value={fc.model?.replace(/_/g, ' ') || 'N/A'} icon={<Zap size={18} />} iconBg="#EDE9FE" iconColor="#8B5CF6" small />
                </div>
                <div style={S.chartFull}>
                    <div>
                        <div style={S.chartTitle}>
                            <TrendingUp size={18} style={{ color: 'var(--primary)' }} /> Revenue Forecast
                            <span style={{ padding: '3px 10px', borderRadius: '12px', background: fc.trend === 'up' ? 'var(--success-bg)' : 'var(--error-bg)', color: fc.trend === 'up' ? 'var(--success)' : 'var(--error)', fontSize: '0.7rem', fontWeight: 700, marginLeft: '8px' }}>
                                {fc.trend === 'up' ? '↑ Uptrend' : '↓ Downtrend'}
                            </span>
                        </div>
                        <div style={S.chartSubtitle}>Historical data with {fc.forecast?.length || 0}-day ML-powered projection (shaded = confidence interval)</div>
                    </div>
                    <div style={{ height: 380 }}>
                        {combined.length > 0 ? (
                            <ResponsiveContainer width="100%" height="100%">
                                <ComposedChart data={combined} margin={{ top: 10, right: 20, left: -5, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="histGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#6366F1" stopOpacity={0.2} /><stop offset="100%" stopColor="#6366F1" stopOpacity={0} /></linearGradient>
                                        <linearGradient id="fcGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#10B981" stopOpacity={0.15} /><stop offset="100%" stopColor="#10B981" stopOpacity={0} /></linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border-color)" opacity={0.4} />
                                    <XAxis dataKey="date" tickFormatter={d => { try { return format(parseISO(d), 'MMM d'); } catch { return d; } }} tick={{ fontSize: 10.5, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} axisLine={false} tickLine={false} tickFormatter={v => `₹${(v / 1000).toFixed(0)}k`} />
                                    <Tooltip content={<CustomTooltip prefix="₹" />} />
                                    <Legend wrapperStyle={{ fontSize: '0.78rem' }} />
                                    <Area type="monotone" dataKey="upper" name="Upper Bound" stroke="none" fill="url(#fcGrad)" fillOpacity={1} />
                                    <Area type="monotone" dataKey="lower" name="Lower Bound" stroke="none" fill="var(--bg-surface)" fillOpacity={1} />
                                    <Area type="monotone" dataKey="revenue" name="Historical" stroke="#6366F1" fill="url(#histGrad)" strokeWidth={2.5} dot={false} activeDot={{ r: 4, fill: '#6366F1' }} />
                                    <Line type="monotone" dataKey="forecast" name="Forecast" stroke="#10B981" strokeWidth={2.5} strokeDasharray="6 4" dot={{ r: 4, fill: '#10B981', strokeWidth: 2, stroke: '#fff' }} />
                                </ComposedChart>
                            </ResponsiveContainer>
                        ) : <EmptyState msg="Insufficient data for forecast" />}
                    </div>
                </div>
                {fc.forecast?.length > 0 && (
                    <div style={S.chartFull}>
                        <div><div style={S.chartTitle}><Calendar size={18} style={{ color: '#10B981' }} /> Projected Daily Revenue</div></div>
                        <div style={S.tableWrap}>
                            <table style={S.table}>
                                <thead><tr><th style={S.th}>Date</th><th style={{ ...S.th, textAlign: 'right' }}>Forecast</th><th style={{ ...S.th, textAlign: 'right' }}>Lower</th><th style={{ ...S.th, textAlign: 'right' }}>Upper</th><th style={{ ...S.th, textAlign: 'right' }}>Confidence</th></tr></thead>
                                <tbody>
                                    {fc.forecast.map((f, i) => {
                                        const range = f.upper - f.lower;
                                        const conf = f.forecast > 0 ? Math.max(0, Math.min(100, 100 - (range / f.forecast) * 50)).toFixed(0) : 0;
                                        return (
                                            <tr key={i} style={{ transition: 'background 0.15s' }} onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-body)'} onMouseLeave={e => e.currentTarget.style.background = ''}>
                                                <td style={{ ...S.td, fontWeight: 600 }}>{(() => { try { return format(parseISO(f.date), 'EEE, MMM d'); } catch { return f.date; }})()}</td>
                                                <td style={{ ...S.td, textAlign: 'right', fontWeight: 700, color: '#10B981' }}>₹{f.forecast?.toLocaleString()}</td>
                                                <td style={{ ...S.td, textAlign: 'right', color: 'var(--text-secondary)' }}>₹{f.lower?.toLocaleString()}</td>
                                                <td style={{ ...S.td, textAlign: 'right', color: 'var(--text-secondary)' }}>₹{f.upper?.toLocaleString()}</td>
                                                <td style={{ ...S.td, textAlign: 'right' }}>
                                                    <span style={{ padding: '3px 8px', borderRadius: '12px', fontSize: '0.72rem', fontWeight: 700,
                                                        background: conf >= 70 ? 'var(--success-bg)' : conf >= 40 ? 'var(--warning-bg)' : 'var(--error-bg)',
                                                        color: conf >= 70 ? 'var(--success)' : conf >= 40 ? 'var(--warning)' : 'var(--error)',
                                                    }}>{conf}%</span>
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
        );
    };

    const tabContent = { overview: renderOverview, sales: renderSales, menu: renderMenu, inventory: renderInventory, channels: renderChannels, forecast: renderForecast };

    return (
        <AppLayout title="Reports & Analytics" subtitle={`Business insights for the last ${dateRange} days`}>
            <div style={S.page}>
                <div style={S.topBar}>
                    <div style={S.tabNav}>
                        {TABS.map(t => (
                            <button key={t.key} style={S.tab(activeTab === t.key)} onClick={() => setActiveTab(t.key)}>
                                {t.icon}{t.label}
                            </button>
                        ))}
                    </div>
                    <div style={S.controls}>
                        <select style={S.select} value={dateRange} onChange={e => setDateRange(Number(e.target.value))}>
                            <option value={7}>Last 7 Days</option>
                            <option value={14}>Last 14 Days</option>
                            <option value={30}>Last 30 Days</option>
                            <option value={60}>Last 60 Days</option>
                            <option value={90}>Last 90 Days</option>
                        </select>
                        <button style={S.refreshBtn} onClick={handleRefresh}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--primary)'; e.currentTarget.style.color = 'var(--primary)'; }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-main)'; }}
                        >
                            <RefreshCw size={14} style={refreshing ? { animation: 'spin 1s linear infinite' } : {}} /> Refresh
                        </button>
                        <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
                    </div>
                </div>
                {tabContent[activeTab]?.()}
            </div>
        </AppLayout>
    );
}

export default ReportsDashboard;
