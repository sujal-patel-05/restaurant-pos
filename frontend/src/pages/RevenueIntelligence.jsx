import React, { useState, useEffect, useMemo } from 'react';
import { AppLayout } from '../components/AppLayout';
import { revenueIntelligenceAPI } from '../services/api';
import {
    ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
    ResponsiveContainer, Cell, BarChart, Bar, Legend, PieChart, Pie,
} from 'recharts';
import {
    TrendingUp, TrendingDown, DollarSign, Target, Zap, AlertTriangle,
    Star, Package, ArrowUpRight, ArrowDownRight, Minus, Shield,
    Sparkles, ChevronDown, RefreshCw, Layers, Award, ShoppingBag,
    Percent, BarChart3, Activity, Eye, Gift, ArrowRight, Clock,
} from 'lucide-react';

/* ═══════════════════════════════════════════════════════════════
   Revenue Intelligence & Menu Optimization Engine
   ═══════════════════════════════════════════════════════════════ */

const TIER_COLORS = {
    Star: '#10b981',
    Workhorse: '#f59e0b',
    Puzzle: '#6366f1',
    Dog: '#ef4444',
};
const TIER_ICONS = {
    Star: <Star size={14} />,
    Workhorse: <Activity size={14} />,
    Puzzle: <Eye size={14} />,
    Dog: <AlertTriangle size={14} />,
};
const MARGIN_COLORS = { high: '#10b981', medium: '#f59e0b', low: '#ef4444' };

const formatINR = (v) => {
    if (v == null) return '₹0';
    return '₹' + Number(v).toLocaleString('en-IN', { maximumFractionDigits: 0 });
};

/* ─── Reusable Micro Components ──────────────────────────────── */
const KPICard = ({ icon, label, value, sub, color }) => (
    <div className="ri-kpi" style={{ '--accent': color }}>
        <div className="ri-kpi-icon" style={{ background: `${color}22`, color }}>{icon}</div>
        <div className="ri-kpi-body">
            <span className="ri-kpi-value">{value}</span>
            <span className="ri-kpi-label">{label}</span>
            {sub && <span className="ri-kpi-sub">{sub}</span>}
        </div>
    </div>
);

const SectionHeader = ({ icon, title, badge }) => (
    <div className="ri-section-header">
        <div className="ri-section-icon">{icon}</div>
        <h2 className="ri-section-title">{title}</h2>
        {badge && <span className="ri-section-badge">{badge}</span>}
    </div>
);

const TierBadge = ({ tier }) => (
    <span className="ri-tier-badge" style={{
        background: `${TIER_COLORS[tier] || '#666'}18`,
        color: TIER_COLORS[tier] || '#666',
        border: `1px solid ${TIER_COLORS[tier] || '#666'}30`,
    }}>
        {TIER_ICONS[tier]} {tier}
    </span>
);

const MarginBar = ({ pct, tier }) => (
    <div className="ri-margin-bar-track">
        <div className="ri-margin-bar-fill" style={{
            width: `${Math.min(pct, 100)}%`,
            background: `linear-gradient(90deg, ${MARGIN_COLORS[tier]}88, ${MARGIN_COLORS[tier]})`,
        }} />
        <span className="ri-margin-bar-label">{pct}%</span>
    </div>
);

const DirectionIcon = ({ dir }) => {
    if (dir === 'increase') return <ArrowUpRight size={16} color="#10b981" />;
    if (dir === 'decrease') return <ArrowDownRight size={16} color="#ef4444" />;
    return <Minus size={16} color="#888" />;
};

