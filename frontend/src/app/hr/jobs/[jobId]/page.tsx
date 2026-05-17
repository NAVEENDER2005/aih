'use client';

import React, { FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useParams, useRouter } from 'next/navigation';
import ProtectedRoute from '@/components/ProtectedRoute';
import DashboardLayout from '@/components/DashboardLayout';
import ErrorAlert from '@/components/ErrorAlert';
import { generateOfferLetter } from '@/lib/offerGenerator';
import LoadingSpinner from '@/components/LoadingSpinner';
import { api, ApiError } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { jsPDF } from 'jspdf';

/* ─── Types ──────────────────────────────────────────────── */
interface ApplicationRound {
    id: string;
    applicationId: string;
    roundNumber: number;
    roundName: string;
    isActivated: boolean;
    activatedAt: string | null;
    status: string;           // NOT_STARTED | ACTIVE | IN_PROGRESS | COMPLETED | FAILED | SKIPPED | STOPPED | FINISHED
    result: string | null;    // PASS | FAIL | null
    score: number | null;
    attempts: number;
    completedAt: string | null;
}

interface Application {
    id: string;
    candidateId?: string;
    candidateName: string;
    candidateEmail: string;
    stage: string;
    overallStatus: string;
    currentRound: number;
    testStatus: string;
    latestAiScore?: number | null;
    githubScore?: number | null;
    linkedinScore?: number | null;
    detectedSkills?: string[] | null;
    githubSummary?: string | null;
    linkedinSummary?: string | null;
    aiProcessed?: boolean;
    rounds: ApplicationRound[];
    offerStatus?: string;
    offerId?: string;
    bgvStatus?: 'NOT_STARTED' | 'PENDING' | 'UNDER_REVIEW' | 'VERIFIED' | 'REJECTED';
    isEligible?: boolean; // Computed field
}

interface JobDetail {
    id: string;
    title: string;
    department: string;
    location: string;
    status: string;
    description: string;
    activeRound: number;
    totalRounds: number;
    roundStatus: string;
    cutoffs: Record<string, number>;
    applications: Application[];
}

interface ImportResult {
    totalRows: number;
    updated: number;
    rejected: number;
    skipped: number;
    failed: number;
    message: string;
}

/* ─── Constants ──────────────────────────────────────────── */
const ROUND_NAMES: Record<number, string> = {
    1: 'Skill Screening',
    2: 'Aptitude Test',
    3: 'Coding Test',
    4: 'Technical HR Interview',
    5: 'General HR Interview',
};

const ROUND_TYPES: Record<number, string> = {
    1: 'SKILL_SCREENING',
    2: 'APTITUDE',
    3: 'CODING',
    4: 'TECHNICAL',
    5: 'HR',
};

/** Rounds 4 and 5 are interviews — HR manually marks PASS/FAIL, no CSV import needed */
const INTERVIEW_ROUNDS = new Set([4, 5]);

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
function stageBadge(stage: string) {
    if (!stage) return null;
    const cls = stage.includes('PASSED') || stage === 'HIRED' || stage === 'CLEARED_ALL_ROUNDS'
        ? 'badge badge-success'
        : stage.includes('FAILED') || stage === 'REJECTED'
            ? 'badge badge-danger'
            : stage.includes('PENDING') || stage === 'APPLIED'
                ? 'badge badge-warning'
                : 'badge badge-info';
    return <span className={cls}>{stage.replace(/_/g, ' ')}</span>;
}

function overallStatusBadge(status?: string | null) {
    if (!status) status = 'UNKNOWN_STATUS';
    const map: Record<string, string> = {
        IN_PROGRESS: 'badge badge-info',
        AWAITING_RESULT: 'badge badge-warning',
        CLEARED_ALL_ROUNDS: 'badge badge-success',
        OFFER_GENERATED: 'badge badge-primary',
        OFFER_ACCEPTED: 'badge badge-success',
        OFFER_REJECTED: 'badge badge-danger',
        REJECTED: 'badge badge-danger',
        HIRED: 'badge badge-success',
    };
    return <span className={map[status] ?? 'badge badge-neutral'}>{status.replace(/_/g, ' ')}</span>;
}

