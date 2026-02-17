import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '../components/AppLayout';
import { aiAPI } from '../services/api';
import ChatMessage from '../components/ChatMessage';
import {
    Brain,
    Send,
    Sparkles,
    TrendingUp,
    Package,
    ShoppingCart,
    UtensilsCrossed,
    Trash2,
    MessageSquare,
    RotateCcw,
    ChevronDown,
    Zap,
    PanelLeftClose,
    PanelLeftOpen,
    Plus,
    Clock,
    X
} from 'lucide-react';

function AskAI() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const [showScrollBtn, setShowScrollBtn] = useState(false);
    const [sidebarOpen, setSidebarOpen] = useState(true);
    const [conversations, setConversations] = useState([]);
    const [loadingHistory, setLoadingHistory] = useState(false);
    const messagesEndRef = useRef(null);
    const chatContainerRef = useRef(null);
    const inputRef = useRef(null);

    const scrollToBottom = (smooth = true) => {
        messagesEndRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' });
    };

    useEffect(() => { scrollToBottom(); }, [messages]);

    // Fetch conversations on mount
    useEffect(() => { fetchConversations(); }, []);

    useEffect(() => {
        const container = chatContainerRef.current;
        if (!container) return;
        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            setShowScrollBtn(scrollHeight - scrollTop - clientHeight > 150);
        };
        container.addEventListener('scroll', handleScroll);
        return () => container.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => { inputRef.current?.focus(); }, []);

    const fetchConversations = async () => {
        try {
            const res = await aiAPI.getConversations();
            setConversations(res.data.conversations || []);
        } catch (err) {
            console.error('Failed to fetch conversations:', err);
        }
    };

    const loadConversation = async (convId) => {
        if (convId === conversationId) return;
        setLoadingHistory(true);
        try {
            const res = await aiAPI.getHistory(convId);
            const loadedMessages = (res.data.messages || []).map(m => ({
                role: m.role,
                content: m.content,
                timestamp: new Date(m.timestamp)
            }));
            setMessages(loadedMessages);
            setConversationId(convId);
        } catch (err) {
            console.error('Failed to load conversation:', err);
        } finally {
            setLoadingHistory(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const deleteConversation = async (convId, e) => {
        e.stopPropagation();
        try {
            await aiAPI.deleteConversation(convId);
            setConversations(prev => prev.filter(c => c.conversation_id !== convId));
            if (conversationId === convId) {
                setMessages([]);
                setConversationId(null);
            }
        } catch (err) {
            console.error('Failed to delete conversation:', err);
        }
    };

    const handleSend = async () => {
        if (!inputMessage.trim() || loading) return;

        const userMessage = { role: 'user', content: inputMessage, timestamp: new Date() };
        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputMessage;
        setInputMessage('');
        setLoading(true);

        try {
            const response = await aiAPI.sendMessage(currentInput, conversationId);

            if (!conversationId) {
                setConversationId(response.data.conversation_id);
            }

            setMessages(prev => [...prev, {
                role: 'assistant',
                content: response.data.message,
                chartData: response.data.chart_data,
                intent: response.data.intent?.intent_type,
                timestamp: new Date(response.data.timestamp)
            }]);

            // Refresh sidebar after sending
            fetchConversations();
        } catch (error) {
            console.error('Error sending message:', error);
            setMessages(prev => [...prev, {
                role: 'assistant',
                content: 'Sorry, I encountered an error processing your request. Please try again.',
                timestamp: new Date(),
                isError: true
            }]);
        } finally {
            setLoading(false);
            setTimeout(() => inputRef.current?.focus(), 100);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    };

    const handleNewChat = () => {
        setMessages([]);
        setConversationId(null);
        setInputMessage('');
        inputRef.current?.focus();
    };

    const featureCards = [
        { icon: <TrendingUp size={20} />, title: 'Sales Analytics', desc: 'Revenue, trends, peak hours', q: "What are today's total sales?", color: '#6366f1' },
        { icon: <Package size={20} />, title: 'Inventory Status', desc: 'Stock levels, low alerts', q: 'Which items are running low in stock?', color: '#f59e0b' },
        { icon: <ShoppingCart size={20} />, title: 'Order Tracking', desc: 'Status, history, details', q: 'Show me all pending orders', color: '#10b981' },
        { icon: <UtensilsCrossed size={20} />, title: 'Menu Intelligence', desc: 'Prices, availability, popular', q: "What's on the menu with prices?", color: '#ec4899' },
        { icon: <Trash2 size={20} />, title: 'Wastage Report', desc: 'Food waste, cost impact', q: 'What was the wastage this week?', color: '#ef4444' },
        { icon: <Sparkles size={20} />, title: 'Smart Insights', desc: 'AI-powered recommendations', q: 'Give me a business summary for this week', color: '#8b5cf6' },
    ];

    const contextChips = [
        "What's our average order value?",
        "Show top 5 selling items",
        "Revenue comparison: today vs yesterday",
        "Any items expiring soon?",
        "What's the busiest hour today?",
        "Total orders this week",
    ];

    const isEmptyChat = messages.length === 0;

    const formatTimeAgo = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        const now = new Date();
        const diffMs = now - d;
        const diffMin = Math.floor(diffMs / 60000);
        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        const diffHr = Math.floor(diffMin / 60);
        if (diffHr < 24) return `${diffHr}h ago`;
        const diffDay = Math.floor(diffHr / 24);
        if (diffDay < 7) return `${diffDay}d ago`;
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
    };

    return (
        <AppLayout title="Ask AI" subtitle="Your intelligent POS co-pilot">
            <style>{`
                .aai-layout { display: flex; height: calc(100vh - 140px); gap: 0; border-radius: 16px; overflow: hidden; border: 1px solid var(--border-color); box-shadow: 0 8px 32px rgba(0,0,0,0.12); }

                /* Sidebar */
                .aai-sidebar {
                    width: 280px; min-width: 280px; background: var(--card-bg);
                    border-right: 1px solid var(--border-color);
                    display: flex; flex-direction: column;
                    transition: all 0.3s cubic-bezier(0.4,0,0.2,1);
                    overflow: hidden;
                }
                .aai-sidebar.collapsed { width: 0; min-width: 0; border-right: none; }
                .aai-sidebar-header {
                    padding: 16px; display: flex; align-items: center; justify-content: space-between;
                    border-bottom: 1px solid var(--border-color); flex-shrink: 0;
                }
                .aai-sidebar-title { font-size: 0.82rem; font-weight: 700; color: var(--text-main); white-space: nowrap; }
                .aai-new-btn {
                    padding: 7px 12px; border-radius: 10px; font-size: 0.72rem; font-weight: 600;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6); color: white;
                    border: none; cursor: pointer; display: flex; align-items: center; gap: 5px;
                    transition: all 0.2s; white-space: nowrap;
                }
                .aai-new-btn:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(99,102,241,0.35); }
                .aai-conv-list { flex: 1; overflow-y: auto; padding: 8px; }
                .aai-conv-list::-webkit-scrollbar { width: 4px; }
                .aai-conv-list::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }
                .aai-conv-item {
                    padding: 10px 12px; border-radius: 10px; cursor: pointer;
                    display: flex; align-items: center; gap: 10px;
                    transition: all 0.15s; margin-bottom: 2px; position: relative;
                    border: 1px solid transparent;
                }
                .aai-conv-item:hover { background: rgba(255,255,255,0.04); }
                .aai-conv-item.active { background: rgba(99,102,241,0.1); border-color: rgba(99,102,241,0.2); }
                .aai-conv-icon {
                    width: 32px; height: 32px; border-radius: 9px; flex-shrink: 0;
                    background: rgba(99,102,241,0.1); display: flex; align-items: center; justify-content: center;
                    color: #818cf8;
                }
                .aai-conv-item.active .aai-conv-icon { background: rgba(99,102,241,0.2); }
                .aai-conv-info { flex: 1; min-width: 0; }
                .aai-conv-title {
                    font-size: 0.78rem; font-weight: 600; color: var(--text-main);
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
                }
                .aai-conv-meta { font-size: 0.65rem; color: var(--text-secondary); margin-top: 2px; display: flex; align-items: center; gap: 4px; }
                .aai-conv-del {
                    opacity: 0; position: absolute; right: 8px; top: 50%; transform: translateY(-50%);
                    background: rgba(239,68,68,0.1); border: none; border-radius: 6px; cursor: pointer;
                    padding: 4px; color: #ef4444; transition: all 0.15s; display: flex;
                }
                .aai-conv-item:hover .aai-conv-del { opacity: 0.6; }
                .aai-conv-del:hover { opacity: 1 !important; background: rgba(239,68,68,0.2); }
                .aai-sidebar-empty {
                    padding: 24px 16px; text-align: center; color: var(--text-secondary);
                    font-size: 0.78rem; opacity: 0.6;
                }

                /* Main container */
                .aai-container { display: flex; flex-direction: column; flex: 1; overflow: hidden; background: var(--card-bg); }

                /* Header */
                .aai-header {
                    display: flex; align-items: center; justify-content: space-between;
                    padding: 14px 20px;
                    background: linear-gradient(135deg, rgba(99,102,241,0.08), rgba(139,92,246,0.06));
                    border-bottom: 1px solid var(--border-color); flex-shrink: 0;
                }
                .aai-header-left { display: flex; align-items: center; gap: 10px; }
                .aai-toggle-btn {
                    width: 34px; height: 34px; border-radius: 10px; border: 1px solid var(--border-color);
                    background: rgba(255,255,255,0.03); cursor: pointer; display: flex;
                    align-items: center; justify-content: center; color: var(--text-secondary);
                    transition: all 0.2s; flex-shrink: 0;
                }
                .aai-toggle-btn:hover { background: rgba(99,102,241,0.1); color: #818cf8; border-color: rgba(99,102,241,0.2); }
                .aai-brain-icon {
                    width: 38px; height: 38px; border-radius: 12px;
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                    display: flex; align-items: center; justify-content: center;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.35);
                    animation: brainPulse 3s ease-in-out infinite;
                }
                @keyframes brainPulse { 0%,100% { box-shadow: 0 4px 14px rgba(99,102,241,0.35); } 50% { box-shadow: 0 4px 24px rgba(139,92,246,0.55); } }
                .aai-title { font-size: 1.05rem; font-weight: 800; letter-spacing: -0.3px; color: var(--text-main); }
                .aai-subtitle { font-size: 0.68rem; color: var(--text-secondary); display: flex; align-items: center; gap: 5px; }
                .aai-status-dot { width: 6px; height: 6px; border-radius: 50%; background: #22c55e; animation: statusBlink 2s ease-in-out infinite; }
                .aai-status-dot.thinking { background: #f59e0b; animation: statusBlink 0.6s ease-in-out infinite; }
                @keyframes statusBlink { 0%,100% { opacity: 1; } 50% { opacity: 0.4; } }
                .aai-model-badge {
                    padding: 3px 10px; border-radius: 8px; font-size: 10px; font-weight: 700;
                    background: rgba(99,102,241,0.1); color: #818cf8;
                    border: 1px solid rgba(99,102,241,0.15); letter-spacing: 0.5px;
                }

                /* Chat area */
                .aai-chat-area {
                    flex: 1; overflow-y: auto; padding: 20px;
                    display: flex; flex-direction: column; gap: 4px; position: relative;
                }
                .aai-chat-area::-webkit-scrollbar { width: 4px; }
                .aai-chat-area::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.08); border-radius: 10px; }

                /* Welcome */
                .aai-welcome { display: flex; flex-direction: column; align-items: center; justify-content: center; flex: 1; padding: 16px; }
                .aai-welcome-icon {
                    width: 64px; height: 64px; border-radius: 20px;
                    background: linear-gradient(135deg, #6366f1, #a855f7);
                    display: flex; align-items: center; justify-content: center;
                    margin-bottom: 16px; box-shadow: 0 8px 32px rgba(99,102,241,0.3);
                    animation: welcomeFloat 4s ease-in-out infinite;
                }
                @keyframes welcomeFloat { 0%,100% { transform: translateY(0); } 50% { transform: translateY(-8px); } }
                .aai-welcome-title { font-size: 1.4rem; font-weight: 800; letter-spacing: -0.5px; margin-bottom: 6px; color: var(--text-main); }
                .aai-welcome-sub { font-size: 0.82rem; color: var(--text-secondary); margin-bottom: 24px; text-align: center; max-width: 400px; }

                /* Feature cards */
                .aai-features { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; width: 100%; max-width: 560px; }
                @media (max-width: 768px) { .aai-features { grid-template-columns: repeat(2, 1fr); } .aai-sidebar { width: 240px; min-width: 240px; } }
                @media (max-width: 600px) { .aai-sidebar { width: 0; min-width: 0; border-right: none; } }
                .aai-feat-card {
                    padding: 12px; border-radius: 12px; cursor: pointer;
                    background: rgba(255,255,255,0.03); border: 1px solid var(--border-color);
                    transition: all 0.25s; text-align: left;
                }
                .aai-feat-card:hover {
                    background: rgba(99,102,241,0.06); border-color: rgba(99,102,241,0.2);
                    transform: translateY(-2px); box-shadow: 0 6px 16px rgba(0,0,0,0.08);
                }
                .aai-feat-icon {
                    width: 32px; height: 32px; border-radius: 9px;
                    display: flex; align-items: center; justify-content: center; margin-bottom: 8px;
                }
                .aai-feat-title { font-size: 0.78rem; font-weight: 700; color: var(--text-main); margin-bottom: 2px; }
                .aai-feat-desc { font-size: 0.65rem; color: var(--text-secondary); }

                /* Typing */
                .aai-typing {
                    display: flex; align-items: center; gap: 8px;
                    padding: 12px 16px; border-radius: 14px 14px 14px 4px;
                    background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.06); max-width: 100px;
                }
                .aai-typing-dots { display: flex; gap: 4px; }
                .aai-typing-dot {
                    width: 6px; height: 6px; border-radius: 50%;
                    background: #818cf8; animation: typingBounce 1.4s ease-in-out infinite;
                }
                .aai-typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .aai-typing-dot:nth-child(3) { animation-delay: 0.4s; }
                @keyframes typingBounce { 0%,60%,100% { transform: translateY(0); opacity: 0.4; } 30% { transform: translateY(-7px); opacity: 1; } }

                .aai-scroll-btn {
                    position: absolute; bottom: 8px; left: 50%; transform: translateX(-50%);
                    width: 34px; height: 34px; border-radius: 50%;
                    background: var(--card-bg); border: 1px solid var(--border-color);
                    display: flex; align-items: center; justify-content: center;
                    cursor: pointer; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                    transition: all 0.2s; z-index: 10; color: var(--text-secondary);
                }
                .aai-scroll-btn:hover { background: rgba(99,102,241,0.1); color: #818cf8; }

                /* Chips */
                .aai-chips {
                    padding: 8px 20px; display: flex; gap: 6px; overflow-x: auto;
                    border-top: 1px solid var(--border-color); flex-shrink: 0;
                }
                .aai-chips::-webkit-scrollbar { height: 0; }
                .aai-chip {
                    padding: 5px 12px; border-radius: 18px; font-size: 0.7rem; font-weight: 500;
                    background: rgba(255,255,255,0.04); border: 1px solid var(--border-color);
                    color: var(--text-secondary); cursor: pointer; white-space: nowrap; transition: all 0.2s;
                }
                .aai-chip:hover { background: rgba(99,102,241,0.08); color: #818cf8; border-color: rgba(99,102,241,0.2); }

                /* Input */
                .aai-input-area { padding: 14px 20px; border-top: 1px solid var(--border-color); flex-shrink: 0; }
                .aai-input-row { display: flex; gap: 8px; align-items: center; }
                .aai-input {
                    flex: 1; padding: 12px 16px; font-size: 0.9rem;
                    border-radius: 12px; border: 1.5px solid var(--border-color);
                    background: var(--bg-main); color: var(--text-main);
                    transition: all 0.25s; outline: none; font-family: inherit;
                }
                .aai-input:focus { border-color: #6366f1; box-shadow: 0 0 0 3px rgba(99,102,241,0.12); }
                .aai-input::placeholder { color: var(--text-secondary); opacity: 0.6; }
                .aai-send-btn {
                    width: 44px; height: 44px; border-radius: 12px;
                    background: linear-gradient(135deg, #6366f1, #8b5cf6);
                    border: none; cursor: pointer; display: flex;
                    align-items: center; justify-content: center;
                    transition: all 0.25s; flex-shrink: 0;
                    box-shadow: 0 4px 14px rgba(99,102,241,0.3);
                }
                .aai-send-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 6px 20px rgba(99,102,241,0.45); }
                .aai-send-btn:disabled { opacity: 0.4; cursor: not-allowed; transform: none; }
                .aai-hint { font-size: 0.62rem; color: var(--text-secondary); opacity: 0.5; text-align: center; margin-top: 6px; }

                @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

                .aai-loading-overlay {
                    display: flex; align-items: center; justify-content: center;
                    flex: 1; color: var(--text-secondary); font-size: 0.85rem; gap: 8px;
                }
            `}</style>

            <div className="aai-layout">
                {/* Sidebar — Chat History */}
                <div className={`aai-sidebar ${sidebarOpen ? '' : 'collapsed'}`}>
                    <div className="aai-sidebar-header">
                        <span className="aai-sidebar-title">Chat History</span>
                        <button className="aai-new-btn" onClick={handleNewChat}>
                            <Plus size={13} /> New
                        </button>
                    </div>
                    <div className="aai-conv-list">
                        {conversations.length === 0 ? (
                            <div className="aai-sidebar-empty">
                                <MessageSquare size={24} style={{ margin: '0 auto 8px', display: 'block', opacity: 0.4 }} />
                                No conversations yet.
                                <br />Start chatting to see history here.
                            </div>
                        ) : (
                            conversations.map((conv) => (
                                <div
                                    key={conv.conversation_id}
                                    className={`aai-conv-item ${conversationId === conv.conversation_id ? 'active' : ''}`}
                                    onClick={() => loadConversation(conv.conversation_id)}
                                >
                                    <div className="aai-conv-icon">
                                        <MessageSquare size={15} />
                                    </div>
                                    <div className="aai-conv-info">
                                        <div className="aai-conv-title">{conv.title}</div>
                                        <div className="aai-conv-meta">
                                            <MessageSquare size={10} />
                                            <span>{conv.message_count} msgs</span>
                                        </div>
                                    </div>
                                    <button
                                        className="aai-conv-del"
                                        onClick={(e) => deleteConversation(conv.conversation_id, e)}
                                        title="Delete conversation"
                                    >
                                        <X size={12} />
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Main Chat */}
                <div className="aai-container">
                    {/* Header */}
                    <div className="aai-header">
                        <div className="aai-header-left">
                            <button className="aai-toggle-btn" onClick={() => setSidebarOpen(!sidebarOpen)} title={sidebarOpen ? 'Hide sidebar' : 'Show sidebar'}>
                                {sidebarOpen ? <PanelLeftClose size={16} /> : <PanelLeftOpen size={16} />}
                            </button>
                            <div className="aai-brain-icon">
                                <Brain size={20} color="white" />
                            </div>
                            <div>
                                <div className="aai-title">SujalPOS AI</div>
                                <div className="aai-subtitle">
                                    <span className={`aai-status-dot ${loading ? 'thinking' : ''}`}></span>
                                    {loading ? 'Analyzing...' : 'Online'}
                                </div>
                            </div>
                        </div>
                        <span className="aai-model-badge">
                            <Zap size={9} style={{ marginRight: 3, verticalAlign: 'middle' }} />
                            LLAMA 3.3 70B
                        </span>
                    </div>

                    {/* Chat Messages */}
                    <div className="aai-chat-area" ref={chatContainerRef}>
                        {loadingHistory ? (
                            <div className="aai-loading-overlay">
                                <div className="aai-typing-dots" style={{ display: 'flex', gap: 4 }}>
                                    <div className="aai-typing-dot"></div>
                                    <div className="aai-typing-dot"></div>
                                    <div className="aai-typing-dot"></div>
                                </div>
                                Loading conversation...
                            </div>
                        ) : isEmptyChat ? (
                            <div className="aai-welcome">
                                <div className="aai-welcome-icon">
                                    <Brain size={32} color="white" />
                                </div>
                                <div className="aai-welcome-title">Ask me anything</div>
                                <div className="aai-welcome-sub">
                                    I'm your AI-powered restaurant co-pilot. Analyze sales, track inventory, manage orders, and get smart business insights.
                                </div>
                                <div className="aai-features">
                                    {featureCards.map((card, i) => (
                                        <div
                                            key={i}
                                            className="aai-feat-card"
                                            onClick={() => { setInputMessage(card.q); inputRef.current?.focus(); }}
                                            style={{ animationDelay: `${i * 50}ms`, animation: 'fadeInUp 0.4s ease-out forwards' }}
                                        >
                                            <div className="aai-feat-icon" style={{ background: `${card.color}15`, color: card.color }}>
                                                {card.icon}
                                            </div>
                                            <div className="aai-feat-title">{card.title}</div>
                                            <div className="aai-feat-desc">{card.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ) : (
                            <>
                                {messages.map((msg, index) => (
                                    <ChatMessage key={index} message={msg} />
                                ))}
                                {loading && (
                                    <div style={{ animation: 'fadeInUp 0.3s ease-out' }}>
                                        <div className="aai-typing">
                                            <div className="aai-typing-dots">
                                                <div className="aai-typing-dot"></div>
                                                <div className="aai-typing-dot"></div>
                                                <div className="aai-typing-dot"></div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                        <div ref={messagesEndRef} />
                        {showScrollBtn && (
                            <button className="aai-scroll-btn" onClick={() => scrollToBottom()}>
                                <ChevronDown size={16} />
                            </button>
                        )}
                    </div>

                    {/* Context Chips */}
                    {messages.length >= 2 && !loading && (
                        <div className="aai-chips">
                            {contextChips.map((chip, i) => (
                                <button key={i} className="aai-chip" onClick={() => { setInputMessage(chip); inputRef.current?.focus(); }}>
                                    {chip}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* Input */}
                    <div className="aai-input-area">
                        <div className="aai-input-row">
                            <input
                                ref={inputRef}
                                type="text"
                                value={inputMessage}
                                onChange={(e) => setInputMessage(e.target.value)}
                                onKeyDown={handleKeyPress}
                                placeholder="Ask about sales, inventory, orders, menu..."
                                className="aai-input"
                                disabled={loading}
                            />
                            <button onClick={handleSend} className="aai-send-btn" disabled={loading || !inputMessage.trim()}>
                                <Send size={18} color="white" />
                            </button>
                        </div>
                        <div className="aai-hint">Press Enter to send</div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}

export default AskAI;
