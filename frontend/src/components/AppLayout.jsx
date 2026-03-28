import React, { useState, useRef, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { ThemeToggle } from './ThemeToggle';
import { InstallAppButton } from './InstallAppButton';
import { AIChatWidget } from './AIChatWidget';
import OnlineOrderNotification from './OnlineOrderNotification';
import posLogo from '../../img/5ivePOSS_F.png';
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
    Brain,
    Phone,
    Store,
    ChevronDown,
    Zap,
    Bell,
    Settings,
    Search,
    MapPin,
    Cpu,
    ExternalLink,
    FileText,
    User, // Added User icon
    Shield, // Added Shield icon
    TrendingUp, // Revenue Intelligence
} from 'lucide-react';

// Reusable Layout Component
export const AppLayout = ({ children, title, subtitle }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isSettingsOpen, setIsSettingsOpen] = useState(false);
    const settingsRef = useRef(null);

    const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
        // Check localStorage for saved preference
        const saved = localStorage.getItem('sidebarCollapsed');
        return saved === 'true';
    });

    useEffect(() => {
        // Save preference to localStorage
        localStorage.setItem('sidebarCollapsed', sidebarCollapsed);
    }, [sidebarCollapsed]);

    // Close dropdown on click outside
    useEffect(() => {
        function handleClickOutside(event) {
            if (settingsRef.current && !settingsRef.current.contains(event.target)) {
                setIsSettingsOpen(false);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    const toggleSidebar = () => {
        setSidebarCollapsed(!sidebarCollapsed);
    };

    const navItems = [
        { path: '/dashboard', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
        { path: '/pos', icon: <ShoppingCart size={20} />, label: 'POS Terminal' },
        { path: '/kds', icon: <ChefHat size={20} />, label: 'Kitchen Display' },
        { path: '/menu', icon: <Menu size={20} />, label: 'Menu' },
        { path: '/inventory', icon: <Package size={20} />, label: 'Inventory' },
        { path: '/reports', icon: <BarChart3 size={20} />, label: 'Reports' },
        { path: '/revenue', icon: <TrendingUp size={20} />, label: 'Revenue Intel' },
        { path: '/ask-ai', icon: <Sparkles size={20} />, label: 'Ask AI' },
        { path: '/agents', icon: <Brain size={20} />, label: 'AI Insights' },
        { label: 'Eva Bot / Digital Call', icon: <Phone size={20} />, path: '/order-call/T1' },
    ];

    return (
        <div className="app-container">
            {/* Online Order Notifications (Zomato/Swiggy) */}
            <OnlineOrderNotification />
            {/* Sidebar */}
            <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''}`}>
                <div className="sidebar-header" style={{ padding: sidebarCollapsed ? '0 0.5rem' : '0' }}>
                    <div className="sidebar-logo" style={{ margin: sidebarCollapsed ? '0 auto' : '0', display: 'flex', justifyContent: sidebarCollapsed ? 'center' : 'flex-start', paddingLeft: sidebarCollapsed ? '0' : '20px', width: '100%' }}>
                        {sidebarCollapsed ? (
                            <div className="sidebar-logo-icon">
                                <UtensilsCrossed size={20} color="white" />
                            </div>
                        ) : (
                            <img 
                                src={posLogo} 
                                alt="5ivePOS" 
                                style={{ 
                                    height: '50px', 
                                    width: 'auto', 
                                    objectFit: 'contain',
                                    objectPosition: 'left center',
                                    transition: 'all 0.3s ease'
                                }} 
                            />
                        )}
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
                        className="sidebar-logout-btn"
                        onClick={() => {
                            localStorage.removeItem('token');
                            localStorage.removeItem('user');
                            window.location.href = '/login';
                        }}
                        title="Logout"
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
                {/* Top Bar - Clean Minimalist Design */}
                <div className="top-bar" style={{ padding: '0 1.5rem', minHeight: '60px', borderBottom: '1px solid var(--border-color)' }}>
                    <div className="flex items-center gap-xl">
                        {/* Outlet Selector - Simplified */}
                        <div className="outlet-selector-premium" style={{
                            background: 'var(--bg-body)',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            padding: '6px 14px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '10px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            minWidth: '220px'
                        }}>
                            <div style={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '50%',
                                background: 'var(--success)',
                                boxShadow: '0 0 8px var(--success)'
                            }} />
                            <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-main)' }}>Gajanand Fast Food</span>
                            <ChevronDown size={14} style={{ marginLeft: 'auto', opacity: 0.5 }} />
                        </div>
                    </div>

                    <div className="flex items-center gap-md">
                        <InstallAppButton />
                        <ThemeToggle />

                        {/* Settings Dropdown */}
                        <div className="settings-container" ref={settingsRef} style={{ position: 'relative' }}>
                            <div
                                className={`top-bar-icon-btn ${isSettingsOpen ? 'active' : ''}`}
                                onClick={() => setIsSettingsOpen(!isSettingsOpen)}
                                title="Restaurant Settings"
                            >
                                <Settings size={20} />
                            </div>

                            {isSettingsOpen && (
                                <div className="settings-dropdown">
                                    <div className="dropdown-item" onClick={() => { navigate('/profile'); setIsSettingsOpen(false); }}>
                                        <div className="dropdown-icon-wrapper">
                                            <User size={16} />
                                        </div>
                                        <span>Edit Profile</span>
                                    </div>

                                    <div className="dropdown-divider"></div>

                                    <div className="dropdown-section">
                                        <div className="flex items-center justify-between mb-xs">
                                            <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-main)' }}>SujalPOS Apps</span>
                                            <ExternalLink size={14} style={{ opacity: 0.5 }} />
                                        </div>
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>Version - 121.0.1</span>
                                    </div>

                                    <div className="dropdown-divider"></div>

                                    <div className="dropdown-item" onClick={() => setIsSettingsOpen(false)}>
                                        <div className="dropdown-icon-wrapper">
                                            <FileText size={16} />
                                        </div>
                                        <span>Terms & Conditions</span>
                                    </div>
                                    <div className="dropdown-item" onClick={() => setIsSettingsOpen(false)}>
                                        <div className="dropdown-icon-wrapper">
                                            <Shield size={16} />
                                        </div>
                                        <span>Privacy Policy</span>
                                    </div>

                                    <div className="dropdown-divider"></div>

                                    <div className="dropdown-item logout" onClick={() => { /* handle logout */; setIsSettingsOpen(false); }}>
                                        <div className="dropdown-icon-wrapper">
                                            <LogOut size={16} />
                                        </div>
                                        <span>Logout</span>
                                    </div>
                                </div>
                            )}
                        </div>
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