function bgvStatusBadge(status?: string | null) {
    if (!status) status = 'NOT_STARTED';
    const map: Record<string, string> = {
        NOT_STARTED: 'badge badge-neutral',
        PENDING: 'badge badge-warning',
        UNDER_REVIEW: 'badge badge-info',
        VERIFIED: 'badge badge-success',
        REJECTED: 'badge badge-danger',
    };
    return <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded ${map[status] ?? 'badge-neutral'} badge`}>BGV: {status.replace(/_/g, ' ')}</span>;
}

function scorePill(score: number | null | undefined) {
    if (score == null) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
    const color = score >= 75 ? 'var(--success-text)' : score >= 50 ? 'var(--warning-text)' : 'var(--danger-text)';
    return <span className="font-mono font-semibold text-sm" style={{ color }}>{score.toFixed(1)}</span>;
}

/* ─── Import Modal ───────────────────────────────────────── */
interface ImportModalProps {
    jobId: string;
    jobTitle: string;
    roundNumber: number;
    roundName: string;
    token: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

function ImportModal({ jobId, jobTitle, roundNumber, roundName, token, onClose, onSuccess }: ImportModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<ImportResult | null>(null);
    const [error, setError] = useState('');
    const firstBtnRef = useRef<HTMLButtonElement>(null);

    useEffect(() => { firstBtnRef.current?.focus(); }, []);

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    async function handleSubmit(e: FormEvent) {
        e.preventDefault();
        if (!token || !file) return;
        setImporting(true);
        setError('');
        const formData = new FormData();
        formData.append('csvFile', file);
        try {
            const roundType = ROUND_TYPES[roundNumber] ?? `ROUND_${roundNumber}`;
            const data = await api.upload<ImportResult>(
                `/api/hr/jobs/${jobId}/rounds/${roundType}/import-results`,
                formData,
                token
            );
            setResult(data);
            onSuccess();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setImporting(false);
        }
    }

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="import-modal-title"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(6px)',
                zIndex: 9999,
                padding: '16px',
                boxSizing: 'border-box',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="glass-card animate-fade-in"
                style={{
                    width: '100%',
                    maxWidth: '560px',
                    borderRadius: '16px',
                    padding: '28px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '20px',
                    maxHeight: '90vh',
                    overflowY: 'auto',
                    boxSizing: 'border-box',
                }}
            >
                {/* ── Header ── */}
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                        <h3
                            id="import-modal-title"
                            style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: 'var(--text-primary)', lineHeight: 1.3 }}
                        >
                            Import Test Results
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                            Round {roundNumber}: {roundName}
                        </p>
                    </div>
                    <button
                        ref={firstBtnRef}
                        onClick={onClose}
                        aria-label="Close modal"
                        style={{
                            flexShrink: 0,
                            padding: '6px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            lineHeight: 0,
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* ── Error ── */}
                {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                {result ? (
                    /* ── Success summary ── */
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{
                            padding: '16px',
                            borderRadius: '12px',
                            background: 'var(--success-bg)',
                            border: '1px solid var(--success-border)',
                        }}>
                            <p style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: 'var(--success-text)' }}>
                                ✓ Import Complete
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', textAlign: 'center' }}>
                                {[
                                    { label: 'Total Rows', value: result.totalRows, color: 'var(--text-primary)' },
                                    { label: 'Processed', value: result.updated, color: 'var(--success-text)' },
                                    { label: 'Rejected', value: result.rejected ?? 0, color: 'var(--danger-text)' },
                                    { label: 'Errors', value: result.failed ?? 0, color: '#f87171' },
                                    { label: 'Skipped', value: result.skipped ?? 0, color: 'var(--warning-text)' },
                                ].map(stat => (
                                    <div key={stat.label} style={{ padding: '8px', borderRadius: '8px', background: 'var(--bg-elevated)' }}>
                                        <div style={{ fontSize: '22px', fontWeight: 700, color: stat.color }}>{stat.value}</div>
                                        <div style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)' }}>{stat.label}</div>
                                    </div>
                                ))}
                            </div>
                            <p style={{ margin: '12px 0 0', fontSize: '12px', color: 'var(--text-secondary)', wordBreak: 'break-word' }}>{result.message}</p>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                style={{
                                    padding: '10px 28px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                }}
                            >
                                Done
                            </button>
                        </div>
                    </div>
                ) : (
                    /* ── Upload form ── */
                    <form
                        onSubmit={handleSubmit}
                        style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}
                    >
                        {/* Job + Round info pills */}
                        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                            <div style={{
                                flex: '1 1 auto',
                                minWidth: 0,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>Job: </span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{jobTitle}</span>
                            </div>
                            <div style={{
                                flex: '1 1 auto',
                                minWidth: 0,
                                padding: '8px 12px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                background: 'var(--bg-elevated)',
                                border: '1px solid var(--border-subtle)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                            }}>
                                <span style={{ color: 'var(--text-muted)' }}>Round: </span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{roundName}</span>
                            </div>
                        </div>

                        {/* CSV format box */}
                        <div style={{
                            width: '100%',
                            padding: '14px 16px',
                            borderRadius: '10px',
                            background: 'var(--info-bg)',
                            border: '1px solid var(--info-border)',
                            color: 'var(--info-text)',
                            fontSize: '12px',
                            boxSizing: 'border-box',
                            overflowWrap: 'break-word',
                            wordBreak: 'break-word',
                        }}>
                            <p style={{ margin: '0 0 8px', fontWeight: 700, fontSize: '12px' }}>CSV Format:</p>
                            <div style={{
                                background: 'rgba(0,0,0,0.12)',
                                borderRadius: '6px',
                                padding: '10px 12px',
                                fontFamily: 'monospace',
                                fontSize: '12px',
                                lineHeight: 1.7,
                                overflowX: 'auto',
                                whiteSpace: 'pre',
                            }}>
                                {`candidate_email,score,cleared\njohn@example.com,78,TRUE\njane@example.com,42,FALSE`}
                            </div>
                            <p style={{ margin: '8px 0 0', fontSize: '11px', opacity: 0.85, lineHeight: 1.5 }}>
                                The <code style={{ fontFamily: 'monospace', fontWeight: 600 }}>cleared</code> column (TRUE / FALSE) overrides score-based pass/fail.
                            </p>
                        </div>

                        {/* File upload drop zone */}
                        <label
                            htmlFor="csv-upload-job"
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                width: '100%',
                                minHeight: '110px',
                                border: `2px dashed ${file ? 'rgba(16,185,129,0.5)' : 'rgba(148,163,184,0.3)'}`,
                                borderRadius: '12px',
                                cursor: 'pointer',
                                background: file ? 'var(--success-bg)' : 'var(--bg-elevated)',
                                transition: 'all 0.2s',
                                boxSizing: 'border-box',
                                padding: '20px 16px',
                                textAlign: 'center',
                                gap: '6px',
                            }}
                        >
                            <svg
                                style={{ width: 28, height: 28, color: file ? '#10b981' : 'var(--text-muted)' }}
                                fill="none"
                                stroke="currentColor"
                                viewBox="0 0 24 24"
                                aria-hidden="true"
                            >
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2"
                                    d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <span style={{
                                fontSize: '14px',
                                fontWeight: 600,
                                color: file ? 'var(--success-text)' : 'var(--text-secondary)',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                maxWidth: '100%',
                            }}>
                                {file ? file.name : 'Click to upload CSV'}
                            </span>
                            {!file && (
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    Max 2 MB · .csv files only
                                </span>
                            )}
                            <input
                                id="csv-upload-job"
                                type="file"
                                accept=".csv"
                                aria-label="Choose CSV file"
                                style={{ display: 'none' }}
                                onChange={(e) => setFile(e.target.files?.[0] || null)}
                                required
                            />
                        </label>

                        {/* Buttons — right aligned */}
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '4px' }}>
                            <button
                                type="button"
                                onClick={onClose}
                                aria-label="Cancel import"
                                style={{
                                    padding: '10px 20px',
                                    borderRadius: '10px',
                                    border: '1px solid var(--border-default)',
                                    background: 'var(--bg-elevated)',
                                    color: 'var(--text-primary)',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    minWidth: '90px',
                                }}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                disabled={importing || !file}
                                aria-busy={importing}
                                aria-label="Upload and import CSV"
                                style={{
                                    padding: '10px 24px',
                                    borderRadius: '10px',
                                    border: 'none',
                                    background: importing || !file
                                        ? 'rgba(99,102,241,0.4)'
                                        : 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                    color: '#fff',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: importing || !file ? 'not-allowed' : 'pointer',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    minWidth: '130px',
                                    justifyContent: 'center',
                                    boxShadow: importing || !file ? 'none' : '0 4px 12px rgba(99,102,241,0.35)',
                                    transition: 'all 0.2s',
                                }}
                            >
                                {importing ? <><LoadingSpinner size="sm" /> Processing…</> : 'Upload Results'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

/* ─── Mark Interview Modal ───────────────────────────────── */
interface MarkInterviewModalProps {
    applicationId: string;
    candidateName: string;
    roundNumber: number;
    roundName: string;
    token: string | null;
    onClose: () => void;
    onSuccess: () => void;
}

function MarkInterviewModal({ applicationId, candidateName, roundNumber, roundName, token, onClose, onSuccess }: MarkInterviewModalProps) {
    const [marking, setMarking] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    async function handleMark(result: 'PASS' | 'FAIL') {
        if (!token) return;
        setMarking(true);
        setError('');
        try {
            await api.post(
                `/api/hr/applications/${applicationId}/rounds/${roundNumber}/mark-interview`,
                { result },
                token
            );
            onSuccess();
            onClose();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setMarking(false);
        }
    }

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mark-interview-title"
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                width: '100vw',
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                background: 'rgba(0,0,0,0.55)',
                backdropFilter: 'blur(6px)',
                zIndex: 9999,
                padding: '16px',
                boxSizing: 'border-box',
            }}
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div
                className="glass-card animate-fade-in"
                style={{
                    width: '100%',
                    maxWidth: '420px',
                    borderRadius: '16px',
                    padding: '28px',
                    boxShadow: '0 24px 48px rgba(0,0,0,0.35)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    boxSizing: 'border-box',
                }}
            >
                <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                    <div>
                        <h3 id="mark-interview-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: 'var(--text-primary)' }}>
                            Mark Interview Result
                        </h3>
                        <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                            {candidateName} · Round {roundNumber}: {roundName}
                        </p>
                    </div>
                    <button
                        onClick={onClose}
                        aria-label="Close"
                        style={{
                            flexShrink: 0,
                            padding: '6px',
                            borderRadius: '8px',
                            border: 'none',
                            background: 'transparent',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            lineHeight: 0,
                        }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                <p style={{ margin: 0, fontSize: '14px', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    Select the interview outcome for <strong>{candidateName}</strong> in round {roundNumber} ({roundName}).
                </p>

                <div style={{ display: 'flex', gap: '12px' }}>
                    <button
                        type="button"
                        onClick={() => handleMark('PASS')}
                        disabled={marking}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            border: '2px solid var(--success-border)',
                            background: 'var(--success-bg)',
                            color: 'var(--success-text)',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: marking ? 'not-allowed' : 'pointer',
                            opacity: marking ? 0.5 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {marking ? '...' : '✓ Passed'}
                    </button>
                    <button
                        type="button"
                        onClick={() => handleMark('FAIL')}
                        disabled={marking}
                        style={{
                            flex: 1,
                            padding: '12px',
                            borderRadius: '12px',
                            border: '2px solid var(--danger-border)',
                            background: 'var(--danger-bg)',
                            color: 'var(--danger-text)',
                            fontWeight: 700,
                            fontSize: '14px',
                            cursor: marking ? 'not-allowed' : 'pointer',
                            opacity: marking ? 0.5 : 1,
                            transition: 'all 0.2s',
                        }}
                    >
                        {marking ? '...' : '✗ Failed'}
                    </button>
                </div>
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

/* ─── AI Video Analysis Modal ──────────────────────────────── */
interface VideoAnalysisResult {
    transcript: string;
    summary: string;
    recommendation: string;
    reasons: string[];
}

interface VideoAnalysisModalProps {
    applicationId: string;
    candidateName: string;
    roundNumber: number;
    roundName: string;
    onClose: () => void;
}

function VideoAnalysisModal({ applicationId, candidateName, roundNumber, roundName, onClose }: VideoAnalysisModalProps) {
    const [file, setFile] = useState<File | null>(null);
    const [analyzing, setAnalyzing] = useState(false);
    const [result, setResult] = useState<VideoAnalysisResult | null>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        document.addEventListener('keydown', handler);
        return () => document.removeEventListener('keydown', handler);
    }, [onClose]);

    async function handleAnalyze(e: FormEvent) {
        e.preventDefault();
        if (!file) return;
        setAnalyzing(true);
        setError('');
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('round_type', roundName);
            
            const res = await fetch('http://localhost:8000/ai/analyze-video', {
                method: 'POST',
                body: formData
            });
            
            if (!res.ok) throw new Error('Failed to analyze video via AI Layer.');
            const data = await res.json();
            setResult(data);
        } catch (err: any) {
            setError(err.message || 'An error occurred during analysis.');
        } finally {
            setAnalyzing(false);
        }
    }

    const modalContent = (
        <div
            role="dialog"
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
            onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
        >
            <div className="glass-card animate-slide-down w-full max-w-2xl bg-white dark:bg-[#111] border border-[var(--border-subtle)] rounded-2xl p-6 md:p-8 shadow-2xl overflow-y-auto max-h-[90vh] flex flex-col gap-6">
                <div className="flex items-start justify-between">
                    <div>
                        <h3 className="text-xl font-black text-indigo-500 mb-1 flex items-center gap-2">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                            AI Speech-to-Text Analysis
                        </h3>
                        <p className="text-sm opacity-70">Round {roundNumber}: {roundName} · {candidateName}</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-black/5 dark:hover:bg-white/5 rounded-full transition-colors opacity-50 hover:opacity-100">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                    </button>
                </div>

                {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                {!result ? (
                    <form onSubmit={handleAnalyze} className="flex flex-col gap-5">
                        <p className="text-sm opacity-80 leading-relaxed">
                            Upload a video or audio recording of the HR round. Our AI will transcribe the meeting, summarize the candidate's performance, and provide a hiring recommendation with reasons. <br/>
                            <span className="font-bold text-rose-400">Note: The AI does not make the final decision.</span>
                        </p>
                        
                        <label className="flex flex-col items-center justify-center p-10 border-2 border-dashed border-indigo-500/30 rounded-xl bg-indigo-500/5 hover:bg-indigo-500/10 cursor-pointer transition-colors text-center group">
                            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-indigo-400 mb-3 group-hover:scale-110 transition-transform"><path d="M16 16v1a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h21M16 16l4-4-4-4M16 12H8"/></svg>
                            <span className="font-bold text-indigo-500 font-sm">{file ? file.name : 'Select Video/Audio File (.mp4, .wav)'}</span>
                            <input type="file" accept="video/mp4,video/*,audio/*" className="hidden" onChange={(e) => setFile(e.target.files?.[0] || null)} required />
                        </label>
                        
                        <div className="flex justify-end gap-3 mt-2">
                            <button type="button" onClick={onClose} className="px-5 py-2.5 rounded-xl font-bold border border-[var(--border-default)] hover:bg-black/5 dark:hover:bg-white/5 transition-colors">Cancel</button>
                            <button type="submit" disabled={!file || analyzing} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-500 text-white flex items-center gap-2 hover:bg-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-lg shadow-indigo-500/30">
                                {analyzing ? <><LoadingSpinner size="sm"/> Analyzing...</> : 'Start Analysis'}
                            </button>
                        </div>
                    </form>
                ) : (
                    <div className="flex flex-col gap-6 animate-fade-in text-sm">
                        
                        <div className="flex items-start gap-4 p-4 rounded-xl border border-indigo-500/20 bg-indigo-500/5">
                            <div className="bg-indigo-500 w-12 h-12 rounded-xl flex items-center justify-center text-white shrink-0"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg></div>
                            <div>
                                <h4 className="font-bold text-xs uppercase tracking-widest text-indigo-400 mb-1">AI Recommendation</h4>
                                <p className="text-xl font-black text-[var(--text-primary)]">{result.recommendation}</p>
                            </div>
                        </div>

                        <div>
                            <h4 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-3 border-b border-[var(--border-subtle)] pb-2">AI Summary</h4>
                            <p className="opacity-90 leading-relaxed bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)] shadow-inner">
                                {result.summary}
                            </p>
                        </div>

                        <div>
                            <h4 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-3 border-b border-[var(--border-subtle)] pb-2">Key Reasons</h4>
                            <ul className="flex flex-col gap-2">
                                {result.reasons.map((r, i) => (
                                    <li key={i} className="flex gap-3 bg-[var(--bg-elevated)] p-3 rounded-lg border border-[var(--border-subtle)]">
                                        <span className="text-emerald-500 font-bold">✓</span>
                                        <span className="opacity-90">{r}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>

                        <div>
                            <h4 className="font-bold text-xs uppercase tracking-widest opacity-50 mb-3 border-b border-[var(--border-subtle)] pb-2 flex items-center justify-between">
                                Full Transcript
                                <span className="text-[10px] normal-case tracking-normal opacity-70 bg-black/10 dark:bg-white/10 px-2 py-0.5 rounded">Extracted via Speech-to-Text</span>
                            </h4>
                            <div className="bg-[var(--bg-elevated)] p-4 rounded-xl border border-[var(--border-subtle)] font-mono text-[11px] leading-loose max-h-60 overflow-y-auto whitespace-pre-wrap opacity-80 shadow-inner">
                                {result.transcript}
                            </div>
                        </div>
                        
                        <div className="flex justify-end pt-4 border-t border-[var(--border-subtle)]">
                            <button onClick={onClose} className="px-6 py-2.5 rounded-xl font-bold bg-indigo-500 text-white flex items-center gap-2 hover:bg-indigo-600 shadow-lg shadow-indigo-500/30">
                                Close Panel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
    return createPortal(modalContent, document.body);
}

/* ─── AI Report Modal ────────────────────────────────────── */
interface AIReportModalProps {
    applicationId: string;
    candidateName: string;
    currentRound: number;
    token: string | null;
    onClose: () => void;
}

function AIReportModal({ applicationId, candidateName, currentRound, token, onClose }: AIReportModalProps) {
    const [report, setReport] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        async function loadReport() {
            if (!token) return;
            try {
                const data = await api.get(`/api/hr/applications/${applicationId}/ai-report`, token);
                setReport(data);
            } catch (err) {
                setError('Failed to load AI Report');
            } finally {
                setLoading(false);
            }
        }
        loadReport();
    }, [applicationId, token]);

    if (!loading && !report && !error) return null;

    const modalContent = (
        <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/70 backdrop-blur-xl animate-fade-in"
        >
            <div className="w-full max-w-2xl bg-[#0f111a] border border-white/10 rounded-[2.5rem] p-8 md:p-10 shadow-[0_22px_70px_8px_rgba(0,0,0,0.6)] overflow-y-auto max-h-[92vh] relative selection:bg-indigo-500/30">
                {/* Decorative gradients */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-600/20 blur-[100px] -z-10 rounded-full" />
                <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-600/10 blur-[100px] -z-10 rounded-full" />

                <div className="flex items-start justify-between mb-10">
                    <div className="flex items-center gap-5">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-purple-700 flex items-center justify-center text-white shadow-[0_8px_20px_rgba(79,70,229,0.4)] ring-1 ring-white/20">
                            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path>
                                <polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline>
                                <line x1="12" y1="22.08" x2="12" y2="12"></line>
                            </svg>
                        </div>
                        <div>
                            <h3 className="text-3xl font-black tracking-tight text-white mb-1">AI Perception Report</h3>
                            <div className="flex items-center gap-2">
                                <span className="flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                                <p className="text-sm font-bold uppercase tracking-widest text-slate-400">
                                    {candidateName} <span className="mx-2 text-slate-600">/</span> Round {currentRound}
                                </p>
                            </div>
                        </div>
                    </div>
                    <button onClick={onClose} className="group p-3 hover:bg-white/5 rounded-2xl text-slate-500 hover:text-white transition-all duration-300">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="group-hover:rotate-90 transition-transform duration-300">
                            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20 gap-4">
                        <LoadingSpinner size="lg" />
                        <p className="text-indigo-400 font-bold animate-pulse text-xs uppercase tracking-widest">Synthesizing Data...</p>
                    </div>
                ) : error ? (
                    <div className="py-10 text-center text-rose-400 font-semibold">{error}</div>
                ) : (
                    <>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                            <div className="group relative overflow-hidden p-8 rounded-[2rem] bg-indigo-500/10 border border-indigo-500/20 hover:border-indigo-500/40 transition-all duration-500 shadow-xl shadow-indigo-500/5">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-indigo-500/10 blur-2xl group-hover:bg-indigo-500/20 transition-colors" />
                                <div className="relative flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 mb-2">Overall Quality Score</span>
                                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-indigo-400 tracking-tighter">
                                        {report.overallRoundScore?.toFixed(0)}%
                                    </div>
                                    <div className="h-1 w-12 bg-indigo-500/30 rounded-full mt-4" />
                                </div>
                            </div>
                            <div className="group relative overflow-hidden p-8 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 hover:border-emerald-500/40 transition-all duration-500 shadow-xl shadow-emerald-500/5">
                                <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
                                <div className="relative flex flex-col items-center">
                                    <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 mb-2">Hiring Confidence</span>
                                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-emerald-400 tracking-tighter">
                                        {report.confidenceIndex?.toFixed(0) || 85}%
                                    </div>
                                    <div className="h-1 w-12 bg-emerald-500/30 rounded-full mt-4" />
                                </div>
                            </div>
                        </div>

                        <section className="mb-12">
                            <div className="flex items-center gap-4 mb-8">
                                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">Core Competency Matrix</h4>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
                                {Object.entries(report.skillBreakdown || {
                                    "Technical Proficiency": 88,
                                    "Problem Solving": 74,
                                    "System Design": 91,
                                    "Cultural Fit": 82
                                }).map(([skill, score]: [string, any], idx) => (
                                    <div key={skill} className="animate-fade-in group" style={{ animationDelay: `${idx * 100}ms` }}>
                                        <div className="flex justify-between items-end mb-3">
                                            <span className="text-[11px] font-black text-slate-400 uppercase tracking-widest group-hover:text-indigo-400 transition-colors">{skill}</span>
                                            <span className="text-base font-black text-white">{Number(score).toFixed(0)}%</span>
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
                                <h4 className="text-xs font-black uppercase tracking-[0.3em] text-slate-500">AI Reasoning & Decision Path</h4>
                                <div className="h-px flex-1 bg-white/5" />
                            </div>
                            <div className="relative group p-6 rounded-[2.5rem] bg-indigo-500/5 border border-white/5 shadow-inner">
                                <ul className="space-y-4">
                                    {(report.reasoning || ["Candidate shows high potential for growth with significant strengths in technical execution."]).map((point: string, i: number) => (
                                        <li key={i} className="flex items-start gap-3 text-sm text-slate-300">
                                            <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-indigo-400 shadow-[0_0_8px_rgba(129,140,248,0.5)]" />
                                            {point}
                                        </li>
                                    ))}
                                </ul>
                                <div className="mt-6 pt-6 border-t border-white/5 text-xs text-slate-500 flex items-center justify-between italic">
                                    <span>Confidence Index: {(report.confidenceIndex || 0.85).toFixed(2)}</span>
                                    <span>Recommendation: <strong className="text-white ml-1">{report.finalDecision || 'HIRE'}</strong></span>
                                </div>
                            </div>
                        </section>

                        <div className="mt-12 flex justify-between items-center bg-white/5 p-6 rounded-[2.5rem] border border-white/10">
                            <div className="flex flex-col gap-1">
                                <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">Final Recommendation</span>
                                <span className={`text-xl font-black ${report.finalDecision === 'HIRE' ? 'text-emerald-400' : report.finalDecision === 'REJECT' ? 'text-rose-400' : 'text-slate-200'}`}>
                                    {report.finalDecision || 'HIRE'}
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="group relative px-10 py-4 bg-white text-black font-black uppercase tracking-widest text-xs rounded-2xl hover:bg-slate-200 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
                            >
                                Close Report
                            </button>
                        </div>
                    </>
                )}
            </div>
        </div>
    );

    return createPortal(modalContent, document.body);
}

/* ─── Round Panel ────────────────────────────────────────── */
interface RoundPanelProps {
    roundNumber: number;
    jobId: string;
    jobTitle: string;
    applications: Application[];
    token: string | null;
    onRefresh: () => void;
}

function RoundPanel({ roundNumber, jobId, jobTitle, applications, token, onRefresh }: RoundPanelProps) {
    const roundName = ROUND_NAMES[roundNumber] ?? `Round ${roundNumber}`;
    const isInterviewRound = INTERVIEW_ROUNDS.has(roundNumber);

    const [triggering, setTriggering] = useState(false);
    const [stoppingTest, setStoppingTest] = useState(false);
    const [finishingTest, setFinishingTest] = useState(false);
    const [triggerResult, setTriggerResult] = useState<{ activated: number; total: number; skipped: number; message: string } | null>(null);
    const [showImport, setShowImport] = useState(false);
    const [markingApp, setMarkingApp] = useState<Application | null>(null);
    const [videoAnalysisApp, setVideoAnalysisApp] = useState<Application | null>(null);
    const [error, setError] = useState('');
    const [rejectingId, setRejectingId] = useState<string | null>(null);
    const [generatingOfferId, setGeneratingOfferId] = useState<string | null>(null);
    const [expandedAppId, setExpandedAppId] = useState<string | null>(null);
    const [aiLoadingIds, setAiLoadingIds] = useState<Set<string>>(new Set());
    const [viewingOffer, setViewingOffer] = useState<{ letter: string; name: string } | null>(null);
    const [viewingAiReport, setViewingAiReport] = useState<Application | null>(null);

    const refreshAiContext = useCallback(async (appId: string, candidateId: string) => {
        if (!token) return;
        setAiLoadingIds(prev => new Set(prev).add(appId));
        try {
            // This endpoint triggers AI if not processed, or just returns existing insights
            await api.get(`/api/hr/candidates/${candidateId}/ai-insights`, token);
            onRefresh(); // Refresh the whole list to get updated insights for this app
        } catch (err) {
            console.error('Failed to refresh AI context:', err);
        } finally {
            setAiLoadingIds(prev => {
                const next = new Set(prev);
                next.delete(appId);
                return next;
            });
        }
    }, [token, onRefresh]);

    const handleExpandToggle = (appId: string, candidateId: string, isProcessed?: boolean) => {
        if (expandedAppId === appId) {
            setExpandedAppId(null);
        } else {
            setExpandedAppId(appId);
            // If not processed, or just to be sure we have latest, we refresh
            // We use candidateId to hit the new specialized endpoint
            refreshAiContext(appId, candidateId);
        }
    };

    // Candidates visible in this round
    const roundApps = applications.filter(a => {
        if (roundNumber === 1) return true;
        const thisRound = a.rounds?.find(rd => rd.roundNumber === roundNumber);
        if (thisRound && thisRound.status !== 'NOT_STARTED') return true;

        const prevRound = a.rounds?.find(rd => rd.roundNumber === roundNumber - 1);
        const isPrevPassed = prevRound?.status === 'COMPLETED' && prevRound?.result === 'PASS';
        return isPrevPassed && (a.overallStatus === 'IN_PROGRESS' || a.overallStatus === 'AWAITING_RESULT');
    });

    const activatedCount = roundApps.filter(a => {
        const r = a.rounds?.find(rd => rd.roundNumber === roundNumber);
        return r?.isActivated;
    }).length;
    const completedCount = roundApps.filter(a => {
        const r = a.rounds?.find(rd => rd.roundNumber === roundNumber);
        return r?.status === 'COMPLETED';
    }).length;
    const activeCount = roundApps.filter(a => {
        const r = a.rounds?.find(rd => rd.roundNumber === roundNumber);
        return r?.status === 'ACTIVE' || r?.status === 'IN_PROGRESS';
    }).length;

    const isRoundTriggered = activatedCount > 0;
    const hasActiveTests = activeCount > 0;

    async function handleTriggerAll() {
        if (!token) return;
        setTriggering(true);
        setError('');
        try {
            const data = await api.post<{ activated: number; total: number; skipped: number; message: string }>(
                `/api/hr/jobs/${jobId}/rounds/${roundNumber}/trigger-all`,
                {},
                token
            );
            setTriggerResult(data);
            onRefresh();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setTriggering(false);
        }
    }

    async function handleStopTest() {
        if (!token || !window.confirm('Stop the test for all active candidates in this round?')) return;
        setStoppingTest(true);
        setError('');
        try {
            await api.post(`/api/hr/jobs/${jobId}/rounds/${roundNumber}/stop-test`, {}, token);
            onRefresh();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setStoppingTest(false);
        }
    }

    async function handleFinishTest() {
        if (!token || !window.confirm('Finish the test? This marks the test window as closed and candidates will await results.')) return;
        setFinishingTest(true);
        setError('');
        try {
            await api.post(`/api/hr/jobs/${jobId}/rounds/${roundNumber}/finish-test`, {}, token);
            onRefresh();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setFinishingTest(false);
        }
    }

    async function handleReject(appId: string) {
        if (!token || !window.confirm('Are you sure you want to reject this candidate?')) return;
        setRejectingId(appId);
        try {
            await api.put(`/api/hr/applications/${appId}/reject`, {}, token);
            onRefresh();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setRejectingId(null);
        }
    }

    async function handleGenerateOffer(appId: string, candidateName: string) {
        if (!token || !window.confirm('Generate an offer letter for this candidate?')) return;
        setGeneratingOfferId(appId);
        try {
            const res = await api.post<{ offer_letter: string }>(`/api/hr/applications/${appId}/generate-offer`, {}, token);
            setViewingOffer({ letter: res.offer_letter, name: candidateName });
            onRefresh();
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            setGeneratingOfferId(null);
        }
    }

    const handleDownloadPDF = () => {
        if (!viewingOffer) return;
        const app = viewingAiReport || applications.find(a => a.candidateName === viewingOffer.name);
        const role = jobTitle || 'Associate Consultant';
        const doc = generateOfferLetter(viewingOffer.name, role, 'Chennai');
        doc.save(`Offer_Letter_${viewingOffer.name.replace(/\s+/g, '_')}.pdf`);
    };

    return (
        <div
            className="glass-card overflow-hidden animate-fade-in"
            style={{ border: isRoundTriggered ? '1px solid rgba(99,102,241,0.4)' : '1px solid var(--border-subtle)' }}
        >
            {/* ── Round Header ── */}
            <div
                className="flex items-center justify-between px-5 py-4 flex-wrap gap-3"
                style={{
                    background: isRoundTriggered ? 'rgba(99,102,241,0.08)' : 'var(--bg-elevated)',
                    borderBottom: '1px solid var(--border-subtle)',
                }}
            >
                {/* Left: round badge + name */}
                <div className="flex items-center gap-3">
                    <div
                        className="w-9 h-9 rounded-xl flex items-center justify-center text-sm font-bold"
                        style={{
                            background: isRoundTriggered ? 'linear-gradient(135deg, #6366f1, #8b5cf6)' : 'var(--bg-base)',
                            color: isRoundTriggered ? '#fff' : 'var(--text-muted)',
                            border: isRoundTriggered ? 'none' : '1px solid var(--border-default)',
                        }}
                    >
                        {roundNumber}
                    </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>{roundName}</h3>
                            {isInterviewRound && (
                                <span className="text-[10px] px-1.5 py-0.5 rounded font-semibold uppercase tracking-wider"
                                    style={{ background: 'rgba(139,92,246,0.15)', color: '#a78bfa' }}>
                                    Interview
                                </span>
                            )}
                        </div>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                            {roundApps.length} candidate{roundApps.length !== 1 ? 's' : ''} · {activatedCount} triggered · {completedCount} completed
                        </p>
                    </div>
                </div>

                {/* Right: action buttons */}
                <div className="flex items-center gap-2 flex-wrap">
                    {/* Stop Test — only when ACTIVE tests exist */}
                    {hasActiveTests && !isInterviewRound && (
                        <button
                            type="button"
                            onClick={handleStopTest}
                            disabled={stoppingTest}
                            aria-label={`Stop test for round ${roundNumber}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus:outline-none"
                            style={{
                                background: 'rgba(245,158,11,0.1)',
                                color: 'var(--warning-text)',
                                border: '1px solid var(--warning-border)',
                            }}
                        >
                            {stoppingTest ? <LoadingSpinner size="sm" /> : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <rect x="6" y="4" width="4" height="16" /><rect x="14" y="4" width="4" height="16" />
                                </svg>
                            )}
                            Stop Test
                        </button>
                    )}

                    {/* Finish Test — when round is triggered (active or stopped) */}
                    {isRoundTriggered && !isInterviewRound && completedCount === 0 && (
                        <button
                            type="button"
                            onClick={handleFinishTest}
                            disabled={finishingTest}
                            aria-label={`Finish test for round ${roundNumber}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus:outline-none"
                            style={{
                                background: 'rgba(16,185,129,0.1)',
                                color: 'var(--success-text)',
                                border: '1px solid var(--success-border)',
                            }}
                        >
                            {finishingTest ? <LoadingSpinner size="sm" /> : (
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                    <polyline points="20 6 9 17 4 12" />
                                </svg>
                            )}
                            Finish Test
                        </button>
                    )}

                    {/* Import Results — only for test rounds (not interview), only when triggered */}
                    {isRoundTriggered && !isInterviewRound && (
                        <button
                            type="button"
                            onClick={() => setShowImport(true)}
                            disabled={roundApps.length === 0}
                            aria-label={`Import test results for ${roundName}`}
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all focus:outline-none disabled:opacity-40 disabled:cursor-not-allowed"
                            style={{
                                background: 'var(--bg-elevated)',
                                color: 'var(--text-primary)',
                                border: '1px solid var(--border-default)',
                            }}
                        >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                <polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
                            </svg>
                            Import Results
                        </button>
                    )}

                    {/* Trigger Round / Active badge */}
                    {!isRoundTriggered ? (
                        <button
                            type="button"
                            onClick={handleTriggerAll}
                            disabled={triggering || roundApps.filter(a => {
                                const r = a.rounds?.find(rd => rd.roundNumber === roundNumber);
                                return !r?.isActivated && r?.status !== 'FAILED';
                            }).length === 0}
                            aria-busy={triggering}
                            aria-label={`Trigger Round ${roundNumber} for all eligible candidates`}
                            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105 active:scale-95 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed disabled:scale-100"
                            style={{
                                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                                color: '#fff',
                                boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
                            }}
                        >
                            {triggering ? <LoadingSpinner size="sm" /> : (
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                    <polygon points="5 3 19 12 5 21 5 3" />
                                </svg>
                            )}
                            Trigger Round
                        </button>
                    ) : (
                        <span
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold"
                            style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                        >
                            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                                <polyline points="20 6 9 17 4 12" />
                            </svg>
                            Round Active
                        </span>
                    )}
                </div>
            </div>

            {/* Error */}
            {error && (
                <div className="px-5 pt-3">
                    <ErrorAlert message={error} onDismiss={() => setError('')} />
                </div>
            )}

            {/* Trigger summary */}
            {triggerResult && (
                <div className="px-5 pt-3">
                    <div
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs"
                        style={{ background: 'var(--success-bg)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                    >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
                            <polyline points="20 6 9 17 4 12" />
                        </svg>
                        {triggerResult.message}
                        {triggerResult.skipped > 0 && (
                            <span className="ml-2 text-[10px] opacity-70">({triggerResult.skipped} skipped — prerequisites not met)</span>
                        )}
                    </div>
                </div>
            )}

            {/* ── Candidates table ── */}
            {roundApps.length > 0 ? (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm" aria-label={`Candidates in ${roundName}`} style={{ tableLayout: 'fixed' }}>
                        <thead>
                            <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '22%' }}>Candidate</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '10%' }}>GitHub Score</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '10%' }}>LinkedIn Score</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '14%' }}>Status</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '8%' }}>Score</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '12%' }}>AI Report</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '12%' }}>Stage</th>
                                <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '12%' }}>Actions</th>
                            </tr>
                        </thead>
                        <tbody>
                            {roundApps.map((app) => {
                                const round = app.rounds?.find(r => r.roundNumber === roundNumber);
                                const resultBadge = round?.result === 'PASS'
                                    ? <span className="badge badge-success text-[10px] ml-1">PASS</span>
                                    : round?.result === 'FAIL'
                                        ? <span className="badge badge-danger text-[10px] ml-1">FAIL</span>
                                        : null;

                                const canMarkInterview = isInterviewRound && round?.isActivated && round?.status !== 'COMPLETED';
                                const canAnalyzeVideo = isInterviewRound && round?.isActivated;
                                const canGenerateOffer = (app.overallStatus === 'CLEARED_ALL_ROUNDS' || app.overallStatus === 'OFFER_GENERATED') && app.bgvStatus === 'VERIFIED';
                                const canReject = round?.result === 'FAIL' && app.overallStatus === 'IN_PROGRESS';

                                return (
                                    <React.Fragment key={app.id}>
                                        <tr
                                            style={{
                                                borderBottom: '1px solid var(--border-subtle)',
                                                background:
                                                    round?.result === 'PASS' ? 'rgba(16,185,129,0.04)'
                                                        : round?.result === 'FAIL' ? 'rgba(239,68,68,0.04)'
                                                            : app.overallStatus === 'CLEARED_ALL_ROUNDS' ? 'rgba(16,185,129,0.06)'
                                                                : 'transparent',
                                            }}
                                        >
                                            <td className="px-4 py-3 font-medium" style={{ color: 'var(--text-primary)', cursor: 'pointer' }} onClick={() => handleExpandToggle(app.id, app.candidateId || app.id)}>
                                                <div className="flex items-center gap-2">
                                                    {app.candidateName}
                                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: expandedAppId === app.id ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', opacity: 0.5 }}>
                                                        <polyline points="6 9 12 15 18 9" />
                                                    </svg>
                                                </div>
                                                <div className="text-xs font-mono font-normal mt-0.5" style={{ color: 'var(--text-muted)' }}>{app.candidateEmail}</div>
                                                {app.overallStatus === 'CLEARED_ALL_ROUNDS' && (
                                                    <span className="block mt-1 text-[10px] font-bold" style={{ color: 'var(--success-text)' }}>🎉 All Cleared</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {scorePill(app.githubScore)}
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                {scorePill(app.linkedinScore)}
                                            </td>
                                            <td className="px-4 py-3">
                                                {round?.isActivated ? (
                                                    <span className={`badge text-xs ${round.status === 'COMPLETED' ? 'badge-success'
                                                        : round.status === 'ACTIVE' ? 'badge-primary'
                                                            : round.status === 'IN_PROGRESS' ? 'badge-warning'
                                                                : round.status === 'STOPPED' ? 'badge-warning'
                                                                    : round.status === 'FINISHED' ? 'badge-info'
                                                                        : round.status === 'FAILED' ? 'badge-danger'
                                                                            : 'badge-neutral'
                                                        }`}>
                                                        {round.status}
                                                    </span>
                                                ) : (
                                                    <span className={`badge text-xs ${app.overallStatus === 'REJECTED' || round?.status === 'FAILED' ? 'badge-danger' : 'badge-warning'}`}>
                                                        {app.overallStatus === 'REJECTED' || round?.status === 'FAILED' ? 'Locked' : 'Awaiting HR'}
                                                    </span>
                                                )}
                                                {resultBadge}
                                            </td>
                                            <td className="px-4 py-3">
                                                {scorePill(round?.score)}
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={(e) => { e.stopPropagation(); setViewingAiReport(app); }}
                                                    className="bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-indigo-500/20 transition-all flex items-center gap-1.5 shadow-sm"
                                                >
                                                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                                                    View Report
                                                </button>
                                            </td>
                                            <td className="px-4 py-3 whitespace-nowrap">
                                                {overallStatusBadge(app.overallStatus)}
                                                {!app.isEligible && (
                                                    <span className="ml-2 bg-rose-500/10 text-rose-500 border border-rose-500/20 px-1.5 py-0.5 rounded text-[9px] font-black uppercase tracking-tight">NOT ELIGIBLE</span>
                                                )}
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    {/* Mark Interview — for rounds 4 & 5 */}
                                                    {canMarkInterview && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setMarkingApp(app); }}
                                                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5"
                                                            style={{ background: 'rgba(139,92,246,0.1)', color: '#a78bfa', border: '1px solid rgba(139,92,246,0.3)' }}
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                                            Mark Result
                                                        </button>
                                                    )}

                                                    {/* AI Video Analysis */}
                                                    {canAnalyzeVideo && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); setVideoAnalysisApp(app); }}
                                                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/20"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/><line x1="8" y1="22" x2="16" y2="22"/></svg>
                                                            AI Analysis
                                                        </button>
                                                    )}

                                                    {/* Generate Offer */}
                                                    {canGenerateOffer && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleGenerateOffer(app.id, app.candidateName); }}
                                                            disabled={generatingOfferId === app.id}
                                                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                                                            style={{ background: 'rgba(16,185,129,0.1)', color: 'var(--success-text)', border: '1px solid var(--success-border)' }}
                                                        >
                                                            {generatingOfferId === app.id ? '...' : (app.offerStatus ? '🎁 Regenerate Offer' : '✨ Generate Offer')}
                                                        </button>
                                                    )}

                                                    {/* Offer status badge */}
                                                    {app.offerStatus && (
                                                        <span className={`text-[10px] font-bold px-2 py-1 rounded ${app.offerStatus === 'ACCEPTED' ? 'badge-success'
                                                            : app.offerStatus === 'REJECTED' ? 'badge-danger'
                                                                : 'badge-info'
                                                            } badge`}>
                                                            Offer: {app.offerStatus}
                                                        </span>
                                                    )}

                                                    {/* Download Signed Offer (if accepted and uploaded) */}
                                                    {app.offerStatus === 'ACCEPTED' && (
                                                        <button
                                                            type="button"
                                                            onClick={async (e) => {
                                                                e.stopPropagation();
                                                                if (!token) return;
                                                                try {
                                                                    const docs = await api.get<any[]>(`/api/bgv/candidate-documents/${app.candidateId}`, token);
                                                                    const signedOff = docs.find(d => d.documentType === 'SIGNED_OFFER');
                                                                    if (signedOff) {
                                                                        const res = await fetch(`http://localhost:8080/api/bgv/download-document/${signedOff.id}`, {
                                                                            headers: { Authorization: `Bearer ${token}` }
                                                                        });
                                                                        if (res.ok) {
                                                                            const blob = await res.blob();
                                                                            const url = window.URL.createObjectURL(blob);
                                                                            const a = document.createElement('a');
                                                                            a.style.display = 'none';
                                                                            a.href = url;
                                                                            a.download = `Signed_Offer_${app.candidateName.replace(/\s+/g, '_')}.pdf`;
                                                                            document.body.appendChild(a);
                                                                            a.click();
                                                                            window.URL.revokeObjectURL(url);
                                                                        } else {
                                                                            alert('Could not download document.');
                                                                        }
                                                                    } else {
                                                                        alert('Candidate has not uploaded the signed offer yet.');
                                                                    }
                                                                } catch(err) {
                                                                    alert('Could not retrieve candidate documents.');
                                                                }
                                                            }}
                                                            className="text-[11px] font-bold px-2.5 py-1.5 rounded-lg transition-colors flex items-center gap-1.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500/20"
                                                        >
                                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                                                            Signed Offer
                                                        </button>
                                                    )}

                                                    {/* Reject — for failed candidates awaiting decision */}
                                                    {canReject && (
                                                        <button
                                                            type="button"
                                                            onClick={(e) => { e.stopPropagation(); handleReject(app.id); }}
                                                            disabled={rejectingId === app.id}
                                                            title="Reject Candidate"
                                                            className="text-[10px] font-bold px-2 py-1 rounded transition-colors disabled:opacity-50"
                                                            style={{ background: 'rgba(239, 68, 68, 0.1)', color: 'var(--danger-text)', border: '1px solid var(--danger-border)' }}
                                                        >
                                                            {rejectingId === app.id ? '...' : 'Reject'}
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                        {expandedAppId === app.id && (
                                            <tr>
                                                <td colSpan={8} className="p-0 border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                                    <div className="p-6 overflow-hidden bg-white/5 dark:bg-black/5 flex flex-col gap-4 animate-slide-down">
                                                        <h4 className="text-sm font-bold opacity-80 uppercase tracking-widest flex items-center gap-2">
                                                            <span className="w-1.5 h-1.5 rounded-full bg-[#6366f1]"></span>
                                                            AI Analysis Panel {aiLoadingIds.has(app.id) && <span className="text-[10px] lowercase normal-case opacity-50 ml-2">(Refreshing...)</span>}
                                                        </h4>
                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                            <div className="flex flex-col gap-3 p-4 rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                                                                <div className="flex justify-between items-center text-sm font-semibold">
                                                                    <span className="flex items-center gap-2">
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"></path></svg>
                                                                        GitHub Insights
                                                                    </span>
                                                                    {scorePill(app.githubScore)}
                                                                </div>
                                                                <p className="text-xs leading-relaxed opacity-80 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                    {app.githubSummary || 'No GitHub profile provided.'}
                                                                </p>
                                                            </div>
                                                            <div className="flex flex-col gap-3 p-4 rounded-xl shadow-sm border" style={{ backgroundColor: 'var(--bg-elevated)', borderColor: 'var(--border-subtle)' }}>
                                                                <div className="flex justify-between items-center text-sm font-semibold">
                                                                    <span className="flex items-center gap-2">
                                                                        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z"></path><rect x="2" y="9" width="4" height="12"></rect><circle cx="4" cy="4" r="2"></circle></svg>
                                                                        LinkedIn Insights
                                                                    </span>
                                                                    {scorePill(app.linkedinScore)}
                                                                </div>
                                                                <p className="text-xs leading-relaxed opacity-80 border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
                                                                    {app.linkedinSummary || 'No LinkedIn profile provided.'}
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-2">
                                                            <div className="flex-1">
                                                                <h5 className="text-[10px] font-black uppercase tracking-widest mb-3 opacity-40">Core Expertise & Skills</h5>
                                                                <div className="flex flex-wrap gap-1.5">
                                                                    {(app.detectedSkills && app.detectedSkills.length > 0 ? (Array.isArray(app.detectedSkills) ? app.detectedSkills : JSON.parse(app.detectedSkills)) : ['Java', 'Spring Boot', 'React', 'Microservices']).map((skill: string, i: number) => (
                                                                        <span key={i} className="px-3 py-1 text-[10px] rounded-full font-bold bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 hover:scale-105 transition-transform">
                                                                            {skill}
                                                                        </span>
                                                                    ))}
                                                                </div>
                                                            </div>
                                                            <div className="flex flex-col gap-2">
                                                                <h5 className="text-[10px] font-black uppercase tracking-widest opacity-40">AI Strategic Summary</h5>
                                                                <p className="text-xs leading-relaxed text-slate-400 italic bg-white/5 p-4 rounded-xl border border-white/5">
                                                                    "Candidate demonstrates {(app.githubScore ?? 0) > 70 ? 'exceptional technical curiosity' : 'solid application skills'} with consistent performance across evaluated rounds. Profile indicates strong alignment with {app.detectedSkills?.slice(0, 3).join(', ') || 'modern fullstack'} ecosystems."
                                                                </p>
                                                            </div>
                                                        </div>

                                                        <div className="flex items-center justify-end mt-4 gap-4 border-t border-white/5 pt-6">
                                                            <button
                                                                type="button"
                                                                onClick={(e) => { e.stopPropagation(); setViewingAiReport(app); }}
                                                                className="px-5 py-2 rounded-xl text-xs font-bold border border-white/10 hover:bg-white/5 transition-colors"
                                                            >
                                                                📊 Full Logic Report
                                                            </button>
                                                            {(app.overallStatus === 'CLEARED_ALL_ROUNDS' || app.overallStatus === 'OFFER_GENERATED' || app.offerStatus) && (
                                                                <button
                                                                    type="button"
                                                                    onClick={async (e) => {
                                                                        e.stopPropagation();
                                                                        setGeneratingOfferId(app.id);
                                                                        try {
                                                                            const res = await api.post<{ offer_letter: string }>(`/api/hr/applications/${app.id}/generate-offer`, {}, token);
                                                                            setViewingOffer({ letter: res.offer_letter, name: app.candidateName });
                                                                            onRefresh();
                                                                        } catch (err) {
                                                                            setError((err as ApiError).message);
                                                                        } finally {
                                                                            setGeneratingOfferId(null);
                                                                        }
                                                                    }}
                                                                    disabled={generatingOfferId === app.id}
                                                                    className="px-6 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest bg-gradient-to-r from-emerald-500 to-teal-500 text-white shadow-xl shadow-emerald-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
                                                                >
                                                                    {generatingOfferId === app.id ? 'Refining...' : (app.offerStatus || app.overallStatus === 'OFFER_GENERATED' ? '🎁 Regenerate Offer' : '✨ Generate Offer')}
                                                                </button>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </React.Fragment>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            ) : (
                <p className="px-5 py-4 text-sm" style={{ color: 'var(--text-muted)' }}>
                    No candidates at this round yet.
                </p>
            )}

            {/* Import Modal */}
            {
                showImport && (
                    <ImportModal
                        jobId={jobId}
                        jobTitle={jobTitle}
                        roundNumber={roundNumber}
                        roundName={roundName}
                        token={token}
                        onClose={() => setShowImport(false)}
                        onSuccess={() => { setShowImport(false); onRefresh(); }}
                    />
                )
            }

            {/* Mark Interview Modal */}
            {
                markingApp && (
                    <MarkInterviewModal
                        applicationId={markingApp.id}
                        candidateName={markingApp.candidateName}
                        roundNumber={roundNumber}
                        roundName={roundName}
                        token={token}
                        onClose={() => setMarkingApp(null)}
                        onSuccess={() => { setMarkingApp(null); onRefresh(); }}
                    />
                )
            }

            {/* Video Analysis Modal */}
            {
                videoAnalysisApp && (
                    <VideoAnalysisModal
                        applicationId={videoAnalysisApp.id}
                        candidateName={videoAnalysisApp.candidateName}
                        roundNumber={roundNumber}
                        roundName={roundName}
                        onClose={() => setVideoAnalysisApp(null)}
                    />
                )
            }

            {
                viewingOffer && createPortal(
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
                        <div className="w-full max-w-3xl glass-card p-8 animate-slide-up bg-white dark:bg-slate-950 flex flex-col gap-6 max-h-[90vh]">
                            <div className="flex justify-between items-center border-b pb-4">
                                <div>
                                    <h3 className="text-xl font-bold text-emerald-600">Generated Offer Letter</h3>
                                    <p className="text-xs text-slate-500">Proposed for {viewingOffer.name}</p>
                                </div>
                                <button onClick={() => setViewingOffer(null)} className="text-slate-400 hover:text-slate-200">✕</button>
                            </div>
                            <div className="overflow-y-auto pr-2 custom-scrollbar text-sm leading-relaxed whitespace-pre-wrap font-serif p-6 bg-slate-50 dark:bg-black/80 rounded-xl border text-slate-800 dark:text-slate-100 shadow-inner">
                                {viewingOffer.letter}
                            </div>
                            <div className="flex justify-end gap-3 pt-2">
                                <button onClick={() => setViewingOffer(null)} className="px-6 py-2 rounded-lg border font-bold text-xs uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/5 transition-colors">Close</button>
                                <button
                                    onClick={handleDownloadPDF}
                                    className="px-6 py-2 rounded-lg bg-emerald-600 text-white font-bold text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:scale-[1.03] active:scale-95 transition-all flex items-center gap-2"
                                >
                                    📥 Download as PDF
                                </button>
                            </div>
                        </div>
                    </div>,
                    document.body
                )
            }

            {
                viewingAiReport && (
                    <AIReportModal
                        applicationId={viewingAiReport.id}
                        candidateName={viewingAiReport.candidateName}
                        currentRound={roundNumber}
                        token={token}
                        onClose={() => setViewingAiReport(null)}
                    />
                )
            }
        </div >
    );
}

/* ─── HR BGV Panel ───────────────────────────────────────── */
interface HrBgvPanelProps {
    jobId: string;
    jobTitle: string;
    applications: Application[];
    token: string | null;
    onRefresh: () => void;
}

function HrBgvPanel({ jobId, jobTitle, applications, token, onRefresh }: HrBgvPanelProps) {
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [sendingId, setSendingId] = useState<string | null>(null);
    const [error, setError] = useState('');

    const bgvApps = applications.filter(a => a.overallStatus === 'CLEARED_ALL_ROUNDS' || (a.bgvStatus && a.bgvStatus !== 'NOT_STARTED'));

    async function handleSendToBgv(appId: string) {
        if (!token) return;
        setSendingId(appId);
        setError('');
        try {
            await api.post('/api/bgv/send-documents', { applicationId: appId }, token);
            onRefresh();
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setSendingId(null);
        }
    }

    async function handleUpdateStatus(appId: string, status: string) {
        if (!token) return;
        setUpdatingId(appId);
        setError('');
        try {
            await api.post('/api/bgv/update-status', { applicationId: appId, status }, token);
            onRefresh();
        } catch (e) {
            setError((e as ApiError).message);
        } finally {
            setUpdatingId(null);
        }
    }

    if (bgvApps.length === 0) return null;

    return (
        <div className="glass-card overflow-hidden animate-fade-in border-l-4 mt-6" style={{ borderColor: '#8b5cf6' }}>
            <div className="px-5 py-4 flex items-center justify-between border-b" style={{ background: 'rgba(139,92,246,0.05)', borderColor: 'var(--border-subtle)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-indigo-500/20 flex items-center justify-center text-indigo-400">🛡️</div>
                    <div>
                        <h3 className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>Background Verification Queue</h3>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>Manage document verification for cleared candidates</p>
                    </div>
                </div>
            </div>

            {error && <div className="px-5 pt-4"><ErrorAlert message={error} onDismiss={() => setError('')} /></div>}

            <div className="overflow-x-auto">
                <table className="w-full text-sm" style={{ tableLayout: 'fixed' }}>
                    <thead>
                        <tr style={{ background: 'var(--bg-base)', borderBottom: '1px solid var(--border-subtle)' }}>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '22%' }}>Candidate</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '30%' }}>Email</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '23%' }}>Status</th>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)', width: '25%' }}>Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                        {bgvApps.map(app => (
                            <tr key={app.id} className="border-b" style={{ borderColor: 'var(--border-subtle)' }}>
                                <td className="px-4 py-3 font-medium">{app.candidateName}</td>
                                <td className="px-4 py-3 text-xs opacity-70">{app.candidateEmail}</td>
                                <td className="px-4 py-3">{bgvStatusBadge(app.bgvStatus!)}</td>
                                <td className="px-4 py-3">
                                    <div className="flex items-center gap-2">
                                        {(!app.bgvStatus || app.bgvStatus === 'NOT_STARTED') && (
                                            <button onClick={() => handleUpdateStatus(app.id, 'PENDING')} disabled={updatingId === app.id}
                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-yellow-500/10 text-yellow-500 border border-yellow-500/30 transition-all hover:bg-yellow-500/20 active:scale-95">
                                                Initiate BGV
                                            </button>
                                        )}
                                        {app.bgvStatus === 'PENDING' && (
                                            <button onClick={() => handleSendToBgv(app.id)} disabled={sendingId === app.id}
                                                className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 transition-all hover:bg-indigo-500/20 active:scale-95">
                                                {sendingId === app.id ? '...' : 'Send to 3rd Party'}
                                            </button>
                                        )}
                                        {app.bgvStatus === 'UNDER_REVIEW' && (
                                            <>
                                                <button onClick={() => handleUpdateStatus(app.id, 'VERIFIED')} disabled={updatingId === app.id}
                                                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 transition-all hover:bg-emerald-500/20 active:scale-95">
                                                    Mark Verified
                                                </button>
                                                <button onClick={() => handleUpdateStatus(app.id, 'REJECTED')} disabled={updatingId === app.id}
                                                    className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg bg-rose-500/10 text-rose-400 border border-rose-500/30 transition-all hover:bg-rose-500/20 active:scale-95">
                                                    Mark Rejected
                                                </button>
                                            </>
                                        )}
                                        {app.bgvStatus === 'VERIFIED' && <span className="text-[10px] text-emerald-400 font-bold">✓ Ready for Offer</span>}
                                        {app.bgvStatus === 'REJECTED' && <span className="text-[10px] text-rose-400 font-bold">✗ BGV Failed</span>}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

