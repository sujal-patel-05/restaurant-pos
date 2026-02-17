
import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

function ChatMessage({ message }) {
    const isUser = message.role === 'user';
    const isAssistant = message.role === 'assistant';

    // Style for the container
    const containerStyle = {
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        marginBottom: '1rem',
        animation: 'fadeInUp 0.3s ease-out'
    };

    // Style for the bubble
    const bubbleStyle = {
        maxWidth: '85%',
        padding: '1rem 1.25rem',
        borderRadius: '1rem',
        background: isUser
            ? 'linear-gradient(135deg, #6366F1, #8B5CF6)'
            : 'rgba(255, 255, 255, 0.05)',
        backdropFilter: isAssistant ? 'blur(10px)' : 'none',
        border: isAssistant ? '1px solid rgba(255, 255, 255, 0.1)' : 'none',
        color: isUser ? 'white' : 'var(--text-main)',
        boxShadow: isUser
            ? '0 4px 12px rgba(99, 102, 241, 0.3)'
            : '0 4px 12px rgba(0, 0, 0, 0.1)',
        fontSize: '0.95rem',
        lineHeight: '1.6'
    };

    // Render Chart if data exists
    const renderChart = () => {
        if (!message.chartData) return null;

        const { data, dataKey, xAxisKey, title, type } = message.chartData;

        return (
            <div style={{
                marginTop: '1.5rem',
                marginBottom: '0.5rem',
                padding: '1rem',
                background: 'rgba(0,0,0,0.2)',
                borderRadius: '0.5rem',
                border: '1px solid rgba(255,255,255,0.05)'
            }}>
                {title && (
                    <div style={{
                        fontSize: '0.85rem',
                        opacity: 0.8,
                        marginBottom: '1rem',
                        fontWeight: 600
                    }}>
                        {title}
                    </div>
                )}
                <div style={{ height: '200px', width: '100%', minWidth: '300px' }}>
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={data} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.1)" />
                            <XAxis
                                dataKey={xAxisKey}
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                                dy={10}
                            />
                            <YAxis
                                axisLine={false}
                                tickLine={false}
                                tick={{ fill: 'var(--text-secondary)', fontSize: 10 }}
                            />
                            <Tooltip
                                contentStyle={{
                                    backgroundColor: 'var(--bg-surface)',
                                    borderColor: 'var(--border-color)',
                                    borderRadius: '0.5rem',
                                    color: 'var(--text-main)'
                                }}
                                cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                            />
                            <Bar
                                dataKey={dataKey}
                                fill="#8B5CF6"
                                radius={[4, 4, 0, 0]}
                                barSize={30}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </div>
        );
    };

    return (
        <div style={containerStyle}>
            <div style={bubbleStyle}>
                <div className="markdown-content">
                    <ReactMarkdown
                        remarkPlugins={[remarkGfm]}
                        components={{
                            // Custom renderer for bold text to ensure it stands out
                            strong: ({ node, ...props }) => <strong style={{ color: isUser ? '#fff' : 'var(--primary)', fontWeight: 700 }} {...props} />,
                            // Custom renderer for lists
                            ul: ({ node, ...props }) => <ul style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }} {...props} />,
                            ol: ({ node, ...props }) => <ol style={{ paddingLeft: '1.2rem', margin: '0.5rem 0' }} {...props} />,
                            li: ({ node, ...props }) => <li style={{ marginBottom: '0.25rem' }} {...props} />,
                            p: ({ node, ...props }) => <p style={{ margin: '0 0 0.5rem 0', lastChild: { margin: 0 } }} {...props} />
                        }}
                    >
                        {message.content}
                    </ReactMarkdown>
                </div>

                {renderChart()}

                <div style={{
                    fontSize: '0.75rem',
                    marginTop: '0.5rem',
                    opacity: 0.7,
                    fontWeight: 500,
                    textAlign: 'right'
                }}>
                    {new Date(message.timestamp).toLocaleTimeString('en-IN', {
                        hour: '2-digit',
                        minute: '2-digit'
                    })}
                </div>
            </div>
        </div>
    );
}

export default ChatMessage;
