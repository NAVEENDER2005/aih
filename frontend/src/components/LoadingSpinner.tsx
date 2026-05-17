'use client';

import React from 'react';

interface LoadingSpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    label?: string;
    className?: string;
}

const sizes = {
    sm: 16,
    md: 24,
    lg: 40,
};

export default function LoadingSpinner({
    size = 'md',
    label = 'Loading…',
    className = '',
}: LoadingSpinnerProps) {
    const px = sizes[size];

    return (
        <span
            role="status"
            aria-label={label}
            aria-busy="true"
            className={`inline-flex items-center justify-center ${className}`}
        >
            <svg
                aria-hidden="true"
                className="animate-spin"
                width={px}
                height={px}
                viewBox="0 0 24 24"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
            >
                <circle
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeOpacity="0.25"
                />
                <path
                    d="M12 2a10 10 0 0 1 10 10"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                />
            </svg>
            <span className="sr-only">{label}</span>
        </span>
    );
}
