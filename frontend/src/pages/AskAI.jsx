import React, { useState, useEffect, useRef } from 'react';
import { AppLayout } from '../components/AppLayout';
import { aiAPI } from '../services/api';

function AskAI() {
    const [messages, setMessages] = useState([]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Add welcome message on mount
    useEffect(() => {
        setMessages([{
            role: 'assistant',
            content: "👋 Hello! I'm your POS assistant. I can help you with:\n\n• Sales reports\n• Inventory status\n• Order tracking\n• Menu information\n• Wastage analysis\n\nJust ask me a question!",
            timestamp: new Date()
        }]);
    }, []);

    const handleSend = async () => {
        if (!inputMessage.trim()) return;

        const userMessage = {
            role: 'user',
            content: inputMessage,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setLoading(true);

        try {
            const response = await aiAPI.sendMessage(inputMessage, conversationId);

            if (!conversationId) {
                setConversationId(response.data.conversation_id);
            }

            const assistantMessage = {
                role: 'assistant',
                content: response.data.message,
                timestamp: new Date(response.data.timestamp)
            };

            setMessages(prev => [...prev, assistantMessage]);
        } catch (error) {
            console.error('Error sending message:', error);
            const errorMessage = {
                role: 'assistant',
                content: '❌ Sorry, I encountered an error. Please try again.',
                timestamp: new Date()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setLoading(false);
        }
    };

    const handleKeyPress = (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const quickQuestions = [
        "What are today's sales?",
        "Which items are low in stock?",
        "Show me pending orders",
        "What's on the menu?"
    ];

    const handleQuickQuestion = (question) => {
        setInputMessage(question);
    };

    return (
        <AppLayout
            title="Ask AI"
            subtitle="Your intelligent POS assistant"
        >
            <div className="stat-card" style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 200px)',
                overflow: 'hidden',
                padding: 0
            }}>
                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: '2rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '1rem',
                    background: 'linear-gradient(180deg, var(--card-bg) 0%, var(--bg-main) 100%)'
                }}>
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            className="fade-in-up"
                            style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start',
                                animationDelay: `${index * 50}ms`
                            }}
                        >
                            <div style={{
                                maxWidth: '75%',
                                padding: '1rem 1.25rem',
                                borderRadius: '1rem',
                                background: msg.role === 'user'
                                    ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
                                    : 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: msg.role === 'assistant' ? 'blur(10px)' : 'none',
                                border: msg.role === 'assistant' ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
                                color: msg.role === 'user' ? 'white' : 'var(--text-main)',
                                boxShadow: msg.role === 'user'
                                    ? '0 4px 12px rgba(99, 102, 241, 0.3)'
                                    : '0 4px 12px rgba(0, 0, 0, 0.1)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word',
                                fontSize: '0.95rem',
                                lineHeight: '1.6'
                            }}>
                                {msg.content}
                                <div style={{
                                    fontSize: '0.75rem',
                                    marginTop: '0.5rem',
                                    opacity: 0.7,
                                    fontWeight: 500
                                }}>
                                    {new Date(msg.timestamp).toLocaleTimeString('en-IN', {
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{
                                padding: '1rem 1.25rem',
                                borderRadius: '1rem',
                                background: 'rgba(255, 255, 255, 0.05)',
                                backdropFilter: 'blur(10px)',
                                border: '1px solid rgba(255, 255, 255, 0.1)',
                                boxShadow: '0 4px 12px rgba(0, 0, 0, 0.1)',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '0.5rem'
                            }}>
                                <div className="loading-spinner" style={{
                                    width: '16px',
                                    height: '16px',
                                    border: '2px solid rgba(99, 102, 241, 0.3)',
                                    borderTopColor: '#6366F1',
                                    borderRadius: '50%',
                                    animation: 'spin 0.8s linear infinite'
                                }}></div>
                                <span style={{ color: 'var(--text-secondary)' }}>Thinking...</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Questions */}
                {messages.length === 1 && (
                    <div style={{
                        padding: '1rem 2rem',
                        borderTop: '1px solid var(--border-color)',
                        background: 'var(--card-bg)'
                    }}>
                        <div style={{
                            fontSize: '0.875rem',
                            marginBottom: '0.75rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 600
                        }}>
                            Quick questions:
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                            {quickQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickQuestion(q)}
                                    className="btn btn-secondary"
                                    style={{
                                        fontSize: '0.875rem',
                                        padding: '0.5rem 1rem',
                                        borderRadius: '0.5rem',
                                        transition: 'all 0.2s ease'
                                    }}
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div style={{
                    padding: '1.5rem 2rem',
                    borderTop: '1px solid var(--border-color)',
                    background: 'var(--card-bg)',
                    backdropFilter: 'blur(10px)'
                }}>
                    <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything about your POS..."
                            className="input"
                            style={{
                                flex: 1,
                                padding: '0.875rem 1.25rem',
                                fontSize: '0.95rem',
                                borderRadius: '0.75rem',
                                border: '1px solid var(--border-color)',
                                background: 'var(--bg-main)',
                                color: 'var(--text-main)',
                                transition: 'all 0.2s ease'
                            }}
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            className="btn btn-primary"
                            disabled={loading || !inputMessage.trim()}
                            style={{
                                padding: '0.875rem 2rem',
                                minWidth: '100px',
                                borderRadius: '0.75rem',
                                fontSize: '0.95rem',
                                fontWeight: 600,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '0.5rem',
                                transition: 'all 0.2s ease'
                            }}
                        >
                            {loading ? (
                                <>
                                    <div className="loading-spinner" style={{
                                        width: '14px',
                                        height: '14px',
                                        border: '2px solid rgba(255, 255, 255, 0.3)',
                                        borderTopColor: 'white',
                                        borderRadius: '50%',
                                        animation: 'spin 0.8s linear infinite'
                                    }}></div>
                                    Sending
                                </>
                            ) : (
                                <>
                                    <span>Send</span>
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes spin {
                    to { transform: rotate(360deg); }
                }
                
                .input:focus {
                    outline: none;
                    border-color: var(--primary);
                    box-shadow: 0 0 0 3px rgba(99, 102, 241, 0.1);
                }
                
                .btn:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
            `}</style>
        </AppLayout>
    );
}

export default AskAI;
