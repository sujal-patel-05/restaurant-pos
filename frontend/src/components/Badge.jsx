import React from 'react';

/**
 * Modern Badge Component with gradient backgrounds
 * @param {Object} props
 * @param {string} props.variant - 'success' | 'warning' | 'error' | 'info' | 'primary'
 * @param {boolean} props.pulse - Enable pulse animation
 * @param {boolean} props.dot - Show as dot indicator
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Badge content
 */
export function Badge({
    variant = 'primary',
    pulse = false,
    dot = false,
    className = '',
    children,
    ...props
}) {
    const baseClass = 'badge';
    const variantClass = `badge-${variant}`;
    const pulseClass = pulse ? 'badge-pulse' : '';

    if (dot) {
        return (
            <span
                className={`badge-dot ${variantClass} ${pulseClass} ${className}`.trim()}
                style={{
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    animation: pulse ? 'pulse 2s infinite' : 'none',
                }}
                {...props}
            />
        );
    }

    return (
        <span
            className={`${baseClass} ${variantClass} ${pulseClass} ${className}`.trim()}
            {...props}
        >
            {children}
        </span>
    );
}

export default Badge;
