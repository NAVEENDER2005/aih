'use client';

import React, { FormEvent, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth, UserRole } from '@/contexts/AuthContext';
import AccessibleFormInput from '@/components/AccessibleFormInput';
import AccessibleSelect from '@/components/AccessibleSelect';
import ErrorAlert from '@/components/ErrorAlert';
import LoadingSpinner from '@/components/LoadingSpinner';

const ROLE_OPTIONS = [
    { value: 'HR', label: 'HR / Recruiter' },
    { value: 'CANDIDATE', label: 'Candidate / Job Seeker' },
];

const EXPERIENCE_OPTIONS = [
    { value: 'Fresher', label: 'Fresher' },
    { value: '0-2', label: '0–2 Years' },
    { value: '2-5', label: '2–5 Years' },
    { value: '5-10', label: '5–10 Years' },
];

const INTERESTED_ROLE_OPTIONS = [
    { value: '.NET Developer', label: '.NET Developer' },
    { value: 'Java Developer', label: 'Java Developer' },
    { value: 'Python Developer', label: 'Python Developer' },
    { value: 'Front End Developer / React / UI', label: 'Front End Developer / React / UI' },
    { value: 'Fullstack Developer', label: 'Fullstack Developer' },
    { value: 'Mobile App Developer', label: 'Mobile App Developer' },
    { value: 'Solution Architect / Architect', label: 'Solution Architect / Architect' },
    { value: 'Technical Lead / Tech Lead', label: 'Technical Lead / Tech Lead' },
    { value: 'System Engineer', label: 'System Engineer' },
    { value: 'Test Engineer / QA Engineer / Automation QA', label: 'Test Engineer / QA Engineer / Automation QA' },
    { value: 'QA Analyst / SDET', label: 'QA Analyst / SDET' },
    { value: 'ETL Tester / Data Tester', label: 'ETL Tester / Data Tester' },
    { value: 'Data Engineer', label: 'Data Engineer' },
    { value: 'Database Administrator (DBA)', label: 'Database Administrator (DBA)' },
    { value: 'DevOps / SRE Engineer', label: 'DevOps / SRE Engineer' },
    { value: 'Cloud Engineer (AWS / Azure / GCP)', label: 'Cloud Engineer (AWS / Azure / GCP)' },
    { value: 'Security / Threat Analyst', label: 'Security / Threat Analyst' },
    { value: 'R&D / Emerging Tech Engineer', label: 'R&D / Emerging Tech Engineer' },
];

