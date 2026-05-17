'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import LoadingSpinner from './LoadingSpinner';

interface ProtectedRouteProps {
    children: React.ReactNode;
    requiredRole?: UserRole;
}

export default function ProtectedRoute({
    children,
    requiredRole,
}: ProtectedRouteProps) {
    const { isAuthenticated, isLoading, user, logout } = useAuth();
    const router = useRouter();

    useEffect(() => {
        if (isLoading) return;

        if (!isAuthenticated) {
            router.replace('/login');
            return;
        }

        if (requiredRole && user?.role !== requiredRole) {
            // Redirect to their correct dashboard
            router.replace(
                user?.role === 'HR' ? '/hr/dashboard' : '/candidate/dashboard'
            );
        }
    }, [isLoading, isAuthenticated, requiredRole, user, router, logout]);

    if (isLoading) {
        return (
            <div
                className="min-h-screen flex flex-col items-center justify-center gap-4"
                style={{ background: 'var(--bg-base)' }}
                aria-busy="true"
                aria-label="Verifying your session…"
            >
                <LoadingSpinner size="lg" label="Verifying your session…" />
                <p className="text-sm animate-pulse" style={{ color: 'var(--text-muted)' }}>
                    Verifying your session…
                </p>
            </div>
        );
    }

    if (!isAuthenticated) return null;
    if (requiredRole && user?.role !== requiredRole) return null;

    return <>{children}</>;
}
