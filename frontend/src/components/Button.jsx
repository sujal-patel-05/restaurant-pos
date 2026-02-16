import React from 'react';

/**
 * Modern Button Component with ripple effects, loading states, and multiple variants
 * @param {Object} props
 * @param {string} props.variant - 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
 * @param {string} props.size - 'sm' | 'md' | 'lg'
 * @param {boolean} props.loading - Show loading spinner
 * @param {boolean} props.disabled - Disable button
 * @param {React.ReactNode} props.leftIcon - Icon to show on left
 * @param {React.ReactNode} props.rightIcon - Icon to show on right
 * @param {Function} props.onClick - Click handler
 * @param {string} props.className - Additional CSS classes
 * @param {React.ReactNode} props.children - Button content
 */
export function Button({
    variant = 'primary',
    size = 'md',
    loading = false,
    disabled = false,
    leftIcon,
    rightIcon,
    onClick,
    className = '',
    children,
    ...props
}) {
    const baseClass = 'btn';
    const variantClass = `btn-${variant}`;
    const sizeClass = `btn-${size}`;
    const disabledClass = (disabled || loading) ? 'btn-disabled' : '';

    return (
        <button
            className={`${baseClass} ${variantClass} ${sizeClass} ${disabledClass} ${className}`.trim()}
            onClick={onClick}
            disabled={disabled || loading}
            {...props}
        >
            {loading && <span className="btn-spinner">⏳</span>}
            {!loading && leftIcon && <span className="btn-icon-left">{leftIcon}</span>}
            {children}
            {!loading && rightIcon && <span className="btn-icon-right">{rightIcon}</span>}
        </button>
    );
}

export default Button;