/* ─── Custom Scatter Tooltip ─────────────────────────────────── */
const MatrixTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0].payload;
    return (
        <div className="ri-tooltip">
            <strong>{d.name}</strong>
            <div>Popularity: {d.per_day}/day</div>
            <div>Margin: {d.margin_pct}%</div>
            <div>Tier: {d.tier}</div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════ */
const RevenueIntelligence = () => {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [days, setDays] = useState(30);
    const [activeTab, setActiveTab] = useState('overview');

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await revenueIntelligenceAPI.getFullReport(days);
            setData(res.data);
        } catch (err) {
            console.error('Revenue Intelligence fetch error:', err);
            setError('Failed to load revenue intelligence data. Make sure the backend is running.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchData(); }, [days]);

    const tabs = [
        { key: 'overview',   label: 'Overview',       icon: <BarChart3 size={16} /> },
        { key: 'matrix',     label: 'Menu Matrix',    icon: <Layers size={16} /> },
        { key: 'combos',     label: 'Smart Combos',   icon: <Gift size={16} /> },
        { key: 'pricing',    label: 'Price Engine',   icon: <DollarSign size={16} /> },
        { key: 'inventory',  label: 'Inventory Link', icon: <Package size={16} /> },
    ];

    return (
        <AppLayout title="Revenue Intelligence" subtitle="Menu Optimization Engine">
            <style>{STYLES}</style>

            {/* ── Header ─────────────────────────────────────────── */}
            <div className="ri-header">
                <div className="ri-header-left">
                    <div className="ri-header-icon"><TrendingUp size={24} /></div>
                    <div>
                        <h1 className="ri-header-title">Revenue Intelligence</h1>
                        <p className="ri-header-sub">Menu Optimization & Profitability Engine</p>
                    </div>
                </div>
                <div className="ri-header-right">
                    <select className="ri-period-select" value={days} onChange={e => setDays(Number(e.target.value))}>
                        <option value={7}>Last 7 days</option>
                        <option value={14}>Last 14 days</option>
                        <option value={30}>Last 30 days</option>
                        <option value={60}>Last 60 days</option>
                        <option value={90}>Last 90 days</option>
                    </select>
                    <button className="ri-refresh-btn" onClick={fetchData} disabled={loading}>
                        <RefreshCw size={16} className={loading ? 'spin' : ''} /> Refresh
                    </button>
                </div>
            </div>

            {/* ── Loading / Error ─────────────────────────────────── */}
            {loading && (
                <div className="ri-loading">
                    <RefreshCw size={32} className="spin" />
                    <p>Crunching the numbers…</p>
                </div>
            )}
            {error && <div className="ri-error">{error}</div>}

            {data && !loading && (
                <>
                    {/* ── KPI Row ───────────────────────────────────── */}
                    <div className="ri-kpi-row">
                        <KPICard
                            icon={<Layers size={20} />}
                            label="Menu Items Analyzed"
                            value={data.summary.total_items}
                            color="#6366f1"
                        />
                        <KPICard
                            icon={<Percent size={20} />}
                            label="Avg Margin"
                            value={`${data.summary.avg_margin_pct}%`}
                            sub={data.summary.avg_margin_pct >= 55 ? 'Healthy' : 'Needs attention'}
                            color={data.summary.avg_margin_pct >= 55 ? '#10b981' : '#f59e0b'}
                        />
                        <KPICard
                            icon={<DollarSign size={20} />}
                            label={`${days}-Day Profit`}
                            value={formatINR(data.summary.total_profit)}
                            sub={`Revenue: ${formatINR(data.summary.total_revenue)}`}
                            color="#10b981"
                        />
                        <KPICard
                            icon={<Award size={20} />}
                            label="Top Performer"
                            value={data.summary.top_performer}
                            color="#f59e0b"
                        />
                    </div>

                    {/* ── Tab Navigation ────────────────────────────── */}
                    <div className="ri-tabs">
                        {tabs.map(t => (
                            <button
                                key={t.key}
                                className={`ri-tab ${activeTab === t.key ? 'active' : ''}`}
                                onClick={() => setActiveTab(t.key)}
                            >
                                {t.icon} {t.label}
                            </button>
                        ))}
                    </div>

                    {/* ── Tab Content ───────────────────────────────── */}
                    <div className="ri-tab-content fade-in-up">
                        {activeTab === 'overview'  && <OverviewTab data={data} />}
                        {activeTab === 'matrix'    && <MatrixTab data={data} />}
                        {activeTab === 'combos'    && <CombosTab data={data} />}
                        {activeTab === 'pricing'   && <PricingTab data={data} />}
                        {activeTab === 'inventory' && <InventoryTab data={data} />}
                    </div>
                </>
            )}
        </AppLayout>
    );
};

/* ═══════════════════════════════════════════════════════════════
   TAB: OVERVIEW — Margin Table + Profitability
   ═══════════════════════════════════════════════════════════════ */
const OverviewTab = ({ data }) => (
    <div className="ri-grid-2">
        {/* Margin Analysis */}
        <div className="ri-card ri-card-full">
            <SectionHeader icon={<Percent size={18} />} title="Contribution Margin Analysis" badge={`${data.margins.length} items`} />
            <div className="ri-table-wrap">
                <table className="ri-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th>Category</th>
                            <th style={{ textAlign: 'right' }}>Selling Price</th>
                            <th style={{ textAlign: 'right' }}>Food Cost</th>
                            <th style={{ textAlign: 'right' }}>Margin</th>
                            <th style={{ minWidth: 140 }}>Margin %</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.margins.map(m => (
                            <tr key={m.id}>
                                <td><strong>{m.name}</strong></td>
                                <td><span className="ri-cat-badge">{m.category}</span></td>
                                <td style={{ textAlign: 'right' }}>{formatINR(m.selling_price)}</td>
                                <td style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>{formatINR(m.food_cost)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: MARGIN_COLORS[m.margin_tier] }}>
                                    {formatINR(m.margin)}
                                </td>
                                <td><MarginBar pct={m.margin_pct} tier={m.margin_tier} /></td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Profitability Ranking */}
        <div className="ri-card ri-card-full">
            <SectionHeader icon={<Award size={18} />} title="Profitability Ranking" badge={`${data.summary.period_days} days`} />
            <div className="ri-table-wrap">
                <table className="ri-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Item</th>
                            <th style={{ textAlign: 'right' }}>Units Sold</th>
                            <th style={{ textAlign: 'right' }}>Revenue</th>
                            <th style={{ textAlign: 'right' }}>Total Profit</th>
                            <th style={{ textAlign: 'right' }}>Profit/Unit</th>
                            <th style={{ textAlign: 'right' }}>Share</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.profitability.map(p => (
                            <tr key={p.id}>
                                <td>
                                    <span className="ri-rank" style={{ background: p.rank <= 3 ? '#f59e0b22' : 'transparent', color: p.rank <= 3 ? '#f59e0b' : 'var(--text-secondary)' }}>
                                        {p.rank}
                                    </span>
                                </td>
                                <td><strong>{p.name}</strong></td>
                                <td style={{ textAlign: 'right' }}>{p.qty_sold.toLocaleString()}</td>
                                <td style={{ textAlign: 'right' }}>{formatINR(p.revenue)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: p.profit > 0 ? '#10b981' : '#ef4444' }}>
                                    {formatINR(p.profit)}
                                </td>
                                <td style={{ textAlign: 'right' }}>{formatINR(p.profit_per_unit)}</td>
                                <td style={{ textAlign: 'right' }}>
                                    <span className="ri-share-badge">{p.profit_share}%</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>

        {/* Hidden Gems */}
        {data.underpromoteds?.length > 0 && (
            <div className="ri-card ri-card-full">
                <SectionHeader icon={<Sparkles size={18} />} title="Hidden Gems — Under-Promoted High-Margin Items" badge={`${data.underpromoteds.length} found`} />
                <div className="ri-gems-grid">
                    {data.underpromoteds.map((g, i) => (
                        <div key={i} className="ri-gem-card">
                            <div className="ri-gem-header">
                                <Sparkles size={16} color="#f59e0b" />
                                <strong>{g.name}</strong>
                                <TierBadge tier="Puzzle" />
                            </div>
                            <div className="ri-gem-stats">
                                <div>Margin: <strong style={{ color: '#10b981' }}>{g.margin_pct}%</strong></div>
                                <div>Sales: <strong>{g.per_day}/day</strong></div>
                            </div>
                            <p className="ri-gem-opp">{g.opportunity}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* Low Margin Risks */}
        {data.low_margin_risks?.length > 0 && (
            <div className="ri-card ri-card-full">
                <SectionHeader icon={<AlertTriangle size={18} />} title="Low-Margin High-Volume Risks" badge={`${data.low_margin_risks.length} alerts`} />
                <div className="ri-gems-grid">
                    {data.low_margin_risks.map((r, i) => (
                        <div key={i} className="ri-risk-card">
                            <div className="ri-gem-header">
                                <AlertTriangle size={16} color="#ef4444" />
                                <strong>{r.name}</strong>
                                <span className="ri-risk-badge">Margin: {r.margin_pct}%</span>
                            </div>
                            <div className="ri-gem-stats">
                                <div>Volume: <strong>{r.per_day}/day</strong></div>
                                <div>Gap from target: <strong style={{ color: '#ef4444' }}>{r.margin_gap}%</strong></div>
                            </div>
                            <p className="ri-gem-opp">{r.action}</p>
                        </div>
                    ))}
                </div>
            </div>
        )}
    </div>
);

/* ═══════════════════════════════════════════════════════════════
   TAB: MENU MATRIX — BCG-style Scatter + Velocity Table
   ═══════════════════════════════════════════════════════════════ */
const MatrixTab = ({ data }) => {
    const velocityData = data.velocity || [];

    // Compute averages for quadrant lines
    const avgVelocity = velocityData.length
        ? velocityData.reduce((s, v) => s + v.per_day, 0) / velocityData.length
        : 0;
    const avgMargin = velocityData.length
        ? velocityData.reduce((s, v) => s + v.margin_pct, 0) / velocityData.length
        : 0;

    return (
        <div className="ri-grid-2">
            {/* Scatter Chart */}
            <div className="ri-card ri-card-full">
                <SectionHeader icon={<Layers size={18} />} title="Menu Engineering Matrix" badge="BCG-Style" />
                <p className="ri-chart-desc">
                    <strong>Stars</strong> = high popularity + high margin &nbsp;|&nbsp;
                    <strong>Workhorses</strong> = high popularity + low margin &nbsp;|&nbsp;
                    <strong>Puzzles</strong> = low popularity + high margin &nbsp;|&nbsp;
                    <strong>Dogs</strong> = low popularity + low margin
                </p>
                <div style={{ width: '100%', height: 380 }}>
                    <ResponsiveContainer>
                        <ScatterChart margin={{ top: 20, right: 30, bottom: 20, left: 20 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                            <XAxis
                                dataKey="per_day"
                                name="Popularity (units/day)"
                                type="number"
                                label={{ value: 'Popularity (units/day)', position: 'bottom', offset: 0, style: { fill: 'var(--text-secondary)', fontSize: 12 } }}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                            />
                            <YAxis
                                dataKey="margin_pct"
                                name="Margin %"
                                type="number"
                                label={{ value: 'Margin %', angle: -90, position: 'insideLeft', style: { fill: 'var(--text-secondary)', fontSize: 12 } }}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 11 }}
                            />
                            <RechartsTooltip content={<MatrixTooltip />} />
                            {/* Reference lines for quadrants */}
                            <Scatter data={velocityData} fill="#8884d8">
                                {velocityData.map((entry, idx) => (
                                    <Cell key={idx} fill={TIER_COLORS[entry.tier] || '#888'} r={8} />
                                ))}
                            </Scatter>
                        </ScatterChart>
                    </ResponsiveContainer>
                </div>
                <div className="ri-matrix-legend">
                    {Object.entries(TIER_COLORS).map(([tier, color]) => (
                        <span key={tier} className="ri-legend-item">
                            <span className="ri-legend-dot" style={{ background: color }} />
                            {tier}
                        </span>
                    ))}
                </div>
            </div>

            {/* Velocity Table */}
            <div className="ri-card ri-card-full">
                <SectionHeader icon={<Activity size={18} />} title="Sales Velocity & Scoring" badge={`Avg ${avgVelocity.toFixed(1)}/day`} />
                <div className="ri-table-wrap">
                    <table className="ri-table">
                        <thead>
                            <tr>
                                <th>Item</th>
                                <th style={{ textAlign: 'right' }}>Units Sold</th>
                                <th style={{ textAlign: 'right' }}>Per Day</th>
                                <th style={{ textAlign: 'right' }}>Revenue</th>
                                <th style={{ textAlign: 'right' }}>Margin</th>
                                <th>Score</th>
                                <th>Tier</th>
                            </tr>
                        </thead>
                        <tbody>
                            {velocityData.map((v, i) => (
                                <tr key={i}>
                                    <td><strong>{v.name}</strong></td>
                                    <td style={{ textAlign: 'right' }}>{v.qty_sold.toLocaleString()}</td>
                                    <td style={{ textAlign: 'right' }}>{v.per_day}</td>
                                    <td style={{ textAlign: 'right' }}>{formatINR(v.revenue)}</td>
                                    <td style={{ textAlign: 'right' }}>{v.margin_pct}%</td>
                                    <td>
                                        <div className="ri-score-bar">
                                            <div className="ri-score-fill" style={{ width: `${v.velocity_score}%` }} />
                                            <span>{v.velocity_score}</span>
                                        </div>
                                    </td>
                                    <td><TierBadge tier={v.tier} /></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

/* ═══════════════════════════════════════════════════════════════
   TAB: COMBOS & UPSELLS
   ═══════════════════════════════════════════════════════════════ */
const CombosTab = ({ data }) => (
    <div className="ri-grid-2">
        {/* Combo Recommendations */}
        <div className="ri-card ri-card-full">
            <SectionHeader icon={<Gift size={18} />} title="Smart Combo Recommendations" badge={`${data.combos?.length || 0} combos`} />
            {data.combos?.length > 0 ? (
                <div className="ri-combo-grid">
                    {data.combos.map((c, i) => (
                        <div key={i} className="ri-combo-card">
                            <div className="ri-combo-items">
                                <span className="ri-combo-item">{c.item_a}</span>
                                <span className="ri-combo-plus">+</span>
                                <span className="ri-combo-item">{c.item_b}</span>
                            </div>
                            <div className="ri-combo-stats">
                                <div className="ri-combo-stat">
                                    <span className="ri-combo-stat-label">Co-orders</span>
                                    <span className="ri-combo-stat-value">{c.co_occurrence}</span>
                                </div>
                                <div className="ri-combo-stat">
                                    <span className="ri-combo-stat-label">Support</span>
                                    <span className="ri-combo-stat-value">{c.support_pct}%</span>
                                </div>
                                <div className="ri-combo-stat">
                                    <span className="ri-combo-stat-label">Individual</span>
                                    <span className="ri-combo-stat-value" style={{ textDecoration: 'line-through', opacity: 0.5 }}>{formatINR(c.individual_total)}</span>
                                </div>
                                <div className="ri-combo-stat">
                                    <span className="ri-combo-stat-label">Combo Price</span>
                                    <span className="ri-combo-stat-value highlight">{formatINR(c.suggested_combo_price)}</span>
                                </div>
                            </div>
                            <div className="ri-combo-footer">
                                <span className="ri-combo-discount">-{c.discount_pct}% discount</span>
                                <span className="ri-combo-projected">
                                    Projected: {formatINR(c.projected_monthly_revenue)}/mo
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <p className="ri-empty">Not enough data for combo recommendations. Need more order history.</p>
            )}
        </div>

        {/* Upsell Priorities */}
        <div className="ri-card ri-card-full">
            <SectionHeader icon={<Zap size={18} />} title="Smart Upsell Priorities" badge="Profit Impact" />
            {data.upsells?.length > 0 ? (
                <div className="ri-table-wrap">
                    <table className="ri-table">
                        <thead>
                            <tr>
                                <th>When ordering…</th>
                                <th>Suggest…</th>
                                <th style={{ textAlign: 'right' }}>Margin Gain</th>
                                <th style={{ textAlign: 'right' }}>Price Diff</th>
                                <th style={{ textAlign: 'right' }}>Monthly Impact</th>
                                <th>Script</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.upsells.map((u, i) => (
                                <tr key={i}>
                                    <td><strong>{u.base_item}</strong> <span style={{ color: 'var(--text-secondary)', fontSize: '11px' }}>({u.base_daily_orders}/day)</span></td>
                                    <td style={{ color: '#10b981', fontWeight: 600 }}>{u.upsell_to}</td>
                                    <td style={{ textAlign: 'right' }}>+{u.margin_gain}%</td>
                                    <td style={{ textAlign: 'right' }}>{u.price_difference > 0 ? `+${formatINR(u.price_difference)}` : formatINR(u.price_difference)}</td>
                                    <td style={{ textAlign: 'right', fontWeight: 600, color: '#10b981' }}>{formatINR(u.monthly_profit_impact)}</td>
                                    <td><span className="ri-script">{u.script}</span></td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="ri-empty">No upsell opportunities identified yet.</p>
            )}
        </div>
    </div>
);

/* ═══════════════════════════════════════════════════════════════
   TAB: PRICING ENGINE
   ═══════════════════════════════════════════════════════════════ */
const PricingTab = ({ data }) => (
    <div className="ri-card ri-card-full">
        <SectionHeader icon={<DollarSign size={18} />} title="Price Optimization Recommendations" />
        {data.price_recommendations?.length > 0 ? (
            <div className="ri-table-wrap">
                <table className="ri-table">
                    <thead>
                        <tr>
                            <th>Item</th>
                            <th style={{ textAlign: 'center' }}>Action</th>
                            <th style={{ textAlign: 'right' }}>Current Price</th>
                            <th style={{ textAlign: 'right' }}>Suggested Price</th>
                            <th style={{ textAlign: 'right' }}>Change</th>
                            <th style={{ textAlign: 'right' }}>Current Margin</th>
                            <th>Reason</th>
                            <th style={{ textAlign: 'right' }}>Projected Revenue</th>
                            <th style={{ textAlign: 'center' }}>Risk</th>
                        </tr>
                    </thead>
                    <tbody>
                        {data.price_recommendations.map((p, i) => (
                            <tr key={i} className={p.direction !== 'hold' ? 'ri-row-highlight' : ''}>
                                <td><strong>{p.name}</strong></td>
                                <td style={{ textAlign: 'center' }}>
                                    <span className={`ri-direction-badge ri-dir-${p.direction}`}>
                                        <DirectionIcon dir={p.direction} /> {p.direction}
                                    </span>
                                </td>
                                <td style={{ textAlign: 'right' }}>{formatINR(p.current_price)}</td>
                                <td style={{ textAlign: 'right', fontWeight: 600, color: p.direction === 'increase' ? '#10b981' : p.direction === 'decrease' ? '#ef4444' : 'var(--text-main)' }}>
                                    {formatINR(p.suggested_price)}
                                </td>
                                <td style={{ textAlign: 'right' }}>
                                    {p.change_amount > 0 ? '+' : ''}{formatINR(p.change_amount)} ({p.change_pct}%)
                                </td>
                                <td style={{ textAlign: 'right' }}>{p.current_margin}%</td>
                                <td><span className="ri-reason">{p.reason}</span></td>
                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{formatINR(p.projected_monthly_revenue)}/mo</td>
                                <td style={{ textAlign: 'center' }}>
                                    <span className={`ri-risk ri-risk-${p.risk_level}`}>{p.risk_level}</span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        ) : (
            <p className="ri-empty">No price recommendations available at this time.</p>
        )}
    </div>
);

/* ═══════════════════════════════════════════════════════════════
   TAB: INVENTORY SIGNALS
   ═══════════════════════════════════════════════════════════════ */
const InventoryTab = ({ data }) => (
    <div className="ri-card ri-card-full">
        <SectionHeader icon={<Package size={18} />} title="Inventory-Linked Performance Signals" badge={`${data.inventory_signals?.length || 0} alerts`} />
        {data.inventory_signals?.length > 0 ? (
            <div className="ri-signals-grid">
                {data.inventory_signals.map((s, i) => (
                    <div key={i} className={`ri-signal-card ri-signal-${s.severity}`}>
                        <div className="ri-signal-header">
                            <div className="ri-signal-severity-wrap">
                                {s.severity === 'critical' ? <AlertTriangle size={16} /> : <Clock size={16} />}
                                <span className={`ri-signal-severity ri-sev-${s.severity}`}>{s.severity.toUpperCase()}</span>
                            </div>
                            <span className="ri-signal-profit">Profit item: {formatINR(s.menu_item_profit)}</span>
                        </div>
                        <h4 className="ri-signal-menu">{s.menu_item}</h4>
                        <div className="ri-signal-details">
                            <div className="ri-signal-detail">
                                <span>Ingredient</span>
                                <strong>{s.ingredient}</strong>
                            </div>
                            <div className="ri-signal-detail">
                                <span>Stock</span>
                                <strong>{s.current_stock} {s.unit}</strong>
                            </div>
                            <div className="ri-signal-detail">
                                <span>Servings Left</span>
                                <strong>{s.servings_remaining}</strong>
                            </div>
                            <div className="ri-signal-detail">
                                <span>Days to Stockout</span>
                                <strong style={{ color: s.days_until_stockout <= 1 ? '#ef4444' : s.days_until_stockout <= 3 ? '#f59e0b' : 'inherit' }}>
                                    {s.days_until_stockout}
                                </strong>
                            </div>
                        </div>
                        <p className="ri-signal-action">{s.action}</p>
                    </div>
                ))}
            </div>
        ) : (
            <div className="ri-empty-state">
                <Shield size={40} color="#10b981" />
                <h3>All Clear!</h3>
                <p>No inventory alerts for your top-performing items. Stock levels are healthy.</p>
            </div>
        )}
    </div>
);

/* ═══════════════════════════════════════════════════════════════
   STYLES
   ═══════════════════════════════════════════════════════════════ */
const STYLES = `
/* ── Header ── */
.ri-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px; flex-wrap: wrap; gap: 16px; }
.ri-header-left { display: flex; align-items: center; gap: 14px; }
.ri-header-icon { width: 48px; height: 48px; border-radius: 14px; background: linear-gradient(135deg, #6366f1, #8b5cf6); display: flex; align-items: center; justify-content: center; color: white; }
.ri-header-title { font-size: 22px; font-weight: 700; color: var(--text-main); margin: 0; }
.ri-header-sub { font-size: 13px; color: var(--text-secondary); margin: 2px 0 0; }
.ri-header-right { display: flex; align-items: center; gap: 10px; }
.ri-period-select { padding: 8px 14px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); font-size: 13px; cursor: pointer; font-weight: 500; }
.ri-refresh-btn { padding: 8px 16px; border-radius: 10px; border: 1px solid var(--border-color); background: var(--bg-card); color: var(--text-main); font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; font-weight: 500; }
.ri-refresh-btn:hover { border-color: #6366f1; color: #6366f1; }
.ri-refresh-btn:disabled { opacity: 0.5; cursor: not-allowed; }

/* ── KPI Row ── */
.ri-kpi-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 16px; margin-bottom: 24px; }
.ri-kpi { display: flex; align-items: center; gap: 14px; padding: 18px 20px; border-radius: 14px; background: var(--bg-card); border: 1px solid var(--border-color); transition: transform 0.2s, box-shadow 0.2s; }
.ri-kpi:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(0,0,0,0.12); }
.ri-kpi-icon { width: 42px; height: 42px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.ri-kpi-body { display: flex; flex-direction: column; }
.ri-kpi-value { font-size: 20px; font-weight: 700; color: var(--text-main); line-height: 1.2; }
.ri-kpi-label { font-size: 12px; color: var(--text-secondary); margin-top: 2px; }
.ri-kpi-sub { font-size: 11px; color: var(--text-secondary); margin-top: 2px; opacity: 0.7; }

/* ── Tabs ── */
.ri-tabs { display: flex; gap: 4px; margin-bottom: 24px; padding: 4px; background: var(--bg-card); border-radius: 14px; border: 1px solid var(--border-color); overflow-x: auto; }
.ri-tab { padding: 10px 18px; border-radius: 10px; border: none; background: transparent; color: var(--text-secondary); font-size: 13px; font-weight: 500; cursor: pointer; display: flex; align-items: center; gap: 6px; transition: all 0.2s; white-space: nowrap; }
.ri-tab:hover { color: var(--text-main); background: var(--bg-body); }
.ri-tab.active { background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white; font-weight: 600; }

/* ── Cards ── */
.ri-card { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 16px; padding: 24px; }
.ri-card-full { grid-column: 1 / -1; }
.ri-grid-2 { display: grid; grid-template-columns: 1fr; gap: 20px; }
.ri-section-header { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; }
.ri-section-icon { width: 32px; height: 32px; border-radius: 10px; background: linear-gradient(135deg, #6366f122, #8b5cf622); display: flex; align-items: center; justify-content: center; color: #6366f1; }
.ri-section-title { font-size: 16px; font-weight: 600; color: var(--text-main); margin: 0; }
.ri-section-badge { padding: 3px 10px; border-radius: 20px; background: #6366f118; color: #6366f1; font-size: 11px; font-weight: 600; }

/* ── Tables ── */
.ri-table-wrap { overflow-x: auto; }
.ri-table { width: 100%; border-collapse: collapse; }
.ri-table th { padding: 10px 14px; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); border-bottom: 1px solid var(--border-color); text-align: left; white-space: nowrap; }
.ri-table td { padding: 12px 14px; font-size: 13px; color: var(--text-main); border-bottom: 1px solid var(--border-color); white-space: nowrap; }
.ri-table tr:last-child td { border-bottom: none; }
.ri-table tr:hover td { background: var(--bg-body); }
.ri-row-highlight td { background: rgba(99,102,241,0.04); }

/* ── Margin Bar ── */
.ri-margin-bar-track { position: relative; width: 100%; height: 20px; border-radius: 10px; background: var(--bg-body); overflow: hidden; }
.ri-margin-bar-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 10px; transition: width 0.6s ease; }
.ri-margin-bar-label { position: absolute; right: 6px; top: 50%; transform: translateY(-50%); font-size: 10px; font-weight: 700; color: var(--text-main); }

/* ── Tier Badge ── */
.ri-tier-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; }

/* ── Category Badge ── */
.ri-cat-badge { padding: 2px 8px; border-radius: 6px; background: var(--bg-body); font-size: 11px; color: var(--text-secondary); }

/* ── Rank ── */
.ri-rank { display: inline-flex; width: 24px; height: 24px; border-radius: 8px; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; }

/* ── Share Badge ── */
.ri-share-badge { padding: 2px 8px; border-radius: 6px; background: #6366f118; color: #6366f1; font-size: 11px; font-weight: 600; }

/* ── Velocity Score ── */
.ri-score-bar { position: relative; width: 80px; height: 6px; border-radius: 3px; background: var(--bg-body); overflow: hidden; }
.ri-score-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 3px; background: linear-gradient(90deg, #6366f1, #8b5cf6); }
.ri-score-bar span { position: absolute; right: -30px; top: -6px; font-size: 11px; font-weight: 600; color: var(--text-secondary); }

/* ── Combo Cards ── */
.ri-combo-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; }
.ri-combo-card { padding: 20px; border-radius: 14px; background: var(--bg-body); border: 1px solid var(--border-color); transition: transform 0.2s, box-shadow 0.2s; }
.ri-combo-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.1); }
.ri-combo-items { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
.ri-combo-item { padding: 6px 14px; border-radius: 10px; background: linear-gradient(135deg, #6366f115, #8b5cf615); color: var(--text-main); font-size: 13px; font-weight: 600; border: 1px solid #6366f130; }
.ri-combo-plus { font-size: 18px; font-weight: 700; color: #6366f1; }
.ri-combo-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.ri-combo-stat { display: flex; flex-direction: column; gap: 2px; }
.ri-combo-stat-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: var(--text-secondary); }
.ri-combo-stat-value { font-size: 14px; font-weight: 600; color: var(--text-main); }
.ri-combo-stat-value.highlight { color: #10b981; }
.ri-combo-footer { display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid var(--border-color); }
.ri-combo-discount { padding: 3px 10px; border-radius: 20px; background: #10b98118; color: #10b981; font-size: 11px; font-weight: 600; }
.ri-combo-projected { font-size: 12px; color: var(--text-secondary); font-weight: 500; }

/* ── Hidden Gems / Risks ── */
.ri-gems-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 16px; }
.ri-gem-card { padding: 18px; border-radius: 14px; background: linear-gradient(135deg, #f59e0b08, #f59e0b05); border: 1px solid #f59e0b30; }
.ri-risk-card { padding: 18px; border-radius: 14px; background: linear-gradient(135deg, #ef444408, #ef444405); border: 1px solid #ef444430; }
.ri-gem-header { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; flex-wrap: wrap; }
.ri-gem-stats { display: flex; gap: 20px; margin-bottom: 10px; font-size: 13px; color: var(--text-secondary); }
.ri-gem-opp { font-size: 12px; color: var(--text-secondary); margin: 0; line-height: 1.5; }
.ri-risk-badge { padding: 2px 8px; border-radius: 6px; background: #ef444418; color: #ef4444; font-size: 11px; font-weight: 600; }

/* ── Direction Badge ── */
.ri-direction-badge { display: inline-flex; align-items: center; gap: 4px; padding: 4px 12px; border-radius: 8px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.ri-dir-increase { background: #10b98118; color: #10b981; }
.ri-dir-decrease { background: #ef444418; color: #ef4444; }
.ri-dir-hold { background: var(--bg-body); color: var(--text-secondary); }

/* ── Risk Level ── */
.ri-risk { padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; text-transform: capitalize; }
.ri-risk-low { background: #10b98118; color: #10b981; }
.ri-risk-medium { background: #f59e0b18; color: #f59e0b; }
.ri-risk-high { background: #ef444418; color: #ef4444; }
.ri-risk-none { background: var(--bg-body); color: var(--text-secondary); }

/* ── Reason & Script ── */
.ri-reason { font-size: 12px; color: var(--text-secondary); max-width: 250px; white-space: normal; line-height: 1.4; }
.ri-script { font-size: 12px; color: #6366f1; font-style: italic; max-width: 250px; white-space: normal; line-height: 1.4; }

/* ── Inventory Signals ── */
.ri-signals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
.ri-signal-card { padding: 20px; border-radius: 14px; background: var(--bg-body); border: 1px solid var(--border-color); }
.ri-signal-critical { border-color: #ef444450; background: linear-gradient(135deg, #ef444406, transparent); }
.ri-signal-warning { border-color: #f59e0b50; background: linear-gradient(135deg, #f59e0b06, transparent); }
.ri-signal-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.ri-signal-severity-wrap { display: flex; align-items: center; gap: 6px; }
.ri-sev-critical { color: #ef4444; font-size: 11px; font-weight: 700; }
.ri-sev-warning { color: #f59e0b; font-size: 11px; font-weight: 700; }
.ri-sev-info { color: #6366f1; font-size: 11px; font-weight: 700; }
.ri-signal-profit { font-size: 11px; color: var(--text-secondary); }
.ri-signal-menu { font-size: 15px; font-weight: 600; color: var(--text-main); margin: 0 0 12px; }
.ri-signal-details { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.ri-signal-detail { display: flex; flex-direction: column; gap: 2px; }
.ri-signal-detail span { font-size: 10px; text-transform: uppercase; color: var(--text-secondary); letter-spacing: 0.5px; }
.ri-signal-detail strong { font-size: 13px; color: var(--text-main); }
.ri-signal-action { font-size: 12px; color: var(--text-secondary); margin: 0; padding-top: 10px; border-top: 1px solid var(--border-color); line-height: 1.5; }

/* ── Matrix ── */
.ri-chart-desc { font-size: 12px; color: var(--text-secondary); margin: 0 0 16px; line-height: 1.5; }
.ri-matrix-legend { display: flex; gap: 16px; justify-content: center; margin-top: 16px; flex-wrap: wrap; }
.ri-legend-item { display: flex; align-items: center; gap: 6px; font-size: 12px; color: var(--text-secondary); }
.ri-legend-dot { width: 10px; height: 10px; border-radius: 50%; }

/* ── Misc ── */
.ri-loading { display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 80px 20px; gap: 16px; color: var(--text-secondary); }
.ri-error { padding: 20px; border-radius: 14px; background: #ef444418; color: #ef4444; border: 1px solid #ef444430; text-align: center; }
.ri-empty { color: var(--text-secondary); text-align: center; padding: 30px; font-size: 13px; }
.ri-empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 50px 20px; color: var(--text-secondary); text-align: center; }
.ri-empty-state h3 { margin: 0; color: var(--text-main); }
.ri-empty-state p { margin: 0; font-size: 13px; }
.ri-tooltip { background: var(--bg-card); border: 1px solid var(--border-color); border-radius: 10px; padding: 10px 14px; font-size: 12px; box-shadow: 0 6px 20px rgba(0,0,0,0.15); color: var(--text-main); }
.ri-tooltip strong { display: block; margin-bottom: 4px; }

@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
.spin { animation: spin 1s linear infinite; }

@media (max-width: 768px) {
    .ri-kpi-row { grid-template-columns: 1fr 1fr; }
    .ri-combo-grid, .ri-gems-grid, .ri-signals-grid { grid-template-columns: 1fr; }
    .ri-header { flex-direction: column; align-items: flex-start; }
}
`;

export default RevenueIntelligence;
