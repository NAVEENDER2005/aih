'use client';

import React, { FormEvent, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import ErrorAlert from '@/components/ErrorAlert';
import LoadingSpinner from '@/components/LoadingSpinner';
import AccessibleFormInput from '@/components/AccessibleFormInput';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import AccessibleSelect from '@/components/AccessibleSelect';

/* ─── Types ──────────────────────────────────────────────── */
interface Job {
    id: string;
    title: string;
    department: string;
    location: string;
    status: string;
    createdAt: string;
    applicantCount?: number;
    activeRound: number;
    totalRounds: number;
    roundStatus: 'NOT_STARTED' | 'ROUND_ACTIVE' | 'ROUND_COMPLETED' | 'CLOSED';
}

interface Application {
    id: string;
    candidateName: string;
    candidateEmail: string;
    jobTitle: string;
    stage: string;
    aiScore: number | null;
    humanScore: number | null;
    recommendation: string | null;
    attemptCount: number;
    status: string;
    currentRound: number;
    testStatus: string;
    stages?: {
        stage: string;
        aiScore: number;
        status: string;
        feedback?: {
            reasoning?: string;
            confidence?: number;
            skillBreakdown?: Record<string, number>;
            [key: string]: unknown;
        };
    }[];
}

/* ─── Nav items ──────────────────────────────────────────── */
const DEPARTMENTS = [
    { value: 'Engineering - Software & QA', label: 'Engineering - Software & QA' },
    { value: 'IT & Information Security', label: 'IT & Information Security' },
    { value: 'Data Science & Analytics', label: 'Data Science & Analytics' },
    { value: 'Project & Program Management', label: 'Project & Program Management' },
    { value: 'Consulting', label: 'Consulting' },
    { value: 'UX, Design & Architecture', label: 'UX, Design & Architecture' },
    { value: 'Cloud and Infrastructure', label: 'Cloud and Infrastructure' },
    { value: 'Sales & Business Development', label: 'Sales & Business Development' },
    { value: 'Human Resources', label: 'Human Resources' },
    { value: 'Finance & Accounting', label: 'Finance & Accounting' },
    { value: 'Emerging Tech (AI/ML, Gen AI)', label: 'Emerging Tech (AI/ML, Gen AI)' },
];

const LOCATIONS = [
    { value: 'Southborough, Massachusetts, USA', label: 'Southborough, Massachusetts, USA' },
    { value: 'New York, USA', label: 'New York, USA' },
    { value: 'Piscataway, New Jersey, USA', label: 'Piscataway, New Jersey, USA' },
    { value: 'Windsor, Connecticut, USA', label: 'Windsor, Connecticut, USA' },
    { value: 'Indianapolis, Indiana, USA', label: 'Indianapolis, Indiana, USA' },
    { value: 'Tampa, Florida, USA', label: 'Tampa, Florida, USA' },
    { value: 'Toronto, Canada', label: 'Toronto, Canada' },
    { value: 'Halifax, Canada', label: 'Halifax, Canada' },
    { value: 'Guadalajara, Mexico', label: 'Guadalajara, Mexico' },
    { value: 'Vienna, Austria', label: 'Vienna, Austria' },
    { value: 'Neuchâtel, Switzerland', label: 'Neuchâtel, Switzerland' },
    { value: 'Eschborn, Germany', label: 'Eschborn, Germany' },
    { value: 'London, United Kingdom', label: 'London, United Kingdom' },
    { value: 'Dubai, United Arab Emirates', label: 'Dubai, United Arab Emirates' },
    { value: 'Chennai, Tamil Nadu, India', label: 'Chennai, Tamil Nadu, India' },
    { value: 'Hyderabad, Telangana, India', label: 'Hyderabad, Telangana, India' },
    { value: 'Bengaluru, Karnataka, India', label: 'Bengaluru, Karnataka, India' },
    { value: 'Pune, Maharashtra, India', label: 'Pune, Maharashtra, India' },
    { value: 'Thane, Maharashtra, India', label: 'Thane, Maharashtra, India' },
    { value: 'Gurugram, Haryana, India', label: 'Gurugram, Haryana, India' },
    { value: 'Singapore, Singapore', label: 'Singapore, Singapore' },
    { value: 'Petaling Jaya, Malaysia', label: 'Petaling Jaya, Malaysia' },
    { value: 'Sydney, Australia', label: 'Sydney, Australia' },
    { value: 'Melbourne, Australia', label: 'Melbourne, Australia' },
    { value: 'Colombo, Sri Lanka', label: 'Colombo, Sri Lanka' },
];

const ROLES = [
    { value: 'Software Engineer / Developer', label: 'Software Engineer / Developer' },
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

const NAV_ITEMS = [
    {
        href: '/hr/dashboard',
        label: 'Dashboard',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" /><rect x="14" y="14" width="7" height="7" />
            </svg>
        ),
    },
    {
        href: '/hr/jobs',
        label: 'Jobs',
        icon: (
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="2" y="7" width="20" height="14" rx="2" ry="2" />
                <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
            </svg>
        ),
    },
];

/* ─── Page component ─────────────────────────────────────── */
export default function HRJobsPage() {
    const { token } = useAuth();
    const router = useRouter();

    /* Data state */
    const [jobs, setJobs] = useState<Job[]>([]);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [jobApps, setJobApps] = useState<Application[]>([]);
    const [loadingJobApps, setLoadingJobApps] = useState(false);
    const [viewingApp, setViewingApp] = useState<Application | null>(null);

    /* UI state */
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [error, setError] = useState('');
    const [showJobForm, setShowJobForm] = useState(false);

    /* Job-create form state */
    const [jobForm, setJobForm] = useState({ title: '', department: '', location: '', description: '' });
    const [jobFormErrors, setJobFormErrors] = useState<Partial<typeof jobForm>>({});
    const [jobSubmitting, setJobSubmitting] = useState(false);
    const [jobSuccess, setJobSuccess] = useState(false);

    /* ── Data loaders ─────────────────────────────────────── */
    const loadJobs = useCallback(async () => {
        if (!token) return;
        setLoadingJobs(true);
        setError('');
        try {
            const data = await api.get<Job[]>('/api/hr/jobs', token);
            setJobs(data);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setLoadingJobs(false);
        }
    }, [token]);

    useEffect(() => {
        loadJobs();
    }, [loadJobs]);

    /* ── Round actions ────────────────────────────────────── */
    // Round-level actions moved to /hr/jobs/[jobId]

    /* ── Load applications per job ────────────────────────── */
    const loadJobApplications = useCallback(async (jobId: string) => {
        if (!token) return;
        setLoadingJobApps(true);
        setSelectedJobId(jobId);
        setJobApps([]);
        try {
            const data = await api.get<Application[]>(`/api/applications/job/${jobId}`, token);
            setJobApps(data);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setLoadingJobApps(false);
        }
    }, [token]);

    /* ── Job form ─────────────────────────────────────────── */
    function validateJobForm() {
        const errs: Partial<typeof jobForm> = {};
        if (!jobForm.title.trim()) errs.title = 'Job title is required.';
        if (!jobForm.department.trim()) errs.department = 'Department is required.';
        if (!jobForm.location.trim()) errs.location = 'Location is required.';
        if (!jobForm.description.trim()) errs.description = 'Job description is required.';
        return errs;
    }

    async function handleCreateJob(e: FormEvent) {
        e.preventDefault();
        const errs = validateJobForm();
        setJobFormErrors(errs);
        if (Object.keys(errs).length) return;
        setJobSubmitting(true);
        try {
            await api.post('/api/hr/jobs', jobForm, token);
            setJobSuccess(true);
            setJobForm({ title: '', department: '', location: '', description: '' });
            loadJobs();
            setTimeout(() => { setJobSuccess(false); setShowJobForm(false); }, 2000);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setJobSubmitting(false);
        }
    }

    /* ── Columns ──────────────────────────────────────────── */
    const jobColumns: Column<Job>[] = [
        { key: 'title', header: 'Job Title', sortable: true },
        { key: 'department', header: 'Department', sortable: true },
        { key: 'location', header: 'Location' },
        {
            key: 'activeRound', header: 'Status',
            render: (_v, row) => (
                <div className="flex flex-col gap-1.5">
                    <div className="flex items-center gap-2">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${row.roundStatus === 'ROUND_ACTIVE' ? 'badge-primary' :
                            row.roundStatus === 'ROUND_COMPLETED' ? 'badge-success' :
                                'badge-neutral'
                            }`}>
                            {row.roundStatus.replace('_', ' ')}
                        </span>
                        {row.activeRound > 0 && (
                            <span className="text-xs font-semibold text-slate-400">
                                Round {row.activeRound}
                            </span>
                        )}
                    </div>
                </div>
            )
        },
        {
            key: 'createdAt', header: 'Posted', sortable: true,
            render: (v) => new Date(String(v)).toLocaleDateString()
        },
        {
            key: 'applicantCount', header: 'Applicants', sortable: true,
            render: (v) => <span className="font-mono">{Number(v ?? 0)}</span>
        },
        {
            key: 'id', header: 'Actions',
            render: (_v, row) => (
                <button
                    type="button"
                    onClick={() => router.push(`/hr/jobs/${row.id}`)}
                    aria-label={`View details for ${row.title}`}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg font-semibold transition-all hover:scale-105 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    style={{
                        background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                        color: '#fff',
                        boxShadow: '0 2px 8px rgba(99,102,241,0.3)',
                    }}
                >
                    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                    View Details
                </button>
            ),
        },
    ];

    const appColumns: Column<Application>[] = [
        { key: 'candidateName', header: 'Candidate', sortable: true },
        {
            key: 'currentRound', header: 'Round',
            render: (v) => <span className="font-semibold text-indigo-400">R{Number(v)}</span>
        },
        {
            key: 'testStatus', header: 'Test Status',
            render: (v) => {
                const val = String(v);
                let cls = 'badge-neutral';
                if (val === 'AVAILABLE') cls = 'badge-primary';
                if (val === 'IN_PROGRESS') cls = 'badge-warning animate-pulse';
                if (val === 'COMPLETED') cls = 'badge-success';
                return <span className={`badge ${cls}`}>{val}</span>;
            }
        },
        {
            key: 'aiScore', header: 'AI Score',
            render: (v) => v ? (
                <div className="flex items-center gap-2">
                    <div className="w-12 h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div className="h-full bg-indigo-500" style={{ width: `${v}%` }} />
                    </div>
                    <span className="font-mono text-xs">{Number(v)}%</span>
                </div>
            ) : <span className="text-slate-600">—</span>
        },
        {
            key: 'recommendation', header: 'Action',
            render: (v) => v ? (
                <span className={`font-bold text-xs ${v === 'PASS' ? 'text-emerald-600' : 'text-rose-600'}`}>{String(v)}</span>
            ) : <span className="text-slate-400">Pending</span>
        },
        {
            key: 'explanation', header: 'Analysis',
            render: (_v, row) => row.testStatus === 'COMPLETED' ? (
                <button
                    onClick={() => setViewingApp(row)}
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold underline underline-offset-4 transition-colors"
                >
                    View Explanation
                </button>
            ) : <span className="text-slate-600">—</span>
        }
    ];

    return (
        <ProtectedRoute requiredRole="HR">
            <DashboardLayout navItems={NAV_ITEMS} title="Manage Job Postings">
                <div className="flex flex-col gap-6">
                    {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                    <div className="flex items-center justify-between">
                        <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                            Job Postings
                        </h2>
                        <button
                            type="button"
                            onClick={() => setShowJobForm((v) => !v)}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                boxShadow: 'var(--shadow-glow)',
                            }}
                        >
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                            </svg>
                            {showJobForm ? 'Cancel' : 'Post New Job'}
                        </button>
                    </div>

                    {showJobForm && (
                        <div className="glass-card p-6 animate-fade-in shadow-xl" style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)' }}>
                            <h3 className="text-lg font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Create Job Posting</h3>
                            {jobSuccess && (
                                <div className="mb-4 text-sm p-3 rounded-lg flex items-center gap-2" style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}>
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                    Job posted successfully!
                                </div>
                            )}
                            <form onSubmit={handleCreateJob} className="grid grid-cols-1 md:grid-cols-2 gap-5">
                                <AccessibleSelect
                                    id="job-title"
                                    label="Job Title"
                                    options={ROLES}
                                    placeholder="Select a role"
                                    value={jobForm.title}
                                    onChange={(e) => setJobForm(p => ({ ...p, title: e.target.value }))}
                                    error={jobFormErrors.title}
                                    required
                                />
                                <AccessibleSelect
                                    id="job-dept"
                                    label="Department"
                                    options={DEPARTMENTS}
                                    placeholder="Select building department"
                                    value={jobForm.department}
                                    onChange={(e) => setJobForm(p => ({ ...p, department: e.target.value }))}
                                    error={jobFormErrors.department}
                                    required
                                />
                                <AccessibleSelect
                                    id="job-loc"
                                    label="Location"
                                    options={LOCATIONS}
                                    placeholder="Select job office location"
                                    value={jobForm.location}
                                    onChange={(e) => setJobForm(p => ({ ...p, location: e.target.value }))}
                                    error={jobFormErrors.location}
                                    required
                                />

                                <div className="flex items-end">
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!jobForm.title || !jobForm.department || !jobForm.location) {
                                                alert('Please select Title, Department and Location first.');
                                                return;
                                            }
                                            setJobSubmitting(true);
                                            try {
                                                const res = await api.post<{ responsibilities: string, summary: string, skills: string[] }>('/api/jobs/ai-generate-description', jobForm, token);
                                                setJobForm(p => ({
                                                    ...p,
                                                    description: `${res.summary}\n\nResponsibilities:\n${res.responsibilities}`
                                                }));
                                            } catch (e) {
                                                setError((e as ApiError).message);
                                            } finally {
                                                setJobSubmitting(false);
                                            }
                                        }}
                                        disabled={jobSubmitting}
                                        className="mb-1.5 px-4 py-2 rounded-lg text-xs font-bold border border-indigo-500/30 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 transition-all active:scale-95 disabled:opacity-50"
                                    >
                                        {jobSubmitting ? '...' : '✨ Generate with AI'}
                                    </button>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-semibold mb-1.5" style={{ color: 'var(--text-primary)' }}>Job Description *</label>
                                    <textarea
                                        className="w-full rounded-lg border px-4 py-3 text-sm transition-all focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                                        style={{
                                            background: 'var(--bg-elevated)',
                                            color: 'var(--text-primary)',
                                            borderColor: 'var(--border-default)',
                                        }}
                                        rows={6}
                                        value={jobForm.description}
                                        onChange={(e) => setJobForm(p => ({ ...p, description: e.target.value }))}
                                        required
                                        placeholder="AI will generate this for you if you click the sparkle button..."
                                    />
                                    {jobFormErrors.description && <p className="text-xs font-medium mt-1" style={{ color: 'var(--accent-danger)' }}>{jobFormErrors.description}</p>}
                                </div>
                                <div className="md:col-span-2">
                                    <button
                                        type="submit"
                                        disabled={jobSubmitting}
                                        className="px-6 py-2.5 rounded-lg text-sm font-semibold transition-all hover:opacity-90 disabled:opacity-50"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: '#fff',
                                            boxShadow: 'var(--shadow-glow)',
                                        }}
                                    >
                                        {jobSubmitting ? <LoadingSpinner size="sm" label="Posting..." /> : 'Publish Job'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    )}

                    <DataTable
                        caption="Overview of all open and closed job positions"
                        columns={jobColumns}
                        data={jobs}
                        isLoading={loadingJobs}
                        emptyMessage="No job postings found. Start by creating your first listing."
                    />

                    {selectedJobId && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
                        >
                            <div className="w-full max-w-5xl glass-card p-6 animate-slide-up overflow-y-auto max-h-[90vh]">
                                <div className="flex items-center justify-between mb-4">
                                    <h3 className="text-lg font-bold">Applicants</h3>
                                    <button
                                        onClick={() => setSelectedJobId(null)}
                                        aria-label="Close applicants modal"
                                        className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                    >
                                        ✕
                                    </button>
                                </div>
                                <DataTable
                                    caption="Applicants for the selected job"
                                    columns={appColumns}
                                    data={jobApps}
                                    isLoading={loadingJobApps}
                                    emptyMessage="No applicants for this job."
                                />
                            </div>
                        </div>
                    )}

                    {viewingApp && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xl animate-fade-in"
                        >
                            <div className="w-full max-w-2xl bg-[#0f1016] border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-[0_22px_70px_8px_rgba(0,0,0,0.56)] overflow-y-auto max-h-[92vh] relative selection:bg-indigo-500/30">
                                {/* Decorative elements */}
                                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/10 blur-[100px] -z-10 rounded-full" />
                                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 blur-[100px] -z-10 rounded-full" />

                                <div className="flex items-start justify-between mb-10">
                                    <div className="flex items-center gap-5">
                                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-[0_8px_20px_rgba(79,70,229,0.3)] ring-1 ring-white/20">
                                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                <path d="M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2zm0 18a8 8 0 1 1 8-8 8 8 0 0 1-8 8z" /><path d="M12 6v6l4 2" />
                                            </svg>
                                        </div>
                                        <div>
                                            <h3 className="text-3xl font-black tracking-tight text-white mb-1">AI Perception Report</h3>
                                            <div className="flex items-center gap-2">
                                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
                                                    {viewingApp.candidateName} <span className="mx-2 text-slate-600">/</span> Round {viewingApp.currentRound}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setViewingApp(null)}
                                        aria-label="Close report"
                                        className="group p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all duration-300"
                                    >
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform duration-300">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                                    <div className="group relative overflow-hidden p-8 rounded-[2rem] bg-indigo-500/5 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-500">
                                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
                                        <div className="relative flex flex-col items-center">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Overall Score</span>
                                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-indigo-400 tracking-tighter">
                                                {viewingApp.aiScore || 0}%
                                            </div>
                                            <div className="h-1 w-12 bg-indigo-500/30 rounded-full mt-4" />
                                        </div>
                                    </div>
                                    <div className="group relative overflow-hidden p-8 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-500">
                                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
                                        <div className="relative flex flex-col items-center">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">AI Confidence</span>
                                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-400 tracking-tighter">
                                                {String(viewingApp.stages?.find(s => Number(s.stage?.split('_')[1]) === viewingApp.currentRound)?.feedback?.confidence || 85)}%
                                            </div>
                                            <div className="h-1 w-12 bg-emerald-500/30 rounded-full mt-4" />
                                        </div>
                                    </div>
                                </div>

                                <section className="mb-12">
                                    <div className="flex items-center gap-4 mb-8">
                                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Competency Mapping</h4>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                        {Object.entries(viewingApp.stages?.find(s => Number(s.stage?.split('_')[1]) === viewingApp.currentRound)?.feedback?.skillBreakdown || {
                                            "Technical Accuracy": 88,
                                            "Process Flow": 74,
                                            "Optimization": 91,
                                            "Best Practices": 82
                                        }).map(([skill, score], idx) => (
                                            <div key={skill} className="animate-fade-in group" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className="flex justify-between items-end mb-3">
                                                    <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{skill}</span>
                                                    <span className="text-base font-black text-white">{String(score)}%</span>
                                                </div>
                                                <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden ring-1 ring-white/5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-600 to-indigo-400 rounded-full shadow-[0_0_12px_rgba(99,102,241,0.4)] transition-all duration-1000 ease-out"
                                                        style={{ width: `${Number(score)}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <section className="mb-4">
                                    <div className="flex items-center gap-4 mb-6">
                                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">AI Narrative Analysis</h4>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>
                                    <div className="relative group">
                                        <div className="absolute -inset-1 bg-gradient-to-r from-indigo-500/20 to-purple-500/20 rounded-[2rem] blur opacity-0 group-hover:opacity-100 transition duration-1000" />
                                        <div className="relative p-7 rounded-[2rem] bg-white/[0.03] border border-white/10 text-base leading-relaxed text-slate-300 italic font-medium">
                                            <span className="text-indigo-500 text-3xl font-serif absolute -top-2 -left-1">"</span>
                                            {String(viewingApp.stages?.find(s => Number(s.stage?.split('_')[1]) === viewingApp.currentRound)?.feedback?.reasoning ||
                                                "Candidate demonstrates a highly analytical approach to problem solving with exceptional attention to edge cases. Behavioral traits suggest strong cultural alignment and potential for leadership.")}
                                            <span className="text-indigo-500 text-3xl font-serif absolute -bottom-6 -right-1">"</span>
                                        </div>
                                    </div>
                                </section>

                                <div className="mt-12 flex justify-end">
                                    <button
                                        onClick={() => setViewingApp(null)}
                                        className="group relative px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        Close Analysis
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
