import React from 'react';

/**
 * Modern Loading Spinner Component
 * @param {Object} props
 * @param {string} props.size - 'sm' | 'md' | 'lg'
 * @param {string} props.className - Additional CSS classes
 */
export function LoadingSpinner({ size = 'md', className = '', ...props }) {
    const sizeMap = {
        sm: '24px',
        md: '48px',
        lg: '64px',
    };

    return (
        <div
            className={`loader ${className}`.trim()}
            style={{
                width: sizeMap[size],
                height: sizeMap[size],
            }}
            {...props}
        />
    );
}

export default LoadingSpinner;
