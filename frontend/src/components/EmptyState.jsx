import React from 'react';

/**
 * Empty State Component with illustration and call-to-action
 * @param {Object} props
 * @param {string} props.icon - Emoji or icon to display
 * @param {string} props.title - Main title
 * @param {string} props.description - Description text
 * @param {React.ReactNode} props.action - Action button or element
 * @param {string} props.className - Additional CSS classes
 */
export function EmptyState({
    icon = '📭',
    title = 'No data yet',
    description = 'Get started by adding your first item',
    action,
    className = '',
    ...props
}) {
    return (
        <div
            className={`stat-card ${className}`.trim()}
            style={{
                textAlign: 'center',
                padding: 'var(--spacing-3xl)',
            }}
            {...props}
        >
            <div style={{
                fontSize: '4rem',
                marginBottom: 'var(--spacing-lg)',
                animation: 'scaleIn 0.5s ease-out',
            }}>
                {icon}
            </div>
            <h2 style={{
                fontSize: 'var(--font-size-2xl)',
                fontWeight: 700,
                marginBottom: 'var(--spacing-md)',
                color: 'var(--text-primary)',
            }}>
                {title}
            </h2>
            <p style={{
                color: 'var(--text-secondary)',
                marginBottom: action ? 'var(--spacing-xl)' : 0,
                fontSize: 'var(--font-size-base)',
            }}>
                {description}
            </p>
            {action && <div>{action}</div>}
        </div>
    );
}

export default EmptyState;
