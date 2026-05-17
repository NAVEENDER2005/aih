'use client';

import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AccessibleFormInput from '@/components/AccessibleFormInput';
import ErrorAlert from '@/components/ErrorAlert';
import LoadingSpinner from '@/components/LoadingSpinner';

// ── client component: no metadata export; it's set in the layout

export default function LoginPage() {
    const { login } = useAuth();
    const router = useRouter();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [isPending, setIsPending] = useState(false);

    const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({});

    /* ── Client-side validation ───────────────────────── */
    function validate() {
        const errs: typeof fieldErrors = {};
        if (!email) errs.email = 'Email is required.';
        else if (!/\S+@\S+\.\S+/.test(email)) errs.email = 'Enter a valid email address.';
        if (!password) errs.password = 'Password is required.';
        return errs;
    }

    /* ── Submit ──────────────────────────────────────── */
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setError('');
        const errs = validate();
        setFieldErrors(errs);
        if (Object.keys(errs).length) return;

        setIsPending(true);
        try {
            await login(email, password);

            // login() calls persistToken() which synchronously writes to localStorage
            document.cookie = 'aihirer_authed=1; path=/; SameSite=Strict';
            let role = 'CANDIDATE';
            try {
                const raw = localStorage.getItem('aihirer_user');
                if (raw) role = JSON.parse(raw).role ?? 'CANDIDATE';
            } catch { /* noop */ }
            document.cookie = `aihirer_role=${role}; path=/; SameSite=Strict`;

            router.replace(role === 'HR' ? '/hr/dashboard' : '/candidate/dashboard');
        } catch (err: unknown) {
            setError((err as Error).message);
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-12"
            style={{ background: 'var(--bg-base)' }}
        >
            {/* Ambient gradient blob */}
            <div
                aria-hidden="true"
                className="pointer-events-none fixed inset-0 overflow-hidden"
            >
                <div
                    className="absolute -top-40 -left-40 w-96 h-96 rounded-full opacity-10 blur-3xl"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }}
                />
                <div
                    className="absolute -bottom-32 -right-32 w-80 h-80 rounded-full opacity-10 blur-3xl"
                    style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }}
                />
            </div>

            <div className="relative w-full max-w-md animate-fade-in">
                {/* Header */}
                <div className="text-center mb-8">
                    <div
                        className="inline-flex items-center justify-center w-14 h-14 rounded-2xl mb-4"
                        style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
                        aria-hidden="true"
                    >
                        <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                            <circle cx="12" cy="8" r="4" />
                            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                            <path d="M18 8l2 2 4-4" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold mb-2 gradient-text">Welcome back</h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Sign in to your AI Hirer account
                    </p>
                </div>

                {/* Card */}
                <div
                    className="glass-card p-8"
                    style={{ boxShadow: 'var(--shadow-lg)' }}
                >
                    <form
                        onSubmit={handleSubmit}
                        noValidate
                        aria-label="Login form"
                    >
                        <div className="flex flex-col gap-5">
                            {/* Global error */}
                            {error && (
                                <ErrorAlert
                                    message={error}
                                    onDismiss={() => setError('')}
                                    id="login-error"
                                />
                            )}

                            <AccessibleFormInput
                                id="login-email"
                                label="Email address"
                                type="email"
                                autoComplete="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => {
                                    setEmail(e.target.value);
                                    setFieldErrors((p) => ({ ...p, email: undefined }));
                                }}
                                error={fieldErrors.email}
                                required
                                icon={
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
                                        <polyline points="22,6 12,13 2,6" />
                                    </svg>
                                }
                            />

                            <AccessibleFormInput
                                id="login-password"
                                label="Password"
                                type="password"
                                autoComplete="current-password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => {
                                    setPassword(e.target.value);
                                    setFieldErrors((p) => ({ ...p, password: undefined }));
                                }}
                                error={fieldErrors.password}
                                required
                                icon={
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                }
                            />

                            <button
                                type="submit"
                                disabled={isPending}
                                aria-busy={isPending}
                                aria-disabled={isPending}
                                className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-lg font-semibold text-sm transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-[var(--bg-base)] disabled:opacity-60 disabled:cursor-not-allowed"
                                style={{
                                    background: isPending
                                        ? 'var(--bg-elevated)'
                                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    boxShadow: isPending ? 'none' : 'var(--shadow-glow)',
                                }}
                            >
                                {isPending ? (
                                    <>
                                        <LoadingSpinner size="sm" label="Signing in…" />
                                        <span>Signing in…</span>
                                    </>
                                ) : (
                                    <>
                                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
                                            <polyline points="10 17 15 12 10 7" />
                                            <line x1="15" y1="12" x2="3" y2="12" />
                                        </svg>
                                        Sign in
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    {/* Register link */}
                    <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Don&apos;t have an account?{' '}
                        <Link
                            href="/register"
                            className="font-semibold transition-colors focus:outline-none focus-visible:underline"
                            style={{ color: 'var(--accent-primary-hover)' }}
                        >
                            Create one
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
