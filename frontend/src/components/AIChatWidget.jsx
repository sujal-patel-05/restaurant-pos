import React, { useState } from 'react';
import { aiAPI } from '../services/api';

export function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([{
        role: 'assistant',
        content: "👋 Hi! Ask me anything about your POS system.",
        timestamp: new Date()
    }]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);

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

    return (
        <>
            {/* Floating Chat Widget */}
            <div style={{
                position: 'fixed',
                bottom: isOpen ? '20px' : '20px',
                right: '20px',
                zIndex: 9999,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'flex-end',
                gap: 'var(--spacing-md)'
            }}>
                {/* Chat Window */}
                {isOpen && (
                    <div style={{
                        width: '400px',
                        height: '600px',
                        background: 'var(--bg-white)',
                        borderRadius: 'var(--radius-xl)',
                        boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        animation: 'slideUp 0.3s ease-out'
                    }}>
                        {/* Header */}
                        <div style={{
                            padding: 'var(--spacing-lg)',
                            background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                            color: 'white',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center'
                        }}>
                            <div>
                                <div style={{ fontSize: 'var(--font-size-lg)', fontWeight: 700 }}>🤖 Ask AI</div>
                                <div style={{ fontSize: 'var(--font-size-xs)', opacity: 0.9 }}>Your POS Assistant</div>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                style={{
                                    background: 'rgba(255,255,255,0.2)',
                                    border: 'none',
                                    color: 'white',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    cursor: 'pointer',
                                    fontSize: '18px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}
                            >
                                ×
                            </button>
                        </div>

                        {/* Messages */}
                        <div style={{
                            flex: 1,
                            overflowY: 'auto',
                            padding: 'var(--spacing-lg)',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: 'var(--spacing-md)',
                            background: 'var(--bg-main)'
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
                                        maxWidth: '80%',
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        borderRadius: 'var(--radius-md)',
                                        background: msg.role === 'user'
                                            ? 'linear-gradient(135deg, var(--primary), var(--primary-dark))'
                                            : 'var(--bg-white)',
                                        color: msg.role === 'user' ? 'white' : 'var(--text-primary)',
                                        boxShadow: 'var(--shadow-sm)',
                                        whiteSpace: 'pre-wrap',
                                        wordBreak: 'break-word',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        {msg.content}
                                    </div>
                                </div>
                            ))}
                            {loading && (
                                <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                                    <div style={{
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        borderRadius: 'var(--radius-md)',
                                        background: 'var(--bg-white)',
                                        boxShadow: 'var(--shadow-sm)',
                                        fontSize: 'var(--font-size-sm)'
                                    }}>
                                        <span className="loading-dots">Thinking</span>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Input */}
                        <div style={{
                            padding: 'var(--spacing-md)',
                            borderTop: '1px solid var(--border-light)',
                            background: 'var(--bg-white)'
                        }}>
                            <div style={{ display: 'flex', gap: 'var(--spacing-sm)' }}>
                                <input
                                    type="text"
                                    value={inputMessage}
                                    onChange={(e) => setInputMessage(e.target.value)}
                                    onKeyPress={handleKeyPress}
                                    placeholder="Ask me anything..."
                                    style={{
                                        flex: 1,
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        fontSize: 'var(--font-size-sm)',
                                        border: '1px solid var(--border-light)',
                                        borderRadius: 'var(--radius-md)',
                                        outline: 'none'
                                    }}
                                    disabled={loading}
                                />
                                <button
                                    onClick={handleSend}
                                    disabled={loading || !inputMessage.trim()}
                                    style={{
                                        padding: 'var(--spacing-sm) var(--spacing-md)',
                                        background: 'var(--primary)',
                                        color: 'white',
                                        border: 'none',
                                        borderRadius: 'var(--radius-md)',
                                        cursor: loading || !inputMessage.trim() ? 'not-allowed' : 'pointer',
                                        opacity: loading || !inputMessage.trim() ? 0.5 : 1,
                                        fontSize: 'var(--font-size-sm)',
                                        fontWeight: 600
                                    }}
                                >
                                    Send
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Toggle Button */}
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    style={{
                        width: '60px',
                        height: '60px',
                        borderRadius: '50%',
                        background: 'linear-gradient(135deg, var(--primary), var(--primary-dark))',
                        border: 'none',
                        color: 'white',
                        fontSize: '28px',
                        cursor: 'pointer',
                        boxShadow: '0 4px 20px rgba(246, 48, 73, 0.4)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.3s ease',
                        transform: isOpen ? 'rotate(0deg)' : 'rotate(0deg)'
                    }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.transform = 'scale(1.1)';
                        e.currentTarget.style.boxShadow = '0 6px 30px rgba(246, 48, 73, 0.5)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'scale(1)';
                        e.currentTarget.style.boxShadow = '0 4px 20px rgba(246, 48, 73, 0.4)';
                    }}
                >
                    {isOpen ? '×' : '🤖'}
                </button>
            </div>

            {/* Animations */}
            <style>{`
                @keyframes slideUp {
                    from {
                        opacity: 0;
                        transform: translateY(20px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }
                
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
        </>
    );
}