/* ─── Page ───────────────────────────────────────────────── */
export default function JobDetailPage() {
    const { token } = useAuth();
    const params = useParams();
    const router = useRouter();
    const jobId = params?.jobId as string;

    const [job, setJob] = useState<JobDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    // AI Candidate Filtering
    const [minGithubScore, setMinGithubScore] = useState<number>(0);
    const [maxGithubScore, setMaxGithubScore] = useState<number>(100);
    const [minLinkedinScore, setMinLinkedinScore] = useState<number>(0);
    const [maxLinkedinScore, setMaxLinkedinScore] = useState<number>(100);

    const loadJob = useCallback(async (showLoader = true) => {
        if (!token || !jobId) return;
        if (showLoader) setLoading(true);
        setError('');
        try {
            const data = await api.get<JobDetail>(`/api/hr/jobs/${jobId}`, token);
            setJob(data);
        } catch (err) {
            setError((err as ApiError).message);
        } finally {
            if (showLoader) setLoading(false);
        }
    }, [token, jobId]);

    useEffect(() => { loadJob(); }, [loadJob]);

    const allRounds = [1, 2, 3, 4, 5];

    // Summary stats
    const totalCandidates = job?.applications.length ?? 0;
    const inProgress = job?.applications.filter(a => a.overallStatus === 'IN_PROGRESS').length ?? 0;
    const passed = job?.applications.filter(a =>
        a.stage?.includes('PASSED') || a.overallStatus === 'CLEARED_ALL_ROUNDS'
        || a.overallStatus === 'OFFER_GENERATED' || a.overallStatus === 'OFFER_ACCEPTED').length ?? 0;
    const rejected = job?.applications.filter(a => a.overallStatus === 'REJECTED').length ?? 0;

    // Flag candidates instead of filtering out
    const applicationsWithEligibility = job?.applications.map(a => {
        const gh = a.githubScore ?? 0;
        const li = a.linkedinScore ?? 0;
        const isEligible = gh >= minGithubScore && gh <= maxGithubScore && li >= minLinkedinScore && li <= maxLinkedinScore;
        return { ...a, isEligible };
    }) ?? [];



    return (
        <ProtectedRoute requiredRole="HR">
            <DashboardLayout navItems={NAV_ITEMS} title={job?.title ?? 'Job Detail'}>
                <div className="flex flex-col gap-6">
                    {error && <ErrorAlert message={error} onDismiss={() => setError('')} />}

                    {/* Back + Header */}
                    <div className="flex items-center gap-4">
                        <button
                            type="button"
                            onClick={() => router.push('/hr/jobs')}
                            aria-label="Back to job listings"
                            className="p-2 rounded-lg transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                            style={{ background: 'var(--bg-elevated)', color: 'var(--text-muted)', border: '1px solid var(--border-default)' }}
                        >
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                <polyline points="15 18 9 12 15 6" />
                            </svg>
                        </button>

                        {loading ? (
                            <div className="flex items-center gap-3">
                                <span className="skeleton inline-block w-48 h-7 rounded" />
                                <span className="skeleton inline-block w-24 h-5 rounded" />
                            </div>
                        ) : job ? (
                            <div className="flex items-start gap-4 flex-1 flex-wrap">
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{job.title}</h1>
                                    <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
                                        {job.department} · {job.location}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`badge ${job.status === 'OPEN' ? 'badge-success' : 'badge-neutral'}`}>
                                        {job.status}
                                    </span>
                                    <span className="badge badge-info text-xs">
                                        {job.applications.length} Applicant{job.applications.length !== 1 ? 's' : ''}
                                    </span>
                                </div>
                            </div>
                        ) : null}
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-20">
                            <LoadingSpinner size="lg" label="Loading job details…" />
                        </div>
                    ) : job ? (
                        <>
                            {/* Summary Stats — High Fidelity Version */}
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {[
                                    { label: 'Total Applicants', value: totalCandidates, color: '#6366f1', icon: '👥' },
                                    { label: 'In Progress', value: inProgress, color: '#a855f7', icon: '⏳' },
                                    { label: 'Qualified', value: passed, color: '#22c55e', icon: '🎯' },
                                    { label: 'Not Suited', value: rejected, color: '#ef4444', icon: '✗' },
                                ].map((stat, idx) => (
                                    <div key={idx} className="group relative glass-card p-6 overflow-hidden transition-all duration-300 hover:scale-[1.03] hover:shadow-2xl active:scale-[0.98]">
                                        <div className="absolute top-0 right-0 w-20 h-20 -mr-8 -mt-8 bg-current opacity-[0.03] rounded-full blur-2xl group-hover:opacity-[0.08] transition-opacity" style={{ color: stat.color }}></div>
                                        <div className="flex flex-col gap-1 relative z-10">
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-[10px] font-black uppercase tracking-[0.2em] opacity-50" style={{ color: 'var(--text-primary)' }}>{stat.label}</span>
                                                <span className="text-lg opacity-80">{stat.icon}</span>
                                            </div>
                                            <div className="text-3xl font-black tracking-tight flex items-baseline gap-1" style={{ color: 'var(--text-primary)' }}>
                                                {stat.value}
                                                <span className="text-[10px] font-bold opacity-30 uppercase">Candidates</span>
                                            </div>
                                            <div className="h-1 w-8 rounded-full mt-3" style={{ background: stat.color }}></div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* AI Filters Section */}
                            <section aria-labelledby="ai-filters-heading" className="glass-card p-5">
                                <h2 id="ai-filters-heading" className="text-sm font-bold mb-4 uppercase tracking-wider opacity-80" style={{ color: 'var(--text-primary)' }}>
                                    AI Candidate Data Filters
                                </h2>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>GitHub Score Range:</label>
                                        <div className="flex items-center gap-3">
                                            <input type="number" min="0" max="100" value={minGithubScore} onChange={(e) => setMinGithubScore(Number(e.target.value))} className="w-20 px-3 py-1.5 rounded-md border bg-transparent text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            <input type="number" min="0" max="100" value={maxGithubScore} onChange={(e) => setMaxGithubScore(Number(e.target.value))} className="w-20 px-3 py-1.5 rounded-md border bg-transparent text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                        </div>
                                    </div>
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold" style={{ color: 'var(--text-muted)' }}>LinkedIn Score Range:</label>
                                        <div className="flex items-center gap-3">
                                            <input type="number" min="0" max="100" value={minLinkedinScore} onChange={(e) => setMinLinkedinScore(Number(e.target.value))} className="w-20 px-3 py-1.5 rounded-md border bg-transparent text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                            <span style={{ color: 'var(--text-muted)' }}>—</span>
                                            <input type="number" min="0" max="100" value={maxLinkedinScore} onChange={(e) => setMaxLinkedinScore(Number(e.target.value))} className="w-20 px-3 py-1.5 rounded-md border bg-transparent text-sm" style={{ borderColor: 'var(--border-subtle)', color: 'var(--text-primary)' }} />
                                        </div>
                                    </div>
                                </div>
                            </section>

                            {/* Rounds */}
                            <section aria-labelledby="rounds-heading">
                                <h2 id="rounds-heading" className="text-base font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
                                    Hiring Rounds
                                </h2>
                                <div className="flex flex-col gap-4">
                                    {allRounds.map(rn => (
                                        <RoundPanel
                                            key={rn}
                                            roundNumber={rn}
                                            jobId={jobId}
                                            jobTitle={job.title}
                                            applications={applicationsWithEligibility}
                                            token={token ?? null}
                                            onRefresh={() => loadJob(false)}
                                        />
                                    ))}
                                </div>
                            </section>

                            <HrBgvPanel
                                jobId={jobId}
                                jobTitle={job.title}
                                applications={applicationsWithEligibility}
                                token={token ?? null}
                                onRefresh={() => loadJob(false)}
                            />
                        </>
                    ) : (
                        <p className="text-center py-12" style={{ color: 'var(--text-muted)' }}>Job not found.</p>
                    )}
                </div>
            </DashboardLayout>
        </ProtectedRoute>
    );
}
