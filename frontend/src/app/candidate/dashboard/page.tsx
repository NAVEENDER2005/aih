'use client';

import React, { useCallback, useEffect, useState } from 'react';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import DataTable, { Column } from '@/components/DataTable';
import ErrorAlert from '@/components/ErrorAlert';

import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';

interface ApplicationStage {
    stage: string;
    status: string;
    aiScore: number | null;
    humanScore: number | null;
    completedAt: string | null;
}

interface ApplicationRound {
    id: string;
    applicationId: string;
    roundNumber: number;
    roundName: string;
    isActivated: boolean;
    activatedAt: string | null;
    activatedBy: string | null;
    status: string;          // NOT_STARTED | ACTIVE | IN_PROGRESS | COMPLETED | FAILED | SKIPPED | STOPPED | FINISHED
    result: string | null;   // PASS | FAIL | null
    score: number | null;
    attempts: number;
    completedAt: string | null;
    candidateView: string;   // START_TEST | CLEARED | REJECTED | LOCKED | AWAITING_ACTIVATION | SKIPPED | AWAITING_RESULT
}

interface CandidateApplication {
    id: string;
    jobTitle: string;
    company: string;
    appliedAt: string;
    currentStage: string;
    overallStatus: string;
    attemptCount: number;
    nextAction: string | null;
    stages: ApplicationStage[];
    rounds: ApplicationRound[];
    finalRecommendation: string | null;
    currentRoundNumber: number;
    testStatus?: string;
    testLink?: string | null;
    offerId?: string;
    offerStatus?: string;     // PENDING | ACCEPTED | REJECTED
    offerGeneratedAt?: string;
    bgvStatus?: 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
}

/* ─── Nav items ──────────────────────────────────────────── */
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

const ROUND_LABELS: Record<number, string> = {
    1: 'Skill Screening',
    2: 'Aptitude Test',
    3: 'Coding Test',
    4: 'Technical HR Interview',
    5: 'General HR Interview',
};

/* ─── Helpers ────────────────────────────────────────────── */
function statusBadge(status: string) {
    const map: Record<string, string> = {
        HIRED: 'badge badge-success',
        REJECTED: 'badge badge-danger',
        ACTIVE: 'badge badge-primary',
        PENDING: 'badge badge-neutral',
        IN_PROGRESS: 'badge badge-info',
        AWAITING_RESULT: 'badge badge-warning',
        CLEARED_ALL_ROUNDS: 'badge badge-success',
        OFFER_GENERATED: 'badge badge-primary',
        OFFER_ACCEPTED: 'badge badge-success',
        OFFER_REJECTED: 'badge badge-danger',
        COMPLETED: 'badge badge-success',
        FAILED: 'badge badge-danger',
        SKIPPED: 'badge badge-neutral',
        BACKGROUND_VERIFICATION: 'badge badge-info',
        VERIFIED: 'badge badge-success',
        UNDER_REVIEW: 'badge badge-warning',
    };
    return <span className={map[status] ?? 'badge badge-neutral'}>{status.replace(/_/g, ' ')}</span>;
}

