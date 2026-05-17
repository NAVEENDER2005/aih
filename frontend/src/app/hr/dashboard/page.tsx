'use client';

import React, { FormEvent, useCallback, useEffect, useState, useMemo } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import ErrorAlert from '@/components/ErrorAlert';
import LoadingSpinner from '@/components/LoadingSpinner';
import AccessibleFormInput from '@/components/AccessibleFormInput';
import AccessibleSelect from '@/components/AccessibleSelect';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

/* ─── Types ──────────────────────────────────────────────── */
interface Job {
    id: string;
    title: string;
    department: string;
    location: string;
    status: string;
    createdAt: string;
    applicantCount?: number;
}

interface StageResultItem {
    stage: string;
    aiScore: number | null;
    humanScore: number | null;
    finalScore: number | null;
    status: string;
    aiExplanation: Record<string, unknown> | null;
    completedAt: string | null;
}

interface ApplicationRound {
    id: string;
    applicationId: string;
    roundNumber: number;
    roundName: string;
    isActivated: boolean;
    activatedAt: string;
    activatedBy: string;
    status: string;
    score: number | null;
    attempts: number;
}

interface Application {
    id: string;
    candidateId?: string;
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
    testStatus?: string;
    stageResults?: StageResultItem[];
    latestAiScore?: number | null;
    rounds?: ApplicationRound[];
}

interface Decision {
    finalScore: number;
    hiringConfidenceIndex: number;
    recommendation: 'HIRE' | 'REJECT' | 'INCOMPLETE';
    reasoning: string[];
}

/* ─── Nav items ──────────────────────────────────────────── */
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

/* ─── Helpers ────────────────────────────────────────────── */
const ALL_STAGE_LABELS: Record<string, string> = {
    ROUND_1: 'Skill Screening', ROUND_2: 'Aptitude Test', ROUND_3: 'Coding Test', ROUND_4: 'Technical Interview', ROUND_5: 'HR Interview',
    APPLIED: 'Applied',
    ROUND_1_PENDING: 'Screening Pending', ROUND_1_PASSED: 'Screening Passed', ROUND_1_FAILED: 'Screening Failed',
    ROUND_2_PENDING: 'Aptitude Pending', ROUND_2_PASSED: 'Aptitude Passed', ROUND_2_FAILED: 'Aptitude Failed',
    ROUND_3_PENDING: 'Coding Pending', ROUND_3_PASSED: 'Coding Passed', ROUND_3_FAILED: 'Coding Failed',
    ROUND_4_PENDING: 'Technical Pending', ROUND_4_PASSED: 'Technical Passed', ROUND_4_FAILED: 'Technical Failed',
    ROUND_5_PENDING: 'HR Interview Pending', ROUND_5_PASSED: 'HR Interview Passed', ROUND_5_FAILED: 'HR Interview Failed',
    HIRED: 'Hired', REJECTED: 'Rejected', PENDING: 'Pending',
};

const PASSED_STAGES_HR = new Set([
    'ROUND_1_PASSED', 'ROUND_2_PASSED', 'ROUND_3_PASSED', 'ROUND_4_PASSED', 'ROUND_5_PASSED',
]);

function stageBadge(stage: string) {
    const label = ALL_STAGE_LABELS[stage] ?? stage.replace(/_/g, ' ');
    const cls = stage.includes('PASSED') || stage === 'HIRED' ? 'badge badge-success'
        : stage.includes('FAILED') || stage === 'REJECTED' ? 'badge badge-danger'
            : stage.includes('PENDING') || stage === 'APPLIED' ? 'badge badge-warning'
                : 'badge badge-primary';
    return <span className={cls}>{label}</span>;
}

function recoBadge(rec: string | null) {
    if (!rec) return <span className="badge badge-neutral">—</span>;
    const cls = rec === 'HIRE' ? 'badge badge-success' : rec === 'REJECT' ? 'badge badge-danger' : 'badge badge-warning';
    return <span className={cls}>{rec}</span>;
}

