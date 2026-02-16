import React, { useState, useEffect } from 'react';

/**
 * Theme Toggle Component for Dark/Light Mode
 */
export function ThemeToggle() {
    const [isDark, setIsDark] = useState(() => {
        // Check localStorage or system preference
        const saved = localStorage.getItem('theme');
        if (saved) {
            return saved === 'dark';
        }
        return window.matchMedia('(prefers-color-scheme: dark)').matches;
    });

    useEffect(() => {
        // Apply theme to document
        if (isDark) {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem('theme', 'light');
        }
    }, [isDark]);

    const toggleTheme = () => {
        setIsDark(!isDark);
    };

    return (
        <button
            onClick={toggleTheme}
            className="btn btn-secondary"
            style={{
                padding: '0.75rem',
                minWidth: 'auto',
                position: 'relative',
                overflow: 'hidden',
            }}
            title={isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
        >
            <span style={{
                fontSize: '1.25rem',
                display: 'inline-block',
                transition: 'transform 0.3s ease',
                transform: isDark ? 'rotate(180deg)' : 'rotate(0deg)',
            }}>
                {isDark ? '🌙' : '☀️'}
            </span>
        </button>
    );
}

export default ThemeToggle;
