import React, { useState } from 'react';
import { AppLayout } from '../components/AppLayout';
import { User, Mail, Phone, Shield, Lock, ChevronRight, Edit3, History } from 'lucide-react';

export default function ProfileSettings() {
    const [is2FAEnabled, setIs2FAEnabled] = useState(false);

    // Mock user data - In a real app, this would come from AuthContext or an API
    const user = {
        name: "Sujal Patel",
        email: "sujal.patel@petpooja.com",
        restaurantName: "Gajanand Fast Food",
        mobileNumbers: [
            "+91 6355760186"
        ]
    };

    return (
        <AppLayout title="Profile Settings" subtitle="Manage your account information and security">
            <div className="profile-settings-container">
                {/* User Info Card */}
                <div className="profile-card">
                    <div className="profile-card-header flex items-center justify-between">
                        <div className="flex items-center gap-md">
                            <h2 style={{ fontSize: '18px', fontWeight: 700 }}>User Info</h2>
                        </div>
                        <div className="flex items-center gap-sm">
                            <button className="btn btn-secondary flex items-center gap-xs" style={{ background: 'transparent', border: '1px solid #ddd', padding: '4px 12px' }}>
                                View Logs
                            </button>
                            <button className="btn btn-secondary" style={{ background: 'transparent', border: '1px solid #ddd', padding: '4px 12px' }}>
                                <Edit3 size={16} />
                            </button>
                        </div>
                    </div>

                    <div className="profile-card-content">
                        <div className="info-row">
                            <div className="info-label">Name</div>
                            <div className="info-value">{user.name}</div>
                        </div>
                        <div className="info-row">
                            <div className="info-label">Email</div>
                            <div className="info-value">{user.email}</div>
                        </div>
                        <div className="info-row">
                            <div className="info-label">Restaurant Name</div>
                            <div className="info-value">{user.restaurantName}</div>
                        </div>
                        <div className="info-row">
                            <div className="info-label">Mobile Number</div>
                            <div className="info-value">
                                {user.mobileNumbers[0]}
                            </div>
                        </div>
                    </div>
                </div>

                {/* Security Section (2FA) */}
                <div className="profile-section-divider"></div>

                <div className="security-item flex items-center justify-between">
                    <div className="flex items-start gap-md">
                        <div className={`toggle-switch ${is2FAEnabled ? 'active' : ''}`} onClick={() => setIs2FAEnabled(!is2FAEnabled)}>
                            <div className="toggle-knob"></div>
                        </div>
                        <div className="flex flex-col">
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>2FA For Login</span>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Keep your account safe with 2FA.
                            </p>
                        </div>
                    </div>
                </div>

                <div className="profile-section-divider"></div>

                {/* Password Change Section */}
                <div className="security-item flex items-center justify-between">
                    <div className="flex items-start gap-md">
                        <div style={{ padding: '10px', background: 'rgba(99, 102, 241, 0.1)', borderRadius: '12px', color: 'var(--primary)' }}>
                            <Lock size={20} />
                        </div>
                        <div className="flex flex-col">
                            <span style={{ fontWeight: 600, fontSize: '15px' }}>Want To Change Your Password?</span>
                            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                Choose a strong password you haven't used before.
                            </p>
                            <button className="btn btn-secondary" style={{ marginTop: '12px', alignSelf: 'flex-start', border: '1px solid #ddd', padding: '6px 16px', fontSize: '13px', fontWeight: 600 }}>
                                Change Password
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <style>{`
                .profile-settings-container {
                    max-width: 1000px;
                    margin: 0 auto;
                }
                .profile-card {
                    background: var(--bg-surface);
                    border-radius: 12px;
                    border: 1px solid var(--border-color);
                    margin-bottom: 24px;
                }
                .profile-card-header {
                    padding: 16px 20px;
                    border-bottom: 1px solid var(--border-color);
                }
                .profile-card-content {
                    padding: 0 20px;
                }
                .info-row {
                    display: grid;
                    grid-template-columns: 200px 1fr;
                    padding: 16px 0;
                    border-bottom: 1px solid var(--border-color);
                }
                .info-row:last-child {
                    border-bottom: none;
                }
                .info-label {
                    color: var(--text-secondary);
                    font-weight: 500;
                    font-size: 14px;
                }
                .info-value {
                    color: var(--text-main);
                    font-weight: 600;
                    font-size: 14px;
                }
                .mobile-list {
                    line-height: 1.6;
                }
                .profile-section-divider {
                    height: 1px;
                    background: var(--border-color);
                    margin: 24px 0;
                }
                .security-item {
                    padding: 8px 0;
                }
                .toggle-switch {
                    width: 44px;
                    height: 24px;
                    background: #cbd5e1;
                    border-radius: 20px;
                    position: relative;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .toggle-switch.active {
                    background: var(--primary);
                }
                .toggle-knob {
                    width: 18px;
                    height: 18px;
                    background: white;
                    border-radius: 50%;
                    position: absolute;
                    top: 3px;
                    left: 3px;
                    transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
                }
                .toggle-switch.active .toggle-knob {
                    left: 23px;
                }
                
                [data-theme="dark"] .profile-card {
                    background: #1e293b;
                }
                [data-theme="dark"] .toggle-switch {
                    background: #334155;
                }
            `}</style>
        </AppLayout>
    );
}
