'use client';

import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import Sidebar from '@/components/Sidebar';

interface NavItem {
    href: string;
    label: string;
    icon: React.ReactNode;
}

interface DashboardLayoutProps {
    children: React.ReactNode;
    navItems: NavItem[];
    title: string;
}

export default function DashboardLayout({
    children,
    navItems,
    title,
}: DashboardLayoutProps) {
    const [sidebarOpen, setSidebarOpen] = useState(false);

    return (
        <div className="flex h-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
            <Sidebar
                navItems={navItems}
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
            />

            {/* Main content area */}
            <div className="flex flex-col flex-1 overflow-hidden">
                <Navbar
                    title={title}
                    isSidebarOpen={sidebarOpen}
                    onMenuToggle={() => setSidebarOpen((v) => !v)}
                />

                <main
                    id="main-content"
                    role="main"
                    tabIndex={-1}
                    className="flex-1 overflow-y-auto p-4 lg:p-6 animate-fade-in"
                    style={{ outline: 'none' }}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