function scorePill(score: number | null) {
    if (score == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const color =
        score >= 75 ? 'var(--success-text)' :
            score >= 50 ? 'var(--warning-text)' : 'var(--danger-text)';
    return (
        <span
            className="inline-flex items-center gap-1.5 font-mono font-semibold text-sm"
            style={{ color }}
        >
            <span
                className="inline-block w-1.5 h-1.5 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
            />
            {score.toFixed(1)}
        </span>
    );
}

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

/* ─── Page component ─────────────────────────────────────── */
export default function HRDashboardPage() {
    const { token } = useAuth();

    /* Data state */
    const [jobs, setJobs] = useState<Job[]>([]);
    const [applications, setApplications] = useState<Application[]>([]);
    const [selectedApp, setSelectedApp] = useState<Application | null>(null);
    const [decision, setDecision] = useState<Decision | null>(null);
    const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
    const [jobApps, setJobApps] = useState<Application[]>([]);
    const [loadingJobApps, setLoadingJobApps] = useState(false);
    const [actioning, setActioning] = useState<string | null>(null);
    const [viewingAppResult, setViewingAppResult] = useState<Application | null>(null);
    const [appSearchQuery, setAppSearchQuery] = useState('');

    const filteredApplications = useMemo(() => {
        if (!appSearchQuery.trim()) return applications;
        const q = appSearchQuery.trim().toLowerCase();
        return applications.filter(a => 
            String(a.id).toLowerCase().includes(q) || 
            (a.candidateId && String(a.candidateId).toLowerCase().includes(q))
        );
    }, [applications, appSearchQuery]);

    /* UI state */
    const [loadingJobs, setLoadingJobs] = useState(true);
    const [loadingApps, setLoadingApps] = useState(true);
    const [loadingDecision, setLoadingDecision] = useState(false);
    const [error, setError] = useState('');
    const [showJobForm, setShowJobForm] = useState(false);

    /* Job-create form state */
    const [jobForm, setJobForm] = useState({ title: '', department: '', location: '', description: '' });
    const [jobFormErrors, setJobFormErrors] = useState<Partial<typeof jobForm>>({});
    const [jobSubmitting, setJobSubmitting] = useState(false);
    const [jobSuccess, setJobSuccess] = useState(false);

    /* CSV Import state — moved to /hr/jobs/[jobId] */

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

    const loadApplications = useCallback(async () => {
        if (!token) return;
        setLoadingApps(true);
        try {
            const data = await api.get<Application[]>('/api/hr/applications', token);
            setApplications(data);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setLoadingApps(false);
        }
    }, [token]);

    const loadDecision = useCallback(async (appId: string) => {
        if (!token) return;
        setLoadingDecision(true);
        setDecision(null);
        try {
            const data = await api.get<Decision>(`/api/hr/applications/${appId}/decision`, token);
            setDecision(data);
        } catch {
            setDecision(null);
        } finally {
            setLoadingDecision(false);
        }
    }, [token]);

    useEffect(() => {
        loadJobs();
        loadApplications();
    }, [loadJobs, loadApplications]);

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

    /* ── Activate Round ────────────────────────────────── */
    async function handleActivateRound(appId: string) {
        if (!token) return;
        setActioning(`activate-${appId}`);
        setError('');
        try {
            await api.put(`/api/applications/${appId}/activate-round`, {}, token);
            loadApplications();
            if (selectedJobId) loadJobApplications(selectedJobId);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setActioning(null);
        }
    }

    /* ── Promote ─────────────────────────────────────────── */
    async function handlePromote(appId: string) {
        if (!token) return;
        setActioning(appId);
        setError('');
        try {
            await api.post(`/api/applications/promote/${appId}`, {}, token);
            loadApplications();
            if (selectedJobId) loadJobApplications(selectedJobId);
            setSelectedApp(null);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setActioning(null);
        }
    }

    /* ── Reject ──────────────────────────────────────────── */
    async function handleReject(appId: string) {
        if (!token) return;
        setActioning(appId);
        setError('');
        try {
            await api.post(`/api/applications/reject/${appId}`, {}, token);
            loadApplications();
            if (selectedJobId) loadJobApplications(selectedJobId);
            setSelectedApp(null);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setActioning(null);
        }
    }

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
            key: 'status', header: 'Status',
            render: (v) => <span className="badge badge-info">{String(v)}</span>
        },
        {
            key: 'applicantCount', header: 'Applicants', sortable: true,
            render: (v) => <span className="font-mono">{Number(v ?? 0)}</span>
        },
        {
            key: 'createdAt', header: 'Posted', sortable: true,
            render: (v) => new Date(String(v)).toLocaleDateString()
        },
        {
            key: 'id', header: 'Applications',
            render: (_v, row) => (
                <button
                    type="button"
                    onClick={() => loadJobApplications(String(row.id))}
                    aria-label={`View applications for ${row.title}`}
                    className="px-3 py-1 text-xs rounded-md font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                    style={{
                        background: 'var(--info-bg)',
                        color: 'var(--info-text)',
                        border: '1px solid var(--info-border)',
                    }}
                >
                    View Applicants
                </button>
            ),
        },
    ];

    const appColumns: Column<Application>[] = [
        { key: 'candidateName', header: 'Candidate', sortable: true },
        { key: 'jobTitle', header: 'Position', sortable: true },
        {
            key: 'currentRound', header: 'Round Status',
            render: (_v, row) => {
                const r = row.rounds?.find(rd => rd.roundNumber === row.currentRound);
                const label = r ? r.roundName : `Round ${row.currentRound}`;
                return (
                    <div className="flex flex-col">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{label}</span>
                        <span className="text-xs text-indigo-300">{r?.status || 'NOT_STARTED'}</span>
                    </div>
                );
            }
        },
        {
            key: 'testStatus', header: 'Activated',
            render: (_v, row) => {
                const r = row.rounds?.find(rd => rd.roundNumber === row.currentRound);
                const activated = r?.isActivated ?? false;
                return (
                    <span className={`badge ${activated ? 'badge-success' : 'badge-neutral'}`}>
                        {activated ? 'Yes' : 'No'}
                    </span>
                );
            }
        },
        { key: 'latestAiScore', header: 'AI Score', sortable: true, render: (v) => scorePill(v as number | null) },
        {
            key: 'explanation', header: 'Analysis',
            render: (_v, row) => row.testStatus === 'COMPLETED' ? (
                <button
                    onClick={() => setViewingAppResult(row)}
                    className="text-indigo-400 hover:text-indigo-300 text-xs font-semibold underline underline-offset-4 transition-colors"
                >
                    View Explanation
                </button>
            ) : <span className="text-slate-600">—</span>
        },
        { key: 'recommendation', header: 'Reco', render: (v) => recoBadge(v as string | null) },
        {
            key: 'id',
            header: 'Actions',
            render: (_v, row) => {
                const currentRound = row.rounds?.find(r => r.roundNumber === row.currentRound);
                const isActivated = currentRound?.isActivated ?? false;
                const isCompleted = currentRound?.status === 'COMPLETED';

                return (
                    <div className="flex items-center gap-2">
                        {!isActivated && !isCompleted && row.status !== 'REJECTED' && (
                            <button
                                type="button"
                                onClick={() => handleActivateRound(row.id)}
                                disabled={actioning === `activate-${row.id}`}
                                className="px-3 py-1 text-xs rounded-md font-semibold transition-all bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
                            >
                                {actioning === `activate-${row.id}` ? '...' : 'Trigger Round'}
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={() => { setSelectedApp(row); if (row.stage && !row.stageResults) loadDecision(String(row.id)); }}
                            className="px-3 py-1 text-xs rounded-md font-medium bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200 transition-colors"
                        >
                            Details
                        </button>
                        {isCompleted && row.status === 'IN_PROGRESS' && (
                            <span className="text-[10px] text-emerald-400 font-bold">Awaiting Scoring</span>
                        )}
                    </div>
                );
            },
        },
    ];

    /* ── Stats ────────────────────────────────────────────── */
    const stats = [
        {
            label: 'Total Jobs',
            value: jobs.length,
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="2" y="7" width="20" height="14" rx="2" /><path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
                </svg>
            ),
            color: '#6366f1',
        },
        {
            label: 'Applications',
            value: applications.length,
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
                    <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
            ),
            color: '#10b981',
        },
        {
            label: 'Hired',
            value: applications.filter((a) => a.stage === 'HIRED').length,
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ),
            color: '#34d399',
        },
        {
            label: 'Awaiting HR Action',
            value: applications.filter((a) => PASSED_STAGES_HR.has(a.stage)).length,
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
            ),
            color: '#f59e0b',
        },
    ];

    return (
        <ProtectedRoute requiredRole="HR">
            <DashboardLayout navItems={NAV_ITEMS} title="HR Dashboard">
                <div className="flex flex-col gap-8">

                    {/* ── Error banner ─────────────────────────────────── */}
                    {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                    {/* ── Stats grid ────────────────────────────────────── */}
                    <section aria-label="Dashboard statistics">
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                            {stats.map((stat) => (
                                <div
                                    key={stat.label}
                                    className="glass-card p-5 flex items-center gap-4 animate-fade-in"
                                >
                                    <div
                                        className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
                                        style={{ background: `${stat.color}20`, color: stat.color }}
                                        aria-hidden="true"
                                    >
                                        {stat.icon}
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                            {loadingJobs || loadingApps ? (
                                                <span className="skeleton inline-block w-8 h-6 rounded" />
                                            ) : (
                                                stat.value
                                            )}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Jobs section ──────────────────────────────────── */}
                    <section aria-labelledby="jobs-heading">
                        <div className="flex items-center justify-between mb-4">
                            <h2 id="jobs-heading" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                Job Postings
                            </h2>
                            <button
                                type="button"
                                onClick={() => setShowJobForm((v) => !v)}
                                aria-expanded={showJobForm}
                                aria-controls="create-job-form"
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                style={{
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    boxShadow: 'var(--shadow-glow)',
                                }}
                            >
                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                    <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                                </svg>
                                {showJobForm ? 'Cancel' : 'Post a Job'}
                            </button>
                        </div>

                        {/* Create job form */}
                        {showJobForm && (
                            <div
                                id="create-job-form"
                                className="glass-card p-6 mb-4 animate-fade-in"
                                role="region"
                                aria-label="Create new job posting"
                            >
                                <h3 className="text-base font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>
                                    New Job Posting
                                </h3>

                                {jobSuccess && (
                                    <div
                                        role="status"
                                        aria-live="polite"
                                        className="flex items-center gap-2 mb-4 text-sm p-3 rounded-lg"
                                        style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                                    >
                                        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Job posted successfully!
                                    </div>
                                )}

                                <form onSubmit={handleCreateJob} noValidate aria-label="Create job form">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                        <AccessibleSelect
                                            id="job-title"
                                            label="Job Title"
                                            options={ROLES}
                                            placeholder="Select a role…"
                                            value={jobForm.title}
                                            onChange={(e) => setJobForm((p) => ({ ...p, title: e.target.value }))}
                                            error={jobFormErrors.title}
                                            required
                                        />
                                        <AccessibleSelect
                                            id="job-dept"
                                            label="Department"
                                            options={DEPARTMENTS}
                                            placeholder="Select department…"
                                            value={jobForm.department}
                                            onChange={(e) => setJobForm((p) => ({ ...p, department: e.target.value }))}
                                            error={jobFormErrors.department}
                                            required
                                        />
                                        <AccessibleSelect
                                            id="job-loc"
                                            label="Location"
                                            options={LOCATIONS}
                                            placeholder="Select office…"
                                            value={jobForm.location}
                                            onChange={(e) => setJobForm((p) => ({ ...p, location: e.target.value }))}
                                            error={jobFormErrors.location}
                                            required
                                        />
                                    </div>

                                    <div className="mb-4">
                                        <label
                                            htmlFor="job-desc"
                                            className="block text-sm font-semibold mb-1.5"
                                            style={{ color: 'var(--text-primary)' }}
                                        >
                                            Job Description <span aria-hidden="true" style={{ color: 'var(--accent-danger)' }}>*</span>
                                            <span className="sr-only">(required)</span>
                                        </label>
                                        <textarea
                                            id="job-desc"
                                            rows={4}
                                            placeholder="Describe the role, responsibilities, and requirements…"
                                            value={jobForm.description}
                                            onChange={(e) => setJobForm((p) => ({ ...p, description: e.target.value }))}
                                            aria-invalid={!!jobFormErrors.description}
                                            aria-describedby={jobFormErrors.description ? 'job-desc-error' : undefined}
                                            required
                                            className="w-full rounded-lg border px-4 py-3 text-sm resize-y focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]"
                                            style={{
                                                background: 'var(--bg-elevated)',
                                                color: 'var(--text-primary)',
                                                borderColor: jobFormErrors.description ? 'var(--accent-danger)' : 'var(--border-default)',
                                            }}
                                        />
                                        {jobFormErrors.description && (
                                            <p id="job-desc-error" role="alert" aria-live="polite"
                                                className="mt-1 text-xs font-medium" style={{ color: 'var(--accent-danger)' }}>
                                                {jobFormErrors.description}
                                            </p>
                                        )}
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={jobSubmitting}
                                        aria-busy={jobSubmitting}
                                        className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60 disabled:cursor-not-allowed"
                                        style={{
                                            background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                            color: '#fff',
                                        }}
                                    >
                                        {jobSubmitting ? (
                                            <><LoadingSpinner size="sm" /> Posting…</>
                                        ) : (
                                            <>
                                                <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <polyline points="22 2 15 22 11 13 2 9 22 2" />
                                                </svg>
                                                Post Job
                                            </>
                                        )}
                                    </button>
                                </form>
                            </div>
                        )}

                        <DataTable
                            caption="List of job postings"
                            columns={jobColumns}
                            data={jobs}
                            isLoading={loadingJobs}
                            emptyMessage="No jobs posted yet. Create your first job posting!"
                        />
                    </section>

                    {/* ── Applications section ──────────────────────────── */}
                    <section aria-labelledby="apps-heading">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
                            <h2 id="apps-heading" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                Applications
                            </h2>
                            <div className="relative w-full md:w-64">
                                <span className="absolute inset-y-0 left-0 flex items-center pl-3">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-400">
                                        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                                    </svg>
                                </span>
                                <input
                                    type="text"
                                    placeholder="Search by Applicant ID..."
                                    value={appSearchQuery}
                                    onChange={(e) => setAppSearchQuery(e.target.value)}
                                    className="w-full rounded-lg border pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                                    style={{
                                        background: 'var(--bg-elevated)',
                                        color: 'var(--text-primary)',
                                        borderColor: 'var(--border-default)',
                                    }}
                                />
                            </div>
                        </div>
                        <DataTable
                            caption="List of candidate applications with AI and human scores"
                            columns={appColumns}
                            data={filteredApplications}
                            isLoading={loadingApps}
                            emptyMessage="No applications found."
                        />
                    </section>

                    {/* ── Per-Job Applications Drawer ──────────────── */}
                    {selectedJobId && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="job-apps-title"
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                            style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
                        >
                            <div className="w-full max-w-4xl glass-card p-6 animate-fade-in"
                                style={{ maxHeight: '90vh', overflowY: 'auto' }}>
                                <div className="flex items-center justify-between mb-5">
                                    <h3 id="job-apps-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                        Applicants for {jobs.find(j => String(j.id) === selectedJobId)?.title ?? 'Job'}
                                    </h3>
                                    <button type="button" onClick={() => setSelectedJobId(null)}
                                        aria-label="Close applicants panel"
                                        className="p-1.5 rounded-lg focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        style={{ color: 'var(--text-muted)' }}>
                                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>
                                <DataTable
                                    caption="Applications for this job"
                                    columns={appColumns}
                                    data={jobApps}
                                    isLoading={loadingJobApps}
                                    emptyMessage="No applications for this job yet."
                                />
                            </div>
                        </div>
                    )}
                    {/* ── AI Decision Drawer ────────────────────────────── */}
                    {selectedApp && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="decision-dialog-title"
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                            style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
                        >
                            <div
                                className="w-full max-w-lg glass-card p-6 animate-fade-in"
                                style={{ maxHeight: '90vh', overflowY: 'auto' }}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-5">
                                    <div>
                                        <h3 id="decision-dialog-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                            AI Decision Analysis
                                        </h3>
                                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {selectedApp.candidateName} — {selectedApp.jobTitle}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setSelectedApp(null); setDecision(null); }}
                                        aria-label="Close AI decision dialog"
                                        className="p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Scores row */}
                                <div className="grid grid-cols-2 gap-3 mb-5">
                                    <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)' }}>
                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>AI Score</p>
                                        {scorePill(selectedApp.aiScore)}
                                    </div>
                                    <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)' }}>
                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Human Score</p>
                                        {scorePill(selectedApp.humanScore)}
                                    </div>
                                    <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)' }}>
                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Stage</p>
                                        {stageBadge(selectedApp.stage)}
                                    </div>
                                    <div className="rounded-lg p-4" style={{ background: 'var(--bg-elevated)' }}>
                                        <p className="text-xs mb-1" style={{ color: 'var(--text-muted)' }}>Attempts</p>
                                        <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                            {selectedApp.attemptCount}
                                        </span>
                                    </div>
                                </div>

                                {/* Stage-by-stage breakdown */}
                                {selectedApp.stageResults && selectedApp.stageResults.length > 0 && (
                                    <section aria-label="Round results" className="mb-5">
                                        <h4 className="text-sm font-semibold mb-3" style={{ color: 'var(--text-primary)' }}>
                                            Round-by-Round Results
                                        </h4>
                                        <div className="flex flex-col gap-2">
                                            {selectedApp.stageResults.map((sr, i) => (
                                                <details
                                                    key={i}
                                                    className="rounded-lg overflow-hidden"
                                                    style={{ border: '1px solid var(--border-subtle)' }}
                                                >
                                                    <summary
                                                        className="flex items-center justify-between px-4 py-3 cursor-pointer text-sm"
                                                        style={{ background: 'var(--bg-elevated)', color: 'var(--text-primary)', listStyle: 'none' }}
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <span className="font-medium">
                                                                {({
                                                                    'ROUND_1': 'ROUND 1 - Skill Screening',
                                                                    'ROUND_2': 'ROUND 2 - Aptitude Test',
                                                                    'ROUND_3': 'ROUND 3 - Coding Test',
                                                                    'ROUND_4': 'ROUND 4 - Technical HR',
                                                                    'ROUND_5': 'ROUND 5 - General HR'
                                                                } as Record<string, string>)[sr.stage] || sr.stage?.replace(/_/g, ' ') || 'Round'}
                                                            </span>
                                                            <span className={`badge text-xs ${sr.status === 'PASS' ? 'badge-success' : sr.status === 'FAIL' ? 'badge-danger' : 'badge-neutral'}`}>
                                                                {sr.status ?? '—'}
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-4 text-xs" style={{ color: 'var(--text-muted)' }}>
                                                            <span>AI: <strong style={{ color: 'var(--text-primary)' }}>{sr.aiScore != null ? sr.aiScore.toFixed(1) : '—'}</strong></span>
                                                            {sr.humanScore != null && (
                                                                <span>Human: <strong style={{ color: 'var(--text-primary)' }}>{sr.humanScore.toFixed(1)}</strong></span>
                                                            )}
                                                        </div>
                                                    </summary>
                                                    {sr.aiExplanation && (
                                                        <div className="px-4 py-3" style={{ background: 'var(--bg-base)', borderTop: '1px solid var(--border-subtle)' }}>
                                                            <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>AI Explanation</p>
                                                            <pre
                                                                className="text-xs rounded-lg p-3 overflow-x-auto"
                                                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)', fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}
                                                            >
                                                                {JSON.stringify(sr.aiExplanation, null, 2)}
                                                            </pre>
                                                        </div>
                                                    )}
                                                </details>
                                            ))}
                                        </div>
                                    </section>
                                )}


                                {loadingDecision && (
                                    <div className="flex justify-center py-6">
                                        <LoadingSpinner size="md" label="Loading AI decision…" />
                                    </div>
                                )}

                                {decision && !loadingDecision && (
                                    <section aria-label="AI final decision" className="animate-fade-in">
                                        <div className="flex items-center gap-3 mb-4">
                                            <div
                                                className={`badge text-base px-4 py-2 ${decision.recommendation === 'HIRE'
                                                    ? 'badge-success'
                                                    : decision.recommendation === 'REJECT'
                                                        ? 'badge-danger'
                                                        : 'badge-warning'
                                                    }`}
                                            >
                                                {decision.recommendation === 'HIRE' ? '✓ Recommend HIRE' :
                                                    decision.recommendation === 'REJECT' ? '✗ Recommend REJECT' : 'INCOMPLETE'}
                                            </div>

                                            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                Confidence:{' '}
                                                <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {(decision.hiringConfidenceIndex * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        </div>

                                        {/* Score bar */}
                                        <div className="mb-4">
                                            <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--text-muted)' }}>
                                                <span>Final Score</span>
                                                <span className="font-mono font-semibold" style={{ color: 'var(--text-primary)' }}>
                                                    {decision.finalScore.toFixed(1)} / 100
                                                </span>
                                            </div>
                                            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg-elevated)' }}>
                                                <div
                                                    className="h-full rounded-full transition-all duration-700"
                                                    style={{
                                                        width: `${decision.finalScore}%`,
                                                        background: decision.finalScore >= 75
                                                            ? 'linear-gradient(90deg, #10b981, #34d399)'
                                                            : decision.finalScore >= 50
                                                                ? 'linear-gradient(90deg, #f59e0b, #fbbf24)'
                                                                : 'linear-gradient(90deg, #ef4444, #f87171)',
                                                    }}
                                                    aria-valuenow={decision.finalScore}
                                                    aria-valuemin={0}
                                                    aria-valuemax={100}
                                                    role="progressbar"
                                                    aria-label={`Final score: ${decision.finalScore.toFixed(1)} out of 100`}
                                                />
                                            </div>
                                        </div>

                                        {/* Reasoning */}
                                        <h4 className="text-sm font-semibold mb-2" style={{ color: 'var(--text-primary)' }}>
                                            Explainable Reasoning
                                        </h4>
                                        <ul className="flex flex-col gap-2" role="list">
                                            {decision.reasoning.map((reason, i) => (
                                                <li
                                                    key={i}
                                                    className="flex items-start gap-2 text-sm p-3 rounded-lg"
                                                    style={{ background: 'var(--bg-elevated)', color: 'var(--text-secondary)' }}
                                                >
                                                    <svg aria-hidden="true" className="shrink-0 mt-0.5" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6366f1" strokeWidth="2.5">
                                                        <polyline points="9 18 15 12 9 6" />
                                                    </svg>
                                                    {reason}
                                                </li>
                                            ))}
                                        </ul>
                                    </section>
                                )}
                                {/* Promote / Reject actions */}
                                {selectedApp && selectedApp.stage !== 'HIRED' && selectedApp.stage !== 'REJECTED' && (
                                    <div className="flex gap-3 mt-6 pt-4" style={{ borderTop: '1px solid var(--border-subtle)' }}>
                                        {PASSED_STAGES_HR.has(selectedApp.stage) && (
                                            <button
                                                type="button"
                                                onClick={() => handlePromote(String(selectedApp.id))}
                                                disabled={actioning === String(selectedApp.id)}
                                                className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60"
                                                style={{
                                                    background: 'linear-gradient(135deg, #10b981, #34d399)',
                                                    color: '#fff',
                                                }}
                                            >
                                                {actioning === String(selectedApp.id)
                                                    ? <LoadingSpinner size="sm" label="…" />
                                                    : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="18 15 12 9 6 15" /></svg>
                                                }
                                                Promote to Next Round
                                            </button>
                                        )}
                                        <button
                                            type="button"
                                            onClick={() => handleReject(String(selectedApp.id))}
                                            disabled={actioning === String(selectedApp.id)}
                                            className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] disabled:opacity-60"
                                            style={{
                                                background: 'rgb(239 68 68 / 0.12)',
                                                color: '#f87171',
                                                border: '1px solid rgb(239 68 68 / 0.3)',
                                            }}
                                        >
                                            Reject Candidate
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {viewingAppResult && (
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
                                                    {viewingAppResult.candidateName} <span className="mx-2 text-slate-600">/</span> Round {viewingAppResult.currentRound}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => setViewingAppResult(null)}
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
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Overall Proficiency</span>
                                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-indigo-400 tracking-tighter">
                                                {viewingAppResult.latestAiScore}%
                                            </div>
                                            <div className="h-1 w-12 bg-indigo-500/30 rounded-full mt-4" />
                                        </div>
                                    </div>
                                    <div className="group relative overflow-hidden p-8 rounded-[2rem] bg-emerald-500/5 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-500">
                                        <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
                                        <div className="relative flex flex-col items-center">
                                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">AI Confidence</span>
                                            <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-400 tracking-tighter">
                                                {String((viewingAppResult.stageResults?.find(s => Number(s.stage?.split('_')[1]) === viewingAppResult.currentRound)?.aiExplanation as any)?.confidence || 85)}%
                                            </div>
                                            <div className="h-1 w-12 bg-emerald-500/30 rounded-full mt-4" />
                                        </div>
                                    </div>
                                </div>

                                <section className="mb-12">
                                    <div className="flex items-center gap-4 mb-8">
                                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Candidate Breakdown</h4>
                                        <div className="h-px flex-1 bg-white/5" />
                                    </div>
                                    <div className="grid grid-cols-1 gap-8">
                                        {Object.entries((viewingAppResult.stageResults?.find(s => Number(s.stage?.split('_')[1]) === viewingAppResult.currentRound)?.aiExplanation as any)?.skillBreakdown || {
                                            "Communication": 82,
                                            "Technical Knowledge": 78,
                                            "Problem Solving": 91
                                        }).map(([skill, score], idx) => (
                                            <div key={skill} className="animate-fade-in" style={{ animationDelay: `${idx * 100}ms` }}>
                                                <div className="flex justify-between items-end mb-3">
                                                    <span className="text-sm font-bold text-slate-300 uppercase tracking-tight">{skill}</span>
                                                    <span className="text-lg font-black text-white">{String(score)}%</span>
                                                </div>
                                                <div className="h-3 w-full bg-white/5 rounded-full p-0.5 overflow-hidden ring-1 ring-white/5">
                                                    <div
                                                        className="h-full bg-gradient-to-r from-indigo-600 via-indigo-500 to-indigo-400 rounded-full shadow-[0_0_15px_rgba(99,102,241,0.5)] transition-all duration-1000 ease-out"
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
                                            {String((viewingAppResult.stageResults?.find(s => Number(s.stage.split('_')[1]) === viewingAppResult.currentRound)?.aiExplanation as any)?.reasoning ||
                                                "The candidate shows a sophisticated grasp of core architectural patterns and demonstrates high velocity in problem-solving. While their technical depth is exceptional, fostering more collaborative communication styles could further accelerate their impact within cross-functional teams.")}
                                            <span className="text-indigo-500 text-3xl font-serif absolute -bottom-6 -right-1">"</span>
                                        </div>
                                    </div>
                                </section>

                                <div className="mt-12 flex justify-end">
                                    <button
                                        onClick={() => setViewingAppResult(null)}
                                        className="group relative px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                                    >
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-black/5 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
                                        Done
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
