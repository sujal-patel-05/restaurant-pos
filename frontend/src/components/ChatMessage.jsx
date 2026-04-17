import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    BarChart, Bar, LineChart, Line, AreaChart, Area, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';
import { Brain, User, Copy, Check, Download, FileText, ChevronLeft, ChevronRight } from 'lucide-react';

const CHART_COLORS = ['#6366f1', '#a855f7', '#ec4899', '#f59e0b', '#10b981', '#06b6d4', '#f97316', '#ef4444'];

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:8000';

function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';
    const [copied, setCopied] = useState(false);
    const [chartIndex, setChartIndex] = useState(0);

    const handleCopy = () => {
        navigator.clipboard.writeText(message.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    // Get all charts from the response data
    const allCharts = message.data?.all_charts || (message.chartData ? [message.chartData] : []);
    const downloadUrl = message.data?.report_download_url;

    const renderSingleChart = (chartData) => {
        if (!chartData) return null;
        const { data, type, title } = chartData;
        // Support both naming conventions
        const chartXKey = chartData.xKey || chartData.xAxisKey || 'label';
        const chartYKey = chartData.yKey || chartData.dataKey || 'value';
        const chartColor = chartData.color || '#6366f1';
        if (!data || data.length <= 1) return null;

        return (
            <div style={{
                marginTop: '10px', padding: '16px',
                background: 'rgba(0,0,0,0.15)', borderRadius: '12px',
                border: '1px solid rgba(255,255,255,0.06)'
            }}>
                {title && (
                    <div style={{
                        fontSize: '0.8rem', fontWeight: 700, marginBottom: '12px',
                        color: 'var(--text-main)', opacity: 0.9
                    }}>
                        {title}
                    </div>
                )}
                <div style={{ height: '220px', width: '100%' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        {type === 'line' ? (
                            <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey={chartXKey} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: 12 }} />
                                <Line type="monotone" dataKey={chartYKey} stroke={chartColor} strokeWidth={2.5} dot={{ r: 3, fill: chartColor }} />
                            </LineChart>
                        ) : type === 'area' ? (
                            <AreaChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                <defs>
                                    <linearGradient id={`gradient-${chartColor.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={chartColor} stopOpacity={0.3}/>
                                        <stop offset="95%" stopColor={chartColor} stopOpacity={0.02}/>
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey={chartXKey} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 9 }} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: 12 }} />
                                <Area type="monotone" dataKey={chartYKey} stroke={chartColor} strokeWidth={2} fill={`url(#gradient-${chartColor.replace('#','')})`} dot={{ r: 3, fill: chartColor }} />
                            </AreaChart>
                        ) : type === 'pie' ? (
                            <PieChart>
                                <Pie
                                    data={data} cx="50%" cy="50%" innerRadius={50} outerRadius={80}
                                    paddingAngle={3} dataKey={chartYKey}
                                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                >
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: 12 }} />
                            </PieChart>
                        ) : (
                            <BarChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.06)" />
                                <XAxis dataKey={chartXKey} axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} dy={8} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: 'var(--text-secondary)', fontSize: 10 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: 'var(--card-bg)', borderColor: 'var(--border-color)', borderRadius: '10px', color: 'var(--text-main)', fontSize: 12 }}
                                    cursor={{ fill: 'rgba(255,255,255,0.03)' }}
                                />
                                <Bar dataKey={chartYKey} radius={[6, 6, 0, 0]} barSize={28}>
                                    {data.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                                    ))}
                                </Bar>
                            </BarChart>
                        )}
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    const renderCharts = () => {
        if (allCharts.length === 0) return null;

        if (allCharts.length === 1) {
            return renderSingleChart(allCharts[0]);
        }

        // Multi-chart carousel
        const currentChart = allCharts[chartIndex];
        return (
            <div style={{ marginTop: '10px' }}>
                {renderSingleChart(currentChart)}
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    gap: '12px', marginTop: '8px',
                }}>
                    <button
                        onClick={() => setChartIndex(Math.max(0, chartIndex - 1))}
                        disabled={chartIndex === 0}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', padding: '4px 8px', cursor: chartIndex === 0 ? 'not-allowed' : 'pointer',
                            color: 'var(--text-secondary)', opacity: chartIndex === 0 ? 0.3 : 0.8,
                            display: 'flex', alignItems: 'center', transition: 'all 0.2s',
                        }}
                    >
                        <ChevronLeft size={14} />
                    </button>
                    <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {allCharts.map((_, i) => (
                            <div
                                key={i}
                                onClick={() => setChartIndex(i)}
                                style={{
                                    width: i === chartIndex ? 18 : 6, height: 6,
                                    borderRadius: 10, cursor: 'pointer',
                                    background: i === chartIndex ? '#6366f1' : 'rgba(255,255,255,0.15)',
                                    transition: 'all 0.3s',
                                }}
                            />
                        ))}
                    </div>
                    <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.5 }}>
                        {chartIndex + 1}/{allCharts.length}
                    </span>
                    <button
                        onClick={() => setChartIndex(Math.min(allCharts.length - 1, chartIndex + 1))}
                        disabled={chartIndex === allCharts.length - 1}
                        style={{
                            background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                            borderRadius: '8px', padding: '4px 8px',
                            cursor: chartIndex === allCharts.length - 1 ? 'not-allowed' : 'pointer',
                            color: 'var(--text-secondary)',
                            opacity: chartIndex === allCharts.length - 1 ? 0.3 : 0.8,
                            display: 'flex', alignItems: 'center', transition: 'all 0.2s',
                        }}
                    >
                        <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        );
    };

    const renderDownloadButton = () => {
        if (!downloadUrl) return null;
        return (
            <a
                href={`${API_BASE}${downloadUrl}`}
                target="_blank"
                rel="noopener noreferrer"
                download
                style={{
                    display: 'flex', alignItems: 'center', gap: '10px',
                    marginTop: '12px', padding: '12px 16px',
                    background: 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))',
                    border: '1px solid rgba(99,102,241,0.25)',
                    borderRadius: '12px', textDecoration: 'none',
                    color: '#a5b4fc', cursor: 'pointer',
                    transition: 'all 0.25s',
                }}
                onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.2), rgba(139,92,246,0.15))';
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.4)';
                    e.currentTarget.style.transform = 'translateY(-1px)';
                    e.currentTarget.style.boxShadow = '0 4px 16px rgba(99,102,241,0.2)';
                }}
                onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'linear-gradient(135deg, rgba(99,102,241,0.12), rgba(139,92,246,0.08))';
                    e.currentTarget.style.borderColor = 'rgba(99,102,241,0.25)';
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = 'none';
                }}
            >
                <div style={{
                    width: 36, height: 36, borderRadius: 10,
                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    flexShrink: 0,
                    boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                }}>
                    <FileText size={18} color="white" />
                </div>
                <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '0.82rem', fontWeight: 700, color: '#c4b5fd' }}>
                        Download PDF Report
                    </div>
                    <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)', opacity: 0.7, marginTop: 1 }}>
                        Full report with charts & analytics
                    </div>
                </div>
                <Download size={18} color="#818cf8" />
            </a>
        );
    };

    return (
        <div style={{
            display: 'flex',
            justifyContent: isUser ? 'flex-end' : 'flex-start',
            marginBottom: '6px',
            animation: 'fadeInUp 0.35s ease-out',
            gap: '10px',
            alignItems: 'flex-start'
        }}>
            {/* AI Avatar */}
            {isAssistant && (
                <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, #6366f1, #a855f7)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 2,
                    boxShadow: '0 2px 8px rgba(99,102,241,0.25)'
                }}>
                    <Brain size={16} color="white" />
                </div>
            )}

            {/* Message Bubble */}
            <div style={{
                maxWidth: '78%',
                position: 'relative',
                group: true
            }}>
                <div style={{
                    padding: isUser ? '12px 16px' : '14px 18px',
                    borderRadius: isUser ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
                    background: isUser
                        ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                        : message.isError
                            ? 'rgba(239,68,68,0.08)'
                            : 'rgba(255, 255, 255, 0.04)',
                    border: isUser ? 'none'
                        : message.isError
                            ? '1px solid rgba(239,68,68,0.15)'
                            : '1px solid rgba(255, 255, 255, 0.07)',
                    color: isUser ? 'white' : 'var(--text-main)',
                    boxShadow: isUser ? '0 4px 14px rgba(99, 102, 241, 0.25)' : '0 2px 8px rgba(0,0,0,0.06)',
                    fontSize: '0.9rem',
                    lineHeight: '1.65'
                }}>
                    {/* Markdown Content */}
                    <div className="markdown-content">
                        <ReactMarkdown
                            remarkPlugins={[remarkGfm]}
                            components={{
                                strong: ({ node, ...props }) => (
                                    <strong style={{ color: isUser ? '#fff' : '#a5b4fc', fontWeight: 700 }} {...props} />
                                ),
                                ul: ({ node, ...props }) => <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }} {...props} />,
                                ol: ({ node, ...props }) => <ol style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }} {...props} />,
                                li: ({ node, ...props }) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                                p: ({ node, ...props }) => <p style={{ margin: '0 0 0.5rem 0' }} {...props} />,
                                h1: ({ node, ...props }) => <h1 style={{ fontSize: '1.15rem', fontWeight: 800, margin: '0.75rem 0 0.5rem', color: 'var(--text-main)' }} {...props} />,
                                h2: ({ node, ...props }) => <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: '0.75rem 0 0.4rem', color: '#a5b4fc' }} {...props} />,
                                h3: ({ node, ...props }) => <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: '0.5rem 0 0.3rem', color: '#c4b5fd' }} {...props} />,
                                table: ({ node, ...props }) => (
                                    <div style={{ overflowX: 'auto', margin: '0.5rem 0' }}>
                                        <table style={{
                                            borderCollapse: 'collapse', width: '100%', fontSize: '0.82rem',
                                            border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px'
                                        }} {...props} />
                                    </div>
                                ),
                                thead: ({ node, ...props }) => (
                                    <thead style={{ background: 'rgba(99,102,241,0.1)' }} {...props} />
                                ),
                                th: ({ node, ...props }) => (
                                    <th style={{
                                        padding: '8px 12px', textAlign: 'left', fontWeight: 700,
                                        borderBottom: '1px solid rgba(255,255,255,0.1)', color: '#a5b4fc', fontSize: '0.78rem'
                                    }} {...props} />
                                ),
                                td: ({ node, ...props }) => (
                                    <td style={{
                                        padding: '7px 12px',
                                        borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: '0.8rem'
                                    }} {...props} />
                                ),
                                blockquote: ({ node, ...props }) => (
                                    <blockquote style={{
                                        borderLeft: '3px solid #6366f1', paddingLeft: '12px',
                                        margin: '0.5rem 0', color: 'var(--text-secondary)', fontStyle: 'italic'
                                    }} {...props} />
                                ),
                                code: ({ node, inline, ...props }) => inline ? (
                                    <code style={{
                                        background: 'rgba(99,102,241,0.15)', padding: '2px 6px',
                                        borderRadius: '4px', fontSize: '0.82rem', color: '#c4b5fd'
                                    }} {...props} />
                                ) : (
                                    <code style={{
                                        display: 'block', background: 'rgba(0,0,0,0.25)', padding: '12px',
                                        borderRadius: '8px', fontSize: '0.8rem', overflowX: 'auto',
                                        margin: '0.5rem 0', color: '#e0e7ff'
                                    }} {...props} />
                                ),
                            }}
                        >
                            {message.content}
                        </ReactMarkdown>
                    </div>

                    {/* Charts (supports single + multi-chart carousel) */}
                    {renderCharts()}

                    {/* Download PDF Button */}
                    {renderDownloadButton()}
                </div>

                {/* Copy button + Timestamp (assistant only) */}
                {isAssistant && !message.isError && (
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        marginTop: 4, paddingLeft: 2
                    }}>
                        <button
                            onClick={handleCopy}
                            style={{
                                background: 'none', border: 'none', cursor: 'pointer',
                                color: copied ? '#22c55e' : 'var(--text-secondary)',
                                opacity: copied ? 1 : 0.4, fontSize: '0.7rem',
                                display: 'flex', alignItems: 'center', gap: 4,
                                transition: 'all 0.2s', padding: '2px 4px', borderRadius: 6
                            }}
                            onMouseEnter={(e) => e.target.style.opacity = '0.8'}
                            onMouseLeave={(e) => e.target.style.opacity = copied ? '1' : '0.4'}
                        >
                            {copied ? <Check size={12} /> : <Copy size={12} />}
                            {copied ? 'Copied' : 'Copy'}
                        </button>
                        <span style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', opacity: 0.35 }}>
                            {new Date(message.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                    </div>
                )}
            </div>

            {/* User Avatar */}
            {isUser && (
                <div style={{
                    width: 32, height: 32, borderRadius: 10, flexShrink: 0,
                    background: 'linear-gradient(135deg, #3b82f6, #1d4ed8)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    marginTop: 2, color: 'white', fontWeight: 700, fontSize: '0.75rem'
                }}>
                    <User size={16} />
                </div>
            )}
        </div>
    );
}

export default ChatMessage;
