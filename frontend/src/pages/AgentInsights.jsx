import React, { useState, useEffect, useCallback } from 'react';
import { AppLayout } from '../components/AppLayout';
import { agentsAPI } from '../services/api';
import {
    Package, TrendingUp, Tag, Brain, Play,
    Loader2, CheckCircle2, Clock, ChevronRight,
    AlertTriangle, Sparkles, BarChart3, Zap, Activity
} from 'lucide-react';

const AGENTS = [
    {
        Icon: Package,
        name: 'Inventory Agent',
        role: 'Stock & Wastage Analyst',
        gradient: 'linear-gradient(135deg, #f97316, #fb923c)',
        bg: '#f97316',
        lightBg: 'rgba(249, 115, 22, 0.1)',
        borderColor: 'rgba(249, 115, 22, 0.25)',
    },
    {
        Icon: TrendingUp,
        name: 'Sales Agent',
        role: 'Revenue Strategist',
        gradient: 'linear-gradient(135deg, #10b981, #34d399)',
        bg: '#10b981',
        lightBg: 'rgba(16, 185, 129, 0.1)',
        borderColor: 'rgba(16, 185, 129, 0.25)',
    },
    {
        Icon: Tag,
        name: 'Pricing Agent',
        role: 'Price Optimizer',
        gradient: 'linear-gradient(135deg, #6366f1, #818cf8)',
        bg: '#6366f1',
        lightBg: 'rgba(99, 102, 241, 0.1)',
        borderColor: 'rgba(99, 102, 241, 0.25)',
    },
    {
        Icon: Brain,
        name: 'AI Co-Pilot',
        role: 'Operations Director',
        gradient: 'linear-gradient(135deg, #ec4899, #f472b6)',
        bg: '#ec4899',
        lightBg: 'rgba(236, 72, 153, 0.1)',
        borderColor: 'rgba(236, 72, 153, 0.25)',
    },
];

