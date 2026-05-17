'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

interface SidebarProps {
    navItems: NavItem[];
    isOpen: boolean;
    onClose: () => void;
}

export default function Sidebar({ navItems, isOpen, onClose }: SidebarProps) {
    const pathname = usePathname();
    const { user } = useAuth();

    return (
        <>
            {/* Mobile overlay */}
            {isOpen && (
                <div
                    aria-hidden="true"
                    className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm lg:hidden"
                    onClick={onClose}
                />
            )}

            {/* Sidebar panel */}
            <aside
                id="sidebar"
                role="navigation"
                aria-label="Main navigation"
                className={[
                    'fixed top-0 left-0 z-30 h-full w-64 flex flex-col transition-transform duration-300 ease-in-out',
                    'lg:translate-x-0 lg:static lg:z-auto',
                    isOpen ? 'translate-x-0' : '-translate-x-full',
                ].join(' ')}
                style={{ background: 'var(--bg-surface)', borderRight: '1px solid var(--border-subtle)' }}
            >
                {/* Logo */}
                <div className="flex items-center gap-3 px-6 py-5" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <div
                        className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                        aria-hidden="true"
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                            <path d="M18 8l2 2 4-4" />
                        </svg>
                    </div>
                    <div>
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>AI Hirer</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {user?.role === 'HR' ? 'HR Portal' : 'Candidate Portal'}
                        </p>
                    </div>
                </div>

                {/* User card */}
                {user && (
                    <div className="mx-4 mt-4 p-3 rounded-lg" style={{ background: 'var(--bg-elevated)' }}>
                        <div className="flex items-center gap-3">
                            <div
                                className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', color: '#fff' }}
                                aria-hidden="true"
                            >
                                {user.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="overflow-hidden">
                                <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                                    {user.name}
                                </p>
                                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>
                                    {user.email}
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Navigation links */}
                <nav aria-label="Sidebar navigation" className="flex-1 px-3 py-4 overflow-y-auto">
                    <ul role="list" className="flex flex-col gap-1">
                        {navItems.map((item) => {
                            const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                            return (
                                <li key={item.href}>
                                    <Link
                                        href={item.href}
                                        onClick={onClose}
                                        aria-current={isActive ? 'page' : undefined}
                                        className={[
                                            'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                                            'focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]',
                                            isActive
                                                ? 'text-white'
                                                : 'hover:bg-[var(--bg-hover)]',
                                        ].join(' ')}
                                        style={
                                            isActive
                                                ? {
                                                    background: 'linear-gradient(135deg, var(--accent-primary), #8b5cf6)',
                                                    boxShadow: 'var(--shadow-glow)',
                                                }
                                                : { color: 'var(--text-secondary)' }
                                        }
                                    >
                                        <span aria-hidden="true" className="shrink-0">{item.icon}</span>
                                        {item.label}
                                    </Link>
                                </li>
                            );
                        })}
                    </ul>
                </nav>
            </aside>
        </>
    );
}