function scorePill(score: number | null) {
    if (score == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const color = score >= 75 ? 'var(--success-text)' : score >= 50 ? 'var(--warning-text)' : 'var(--danger-text)';
    return <span className="font-mono font-semibold text-sm" style={{ color }}>{score.toFixed(1)}</span>;
}

function nextActionBadge(action: string | null) {
    if (!action) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    return (
        <span className="badge badge-warning">
            <svg aria-hidden="true" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            {action}
        </span>
    );
}

/* ─── Offer Card ─────────────────────────────────────────── */
import { generateOfferLetter } from '@/lib/offerGenerator';

interface OfferCardProps {
    app: CandidateApplication;
    token: string | null;
    onRefresh: () => void;
    onDismiss?: () => void;
}

function OfferCard({ app, token, onRefresh, onDismiss }: OfferCardProps) {
    const [responding, setResponding] = useState(false);
    const [showRejectForm, setShowRejectForm] = useState(false);
    const [rejectionReason, setRejectionReason] = useState('');
    const [actionError, setActionError] = useState('');
    const [uploading, setUploading] = useState(false);
    const [signedUploaded, setSignedUploaded] = useState(false); // Check if uploaded

    // Load existing signed offer check
    useEffect(() => {
        if (app.overallStatus === 'OFFER_ACCEPTED' && token) {
            api.get<any[]>('/api/bgv/my-documents', token).then(docs => {
                if (docs.some(d => d.documentType === 'SIGNED_OFFER')) {
                    setSignedUploaded(true);
                }
            }).catch(console.error);
        }
    }, [app.overallStatus, token]);

    if (!app.offerId || (app.overallStatus !== 'OFFER_GENERATED' && app.overallStatus !== 'OFFER_ACCEPTED')) return null;

    async function handleAccept() {
        if (!token || !app.offerId) return;
        if (!window.confirm('Accept this offer? Congratulations on your new role! 🎉')) return;
        setResponding(true);
        setActionError('');
        try {
            await api.post(`/api/candidate/offers/${app.offerId}/accept`, {}, token);
            onRefresh();
        } catch (e) {
            setActionError((e as ApiError).message);
        } finally {
            setResponding(false);
        }
    }

    async function handleReject() {
        if (!token || !app.offerId) return;
        if (!rejectionReason.trim()) {
            setActionError('Please provide a reason for declining the offer.');
            return;
        }
        setResponding(true);
        setActionError('');
        try {
            await api.post(`/api/candidate/offers/${app.offerId}/reject`, { rejectionReason }, token);
            onRefresh();
            setShowRejectForm(false);
        } catch (e) {
            setActionError((e as ApiError).message);
        } finally {
            setResponding(false);
        }
    }

    function handleDownloadUnsigned() {
        // Use user profile data and job application data to pass candidateName, jobTitle
        // We do not have user name directly in app, but we know it's the current logged in user
        // wait, we don't have user name directly here, but we can access it via app or context.
        // Let's use a dummy name if unavailable, or just 'Candidate'
        const doc = generateOfferLetter('Candidate', app.jobTitle, 'Chennai');
        doc.save(`Offer_Letter.pdf`);
    }

    async function handleUploadSigned(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file || !token) return;
        setUploading(true);
        setActionError('');
        try {
            const formData = new FormData();
            formData.append('type', 'SIGNED_OFFER');
            formData.append('file', file);
            await api.upload('/api/bgv/upload', formData, token);
            setSignedUploaded(true);
            onRefresh();
            alert('Signed offer letter uploaded successfully!');
        } catch (err) {
            setActionError((err as ApiError).message);
        } finally {
            setUploading(false);
        }
    }

    return (
        <div
            className="p-1 rounded-2xl bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500 animate-fade-in"
            role="region"
            aria-label="Job Offer Received"
        >
            <div className="glass-card p-6 flex flex-col gap-4">
                <div className="flex items-start gap-4 pr-8 relative">
                    <div className="w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0"
                        style={{ background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)' }}>
                        🎁
                    </div>
                    <div className="flex-1">
                        <p className="text-xs font-bold uppercase tracking-wider" style={{ color: '#10b981' }}>
                            Offer Received!
                        </p>
                        <h3 className="text-lg font-bold mt-0.5" style={{ color: 'var(--text-primary)' }}>
                            Congratulations! You've been selected for{' '}
                            <span style={{ color: '#10b981' }}>{app.jobTitle}</span>
                        </h3>
                        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
                            Please review and respond to your offer.
                        </p>
                        {app.offerGeneratedAt && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Offer date: {new Date(app.offerGeneratedAt).toLocaleDateString()}
                            </p>
                        )}
                    </div>
                    {onDismiss && (
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
                            aria-label="Dismiss notification"
                            className="absolute -top-1 -right-1 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white shadow-lg border border-white/30 transition-all hover:scale-110 active:scale-90 focus:outline-none"
                        >
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>
                    )}
                </div>

                {actionError && <ErrorAlert message={actionError} onDismiss={() => setActionError('')} />}

                {app.overallStatus === 'OFFER_ACCEPTED' ? (
                    <div className="flex flex-col gap-3 mt-1 animate-fade-in border-t border-[var(--border-subtle)] pt-4">
                        <p className="text-sm font-semibold" style={{ color: 'var(--success-text)' }}>
                            You have accepted this Offer. Next steps:
                        </p>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={handleDownloadUnsigned}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm bg-black/10 dark:bg-white/10 hover:bg-black/20 dark:hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                                style={{ color: 'var(--text-primary)' }}
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                1. Download Offer
                            </button>
                            <label
                                className={`flex-1 py-2.5 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-2 cursor-pointer ${uploading ? 'opacity-50' : 'hover:scale-[1.02] active:scale-[0.98]'}`}
                                style={{ background: signedUploaded ? 'rgba(16,185,129,0.1)' : 'var(--accent-primary)', color: signedUploaded ? '#10b981' : '#fff' }}
                            >
                                {uploading ? 'Uploading...' : signedUploaded ? '✓ Signed Offer Uploaded' : '2. Upload Signed Offer'}
                                <input type="file" accept=".pdf,image/*" className="hidden" onChange={handleUploadSigned} disabled={uploading} />
                            </label>
                        </div>
                        {signedUploaded && (
                            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                                Your signed offer has been successfully transmitted to HR. Welcome to the team!
                            </p>
                        )}
                    </div>
                ) : !showRejectForm ? (
                    <div className="flex gap-3 mt-1">
                        <button
                            type="button"
                            onClick={handleAccept}
                            disabled={responding}
                            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50 hover:scale-[1.02] active:scale-[0.98]"
                            style={{ background: 'linear-gradient(135deg, #10b981, #059669)', color: '#fff', boxShadow: '0 4px 12px rgba(16,185,129,0.3)' }}
                        >
                            {responding ? '...' : '✓ Accept Offer'}
                        </button>
                        <button
                            type="button"
                            onClick={() => setShowRejectForm(true)}
                            disabled={responding}
                            className="flex-1 py-3 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--danger-text)', border: '2px solid var(--danger-border)' }}
                        >
                            ✗ Decline
                        </button>
                    </div>
                ) : (
                    <div className="space-y-3">
                        <label className="block">
                            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                                Reason for declining <span style={{ color: 'var(--danger-text)' }}>*</span>
                            </span>
                            <textarea
                                value={rejectionReason}
                                onChange={e => setRejectionReason(e.target.value)}
                                rows={3}
                                placeholder="e.g. Accepted another offer, location concerns, salary mismatch..."
                                className="mt-1.5 w-full rounded-xl px-3 py-2.5 text-sm resize-none focus:outline-none focus-visible:ring-2"
                                style={{
                                    background: 'var(--bg-elevated)',
                                    border: '1px solid var(--border-default)',
                                    color: 'var(--text-primary)',
                                }}
                            />
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                onClick={() => setShowRejectForm(false)}
                                className="flex-1 py-2.5 rounded-xl text-sm font-semibold"
                                style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                            >
                                Back
                            </button>
                            <button
                                type="button"
                                onClick={handleReject}
                                disabled={responding || !rejectionReason.trim()}
                                className="flex-1 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                                style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--danger-text)', border: '2px solid var(--danger-border)' }}
                            >
                                {responding ? '...' : 'Confirm Decline'}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── BGV Panel ─────────────────────────────────────────── */
interface BgvPanelProps {
    app: CandidateApplication;
    token: string | null;
}

function BgvPanel({ app, token }: BgvPanelProps) {
    const [uploading, setUploading] = useState<string | null>(null);
    const [docs, setDocs] = useState<any[]>([]);
    const [error, setError] = useState('');

    const docTypes = [
        { key: 'TENTH_MARKSHEET', label: '10th Mark Sheet' },
        { key: 'TWELFTH_MARKSHEET', label: '12th Mark Sheet' },
        { key: 'DEGREE_CERTIFICATE', label: 'Degree Certificate' },
        { key: 'ID_PROOF', label: 'ID Proof (Aadhaar/Passport)' },
        { key: 'EXPERIENCE_CERTIFICATE', label: 'Experience Certificate (Optional)' }
    ];

    useEffect(() => {
        if (token && app.id) {
            api.get<any[]>('/api/bgv/my-documents', token).then(setDocs).catch(console.error);
        }
    }, [token, app.id]);

    async function handleUpload(type: string, file: File) {
        if (!token) return;
        setUploading(type);
        setError('');
        const formData = new FormData();
        formData.append('type', type);
        formData.append('file', file);
        try {
            await api.upload('/api/bgv/upload', formData, token);
            const updatedDocs = await api.get<any[]>('/api/bgv/my-documents', token);
            setDocs(updatedDocs);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setUploading(null);
        }
    }

    if (app.currentStage !== 'BACKGROUND_VERIFICATION' && app.bgvStatus === 'NOT_STARTED') return null;

    return (
        <div className="glass-card p-6 animate-fade-in mb-6 border-l-4" style={{ borderColor: '#8b5cf6' }}>
            <div className="flex items-center justify-between mb-4">
                <div>
                    <h3 className="text-lg font-bold">Background Verification</h3>
                    <p className="text-sm text-slate-400">Upload required documents for verification.</p>
                </div>
                {statusBadge(app.bgvStatus || 'PENDING')}
            </div>

            {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
                {docTypes.map(dt => {
                    const uploaded = docs.find(d => d.documentType === dt.key);
                    return (
                        <div key={dt.key} className="p-4 rounded-xl border flex items-center justify-between gap-4" style={{ background: 'var(--bg-elevated)', borderColor: 'var(--border-default)' }}>
                            <div className="flex-1">
                                <p className="text-sm font-semibold">{dt.label}</p>
                                {uploaded ? (
                                    <p className="text-xs text-emerald-400 flex items-center gap-1 mt-0.5">
                                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                            <polyline points="20 6 9 17 4 12" />
                                        </svg>
                                        Uploaded
                                    </p>
                                ) : (
                                    <p className="text-xs text-slate-500 mt-0.5">Not uploaded yet</p>
                                )}
                            </div>
                            <div className="shrink-0">
                                {uploading === dt.key ? (
                                    <span className="text-xs animate-pulse text-indigo-400">Uploading...</span>
                                ) : (
                                    <label className="cursor-pointer px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 shadow-sm"
                                        style={{ background: uploaded ? 'rgba(16,185,129,0.1)' : 'var(--accent-primary)', color: uploaded ? '#10b981' : '#fff' }}>
                                        {uploaded ? 'Re-upload' : 'Upload'}
                                        <input type="file" className="hidden"
                                            onChange={e => {
                                                const file = e.target.files?.[0];
                                                if (file) handleUpload(dt.key, file);
                                            }} />
                                    </label>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

/* ─── Round progress stepper ─────────────────────────────── */
function RoundStepper({ rounds }: { rounds: ApplicationRound[] }) {
    return (
        <div className="flex items-center gap-0 overflow-x-auto py-2" role="list" aria-label="Hiring round progress">
            {rounds.filter(r => r.status !== 'SKIPPED').sort((a, b) => a.roundNumber - b.roundNumber).map((r, idx, filteredRounds) => {
                const done = r.status === 'COMPLETED';
                const failed = r.status === 'FAILED';
                const active = r.status === 'IN_PROGRESS' || r.status === 'ACTIVE';
                const awaitingResult = r.status === 'STOPPED' || r.status === 'FINISHED';
                const locked = !r.isActivated;

                const color = done
                    ? (r.result === 'FAIL' ? 'var(--danger-text)' : 'var(--success-text)')
                    : failed ? 'var(--danger-text)'
                        : active ? 'var(--accent-primary)'
                            : awaitingResult ? 'var(--warning-text)'
                                : 'var(--text-muted)';

                const bgColor = done
                    ? (r.result === 'FAIL' ? 'var(--danger-bg)' : 'var(--success-bg)')
                    : failed ? 'var(--danger-bg)'
                        : active ? 'var(--info-bg)'
                            : awaitingResult ? 'var(--warning-bg)'
                                : 'var(--bg-elevated)';

                return (
                    <React.Fragment key={r.id}>
                        <div
                            role="listitem"
                            className="flex flex-col items-center gap-1.5 shrink-0"
                            aria-label={`${r.roundName}: ${r.status}`}
                        >
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-all"
                                style={{
                                    background: bgColor,
                                    borderColor: color,
                                    color,
                                    opacity: locked ? 0.4 : 1
                                }}
                            >
                                {locked ? (
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                                    </svg>
                                ) : done && r.result === 'PASS' ? (
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <polyline points="20 6 9 17 4 12" />
                                    </svg>
                                ) : done && r.result === 'FAIL' || failed ? (
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                                        <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                    </svg>
                                ) : awaitingResult ? (
                                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                                    </svg>
                                ) : (
                                    r.roundNumber
                                )}
                            </div>
                            <span className="text-[10px] text-center max-w-[4.5rem] leading-tight" style={{ color, opacity: locked ? 0.6 : 1 }}>
                                {r.roundName}
                            </span>
                        </div>

                        {/* connector line */}
                        {idx < filteredRounds.length - 1 && (
                            <div
                                aria-hidden="true"
                                className="flex-1 h-0.5 mx-1 min-w-4"
                                style={{
                                    background: done && r.result === 'PASS' ? 'var(--success-text)' : 'var(--border-subtle)',
                                    opacity: locked ? 0.3 : 1,
                                    minWidth: '1rem',
                                }}
                            />
                        )}
                    </React.Fragment>
                );
            })}
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function CandidateDashboardPage() {
    const { token, user } = useAuth();

    const [applications, setApplications] = useState<CandidateApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedApp, setSelectedApp] = useState<CandidateApplication | null>(null);
    const [dismissedOfferIds, setDismissedOfferIds] = useState<string[]>([]);
    const [dismissedAssessmentIds, setDismissedAssessmentIds] = useState<string[]>([]);

    useEffect(() => {
        const saved = localStorage.getItem('dismissedOfferIds');
        if (saved) {
            try { setDismissedOfferIds(JSON.parse(saved)); } catch (e) { console.error('Failed to parse dismissedOfferIds', e); }
        }
        const savedAssess = localStorage.getItem('dismissedAssessmentIds');
        if (savedAssess) {
            try { setDismissedAssessmentIds(JSON.parse(savedAssess)); } catch (e) { console.error('Failed to parse dismissedAssessmentIds', e); }
        }
    }, []);

    const dismissOffer = (id: string) => {
        const updated = [...dismissedOfferIds, id];
        setDismissedOfferIds(updated);
        localStorage.setItem('dismissedOfferIds', JSON.stringify(updated));
    };

    const dismissAssessment = (id: string) => {
        const updated = [...dismissedAssessmentIds, id];
        setDismissedAssessmentIds(updated);
        localStorage.setItem('dismissedAssessmentIds', JSON.stringify(updated));
    };

    const loadApplications = useCallback(async (showLoading = true) => {
        if (!token) return;
        if (showLoading) setLoading(true);
        setError('');
        try {
            const data = await api.get<CandidateApplication[]>('/api/candidate/applications', token);
            setApplications(data);
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            if (showLoading) setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        loadApplications();
        const interval = setInterval(() => {
            loadApplications(false); // Background refresh
        }, 3000);
        return () => clearInterval(interval);
    }, [loadApplications]);

    /* ── Start External Test ─────────────────────────────────── */
    function handleStartExternalTest(app: CandidateApplication) {
        const testLink = app.testLink;
        if (testLink) {
            window.open(testLink, '_blank', 'noopener,noreferrer');
        } else {
            alert('Test link is not available yet. Please check with HR.');
        }
    }

    /* ── Pending offers ──────────────────────────────────────── */
    const pendingOffers = applications.filter(a => a.overallStatus === 'OFFER_GENERATED' && a.offerId);

    /* ── Summary stats ────────────────────────────────────── */
    const stats = [
        {
            label: 'Applications',
            value: applications.length,
            color: '#6366f1',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                    <polyline points="14 2 14 8 20 8" />
                </svg>
            ),
        },
        {
            label: 'Hired / Accepted',
            value: applications.filter((a) => a.overallStatus === 'HIRED' || a.overallStatus === 'OFFER_ACCEPTED').length,
            color: '#10b981',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                </svg>
            ),
        },
        {
            label: 'In Progress',
            value: applications.filter((a) =>
                a.overallStatus === 'IN_PROGRESS' || a.overallStatus === 'AWAITING_RESULT').length,
            color: '#8b5cf6',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
                </svg>
            ),
        },
        {
            label: 'Offers Pending',
            value: pendingOffers.length,
            color: '#f59e0b',
            icon: (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
            ),
        },
    ];

    /* ── Table columns ────────────────────────────────────── */
    const columns: Column<CandidateApplication>[] = [
        { key: 'jobTitle', header: 'Position', sortable: true },
        { key: 'company', header: 'Company', sortable: true },
        {
            key: 'appliedAt', header: 'Applied',
            render: (v) => new Date(String(v)).toLocaleDateString(), sortable: true
        },
        {
            key: 'currentStage', header: 'Current Stage',
            render: (_v, row) => {
                const label = ROUND_LABELS[row.currentRoundNumber] ?? 'Assessment';
                return <span className="badge badge-info">{label}</span>;
            },
        },
        { key: 'overallStatus', header: 'Status', render: (v) => statusBadge(String(v)) },
        {
            key: 'attemptCount', header: 'Attempts', sortable: true,
            render: (v) => <span className="font-mono">{String(v)}</span>
        },
        {
            key: 'finalRecommendation', header: 'Result',
            render: (v) => {
                if (!v) return <span style={{ color: 'var(--text-muted)' }}>Pending</span>;
                const cls = v === 'HIRE' ? 'badge-success' : 'badge-danger';
                return <span className={`badge ${cls}`}>{String(v)}</span>;
            },
        },
        {
            key: 'id',
            header: 'Actions',
            render: (_v, row) => {
                const activeRound = row.rounds?.find(r => r.candidateView === 'START_TEST');

                // Offer received and pending
                if (row.overallStatus === 'OFFER_GENERATED' && row.offerId) {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge text-xs" style={{ background: 'rgba(16,185,129,0.15)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                🎁 Offer Received
                            </span>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium transition-colors"
                                style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                Respond
                            </button>
                        </div>
                    );
                }

                // Offer accepted
                if (row.overallStatus === 'OFFER_ACCEPTED') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-success text-xs">🎉 Offer Accepted</span>
                        </div>
                    );
                }

                // Offer rejected
                if (row.overallStatus === 'OFFER_REJECTED') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-danger text-xs">Offer Declined</span>
                        </div>
                    );
                }

                // Cleared all rounds — awaiting offer
                if (row.overallStatus === 'CLEARED_ALL_ROUNDS') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-success text-xs">🏆 All Rounds Cleared</span>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                                View Details
                            </button>
                        </div>
                    );
                }

                // Awaiting results import
                if (row.overallStatus === 'AWAITING_RESULT') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-warning text-xs">⏳ Awaiting Results</span>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                                View Rounds
                            </button>
                        </div>
                    );
                }

                // Active test
                if (activeRound) {
                    return (
                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={() => handleStartExternalTest(row)}
                                aria-label={`Start external test for ${activeRound.roundName}`}
                                className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-md font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)', color: '#fff' }}
                            >
                                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                                Start Test
                            </button>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium transition-colors"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                                View Rounds
                            </button>
                        </div>
                    );
                }

                // Rejected
                if (row.overallStatus === 'REJECTED') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-danger text-xs">Application Rejected</span>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                                View Details
                            </button>
                        </div>
                    );
                }

                // Completed / Hired
                if (row.overallStatus === 'COMPLETED' || row.overallStatus === 'HIRED') {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-success text-xs">🎉 All Rounds Cleared</span>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                                View Details
                            </button>
                        </div>
                    );
                }

                // Awaiting HR decision after fail
                const failedRound = row.rounds?.find(r => r.candidateView === 'AWAITING_DECISION');
                if (failedRound) {
                    return (
                        <div className="flex items-center gap-2">
                            <span className="badge badge-warning text-xs">⚠️ Failed - Awaiting HR Decision</span>
                            <button type="button" onClick={() => setSelectedApp(row)}
                                className="px-3 py-1 text-xs rounded-md font-medium"
                                style={{ background: 'var(--info-bg)', color: 'var(--info-text)', border: '1px solid var(--info-border)' }}>
                                View Details
                            </button>
                        </div>
                    );
                }

                return (
                    <div className="flex items-center gap-2">
                        <span className="badge badge-neutral text-xs">Awaiting HR Activation</span>
                        <button type="button" onClick={() => setSelectedApp(row)}
                            className="px-3 py-1 text-xs rounded-md font-medium"
                            style={{ background: 'rgb(99 102 241 / 0.15)', color: '#818cf8', border: '1px solid rgb(99 102 241 / 0.3)' }}>
                            View Rounds
                        </button>
                    </div>
                );
            },
        },
    ];

    return (
        <ProtectedRoute requiredRole="CANDIDATE">
            <DashboardLayout navItems={NAV_ITEMS} title="My Applications">
                <div className="flex flex-col gap-8">

                    {/* ── Welcome banner ────────────────────────────────── */}
                    <div
                        className="glass-card p-6 flex items-center gap-5 animate-fade-in"
                        style={{ borderLeft: '4px solid #6366f1' }}
                    >
                        <div
                            className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold shrink-0"
                            style={{ background: 'linear-gradient(135deg, #6366f1, #ec4899)', color: '#fff' }}
                            aria-hidden="true"
                        >
                            {user?.name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                            <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>
                                Hello, {user?.name}! 👋
                            </h2>
                            <p className="text-sm mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                Track your applications, round scores, and next steps all in one place.
                            </p>
                        </div>
                    </div>

                    {/* ── Pending / Accepted Offer CTAs ─────────────────────────────── */}
                    {applications.filter(a => (a.overallStatus === 'OFFER_GENERATED' || a.overallStatus === 'OFFER_ACCEPTED') && !dismissedOfferIds.includes(a.id)).map(app => (
                        <OfferCard key={app.id} app={app} token={token ?? null} onRefresh={() => loadApplications(false)} onDismiss={() => dismissOffer(app.id)} />
                    ))}

                    {/* ── Active Test CTA ─────────────────────────────────── */}
                    {applications.some(a => !dismissedAssessmentIds.includes(a.id) && a.rounds?.some(r => r.candidateView === 'START_TEST')) && (
                        <div className="animate-fade-in">
                            {applications
                                .filter(a => !dismissedAssessmentIds.includes(a.id) && a.rounds?.some(r => r.candidateView === 'START_TEST'))
                                .map(a => {
                                    const activeRound = a.rounds!.find(r => r.candidateView === 'START_TEST')!;
                                    return (
                                        <div
                                            key={a.id}
                                            className="p-1 rounded-2xl bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500 mb-4 relative"
                                        >
                                            <button
                                                type="button"
                                                onClick={() => dismissAssessment(a.id)}
                                                className="absolute -top-1.5 -right-1.5 z-10 p-2 rounded-full bg-white/20 hover:bg-white/30 text-white shadow-lg border border-white/30 transition-all hover:scale-110 active:scale-90 focus:outline-none"
                                            >
                                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                    <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                                </svg>
                                            </button>
                                            <div className="glass-card p-5 flex flex-col md:flex-row items-center justify-between gap-4">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-12 h-12 rounded-xl bg-indigo-500/20 flex items-center justify-center text-indigo-400">
                                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                                                            <polyline points="14 2 14 8 20 8" />
                                                        </svg>
                                                    </div>
                                                    <div>
                                                        <p className="text-sm font-bold uppercase tracking-wider text-indigo-400">Assessment Ready</p>
                                                        <h3 className="text-lg font-bold text-white">
                                                            {activeRound.roundName} for <span className="text-indigo-300">{a.jobTitle}</span>
                                                        </h3>
                                                        <p className="text-xs text-slate-400 mt-0.5">Click to open the external test platform.</p>
                                                    </div>
                                                </div>
                                                <button
                                                    onClick={() => handleStartExternalTest(a)}
                                                    className="w-full md:w-auto px-8 py-3 rounded-xl font-bold bg-white text-indigo-600 hover:bg-slate-100 transition-all flex items-center justify-center gap-2 shadow-lg"
                                                >
                                                    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                                                        <polygon points="5 3 19 12 5 21 5 3" />
                                                    </svg>
                                                    Start Assessment
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                        </div>
                    )}

                    {/* ── Error ─────────────────────────────────────────── */}
                    {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                    {/* ── Stats ─────────────────────────────────────────── */}
                    <section aria-label="Application summary">
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
                                            {loading ? <span className="skeleton inline-block w-6 h-6 rounded" /> : stat.value}
                                        </p>
                                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{stat.label}</p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </section>

                    {/* ── Applications table ────────────────────────────── */}
                    <section aria-labelledby="apps-heading">
                        <h2 id="apps-heading" className="text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                            My Applications
                        </h2>
                        <DataTable
                            caption="Your job applications with round status and scores"
                            columns={columns}
                            data={applications}
                            isLoading={loading}
                            emptyMessage="You haven't applied to any jobs yet. Browse openings to get started!"
                        />
                    </section>

                    {/* ── Round detail dialog ───────────────────────────── */}
                    {selectedApp && (
                        <div
                            role="dialog"
                            aria-modal="true"
                            aria-labelledby="round-dialog-title"
                            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
                            style={{ background: 'var(--modal-overlay)', backdropFilter: 'blur(4px)' }}
                        >
                            <div
                                className="w-full max-w-2xl glass-card p-6 animate-fade-in"
                                style={{ maxHeight: '90vh', overflowY: 'auto' }}
                            >
                                {/* Header */}
                                <div className="flex items-start justify-between mb-5">
                                    <div>
                                        <h3 id="round-dialog-title" className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>
                                            Round Progress
                                        </h3>
                                        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                            {selectedApp.jobTitle} at {selectedApp.company}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedApp(null)}
                                        aria-label="Close round progress dialog"
                                        className="p-1.5 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                                        style={{ color: 'var(--text-muted)' }}
                                    >
                                        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                                        </svg>
                                    </button>
                                </div>

                                {/* Offer Notice inside modal */}
                                {selectedApp.overallStatus === 'OFFER_GENERATED' && selectedApp.offerId && (
                                    <div className="mb-4 p-3 rounded-xl text-sm font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                        🎁 You have a pending offer! Close this dialog to review and respond.
                                    </div>
                                )}

                                {selectedApp.overallStatus === 'CLEARED_ALL_ROUNDS' && (
                                    <div className="mb-4 p-3 rounded-xl text-sm font-semibold" style={{ background: 'rgba(16,185,129,0.1)', color: '#10b981', border: '1px solid rgba(16,185,129,0.3)' }}>
                                        🏆 Congratulations! You've cleared all rounds. Awaiting offer letter from HR.
                                    </div>
                                )}

                                {/* Stage stepper */}
                                <div className="mb-6 overflow-x-auto">
                                    <RoundStepper rounds={selectedApp.rounds || []} />
                                </div>

                                <BgvPanel app={selectedApp} token={token ?? null} />

                                {/* Stage detail table */}
                                <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
                                    <table className="w-full text-sm" aria-label="Round-by-round scores">
                                        <caption className="sr-only">Round-by-round scores for {selectedApp.jobTitle}</caption>
                                        <thead>
                                            <tr style={{ background: 'var(--bg-elevated)', borderBottom: '1px solid var(--border-subtle)' }}>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Round</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Status</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Score</th>
                                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Action</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {(selectedApp.rounds || []).filter(r => r.status !== 'SKIPPED')
                                                .sort((a, b) => a.roundNumber - b.roundNumber)
                                                .map((r) => {
                                                    const isRejected = r.candidateView === 'REJECTED';
                                                    const isCleared = r.candidateView === 'CLEARED';
                                                    const isActive = r.candidateView === 'START_TEST';
                                                    const isAwaiting = r.candidateView === 'AWAITING_RESULT';
                                                    return (
                                                        <tr key={r.id}
                                                            style={{
                                                                borderBottom: '1px solid var(--border-subtle)',
                                                                background: isRejected ? 'rgba(239,68,68,0.06)'
                                                                    : isCleared ? 'rgba(16,185,129,0.06)'
                                                                        : isActive ? 'rgba(99,102,241,0.07)'
                                                                            : isAwaiting ? 'rgba(245,158,11,0.06)'
                                                                                : r.candidateView === 'AWAITING_DECISION' ? 'rgba(245,158,11,0.06)'
                                                                                    : 'transparent',
                                                            }}
                                                        >
                                                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)' }}>
                                                                {r.roundName}
                                                            </td>
                                                            <td className="px-4 py-3">
                                                                {r.candidateView === 'START_TEST' && <span className="badge badge-primary text-xs">🔔 Active</span>}
                                                                {r.candidateView === 'CLEARED' && <span className="badge badge-success text-xs">✓ Cleared</span>}
                                                                {r.candidateView === 'REJECTED' && <span className="badge badge-danger text-xs">✗ Rejected</span>}
                                                                {r.candidateView === 'LOCKED' && <span className="badge badge-neutral text-xs">🔒 Locked</span>}
                                                                {r.candidateView === 'AWAITING_ACTIVATION' && <span className="badge badge-warning text-xs">⏳ Awaiting HR</span>}
                                                                {r.candidateView === 'AWAITING_RESULT' && <span className="badge badge-warning text-xs">⏳ Awaiting Result</span>}
                                                                {r.candidateView === 'AWAITING_DECISION' && (
                                                                    <span className="badge text-xs" style={{ background: 'var(--warning-bg)', color: 'var(--warning-text)', border: '1px solid var(--warning-border)' }}>
                                                                        ⚠️ Failed - Awaiting HR Decision
                                                                    </span>
                                                                )}
                                                            </td>
                                                            <td className="px-4 py-3">{scorePill(r.score)}</td>
                                                            <td className="px-4 py-3">
                                                                {r.candidateView === 'START_TEST' && (
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => { setSelectedApp(null); handleStartExternalTest(selectedApp); }}
                                                                        className="text-indigo-400 hover:text-indigo-300 font-semibold flex items-center gap-1"
                                                                    >
                                                                        <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                                                            <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                                                                            <polyline points="15 3 21 3 21 9" /><line x1="10" y1="14" x2="21" y2="3" />
                                                                        </svg>
                                                                        Open Test
                                                                    </button>
                                                                )}
                                                            </td>
                                                        </tr>
                                                    );
                                                })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Final recommendation or offer info */}
                                {(selectedApp.overallStatus === 'OFFER_ACCEPTED' || selectedApp.overallStatus === 'OFFER_REJECTED') && (
                                    <div
                                        className="mt-5 p-4 rounded-xl flex items-center gap-3 animate-fade-in"
                                        style={{
                                            background: selectedApp.overallStatus === 'OFFER_ACCEPTED' ? 'var(--success-bg)' : 'var(--danger-bg)',
                                            border: `1px solid ${selectedApp.overallStatus === 'OFFER_ACCEPTED' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                                        }}
                                    >
                                        <div>
                                            <p className="font-semibold" style={{
                                                color: selectedApp.overallStatus === 'OFFER_ACCEPTED' ? 'var(--success-text)' : 'var(--danger-text)',
                                            }}>
                                                {selectedApp.overallStatus === 'OFFER_ACCEPTED' ? '🎉 Offer Accepted! Welcome aboard!' : 'Offer Declined'}
                                            </p>
                                        </div>
                                    </div>
                                )}

                                {selectedApp.finalRecommendation && !['OFFER_ACCEPTED', 'OFFER_REJECTED'].includes(selectedApp.overallStatus) && (
                                    <div
                                        className="mt-5 p-4 rounded-xl flex items-center gap-3 animate-fade-in"
                                        style={{
                                            background: selectedApp.finalRecommendation === 'HIRE' ? 'var(--success-bg)' : 'var(--danger-bg)',
                                            border: `1px solid ${selectedApp.finalRecommendation === 'HIRE' ? 'var(--success-border)' : 'var(--danger-border)'}`,
                                        }}
                                    >
                                        <svg aria-hidden="true" width="24" height="24" viewBox="0 0 24 24" fill="none"
                                            stroke={selectedApp.finalRecommendation === 'HIRE' ? 'var(--success-text)' : 'var(--danger-text)'}
                                            strokeWidth="2.5">
                                            {selectedApp.finalRecommendation === 'HIRE' ? (
                                                <polyline points="20 6 9 17 4 12" />
                                            ) : (
                                                <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                                            )}
                                        </svg>
                                        <div>
                                            <p className="font-semibold" style={{
                                                color: selectedApp.finalRecommendation === 'HIRE' ? 'var(--success-text)' : 'var(--danger-text)',
                                            }}>
                                                Final Decision: {selectedApp.finalRecommendation === 'HIRE' ? 'Hired! 🎉' : 'Not Selected'}
                                            </p>
                                            {selectedApp.nextAction && (
                                                <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
                                                    Next: {selectedApp.nextAction}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
