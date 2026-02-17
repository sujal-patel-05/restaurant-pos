import React, { useState, useRef, useEffect } from 'react';
import { aiAPI } from '../services/api';

export function AIChatWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [messages, setMessages] = useState([{
        role: 'assistant',
        content: "👋 Hi there! I'm your AI POS Assistant.\nAsk me about sales, inventory, or help with orders!",
        timestamp: new Date()
    }]);
    const [inputMessage, setInputMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [conversationId, setConversationId] = useState(null);
    const messagesEndRef = useRef(null);

    const suggestions = [
        "💰 Total sales today?",
        "📉 Which items are low in stock?",
        "🍔 What is the top selling item?",
        "📦 Show me pending orders"
    ];

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, isOpen]);

    const handleSend = async (messageOverride = null) => {
        const messageToSend = messageOverride || inputMessage;
        if (!messageToSend.trim()) return;

        const userMessage = {
            role: 'user',
            content: messageToSend,
            timestamp: new Date()
        };

        setMessages(prev => [...prev, userMessage]);
        setInputMessage('');
        setLoading(true);

        try {
            const response = await aiAPI.sendMessage(messageToSend, conversationId);

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
            {/* Widget Container - Fixed Position */}
            <div className="ai-widget-container">

                {/* Chat Window */}
                <div className={`ai-chat-window ${isOpen ? 'open' : ''}`}>
                    {/* Header */}
                    <div className="ai-header">
                        <div className="ai-header-content">
                            <div className="ai-avatar-container">
                                <span className="ai-avatar">🤖</span>
                                <span className="status-dot"></span>
                            </div>
                            <div className="ai-title-container">
                                <h3>Ask AI</h3>
                                <p>SujalPOS Assistant</p>
                            </div>
                        </div>
                        <button
                            className="close-button"
                            onClick={() => setIsOpen(false)}
                            aria-label="Close chat"
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="18" y1="6" x2="6" y2="18"></line>
                                <line x1="6" y1="6" x2="18" y2="18"></line>
                            </svg>
                        </button>
                    </div>

                    {/* Messages Area */}
                    <div className="ai-messages">
                        {messages.map((msg, index) => (
                            <div
                                key={index}
                                className={`message-row ${msg.role === 'user' ? 'user-row' : 'assistant-row'}`}
                            >
                                {msg.role === 'assistant' && (
                                    <div className="message-avatar">🤖</div>
                                )}
                                <div className={`message-bubble ${msg.role}`}>
                                    {msg.content}
                                    <div className="message-time">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                </div>
                            </div>
                        ))}

                        {loading && (
                            <div className="message-row assistant-row">
                                <div className="message-avatar">🤖</div>
                                <div className="message-bubble assistant loading">
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                    <span className="typing-dot"></span>
                                </div>
                            </div>
                        )}

                        {/* Suggestions (Only show if few messages) */}
                        {messages.length < 3 && !loading && (
                            <div className="suggestions-container">
                                {suggestions.map((question, idx) => (
                                    <button
                                        key={idx}
                                        className="suggestion-chip"
                                        onClick={() => handleSend(question)}
                                    >
                                        {question}
                                    </button>
                                ))}
                            </div>
                        )}

                        <div ref={messagesEndRef} />
                    </div>

                    {/* Input Area */}
                    <div className="ai-input-area">
                        <input
                            type="text"
                            value={inputMessage}
                            onChange={(e) => setInputMessage(e.target.value)}
                            onKeyPress={handleKeyPress}
                            placeholder="Type a message..."
                            disabled={loading}
                        />
                        <button
                            className={`send-button ${!inputMessage.trim() ? 'disabled' : ''}`}
                            onClick={() => handleSend()}
                            disabled={loading || !inputMessage.trim()}
                        >
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <line x1="22" y1="2" x2="11" y2="13"></line>
                                <polygon points="22 2 15 22 11 13 2 9 22 2"></polygon>
                            </svg>
                        </button>
                    </div>
                </div>

                {/* Toggle Button */}
                <button
                    className={`ai-toggle-button ${isOpen ? 'hidden' : ''}`}
                    onClick={() => setIsOpen(true)}
                    aria-label="Open AI Chat"
                >
                    <span className="toggle-icon">✨</span>
                    <span className="toggle-text">Ask AI</span>
                </button>
            </div>

            {/* Styles */}
            <style>{`
                .ai-widget-container {
                    position: fixed;
                    bottom: 2rem;
                    right: 2rem;
                    z-index: 9999;
                    font-family: 'Inter', sans-serif;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                }

                /* Toggle Button */
                .ai-toggle-button {
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: white;
                    border: none;
                    border-radius: 50px;
                    padding: 0.8rem 1.5rem;
                    font-size: 1rem;
                    font-weight: 600;
                    cursor: pointer;
                    box-shadow: 0 4px 15px rgba(79, 70, 229, 0.4);
                    transition: all 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                }

                .ai-toggle-button:hover {
                    box-shadow: 0 6px 20px rgba(79, 70, 229, 0.6);
                    transform: translateY(-2px);
                }

                .ai-toggle-button.hidden {
                    opacity: 0;
                    pointer-events: none;
                    transform: scale(0.8) translateY(20px);
                }

                /* Chat Window - WIDER & TALLER */
                .ai-chat-window {
                    width: 450px;
                    height: 700px;
                    max-height: 85vh;
                    background: rgba(255, 255, 255, 0.9);
                    backdrop-filter: blur(25px);
                    -webkit-backdrop-filter: blur(25px);
                    border: 1px solid rgba(255, 255, 255, 0.6);
                    border-radius: 24px;
                    box-shadow:
                        0 25px 60px rgba(0, 0, 0, 0.15),
                        0 0 0 1px rgba(255, 255, 255, 0.4) inset;
                    display: flex;
                    flex-direction: column;
                    overflow: hidden;
                    transform-origin: bottom right;
                    transition: all 0.4s cubic-bezier(0.19, 1, 0.22, 1);
                    opacity: 0;
                    transform: scale(0.9) translateY(20px);
                    pointer-events: none;
                    position: absolute;
                    bottom: 0;
                    right: 0;
                }

                .ai-chat-window.open {
                    opacity: 1;
                    transform: scale(1) translateY(0);
                    pointer-events: all;
                }

                /* Header */
                .ai-header {
                    padding: 1.5rem;
                    background: linear-gradient(135deg, rgba(99, 102, 241, 0.08), rgba(79, 70, 229, 0.08));
                    border-bottom: 1px solid rgba(99, 102, 241, 0.1);
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                }

                .ai-header-content {
                    display: flex;
                    align-items: center;
                    gap: 1rem;
                }

                .ai-avatar-container {
                    position: relative;
                    width: 48px;
                    height: 48px;
                    background: white;
                    border-radius: 14px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1.5rem;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.15);
                }

                .status-dot {
                    position: absolute;
                    bottom: -2px;
                    right: -2px;
                    width: 12px;
                    height: 12px;
                    background: #10b981;
                    border: 2px solid white;
                    border-radius: 50%;
                }

                .ai-title-container h3 {
                    margin: 0;
                    font-size: 1.1rem;
                    font-weight: 700;
                    color: #1e293b;
                    letter-spacing: -0.02em;
                }

                .ai-title-container p {
                    margin: 0;
                    font-size: 0.8rem;
                    color: #64748b;
                    font-weight: 500;
                }

                .close-button {
                    background: rgba(255,255,255,0.5);
                    border: 1px solid rgba(0,0,0,0.05);
                    color: #64748b;
                    cursor: pointer;
                    width: 32px;
                    height: 32px;
                    border-radius: 50%;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                }

                .close-button:hover {
                    background: #ef4444;
                    color: white;
                    border-color: #ef4444;
                    transform: rotate(90deg);
                }

                /* Messages */
                .ai-messages {
                    flex: 1;
                    padding: 1.5rem;
                    overflow-y: auto;
                    display: flex;
                    flex-direction: column;
                    gap: 1.25rem;
                    background: rgba(248, 250, 252, 0.3);
                }

                .message-row {
                    display: flex;
                    gap: 1rem;
                    align-items: flex-end;
                    animation: messageSlide 0.3s ease-out forwards;
                }

                .user-row {
                    flex-direction: row-reverse;
                }

                .message-avatar {
                    width: 32px;
                    height: 32px;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 1rem;
                    box-shadow: 0 2px 6px rgba(0,0,0,0.05);
                    border: 1px solid rgba(0,0,0,0.05);
                }

                .message-bubble {
                    max-width: 80%;
                    padding: 1rem 1.25rem;
                    border-radius: 20px;
                    font-size: 0.95rem;
                    line-height: 1.6;
                    position: relative;
                    box-shadow: 0 2px 8px rgba(0,0,0,0.04);
                }

                .message-bubble.assistant {
                    background: white;
                    color: #334155;
                    border-bottom-left-radius: 4px;
                }

                .message-bubble.user {
                    background: linear-gradient(135deg, #6366f1 0%, #4f46e5 100%);
                    color: white;
                    border-bottom-right-radius: 4px;
                }

                .message-time {
                    font-size: 0.7rem;
                    margin-top: 0.5rem;
                    opacity: 0.6;
                    text-align: right;
                }

                /* Suggestions */
                .suggestions-container {
                    display: grid;
                    grid-template-columns: 1fr 1fr;
                    gap: 0.75rem;
                    margin-top: 1rem;
                    animation: messageSlide 0.4s ease-out forwards;
                }

                .suggestion-chip {
                    background: white;
                    border: 1px solid rgba(99, 102, 241, 0.15);
                    padding: 0.75rem 1rem;
                    border-radius: 12px;
                    color: #475569;
                    font-size: 0.85rem;
                    font-weight: 500;
                    cursor: pointer;
                    transition: all 0.2s;
                    text-align: left;
                    display: flex;
                    align-items: center;
                    gap: 0.5rem;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.02);
                }

                .suggestion-chip:hover {
                    background: #f8fafc;
                    border-color: #6366f1;
                    color: #6366f1;
                    transform: translateY(-2px);
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.1);
                }

                /* Loading Dots */
                .loading-dots {
                    display: flex;
                    gap: 4px;
                    padding: 0.5rem 0.2rem;
                }

                .typing-dot {
                    width: 6px;
                    height: 6px;
                    background: #94a3b8;
                    border-radius: 50%;
                    animation: typing 1.4s infinite ease-in-out;
                }

                .typing-dot:nth-child(1) { animation-delay: 0s; }
                .typing-dot:nth-child(2) { animation-delay: 0.2s; }
                .typing-dot:nth-child(3) { animation-delay: 0.4s; }

                /* Input Area */
                .ai-input-area {
                    padding: 1.25rem;
                    background: white;
                    border-top: 1px solid rgba(0,0,0,0.05);
                    display: flex;
                    gap: 0.75rem;
                    align-items: center;
                }

                .ai-input-area input {
                    flex: 1;
                    padding: 0.9rem 1.25rem;
                    border-radius: 30px;
                    border: 1px solid #e2e8f0;
                    outline: none;
                    background: #f8fafc;
                    transition: all 0.2s;
                    font-size: 0.95rem;
                    box-shadow: inset 0 2px 4px rgba(0,0,0,0.02);
                }

                .ai-input-area input:focus {
                    border-color: #6366f1;
                    box-shadow: 0 0 0 4px rgba(99, 102, 241, 0.1);
                    background: white;
                }

                .send-button {
                    width: 46px;
                    height: 46px;
                    border-radius: 50%;
                    background: #6366f1;
                    color: white;
                    border: none;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    transition: all 0.2s;
                    box-shadow: 0 4px 12px rgba(99, 102, 241, 0.3);
                }

                .send-button:hover {
                    background: #4f46e5;
                    transform: scale(1.05);
                    box-shadow: 0 6px 15px rgba(99, 102, 241, 0.4);
                }

                .send-button.disabled {
                    background: #e2e8f0;
                    color: #94a3b8;
                    cursor: not-allowed;
                    transform: none;
                    box-shadow: none;
                }

                @keyframes messageSlide {
                    from {
                        opacity: 0;
                        transform: translateY(10px);
                    }
                    to {
                        opacity: 1;
                        transform: translateY(0);
                    }
                }

                @keyframes typing {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-4px); }
                }

                /* Scrollbar */
                .ai-messages::-webkit-scrollbar {
                    width: 6px;
                }
                .ai-messages::-webkit-scrollbar-track {
                    background: transparent;
                }
                .ai-messages::-webkit-scrollbar-thumb {
                    background: rgba(0,0,0,0.1);
                    border-radius: 3px;
                }
            `}</style>
        </>
    );
}
