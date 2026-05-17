'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface NavbarProps {
    onMenuToggle: () => void;
    isSidebarOpen: boolean;
    title: string;
}

export default function Navbar({ onMenuToggle, isSidebarOpen, title }: NavbarProps) {
    const { user, logout } = useAuth();
    const router = useRouter();

    const handleLogout = () => {
        // Clear auth cookie for middleware
        document.cookie = 'aihirer_authed=; Max-Age=0; path=/';
        document.cookie = 'aihirer_role=; Max-Age=0; path=/';
        logout();
        router.push('/login');
    };

    return (
        <header
            role="banner"
            className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 lg:px-6"
            style={{
                background: 'rgba(255, 255, 255, 0.7)',
                backdropFilter: 'blur(12px)',
                WebkitBackdropFilter: 'blur(12px)',
                borderBottom: '1px solid var(--border-subtle)',
            }}
        >
            {/* Left: hamburger + title */}
            <div className="flex items-center gap-3">
                <button
                    type="button"
                    onClick={onMenuToggle}
                    aria-expanded={isSidebarOpen}
                    aria-controls="sidebar"
                    aria-label={isSidebarOpen ? 'Close navigation menu' : 'Open navigation menu'}
                    className="lg:hidden p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-elevated)')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                >
                    <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {isSidebarOpen ? (
                            <>
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </>
                        ) : (
                            <>
                                <line x1="3" y1="12" x2="21" y2="12" />
                                <line x1="3" y1="6" x2="21" y2="6" />
                                <line x1="3" y1="18" x2="21" y2="18" />
                            </>
                        )}
                    </svg>
                </button>

                <h1 className="text-base font-semibold" style={{ color: 'var(--text-primary)' }}>
                    {title}
                </h1>
            </div>

            {/* Right: user + logout */}
            <div className="flex items-center gap-3">
                {user && (
                    <span className="hidden sm:flex items-center gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                        <span
                            className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', color: '#fff' }}
                            aria-hidden="true"
                        >
                            {user.name.charAt(0).toUpperCase()}
                        </span>
                        <span className="hidden md:inline">{user.name}</span>
                    </span>
                )}

                <button
                    type="button"
                    onClick={handleLogout}
                    aria-label="Log out of your account"
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#f87171';
                        e.currentTarget.style.borderColor = 'rgb(239 68 68 / 0.4)';
                        e.currentTarget.style.background = 'rgb(239 68 68 / 0.1)';
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.color = 'var(--text-secondary)';
                        e.currentTarget.style.borderColor = 'var(--border-subtle)';
                        e.currentTarget.style.background = '';
                    }}
                >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                        <polyline points="16 17 21 12 16 7" />
                        <line x1="21" y1="12" x2="9" y2="12" />
                    </svg>
                    <span className="hidden sm:inline">Log out</span>
                </button>
            </div>
        </header>
    );
}
