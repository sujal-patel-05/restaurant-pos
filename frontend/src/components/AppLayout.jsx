import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { AIChatWidget } from './AIChatWidget';
import {
    LayoutDashboard,
    ShoppingCart,
    UtensilsCrossed,
    ClipboardList,
    Package,
    BarChart3,
    Sparkles,
    LogOut,
    Menu,
    ChevronLeft,
    ChevronRight,
    ChefHat,
    Brain
} from 'lucide-react';

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
        { path: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { path: '/pos', icon: <ShoppingCart size={20} />, label: 'POS Terminal' },
        { path: '/kds', icon: <ChefHat size={20} />, label: 'Kitchen Display' },
        { path: '/menu', icon: <Menu size={20} />, label: 'Menu' },
        { path: '/inventory', icon: <Package size={20} />, label: 'Inventory' },
        { path: '/reports', icon: <BarChart3 size={20} />, label: 'Reports' },
        { path: '/ask-ai', icon: <Sparkles size={20} />, label: 'Ask AI' },
        { path: '/agents', icon: <Brain size={20} />, label: 'AI Insights' },
    ];

    return (
        <div className="app-container">
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header">
                    <div className="sidebar-logo">
                        <div className="sidebar-logo-icon">
                            <UtensilsCrossed size={20} color="white" />
                        </div>
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
                        <span className="nav-item-icon"><LogOut size={20} /></span>
                        <span>Logout</span>
                    </button>
                    <button
                        className="sidebar-toggle"
                        onClick={toggleSidebar}
                        title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
                    >
                        {sidebarCollapsed ? <ChevronRight size={20} /> : <ChevronLeft size={20} />}
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

            {/* Floating AI Chat Widget - REMOVED as per user request to use Sidebar/Page instead */}
            {/* <AIChatWidget /> */}
        </div>
    );
}
