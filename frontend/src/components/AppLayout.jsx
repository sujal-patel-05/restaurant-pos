import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { AIChatWidget } from './AIChatWidget';

// Reusable Layout Component
export function AppLayout({ children, title, subtitle, actions }) {
    const location = useLocation();
    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        // Save preference to localStorage
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const navItems = [
        { path: '/', icon: '📊', label: 'Dashboard' },
        { path: '/pos', icon: '🛒', label: 'POS Terminal' },
        { path: '/kds', icon: '👨‍🍳', label: 'Kitchen Display' },
        { path: '/menu', icon: '📋', label: 'Menu' },
        { path: '/inventory', icon: '📦', label: 'Inventory' },
        { path: '/billing', icon: '💳', label: 'Billing' },
        { path: '/reports', icon: '📈', label: 'Reports' },
        { path: '/ask-ai', icon: '🤖', label: 'Ask AI' },
    ];

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">🍽️</div>
                        <span>SujalPOS</span>
                    </div>
                </div>

                <nav className="sidebar-nav">
                    {navItems.map((item) => (
                        <Link
                            key={item.path}
                            to={item.path}
                            className={`nav-item ${location.pathname === item.path ? 'active' : ''}`}
                            title={item.label}
                        >
                            <span className="nav-item-icon">{item.icon}</span>
                            <span>{item.label}</span>
                        </Link>
                    ))}
                </nav>

                <div className="sidebar-footer">
                    <button
                        className="nav-item"
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                        }}
                        title="Logout"
                        style={{
                            width: '100%',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-secondary)',
                            transition: 'all 0.2s ease'
                        }}
                    >
                        <span className="nav-item-icon">🚪</span>
                        <span>Logout</span>
                    </button>
                    <button
                        className="sidebar-toggle"
                        onClick={toggleSidebar}
                        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        {sidebarCollapsed ? '→' : '←'}
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="main-content">
                {/* Top Bar */}
                <div className="top-bar">
                    <div>
                        <h1 className="page-title">{title}</h1>
                        {subtitle && <p className="page-subtitle">{subtitle}</p>}
                    </div>
                    <div className="flex items-center gap-md">
                        <ThemeToggle />
                        {actions}
                    </div>
                </div>

                {/* Content Area */}
                <div className="content-area fade-in-up">
                    {children}
                </div>
            </main>

            {/* Floating AI Chat Widget */}
            {/* <AIChatWidget /> */}
        </div>
    );
}