export default function RegisterPage() {
    const { register } = useAuth();
    const router = useRouter();

    const [form, setForm] = useState({
        name: '',
        email: '',
        password: '',
        confirm: '',
        role: 'CANDIDATE' as UserRole,
        experienceLevel: '',
        githubProfile: '',
        linkedinProfile: '',
        interestedRole: '',
    });
    const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
    const [globalError, setGlobalError] = useState('');
    const [isPending, setIsPending] = useState(false);
    const [success, setSuccess] = useState(false);

    /* ── Validation ─────────────────────────────────────── */
    function validate() {
        const errs: Partial<Record<keyof typeof form, string>> = {};
        if (!form.name.trim()) errs.name = 'Full name is required.';
        else if (form.name.trim().length < 2) errs.name = 'Name must be at least 2 characters.';

        if (!form.email) errs.email = 'Email is required.';
        else if (!/\S+@\S+\.\S+/.test(form.email)) errs.email = 'Enter a valid email address.';

        if (!form.password) errs.password = 'Password is required.';
        else if (form.password.length < 8) errs.password = 'Password must be at least 8 characters.';
        else if (!/[A-Z]/.test(form.password)) errs.password = 'Include at least one uppercase letter.';
        else if (!/[0-9]/.test(form.password)) errs.password = 'Include at least one number.';

        if (!form.confirm) errs.confirm = 'Please confirm your password.';
        else if (form.confirm !== form.password) errs.confirm = 'Passwords do not match.';

        if (!form.role) errs.role = 'Please select your role.';

        if (form.role === 'CANDIDATE') {
            if (!form.experienceLevel) errs.experienceLevel = 'Experience level is required.';
            if (!form.githubProfile.trim()) errs.githubProfile = 'GitHub profile is required.';
            if (!form.linkedinProfile.trim()) errs.linkedinProfile = 'LinkedIn profile is required.';
            if (!form.interestedRole) errs.interestedRole = 'Interested role is required.';
        }

        return errs;
    }

    /* ── field update helper ─────────────────────────────── */
    function update<K extends keyof typeof form>(key: K, val: typeof form[K]) {
        setForm((prev) => ({ ...prev, [key]: val }));
        setFieldErrors((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
    }

    /* ── Submit ──────────────────────────────────────────── */
    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        setGlobalError('');
        const errs = validate();
        setFieldErrors(errs);
        if (Object.keys(errs).length) return;

        setIsPending(true);
        try {
            await register(
                form.name.trim(),
                form.email,
                form.password,
                form.role as UserRole,
                form.experienceLevel,
                form.githubProfile,
                form.linkedinProfile,
                form.interestedRole
            );
            setSuccess(true);
            setTimeout(() => router.push('/login'), 2000);
        } catch (err: unknown) {
            setGlobalError((err as Error).message);
        } finally {
            setIsPending(false);
        }
    }

    return (
        <div
            className="min-h-screen flex items-center justify-center px-4 py-12"
            style={{ background: 'var(--bg-base)' }}
        >
            {/* Ambient blobs */}
            <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
                <div className="absolute top-20 right-10 w-80 h-80 rounded-full opacity-10 blur-3xl"
                    style={{ background: 'radial-gradient(circle, #8b5cf6, transparent)' }} />
                <div className="absolute bottom-10 left-10 w-72 h-72 rounded-full opacity-10 blur-3xl"
                    style={{ background: 'radial-gradient(circle, #6366f1, transparent)' }} />
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
                            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                            <circle cx="9" cy="7" r="4" />
                            <line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" />
                        </svg>
                    </div>
                    <h1 className="text-3xl font-bold mb-2 gradient-text">Create account</h1>
                    <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Join AI Hirer — smart hiring starts here
                    </p>
                </div>

                <div className="glass-card p-8" style={{ boxShadow: 'var(--shadow-lg)' }}>

                    {success ? (
                        <div
                            role="alert"
                            aria-live="assertive"
                            className="flex flex-col items-center gap-4 py-8 text-center animate-fade-in"
                        >
                            <div
                                className="w-16 h-16 rounded-full flex items-center justify-center"
                                style={{ background: 'var(--success-bg)', border: '2px solid var(--success-border)' }}
                                aria-hidden="true"
                            >
                                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--success-text)" strokeWidth="2.5">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            </div>
                            <p className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Account created!
                            </p>
                            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                Redirecting to login…
                            </p>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} noValidate aria-label="Registration form">
                            <div className="flex flex-col gap-5">
                                {globalError && (
                                    <ErrorAlert message={globalError} onDismiss={() => setGlobalError('')} />
                                )}

                                <AccessibleFormInput
                                    id="reg-name"
                                    label="Full name"
                                    type="text"
                                    autoComplete="name"
                                    placeholder="Jane Smith"
                                    value={form.name}
                                    onChange={(e) => update('name', e.target.value)}
                                    error={fieldErrors.name}
                                    required
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                                            <circle cx="12" cy="7" r="4" />
                                        </svg>
                                    }
                                />

                                <AccessibleFormInput
                                    id="reg-email"
                                    label="Email address"
                                    type="email"
                                    autoComplete="email"
                                    placeholder="you@example.com"
                                    value={form.email}
                                    onChange={(e) => update('email', e.target.value)}
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
                                    id="reg-password"
                                    label="Password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={form.password}
                                    onChange={(e) => update('password', e.target.value)}
                                    error={fieldErrors.password}
                                    hint="Min 8 chars, one uppercase, one number."
                                    required
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                                            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                        </svg>
                                    }
                                />

                                <AccessibleFormInput
                                    id="reg-confirm"
                                    label="Confirm password"
                                    type="password"
                                    autoComplete="new-password"
                                    placeholder="••••••••"
                                    value={form.confirm}
                                    onChange={(e) => update('confirm', e.target.value)}
                                    error={fieldErrors.confirm}
                                    required
                                    icon={
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <path d="M9 11l3 3L22 4" /><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
                                        </svg>
                                    }
                                />

                                {/* Role Selection Cards */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                        I am a... <span style={{ color: 'var(--accent-danger)' }}>*</span>
                                    </label>
                                    <div className="grid grid-cols-2 gap-3">
                                        {ROLE_OPTIONS.map((opt) => {
                                            const selected = form.role === opt.value;
                                            return (
                                                <button
                                                    key={opt.value}
                                                    type="button"
                                                    onClick={() => update('role', opt.value as UserRole)}
                                                    className={`p-4 rounded-xl border-2 text-center transition-all duration-200 ${selected
                                                        ? 'border-indigo-500 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.2)]'
                                                        : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                                                        }`}
                                                >
                                                    <div className="flex flex-col items-center gap-2">
                                                        <div className={`p-2 rounded-lg ${selected ? 'bg-indigo-500 text-white' : 'bg-slate-800 text-slate-400'}`}>
                                                            {opt.value === 'HR' ? (
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                                                                </svg>
                                                            ) : (
                                                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
                                                                </svg>
                                                            )}
                                                        </div>
                                                        <span className={`text-sm font-bold ${selected ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                            {opt.label}
                                                        </span>
                                                    </div>
                                                </button>
                                            );
                                        })}
                                    </div>
                                    {fieldErrors.role && (
                                        <p className="text-xs font-medium text-rose-400 mt-1" role="alert">{fieldErrors.role}</p>
                                    )}
                                </div>

                                {form.role === 'CANDIDATE' && (
                                    <div className="flex flex-col gap-5 animate-fade-in">
                                        {/* Experience Level Cards */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                Experience Level <span style={{ color: 'var(--accent-danger)' }}>*</span>
                                            </label>
                                            <div className="grid grid-cols-2 gap-3">
                                                {EXPERIENCE_OPTIONS.map((opt) => {
                                                    const selected = form.experienceLevel === opt.value;
                                                    return (
                                                        <button
                                                            key={opt.value}
                                                            type="button"
                                                            onClick={() => update('experienceLevel', opt.value)}
                                                            className={`p-3 rounded-xl border-2 text-center transition-all duration-200 ${selected
                                                                    ? 'border-indigo-500 bg-indigo-500/10 shadow-sm'
                                                                    : 'border-slate-800 bg-slate-900/40 hover:border-slate-600'
                                                                }`}
                                                        >
                                                            <span className={`text-sm font-bold ${selected ? 'text-indigo-300' : 'text-slate-300'}`}>
                                                                {opt.label}
                                                            </span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                            {fieldErrors.experienceLevel && (
                                                <p className="text-xs font-medium text-rose-400 mt-1" role="alert">{fieldErrors.experienceLevel}</p>
                                            )}
                                        </div>

                                        <AccessibleSelect
                                            id="reg-interested-role"
                                            label="Interested Role"
                                            options={INTERESTED_ROLE_OPTIONS}
                                            placeholder="Select your preferred role"
                                            value={form.interestedRole}
                                            onChange={(e) => update('interestedRole', e.target.value)}
                                            error={fieldErrors.interestedRole}
                                            required
                                        />

                                        <AccessibleFormInput
                                            id="reg-github"
                                            label="GitHub Profile URL"
                                            type="url"
                                            placeholder="https://github.com/username"
                                            value={form.githubProfile}
                                            onChange={(e) => update('githubProfile', e.target.value)}
                                            error={fieldErrors.githubProfile}
                                            icon={
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22" />
                                                </svg>
                                            }
                                        />

                                        <AccessibleFormInput
                                            id="reg-linkedin"
                                            label="LinkedIn Profile URL"
                                            type="url"
                                            placeholder="https://linkedin.com/in/username"
                                            value={form.linkedinProfile}
                                            onChange={(e) => update('linkedinProfile', e.target.value)}
                                            error={fieldErrors.linkedinProfile}
                                            icon={
                                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
                                                    <rect x="2" y="9" width="4" height="12" />
                                                    <circle cx="4" cy="4" r="2" />
                                                </svg>
                                            }
                                        />
                                    </div>
                                )}

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
                                            <LoadingSpinner size="sm" label="Creating account…" />
                                            <span>Creating account…</span>
                                        </>
                                    ) : (
                                        <>
                                            <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                            </svg>
                                            Create account
                                        </>
                                    )}
                                </button>
                            </div>
                        </form>
                    )}

                    <p className="mt-6 text-center text-sm" style={{ color: 'var(--text-secondary)' }}>
                        Already have an account?{' '}
                        <Link
                            href="/login"
                            className="font-semibold transition-colors focus:outline-none focus-visible:underline"
                            style={{ color: 'var(--accent-primary-hover)' }}
                        >
                            Sign in
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
