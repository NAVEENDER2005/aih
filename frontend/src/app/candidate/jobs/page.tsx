'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import LoadingSpinner from '@/components/LoadingSpinner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Types ──────────────────────────────────────────────── */
interface OpenJob {
    id: string;
    title: string;
    description: string;
    department: string | null;
    location: string | null;
    status: string;
    requiredSkills: string[];
    createdAt: string | null;
    applicantCount: number;
    alreadyApplied: boolean;
}

/* ─── Nav ─────────────────────────────────────────────────── */
const NAV_ITEMS = [
    {
        href: '/candidate/dashboard',
        label: 'My Applications',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
                <line x1="16" y1="17" x2="8" y2="17" />
            </svg>
        ),
    },
    {
        href: '/candidate/jobs',
        label: 'Browse Jobs',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
        ),
    },
    {
        href: '/candidate/profile',
        label: 'My Profile',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
            </svg>
        ),
    },
];

/* ─── Apply Modal ────────────────────────────────────────── */
interface ApplyModalProps {
    job: OpenJob;
    token: string | null;
    onClose: () => void;
    onSuccess: (jobId: string) => void;
}

function ApplyModal({ job, token, onClose, onSuccess }: ApplyModalProps) {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [formData, setFormData] = useState({
        tenthPercentage: '',
        twelfthPercentage: '',
        degreeName: '',
        collegeName: '',
        collegePercentage: '',
        graduationYear: new Date().getFullYear().toString()
    });

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const tenth = parseFloat(formData.tenthPercentage);
        const twelfth = parseFloat(formData.twelfthPercentage);
        const college = parseFloat(formData.collegePercentage);

        if (tenth < 60) {
            setError('10th percentage must be at least 60%.');
            return;
        }
        if (twelfth < 60) {
            setError('12th percentage must be at least 60%.');
            return;
        }
        
        // For College CGPA/Percentage, 6.0 CGPA is generally considered 60%
        const isCGPA = college <= 10;
        if (isCGPA && college < 6.0) {
            setError('College CGPA must be at least 6.0.');
            return;
        } else if (!isCGPA && college < 60) {
            setError('College percentage must be at least 60%.');
            return;
        }

        if (!token) return;
        setLoading(true);
        setError('');
        try {
            await api.post(`/api/applications/apply/${job.id}`, {
                ...formData,
                tenthPercentage: tenth,
                twelfthPercentage: twelfth,
                collegePercentage: college,
                graduationYear: parseInt(formData.graduationYear)
            }, token);
            onSuccess(job.id);
            onClose();
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setLoading(false);
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={e => e.target === e.currentTarget && onClose()}>
            <div className="w-full max-w-lg glass-card p-8 animate-slide-up flex flex-col gap-6" style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-bold">Apply for {job.title}</h3>
                        <p className="text-sm text-slate-400 mt-1">Please provide your academic details to continue.</p>
                    </div>
                    <button onClick={onClose} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                <form onSubmit={handleSubmit} className="flex flex-col gap-5">
                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">10th Percentage %</span>
                            <input required type="number" step="0.01" min="0" max="100" placeholder="e.g. 85.50"
                                value={formData.tenthPercentage} onChange={e => setFormData({ ...formData, tenthPercentage: e.target.value })}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">12th Percentage %</span>
                            <input required type="number" step="0.01" min="0" max="100" placeholder="e.g. 88.20"
                                value={formData.twelfthPercentage} onChange={e => setFormData({ ...formData, twelfthPercentage: e.target.value })}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all" />
                        </label>
                    </div>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Degree / Course Name</span>
                        <input required type="text" placeholder="e.g. B.Tech Computer Science"
                            value={formData.degreeName} onChange={e => setFormData({ ...formData, degreeName: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all" />
                    </label>

                    <label className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">College / University Name</span>
                        <input required type="text" placeholder="e.g. Indian Institute of Technology"
                            value={formData.collegeName} onChange={e => setFormData({ ...formData, collegeName: e.target.value })}
                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all" />
                    </label>

                    <div className="grid grid-cols-2 gap-4">
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">College CGPA / %</span>
                            <input required type="number" step="0.01" min="0" max="100" placeholder="e.g. 9.20"
                                value={formData.collegePercentage} onChange={e => setFormData({ ...formData, collegePercentage: e.target.value })}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all" />
                        </label>
                        <label className="flex flex-col gap-1.5">
                            <span className="text-xs font-bold uppercase tracking-wider text-slate-500">Graduation Year</span>
                            <input required type="number" min="1990" max="2030"
                                value={formData.graduationYear} onChange={e => setFormData({ ...formData, graduationYear: e.target.value })}
                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all" />
                        </label>
                    </div>

                    <button type="submit" disabled={loading}
                        className="mt-4 bg-gradient-to-r from-indigo-500 to-purple-600 text-white font-bold py-3.5 rounded-xl hover:scale-[1.02] transition-all disabled:opacity-50">
                        {loading ? 'Submitting Application...' : 'Confirm and Apply'}
                    </button>
                </form>
            </div>
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function CandidateJobsPage() {
    const { token } = useAuth();

    const [jobs, setJobs] = useState<OpenJob[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [applyingJob, setApplyingJob] = useState<OpenJob | null>(null);
    const [successId, setSuccessId] = useState<string | null>(null);
    const [search, setSearch] = useState('');

    const loadJobs = useCallback(async () => {
        if (!token) return;
        setLoading(true);
        setError('');
        try {
            const data = await api.get<OpenJob[]>('/api/jobs/open', token);
            setJobs(data);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { loadJobs(); }, [loadJobs]);

    function handleApplySuccess(jobId: string) {
        setSuccessId(jobId);
        // Mark as applied locally
        setJobs(prev => prev.map(j => j.id === jobId ? { ...j, alreadyApplied: true } : j));
        setTimeout(() => setSuccessId(null), 3000);
    }

    const filtered = jobs.filter(j =>
        !search ||
        j.title.toLowerCase().includes(search.toLowerCase()) ||
        (j.department ?? '').toLowerCase().includes(search.toLowerCase()) ||
        j.requiredSkills.some(s => s.toLowerCase().includes(search.toLowerCase()))
    );

    return (
        <ProtectedRoute requiredRole="CANDIDATE">
            <DashboardLayout navItems={NAV_ITEMS} title="Browse Jobs">
                <div className="flex flex-col gap-6">

                    {/* Search bar */}
                    <div className="glass-card p-4 flex items-center gap-3 animate-fade-in">
                        <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24"
                            fill="none" stroke="currentColor" strokeWidth="2"
                            style={{ color: 'var(--text-muted)', flexShrink: 0 }}>
                            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                        </svg>
                        <input
                            type="search"
                            placeholder="Search by title, department, or skill…"
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="bg-transparent outline-none flex-1 text-sm"
                            style={{ color: 'var(--text-primary)' }}
                            aria-label="Search open jobs"
                        />
                        {search && (
                            <button onClick={() => setSearch('')} aria-label="Clear search"
                                style={{ color: 'var(--text-muted)' }}>
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                    stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        )}
                    </div>

                    {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                    {/* Job count summary */}
                    {!loading && (
                        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {filtered.length} open {filtered.length === 1 ? 'position' : 'positions'} available
                        </p>
                    )}

                    {/* Jobs grid */}
                    {loading ? (
                        <div className="flex justify-center py-12">
                            <LoadingSpinner size="lg" label="Loading open jobs…" />
                        </div>
                    ) : filtered.length === 0 ? (
                        <div className="glass-card p-12 text-center animate-fade-in">
                            <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24"
                                fill="none" stroke="currentColor" strokeWidth="1.5"
                                className="mx-auto mb-4"
                                style={{ color: 'var(--text-muted)' }}>
                                <rect x="2" y="7" width="20" height="14" rx="2" />
                                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                            </svg>
                            <p style={{ color: 'var(--text-muted)' }}>
                                {search ? 'No jobs match your search.' : 'No open positions right now. Check back soon!'}
                            </p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                            {filtered.map(job => (
                                <article
                                    key={job.id}
                                    className="glass-card p-6 flex flex-col gap-4 animate-fade-in"
                                    aria-label={`Job: ${job.title}`}
                                >
                                    {/* Header */}
                                    <div className="flex items-start justify-between gap-3">
                                        <div className="flex-1 min-w-0">
                                            <h2 className="text-base font-bold truncate"
                                                style={{ color: 'var(--text-primary)' }}>
                                                {job.title}
                                            </h2>
                                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                                                {job.department && (
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        🏢 {job.department}
                                                    </span>
                                                )}
                                                {job.location && (
                                                    <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                        📍 {job.location}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <span className="badge badge-success shrink-0 text-xs">OPEN</span>
                                    </div>

                                    {/* Description */}
                                    {job.description && (
                                        <p className="text-sm line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                                            {job.description}
                                        </p>
                                    )}

                                    {/* Skills */}
                                    {job.requiredSkills.length > 0 && (
                                        <div className="flex flex-wrap gap-1.5" aria-label="Required skills">
                                            {job.requiredSkills.slice(0, 6).map(skill => (
                                                <span key={skill}
                                                    className="px-2 py-0.5 rounded-full text-xs font-medium"
                                                    style={{
                                                        background: 'var(--info-bg)',
                                                        color: 'var(--info-text)',
                                                        border: '1px solid var(--info-border)',
                                                    }}>
                                                    {skill}
                                                </span>
                                            ))}
                                            {job.requiredSkills.length > 6 && (
                                                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                                    +{job.requiredSkills.length - 6} more
                                                </span>
                                            )}
                                        </div>
                                    )}

                                    {/* Footer */}
                                    <div className="flex items-center justify-between pt-2 border-t"
                                        style={{ borderColor: 'var(--border-subtle)' }}>
                                        <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                                            {job.applicantCount} applicant{job.applicantCount !== 1 ? 's' : ''}
                                        </span>

                                        {job.alreadyApplied ? (
                                            <span
                                                className="px-4 py-2 rounded-lg text-xs font-semibold"
                                                style={{
                                                    background: 'var(--success-bg)',
                                                    color: 'var(--success-text)',
                                                    border: '1px solid var(--success-border)',
                                                }}>
                                                ✓ Applied
                                            </span>
                                        ) : successId === job.id ? (
                                            <span
                                                className="px-4 py-2 rounded-lg text-xs font-semibold animate-fade-in"
                                                style={{
                                                    background: 'var(--success-bg)',
                                                    color: 'var(--success-text)',
                                                    border: '1px solid var(--success-border)',
                                                }}>
                                                🎉 Applied!
                                            </span>
                                        ) : (
                                            <button
                                                type="button"
                                                onClick={() => setApplyingJob(job)}
                                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                                style={{
                                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                                    color: '#fff',
                                                    boxShadow: 'var(--shadow-glow)',
                                                }}
                                            >
                                                <svg aria-hidden="true" width="13" height="13" viewBox="0 0 24 24"
                                                    fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <line x1="12" y1="5" x2="12" y2="19" />
                                                    <line x1="5" y1="12" x2="19" y2="12" />
                                                </svg>
                                                Apply Now
                                            </button>
                                        )}
                                    </div>
                                </article>
                            ))}
                        </div>
                    )}
                </div>

                {applyingJob && (
                    <ApplyModal
                        job={applyingJob}
                        token={token ?? null}
                        onClose={() => setApplyingJob(null)}
                        onSuccess={handleApplySuccess}
                    />
                )}
            </DashboardLayout>
        </ProtectedRoute>
    );
}
