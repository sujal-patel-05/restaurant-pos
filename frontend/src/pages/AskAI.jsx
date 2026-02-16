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
            <div style={{
                display: 'flex',
                flexDirection: 'column',
                height: 'calc(100vh - 180px)',
                background: 'var(--bg-white)',
                borderRadius: 'var(--radius-xl)',
                boxShadow: 'var(--shadow-lg)',
                overflow: 'hidden'
            }}>
                {/* Messages Area */}
                <div style={{
                    flex: 1,
                    overflowY: 'auto',
                    padding: 'var(--spacing-xl)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 'var(--spacing-lg)'
                }}>
                    {messages.map((msg, index) => (
                        <div
                            key={index}
                            style={{
                                display: 'flex',
                                justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start'
                            }}
                        >
                            <div style={{
                                maxWidth: '70%',
                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)',
                                background: msg.role === 'user'
                                    ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
                                    : 'var(--bg-main)',
                                color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                boxShadow: 'var(--shadow-sm)',
                                whiteSpace: 'pre-wrap',
                                wordBreak: 'break-word'
                            }}>
                                {msg.content}
                                <div style={{
                                    fontSize: 'var(--font-size-xs)',
                                    marginTop: 'var(--spacing-sm)',
                                    opacity: 0.7
                                }}>
                                    {new Date(msg.timestamp).toLocaleTimeString()}
                                </div>
                            </div>
                        </div>
                    ))}
                    {loading && (
                        <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                            <div style={{
                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                borderRadius: 'var(--radius-lg)',
                                background: 'var(--bg-main)',
                                boxShadow: 'var(--shadow-sm)'
                            }}>
                                <span className="loading-dots">Thinking</span>
                            </div>
                        </div>
                    )}
                    <div ref={messagesEndRef} />
                </div>

                {/* Quick Questions */}
                {messages.length === 1 && (
                    <div style={{
                        padding: 'var(--spacing-md) var(--spacing-xl)',
                        borderTop: '1px solid var(--border-light)',
                        background: 'var(--bg-main)'
                    }}>
                        <div style={{ fontSize: 'var(--font-size-sm)', marginBottom: 'var(--spacing-sm)', color: 'var(--text-secondary)' }}>
                            Quick questions:
                        </div>
                        <div style={{ display: 'flex', gap: 'var(--spacing-sm)', flexWrap: 'wrap' }}>
                            {quickQuestions.map((q, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleQuickQuestion(q)}
                                    className="btn btn-sm btn-secondary"
                                >
                                    {q}
                                </button>
                            ))}
                        </div>
                    </div>
                )}

                {/* Input Area */}
                <div style={{
                    padding: 'var(--spacing-lg) var(--spacing-xl)',
                    borderTop: '2px solid var(--border-light)',
                    background: 'var(--bg-white)'
                }}>
                    <div style={{ display: 'flex', gap: 'var(--spacing-md)' }}>
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Ask me anything about your POS..."
                            className="input"
                            style={{
                                flex: 1,
                                padding: 'var(--spacing-md) var(--spacing-lg)',
                                fontSize: 'var(--font-size-md)',
                                borderRadius: 'var(--radius-lg)'
                            }}
                            disabled={loading}
                        />
                        <button
                            onClick={handleSend}
                            className="btn btn-primary"
                            disabled={loading || !inputMessage.trim()}
                            style={{
                                padding: 'var(--spacing-md) var(--spacing-xl)',
                                minWidth: '100px'
                            }}
                        >
                            {loading ? '...' : 'Send'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Loading dots animation */}
            <style>{`
                .loading-dots::after {
                    content: '...';
                    animation: dots 1.5s steps(4, end) infinite;
                }
                @keyframes dots {
                    0%, 20% { content: '.'; }
                    40% { content: '..'; }
                    60%, 100% { content: '...'; }
                }
            `}</style>
        </AppLayout>
    );
}

export default AskAI;
