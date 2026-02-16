import React from 'react';

/**
 * Modern Card Component with glassmorphism and hover effects
 * @param {Object} props
 * @param {boolean} props.glass - Use glassmorphism effect
 * @param {boolean} props.hover - Enable hover lift effect
 * @param {boolean} props.clickable - Make card clickable
 * @param {Function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Card content
 */
export function Card({
    glass = false,
    hover = true,
    clickable = false,
    onClick,
    className = '',
    children,
    ...props
}) {
    const baseClass = 'stat-card';
    const glassClass = glass ? 'card-glass' : '';
    const clickableClass = clickable ? 'card-clickable' : '';

    return (
        <div
            className={`${baseClass} ${glassClass} ${clickableClass} ${className}`.trim()}
            onClick={clickable ? onClick : undefined}
            style={{ cursor: clickable ? 'pointer' : 'default' }}
            {...props}
        >
            {children}
        </div>
    );
}

/**
 * Card Header Component
 */
export function CardHeader({ children, className = '', ...props }) {
    return (
        <div className={`stat-card-header ${className}`.trim()} {...props}>
            {children}
        </div>
    );
}

/**
 * Card Body Component
 */
export function CardBody({ children, className = '', ...props }) {
    return (
        <div className={`card-body ${className}`.trim()} {...props}>
            {children}
        </div>
    );
}

export default Card;
