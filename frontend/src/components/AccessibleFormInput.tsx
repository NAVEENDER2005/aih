'use client';

import React, { forwardRef, useId } from 'react';

interface AccessibleFormInputProps
    extends React.InputHTMLAttributes<HTMLInputElement> {
    label: string;
    error?: string;
    hint?: string;
    icon?: React.ReactNode;
}

const AccessibleFormInput = forwardRef<
    HTMLInputElement,
    AccessibleFormInputProps
>(({ label, error, hint, icon, className = '', id: propId, ...rest }, ref) => {
    const autoId = useId();
    const inputId = propId ?? autoId;
    const errorId = `${inputId}-error`;
    const hintId = `${inputId}-hint`;
    const hasError = Boolean(error);
    const hasHint = Boolean(hint);

    const describedBy = [hasHint ? hintId : '', hasError ? errorId : '']
        .filter(Boolean)
        .join(' ') || undefined;

    return (
        <div className="flex flex-col gap-1.5 w-full">
            <label
                htmlFor={inputId}
                className="text-sm font-semibold"
                style={{ color: 'var(--text-primary)' }}
            >
                {label}
                {rest.required && (
                    <span
                        aria-hidden="true"
                        className="ml-1"
                        style={{ color: 'var(--accent-danger)' }}
                    >
                        *
                    </span>
                )}
                {rest.required && <span className="sr-only">(required)</span>}
            </label>

            {hasHint && (
                <p id={hintId} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {hint}
                </p>
            )}

            <div className="relative flex items-center">
                {icon && (
                    <span
                        aria-hidden="true"
                        className="absolute left-3 flex items-center pointer-events-none"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        {icon}
                    </span>
                )}

                <input
                    ref={ref}
                    id={inputId}
                    aria-invalid={hasError}
                    aria-describedby={describedBy}
                    className={[
                        'w-full rounded-lg border px-4 py-3 text-sm transition-all duration-200',
                        'bg-[var(--bg-elevated)] text-[var(--text-primary)]',
                        'placeholder:text-[var(--text-muted)]',
                        icon ? 'pl-10' : '',
                        hasError
                            ? 'border-[var(--accent-danger)] focus:ring-[var(--accent-danger)]'
                            : 'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                        'focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]',
                        className,
                    ]
                        .filter(Boolean)
                        .join(' ')}
                    {...rest}
                />
            </div>

            {hasError && (
                <p
                    id={errorId}
                    role="alert"
                    aria-live="polite"
                    className="text-xs font-medium flex items-center gap-1"
                    style={{ color: 'var(--accent-danger)' }}
                >
                    <svg
                        aria-hidden="true"
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="currentColor"
                    >
                        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                    </svg>
                    {error}
                </p>
            )}
        </div>
    );
});

AccessibleFormInput.displayName = 'AccessibleFormInput';
export default AccessibleFormInput;
