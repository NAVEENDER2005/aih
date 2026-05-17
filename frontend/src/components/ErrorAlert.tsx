'use client';

import React from 'react';

interface ErrorAlertProps {
    message: string;
    id?: string;
    onDismiss?: () => void;
}

export default function ErrorAlert({ message, id, onDismiss }: ErrorAlertProps) {
    if (!message) return null;

    return (
        <div
            id={id}
            role="alert"
            aria-live="polite"
            aria-atomic="true"
            className="flex items-start gap-3 rounded-lg border p-4 animate-fade-in"
            style={{
                background: 'rgba(249, 115, 22, 0.15)',
                borderColor: 'rgba(249, 115, 22, 0.5)',
                color: '#fb923c',
            }}
        >
            <svg
                aria-hidden="true"
                className="shrink-0 mt-0.5"
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="currentColor"
            >
                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>

            <span className="flex-1 text-sm font-medium" style={{ WebkitTextStroke: '0.3px #fb923c' }}>
                {message}
            </span>

            {onDismiss && (
                <button
                    type="button"
                    onClick={onDismiss}
                    aria-label="Dismiss error"
                    className="shrink-0 rounded p-0.5 transition-colors hover:bg-orange-500/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400"
                    style={{ color: '#fb923c' }}
                >
                    <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                    </svg>
                </button>
            )}
        </div>
    );
}