function AgentInsights() {
    const [insights, setInsights] = useState(null);
    const [status, setStatus] = useState(null);
    const [history, setHistory] = useState([]);
    const [loading, setLoading] = useState(true);
    const [running, setRunning] = useState(false);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('brief');
    const [selectedBrief, setSelectedBrief] = useState(null);
    const [selectedAgent, setSelectedAgent] = useState(null);

    const handleAgentClick = (index) => {
        if (selectedAgent === index) {
            setSelectedAgent(null);
            setActiveTab('brief');
        } else {
            setSelectedAgent(index);
            setActiveTab('agents');
        }
    };

    const fetchData = useCallback(async () => {
        try {
            setLoading(true);
            const [insightsRes, statusRes, historyRes] = await Promise.all([
                agentsAPI.getInsights(),
                agentsAPI.getStatus(),
                agentsAPI.getHistory(10)
            ]);
            setInsights(insightsRes.data);
            setStatus(statusRes.data);
            setHistory(historyRes.data.entries || []);
            setRunning(statusRes.data.running);
        } catch (err) {
            console.error('Failed to fetch agent data:', err);
            setError('Failed to load agent insights');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(); }, [fetchData]);

    useEffect(() => {
        if (!running) return;
        const interval = setInterval(async () => {
            try {
                const res = await agentsAPI.getStatus();
                if (!res.data.running) {
                    setRunning(false);
                    fetchData();
                }
            } catch (e) { /* ignore */ }
        }, 5000);
        return () => clearInterval(interval);
    }, [running, fetchData]);

    const handleRunAnalysis = async () => {
        try {
            setRunning(true);
            setError(null);
            await agentsAPI.runAnalysis();
        } catch (err) {
            if (err.response?.status === 409) {
                setError('Analysis is already running. Please wait.');
            } else {
                setError('Failed to start: ' + (err.response?.data?.detail || err.message));
            }
            setRunning(false);
        }
    };

    const formatBrief = (text) => {
        if (!text) return '';
        // Strip emojis from the AI-generated brief content
        const stripped = text.replace(/[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu, '').trim();
        return stripped
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            .replace(/^### (.+)$/gm, '<h3 class="ai-h3">$1</h3>')
            .replace(/^## (.+)$/gm, '<h2 class="ai-h2">$1</h2>')
            .replace(/^# (.+)$/gm, '<h1 class="ai-h1">$1</h1>')
            .replace(/^- (.+)$/gm, '<li>$1</li>')
            .replace(/^(\d+)\. (.+)$/gm, '<li><strong>$1.</strong> $2</li>')
            .replace(/\n/g, '<br>');
    };

    const formatTime = (isoStr) => {
        if (!isoStr) return 'Never';
        return new Date(isoStr).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
    };

    return (
        <AppLayout
            title="AI Agent Insights"
            subtitle="CrewAI multi-agent restaurant intelligence"
            actions={
                <button
                    onClick={handleRunAnalysis}
                    disabled={running}
                    style={{
                        display: 'flex', alignItems: 'center', gap: '8px',
                        background: running
                            ? 'var(--bg-tertiary)'
                            : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        border: 'none', color: 'white', padding: '10px 22px',
                        borderRadius: '12px', cursor: running ? 'wait' : 'pointer',
                        fontWeight: 700, fontSize: '14px', fontFamily: 'inherit',
                        transition: 'all 0.3s ease',
                        boxShadow: running ? 'none' : '0 4px 20px rgba(99, 102, 241, 0.4)',
                    }}
                >
                    {running ? <Loader2 size={16} className="ai-spin-icon" /> : <Play size={16} fill="white" />}
                    {running ? 'Agents Working...' : 'Run Analysis'}
                </button>
            }
        >
            <style>{`
                @keyframes ai-spin { to { transform: rotate(360deg); } }
                @keyframes ai-float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-5px); } }
                @keyframes ai-fadeIn { from { opacity: 0; transform: translateY(12px); } to { opacity: 1; transform: 0; } }
                @keyframes ai-pulse { 0%, 100% { opacity: .6; } 50% { opacity: 1; } }
                @keyframes ai-bar { 0%, 100% { height: 8px; } 50% { height: 24px; } }
                .ai-spin-icon { animation: ai-spin .8s linear infinite; }

                /* ===== AGENT GRID ===== */
                .aig-grid {
                    display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px;
                    margin-bottom: 20px;
                }
                .aig-card {
                    position: relative;
                    border-radius: 16px; padding: 24px 16px;
                    text-align: center;
                    transition: all 0.35s cubic-bezier(.4,0,.2,1);
                    cursor: pointer;
                    overflow: hidden;
                }
                .aig-card:hover {
                    transform: translateY(-6px) scale(1.02);
                }
                .aig-card.selected {
                    transform: translateY(-4px) scale(1.03);
                    border-width: 2px !important;
                }
                .aig-card.selected .aig-icon-box {
                    transform: scale(1.1);
                }
                .aig-card-bg {
                    position: absolute; inset: 0; border-radius: 16px; z-index: 0;
                    opacity: 1;
                }
                .aig-card-content { position: relative; z-index: 1; }
                .aig-icon-box {
                    width: 52px; height: 52px;
                    border-radius: 14px;
                    display: inline-flex; align-items: center; justify-content: center;
                    margin-bottom: 14px;
                    animation: ai-float 3.5s ease-in-out infinite;
                }
                .aig-card:nth-child(1) .aig-icon-box { animation-delay: 0s; }
                .aig-card:nth-child(2) .aig-icon-box { animation-delay: 0.4s; }
                .aig-card:nth-child(3) .aig-icon-box { animation-delay: 0.8s; }
                .aig-card:nth-child(4) .aig-icon-box { animation-delay: 1.2s; }
                .aig-name {
                    font-weight: 700; font-size: 14px;
                    color: white; margin-bottom: 3px;
                    letter-spacing: -0.2px;
                }
                .aig-role {
                    font-size: 11.5px; color: rgba(255,255,255,0.7);
                    font-weight: 500;
                }

                /* ===== STATUS ===== */
                .aig-status {
                    display: flex; align-items: center; gap: 12px;
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 14px; padding: 12px 20px;
                    margin-bottom: 20px; font-size: 13px;
                }
                .aig-status-dot {
                    width: 9px; height: 9px; border-radius: 50%; flex-shrink: 0;
                }
                .aig-status-dot.on { background: #22c55e; box-shadow: 0 0 8px rgba(34,197,94,.5); }
                .aig-status-dot.busy { background: #f59e0b; animation: ai-pulse 1.2s ease infinite; box-shadow: 0 0 8px rgba(245,158,11,.5); }
                .aig-status-text { font-weight: 600; color: var(--text-primary); }
                .aig-status-meta { margin-left: auto; color: var(--text-secondary); font-size: 12px; font-weight: 500; }

                /* ===== RUNNING ANIMATION ===== */
                .aig-running {
                    display: flex; align-items: center; justify-content: center;
                    gap: 20px; padding: 36px;
                    background: linear-gradient(135deg, rgba(99,102,241,0.06), rgba(139,92,246,0.04));
                    border: 1px solid rgba(99,102,241,0.12);
                    border-radius: 16px; margin-bottom: 20px;
                }
                .aig-bars { display: flex; align-items: end; gap: 3px; height: 28px; }
                .aig-bars span {
                    width: 4px; background: #6366f1; border-radius: 3px;
                    animation: ai-bar 1.1s ease-in-out infinite; height: 8px;
                }
                .aig-bars span:nth-child(2) { animation-delay: .12s; background: #818cf8; }
                .aig-bars span:nth-child(3) { animation-delay: .24s; }
                .aig-bars span:nth-child(4) { animation-delay: .36s; background: #a78bfa; }
                .aig-bars span:nth-child(5) { animation-delay: .48s; }
                .aig-running-label {
                    font-size: 15px; font-weight: 700;
                    background: linear-gradient(90deg, #6366f1, #a855f7, #ec4899);
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    background-clip: text;
                }

                /* ===== TABS ===== */
                .aig-tabs {
                    display: flex; gap: 4px;
                    background: var(--bg-secondary);
                    padding: 4px; border-radius: 14px;
                    margin-bottom: 20px;
                    border: 1px solid var(--border-color);
                }
                .aig-tab {
                    flex: 1; padding: 11px 16px;
                    border: none; background: transparent;
                    color: var(--text-secondary);
                    border-radius: 10px; cursor: pointer;
                    font-weight: 600; font-size: 13px;
                    transition: all 0.25s ease;
                    display: flex; align-items: center; justify-content: center; gap: 8px;
                    font-family: inherit;
                }
                .aig-tab:hover:not(.on) {
                    background: var(--bg-tertiary);
                    color: var(--text-primary);
                }
                .aig-tab.on {
                    background: linear-gradient(135deg, #6366f1, #7c3aed);
                    color: white;
                    box-shadow: 0 4px 14px rgba(99,102,241,.35);
                }
                .aig-tab-ct {
                    background: rgba(255,255,255,.2); padding: 1px 8px;
                    border-radius: 8px; font-size: 11px; font-weight: 700;
                    min-width: 20px; text-align: center;
                }

                /* ===== BRIEF ===== */
                .aig-brief {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 20px; padding: 28px 32px;
                    position: relative; overflow: hidden;
                }
                .aig-brief::before {
                    content: ''; position: absolute;
                    top: 0; left: 0; right: 0; height: 3px;
                    background: linear-gradient(90deg, #6366f1, #8b5cf6, #a855f7, #ec4899);
                }
                .aig-brief-hdr {
                    display: flex; justify-content: space-between; align-items: center;
                    margin-bottom: 20px; padding-bottom: 16px;
                    border-bottom: 1px solid var(--border-color);
                }
                .aig-brief-hdr-left {
                    display: flex; align-items: center; gap: 14px;
                }
                .aig-brief-icon {
                    width: 42px; height: 42px; border-radius: 12px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 4px 12px rgba(99,102,241,.3);
                }
                .aig-brief-hdr h2 {
                    margin: 0; font-size: 19px; font-weight: 800;
                    color: var(--text-primary); letter-spacing: -0.5px;
                }
                .aig-brief-hdr .sub {
                    margin: 3px 0 0; font-size: 12px;
                    color: var(--text-secondary); font-weight: 500;
                }
                .aig-brief-time {
                    font-size: 12px; color: var(--text-secondary);
                    background: var(--bg-tertiary); padding: 5px 14px;
                    border-radius: 20px;
                }
                .aig-brief-body {
                    color: var(--text-primary); line-height: 1.85; font-size: 14px;
                }
                .aig-brief-body strong { color: #c4b5fd; font-weight: 700; }
                .aig-brief-body h1, .aig-brief-body .ai-h1 {
                    font-size: 20px; font-weight: 800; margin: 24px 0 12px;
                    letter-spacing: -0.5px; color: #e0e7ff;
                    border-bottom: 2px solid rgba(99,102,241,.2); padding-bottom: 8px;
                }
                .aig-brief-body h2, .aig-brief-body .ai-h2 {
                    font-size: 17px; font-weight: 700; margin: 20px 0 10px;
                    color: #a5b4fc;
                    border-bottom: 1px solid var(--border-color); padding-bottom: 6px;
                }
                .aig-brief-body h3, .aig-brief-body .ai-h3 {
                    font-size: 15px; font-weight: 700; margin: 16px 0 8px;
                    color: #c4b5fd; letter-spacing: -0.2px;
                }
                .aig-brief-body li { margin-left: 16px; margin-bottom: 8px; padding-left: 4px; }

                /* ===== TASK CARDS ===== */
                .aig-tasks { display: flex; flex-direction: column; gap: 14px; }
                .aig-task {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 16px; overflow: hidden;
                    transition: all 0.25s ease;
                }
                .aig-task:hover { border-color: rgba(99,102,241,.25); }
                .aig-task-hdr {
                    display: flex; align-items: center; gap: 12px;
                    padding: 14px 20px;
                    border-bottom: 1px solid var(--border-color);
                }
                .aig-task-icon {
                    width: 34px; height: 34px; border-radius: 10px;
                    display: flex; align-items: center; justify-content: center;
                }
                .aig-task-name { font-weight: 700; font-size: 13px; }
                .aig-task-body {
                    padding: 16px 20px; font-size: 13px;
                    line-height: 1.75; white-space: pre-wrap;
                    word-break: break-word; color: var(--text-secondary);
                }

                /* ===== HISTORY ===== */
                .aig-hist { display: flex; flex-direction: column; gap: 8px; }
                .aig-hist-item {
                    background: var(--bg-secondary);
                    border: 1px solid var(--border-color);
                    border-radius: 14px; padding: 16px 20px;
                    display: flex; justify-content: space-between; align-items: center;
                    cursor: pointer; transition: all 0.25s ease;
                }
                .aig-hist-item:hover {
                    border-color: rgba(99,102,241,.3);
                    transform: translateX(4px);
                    box-shadow: 0 4px 16px rgba(99,102,241,.08);
                }
                .aig-hist-title {
                    font-weight: 700; color: var(--text-primary); font-size: 14px;
                    display: flex; align-items: center; gap: 8px; margin-bottom: 4px;
                }
                .aig-hist-preview {
                    font-size: 12px; color: var(--text-secondary);
                    line-height: 1.5; max-width: 560px;
                }
                .aig-badge {
                    padding: 4px 12px; border-radius: 20px;
                    font-size: 11px; font-weight: 700; flex-shrink: 0;
                    display: inline-flex; align-items: center; gap: 4px;
                }
                .aig-badge.ok { background: rgba(34,197,94,.1); color: #22c55e; border: 1px solid rgba(34,197,94,.15); }
                .aig-badge.err { background: rgba(239,68,68,.1); color: #ef4444; border: 1px solid rgba(239,68,68,.15); }

                /* ===== EMPTY ===== */
                .aig-empty {
                    text-align: center; padding: 56px 24px;
                }
                .aig-empty-icon {
                    margin-bottom: 16px; opacity: .4;
                    animation: ai-float 4s ease-in-out infinite;
                }
                .aig-empty h3 { color: var(--text-primary); font-size: 17px; margin-bottom: 8px; }
                .aig-empty p { font-size: 13px; color: var(--text-secondary); max-width: 380px; margin: 0 auto; line-height: 1.6; }
                .aig-empty-btn {
                    display: inline-flex; align-items: center; gap: 8px;
                    margin-top: 20px; padding: 10px 22px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    color: white; border: none; border-radius: 12px;
                    font-weight: 700; font-size: 13px; cursor: pointer;
                    transition: all 0.3s ease; font-family: inherit;
                    box-shadow: 0 4px 14px rgba(99,102,241,.35);
                }
                .aig-empty-btn:hover { transform: translateY(-2px); box-shadow: 0 8px 24px rgba(99,102,241,.45); }

                /* ===== ERROR ===== */
                .aig-err {
                    display: flex; align-items: center; justify-content: space-between;
                    background: rgba(239,68,68,.06); border: 1px solid rgba(239,68,68,.15);
                    border-radius: 12px; padding: 12px 18px;
                    color: #f87171; font-size: 13px; margin-bottom: 16px;
                }
                .aig-err button {
                    background: none; border: none; color: #f87171;
                    cursor: pointer; font-size: 16px; padding: 2px 6px;
                    border-radius: 6px; transition: background .2s;
                }
                .aig-err button:hover { background: rgba(239,68,68,.1); }

                @media (max-width: 800px) { .aig-grid { grid-template-columns: repeat(2, 1fr); } }
                @media (max-width: 500px) {
                    .aig-grid { grid-template-columns: 1fr; }
                    .aig-tabs { flex-wrap: wrap; }
                    .aig-brief { padding: 20px; }
                    .aig-brief-hdr { flex-direction: column; align-items: flex-start; gap: 10px; }
                }
            `}</style>

            {/* Error */}
            {error && (
                <div className="aig-err">
                    <span><AlertTriangle size={14} style={{ verticalAlign: 'middle', marginRight: 6 }} />{error}</span>
                    <button onClick={() => setError(null)}>✕</button>
                </div>
            )}

            {/* ===== AGENT CARDS ===== */}
            <div className="aig-grid">
                {AGENTS.map((agent, i) => (
                    <div
                        key={i}
                        className={`aig-card ${selectedAgent === i ? 'selected' : ''}`}
                        style={{
                            border: selectedAgent === i
                                ? `2px solid ${agent.bg}`
                                : `1px solid ${agent.borderColor}`,
                            boxShadow: selectedAgent === i
                                ? `0 8px 30px ${agent.lightBg}`
                                : 'none',
                        }}
                        onClick={() => handleAgentClick(i)}
                    >
                        <div
                            className="aig-card-bg"
                            style={{ background: `linear-gradient(160deg, ${agent.lightBg}, transparent 70%)` }}
                        />
                        <div className="aig-card-content">
                            <div
                                className="aig-icon-box"
                                style={{ background: agent.gradient, boxShadow: `0 6px 20px ${agent.lightBg}` }}
                            >
                                <agent.Icon size={24} color="white" strokeWidth={2.2} />
                            </div>
                            <div className="aig-name" style={{ color: 'var(--text-primary)' }}>{agent.name}</div>
                            <div className="aig-role" style={{ color: 'var(--text-secondary)' }}>{agent.role}</div>
                        </div>
                    </div>
                ))}
            </div>

            {/* ===== STATUS BAR ===== */}
            <div className="aig-status">
                <div className={`aig-status-dot ${running ? 'busy' : 'on'}`} />
                <span className="aig-status-text">
                    {running ? (
                        <><Activity size={14} style={{ verticalAlign: 'middle', marginRight: 4 }} />Agents analyzing data...</>
                    ) : (
                        <><CheckCircle2 size={14} style={{ verticalAlign: 'middle', marginRight: 4, color: '#22c55e' }} />All systems ready</>
                    )}
                </span>
                <span className="aig-status-meta">
                    {status ? (
                        <>
                            <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                            {formatTime(status.last_completed)}
                            {status.total_runs > 0 && <> • {status.total_runs} runs</>}
                        </>
                    ) : 'No runs yet'}
                </span>
            </div>

            {/* ===== RUNNING ANIMATION ===== */}
            {running && (
                <div className="aig-running">
                    <div className="aig-bars"><span /><span /><span /><span /><span /></div>
                    <span className="aig-running-label">
                        <Sparkles size={16} style={{ verticalAlign: 'middle', marginRight: 6 }} />
                        AI agents analyzing inventory, sales & pricing...
                    </span>
                    <div className="aig-bars"><span /><span /><span /><span /><span /></div>
                </div>
            )}

            {/* ===== TABS ===== */}
            <div className="aig-tabs">
                <button className={`aig-tab ${activeTab === 'brief' ? 'on' : ''}`} onClick={() => setActiveTab('brief')}>
                    <Zap size={14} /> Daily Brief
                </button>
                <button className={`aig-tab ${activeTab === 'agents' ? 'on' : ''}`} onClick={() => setActiveTab('agents')}>
                    <BarChart3 size={14} /> Agent Outputs
                    {insights?.data?.task_outputs?.length > 0 && (
                        <span className="aig-tab-ct">{insights.data.task_outputs.length}</span>
                    )}
                </button>
                <button className={`aig-tab ${activeTab === 'history' ? 'on' : ''}`} onClick={() => setActiveTab('history')}>
                    <Clock size={14} /> History
                    {history.length > 0 && <span className="aig-tab-ct">{history.length}</span>}
                </button>
            </div>

            {/* ===== TAB CONTENT ===== */}
            {loading ? (
                <div className="aig-empty">
                    <div className="aig-empty-icon"><Loader2 size={44} className="ai-spin-icon" color="var(--primary)" /></div>
                    <h3>Loading insights...</h3>
                </div>
            ) : activeTab === 'brief' ? (
                insights?.available ? (
                    <div className="aig-brief">
                        <div className="aig-brief-hdr">
                            <div className="aig-brief-hdr-left">
                                <div className="aig-brief-icon">
                                    <Brain size={22} color="white" />
                                </div>
                                <div>
                                    <h2>AI Co-Pilot Daily Brief</h2>
                                    <p className="sub">Multi-agent synthesis of your restaurant data</p>
                                </div>
                            </div>
                            <span className="aig-brief-time">
                                <Clock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                                {formatTime(insights.data?.timestamp)}
                            </span>
                        </div>
                        <div
                            className="aig-brief-body"
                            dangerouslySetInnerHTML={{ __html: formatBrief(selectedBrief || insights.data?.daily_brief) }}
                        />
                    </div>
                ) : (
                    <div className="aig-empty">
                        <div className="aig-empty-icon"><Sparkles size={52} color="var(--primary)" /></div>
                        <h3>No Analysis Yet</h3>
                        <p>Launch your first AI analysis to get actionable insights about your inventory, sales trends, and pricing strategy.</p>
                        <button className="aig-empty-btn" onClick={handleRunAnalysis} disabled={running}>
                            <Play size={14} fill="white" /> Launch First Analysis
                        </button>
                    </div>
                )
            ) : activeTab === 'agents' ? (
                insights?.available && insights.data?.task_outputs?.length > 0 ? (
                    <div className="aig-tasks">
                        {insights.data.task_outputs
                            .map((task, i) => ({ task, i }))
                            .filter(({ i }) => selectedAgent === null || selectedAgent === i)
                            .map(({ task, i }) => {
                                const agent = AGENTS[i] || AGENTS[0];
                                return (
                                    <div key={i} className="aig-task">
                                        <div className="aig-task-hdr">
                                            <div className="aig-task-icon" style={{ background: agent.gradient }}>
                                                <agent.Icon size={18} color="white" />
                                            </div>
                                            <span className="aig-task-name" style={{ color: agent.bg }}>
                                                {['Inventory Analysis', 'Sales Analysis', 'Pricing Analysis', 'Co-Pilot Synthesis'][i] || `Agent ${i + 1}`}
                                            </span>
                                        </div>
                                        <div className="aig-task-body">{task.output}</div>
                                    </div>
                                );
                            })}
                    </div>
                ) : (
                    <div className="aig-empty">
                        <div className="aig-empty-icon"><BarChart3 size={52} color="var(--text-secondary)" /></div>
                        <h3>{selectedAgent !== null ? 'No Output for This Agent' : 'No Agent Outputs'}</h3>
                        <p>Run an analysis to see detailed outputs from each AI agent.</p>
                    </div>
                )
            ) : activeTab === 'history' ? (
                history.length > 0 ? (
                    <div className="aig-hist">
                        {history.map((entry, i) => (
                            <div
                                key={i}
                                className="aig-hist-item"
                                onClick={() => { setSelectedBrief(entry.daily_brief); setActiveTab('brief'); }}
                            >
                                <div>
                                    <div className="aig-hist-title">
                                        <span>Run #{entry.id}</span>
                                        <span style={{ color: 'var(--text-secondary)', fontWeight: 500, fontSize: 12 }}>
                                            {formatTime(entry.timestamp)}
                                        </span>
                                    </div>
                                    <div className="aig-hist-preview">
                                        {entry.daily_brief ? entry.daily_brief.substring(0, 130) + '...' : 'No brief generated'}
                                    </div>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                    <span className={`aig-badge ${entry.success ? 'ok' : 'err'}`}>
                                        {entry.success ? <><CheckCircle2 size={12} /> Success</> : 'Failed'}
                                    </span>
                                    <ChevronRight size={16} color="var(--text-secondary)" />
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="aig-empty">
                        <div className="aig-empty-icon"><Clock size={52} color="var(--text-secondary)" /></div>
                        <h3>No History Yet</h3>
                        <p>Past analysis runs will appear here.</p>
                    </div>
                )
            ) : null}
        </AppLayout>
    );
}

export default AgentInsights;
