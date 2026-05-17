'use client';

import React, { useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import LoadingSpinner from '@/components/LoadingSpinner';

/* ─── Nav ──────────────────────────────────────────────── */
const NAV_ITEMS = [
    {
        href: '/candidate/dashboard',
        label: 'Dashboard',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="9" rx="1" />
                <rect x="14" y="3" width="7" height="5" rx="1" />
                <rect x="14" y="12" width="7" height="9" rx="1" />
                <rect x="3" y="16" width="7" height="5" rx="1" />
            </svg>
        ),
    },
    {
        href: '/candidate/jobs',
        label: 'Browse Jobs',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
        ),
    },
    {
        href: '/candidate/profile',
        label: 'My Profile',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                <circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
];

/* ─── Types ────────────────────────────────────────────── */
interface CandidateProfile {
    id: string;
    name: string;
    email: string;
    experienceLevel: string | null;
    interestedRole: string | null;
    githubProfile: string | null;
    linkedinProfile: string | null;
    githubScore: number | null;
    linkedinScore: number | null;
    githubSummary: string | null;
    linkedinSummary: string | null;
    detectedSkills: string[] | null;
    aiProcessed: boolean;
}

/* ─── Component ─────────────────────────────────────────── */
export default function CandidateProfilePage() {
    const { token } = useAuth();
    const [profile, setProfile] = useState<CandidateProfile | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let active = true;
        async function loadProfile() {
            if (!token) return;
            try {
                const data = await api.get<CandidateProfile>('/api/candidate/profile', token);
                if (active) setProfile(data);
            } catch (err) {
                if (active) setError((err as ApiError).message || 'Failed to load profile.');
            } finally {
                if (active) setLoading(false);
            }
        }
        loadProfile();
        return () => { active = false; };
    }, [token]);

    function scorePill(score: number | null) {
        if (score == null) {
            return (
                <span className="inline-flex py-1 px-3 text-xs font-bold rounded-full bg-slate-100 text-slate-500 border border-slate-200 shadow-sm opacity-60">
                    Not Analyzed
                </span>
            );
        }
        const color = score >= 75 ? '#10b981' : score >= 50 ? '#f59e0b' : '#ef4444';
        const bg = score >= 75 ? 'rgba(16,185,129,0.1)' : score >= 50 ? 'rgba(245,158,11,0.1)' : 'rgba(239,68,68,0.1)';
        return (
            <span
                className="inline-flex py-1 px-3 text-xs font-bold rounded-xl shadow-sm tracking-wide border"
                style={{ background: bg, color, borderColor: `${color}40`, minWidth: '3.5rem', justifyContent: 'center' }}
            >
                {Math.round(score)} / 100
            </span>
        );
    }

    return (
        <ProtectedRoute requiredRole="CANDIDATE">
            <DashboardLayout navItems={NAV_ITEMS} title="My Profile">
                <main className="max-w-4xl mx-auto space-y-6 pb-20 animate-fade-in pt-4">
                    {/* Header Details */}
                    <div className="flex flex-col md:flex-row gap-6">
                        <div className="w-full md:w-1/3 glass-card p-6 flex flex-col items-center justify-center text-center">
                            <div className="w-24 h-24 rounded-2xl flex items-center justify-center text-4xl mb-4 font-bold shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-white">
                                {profile?.name ? profile.name.charAt(0).toUpperCase() : '👤'}
                            </div>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                {profile?.name || 'Loading...'}
                            </h2>
                            <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                                {profile?.email}
                            </p>
                            {profile?.experienceLevel && (
                                <p className="text-xs font-semibold mt-3 px-3 py-1 bg-indigo-500/10 text-indigo-400 rounded-full border border-indigo-500/20">
                                    {profile.experienceLevel} Experience
                                </p>
                            )}
                        </div>

                        <div className="w-full md:w-2/3 glass-card p-6">
                            <h3 className="text-lg font-bold mb-5" style={{ color: 'var(--text-primary)' }}>
                                Professional Overview
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-4 text-sm">
                                <div>
                                    <p className="font-semibold text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>Interested Role</p>
                                    <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>
                                        {profile?.interestedRole || 'Not Specified'}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-semibold text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>GitHub Profile</p>
                                    <p className="font-medium truncate">
                                        {profile?.githubProfile ? (
                                            <a href={profile.githubProfile} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                                                {profile.githubProfile}
                                            </a>
                                        ) : 'Not Provided'}
                                    </p>
                                </div>
                                <div>
                                    <p className="font-semibold text-xs uppercase tracking-wider mb-1" style={{ color: 'var(--text-muted)' }}>LinkedIn Profile</p>
                                    <p className="font-medium truncate">
                                        {profile?.linkedinProfile ? (
                                            <a href={profile.linkedinProfile} target="_blank" rel="noreferrer" className="text-indigo-400 hover:underline">
                                                {profile.linkedinProfile}
                                            </a>
                                        ) : 'Not Provided'}
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}
                    {loading && (
                        <div className="flex justify-center py-10">
                            <LoadingSpinner size="lg" label="Loading Profile..." />
                        </div>
                    )}

                    {!loading && profile && (
                        <>
                            {/* AI Insights Module */}
                            <div className="glass-card p-1 rounded-[1.5rem] bg-gradient-to-r from-emerald-500/30 via-teal-500/30 to-cyan-500/30 mt-6 relative overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-cyan-500/10 blur-[50px] pointer-events-none" />
                                <div className="rounded-[1.35rem] p-6 lg:p-8" style={{ background: 'var(--bg-base)' }}>
                                    <div className="flex items-center gap-3 mb-6">
                                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-400 to-cyan-500 flex items-center justify-center text-white shadow-lg">
                                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path d="M12 6v6l4 2" /></svg>
                                        </div>
                                        <h3 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>AI Resume Analysis</h3>
                                        {!profile.aiProcessed && (
                                            <span className="ml-auto text-xs font-semibold px-3 py-1 bg-amber-500/10 text-amber-500 rounded-lg border border-amber-500/20">
                                                Analysis in progress...
                                            </span>
                                        )}
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        {/* GitHub Analysis */}
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-inner">
                                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-primary)' }}><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>GitHub Technical Read</span>
                                                </div>
                                                {scorePill(profile.githubScore)}
                                            </div>
                                            <p className="text-xs leading-relaxed max-h-48 overflow-y-auto pr-2 custom-scrollbar" style={{ color: 'var(--text-secondary)' }}>
                                                {profile.githubSummary || 'No analysis available for GitHub. Assure the profile is valid.'}
                                            </p>
                                        </div>

                                        {/* LinkedIn Analysis */}
                                        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 shadow-inner">
                                            <div className="flex items-center justify-between mb-3 border-b border-white/10 pb-3">
                                                <div className="flex items-center gap-2">
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#0ea5e9' }}><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                                                    <span className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>LinkedIn Network Read</span>
                                                </div>
                                                {scorePill(profile.linkedinScore)}
                                            </div>
                                            <p className="text-xs leading-relaxed max-h-48 overflow-y-auto pr-2 custom-scrollbar" style={{ color: 'var(--text-secondary)' }}>
                                                {profile.linkedinSummary || 'No analysis available for LinkedIn. Assure the profile is public.'}
                                            </p>
                                        </div>
                                    </div>

                                    {/* Skills Array */}
                                    <div className="mt-8">
                                        <span className="text-xs font-black uppercase tracking-wider mb-3 block" style={{ color: 'var(--text-muted)' }}>Detected Competencies</span>
                                        <div className="flex flex-wrap gap-2">
                                            {profile.detectedSkills && profile.detectedSkills.length > 0 ? (
                                                profile.detectedSkills.map((s, idx) => (
                                                    <span key={idx} className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white/5 border border-white/10 hover:border-indigo-400 hover:bg-white/10 transition-colors" style={{ color: 'var(--text-primary)' }}>
                                                        {s}
                                                    </span>
                                                ))
                                            ) : (
                                                <span className="text-xs italic opacity-60">No competencies detected yet.</span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}
                </main>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
