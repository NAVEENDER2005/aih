'use client';

import React, { forwardRef, useId } from 'react';

interface SelectOption {
    value: string;
    label: string;
}

interface AccessibleSelectProps
    extends React.SelectHTMLAttributes<HTMLSelectElement> {
    label: string;
    options: SelectOption[];
    error?: string;
    hint?: string;
    placeholder?: string;
}

const AccessibleSelect = forwardRef<HTMLSelectElement, AccessibleSelectProps>(
    (
        {
            label,
            options,
            error,
            hint,
            placeholder,
            className = '',
            id: propId,
            ...rest
        },
        ref
    ) => {
        const autoId = useId();
        const selectId = propId ?? autoId;
        const errorId = `${selectId}-error`;
        const hintId = `${selectId}-hint`;
        const hasError = Boolean(error);
        const hasHint = Boolean(hint);

        const describedBy = [hasHint ? hintId : '', hasError ? errorId : '']
            .filter(Boolean)
            .join(' ') || undefined;

        return (
            <div className="flex flex-col gap-1.5 w-full">
                <label
                    htmlFor={selectId}
                    className="text-sm font-semibold"
                    style={{ color: 'var(--text-primary)' }}
                >
                    {label}
                    {rest.required && (
                        <>
                            <span aria-hidden="true" className="ml-1" style={{ color: 'var(--accent-danger)' }}>*</span>
                            <span className="sr-only">(required)</span>
                        </>
                    )}
                </label>

                {hasHint && (
                    <p id={hintId} className="text-xs" style={{ color: 'var(--text-muted)' }}>
                        {hint}
                    </p>
                )}

                <div className="relative">
                    <select
                        ref={ref}
                        id={selectId}
                        aria-invalid={hasError}
                        aria-describedby={describedBy}
                        className={[
                            'w-full appearance-none rounded-lg border px-4 py-3 pr-10 text-sm transition-all duration-200',
                            'bg-[var(--bg-elevated)] text-[var(--text-primary)]',
                            hasError
                                ? 'border-[var(--accent-danger)]'
                                : 'border-[var(--border-default)] focus:border-[var(--accent-primary)]',
                            'focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] focus:ring-offset-2 focus:ring-offset-[var(--bg-base)]',
                            className,
                        ]
                            .filter(Boolean)
                            .join(' ')}
                        {...rest}
                    >
                        {placeholder && (
                            <option value="" disabled>
                                {placeholder}
                            </option>
                        )}
                        {options.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {/* Custom dropdown arrow */}
                    <span
                        aria-hidden="true"
                        className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2"
                        style={{ color: 'var(--text-muted)' }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <polyline points="6 9 12 15 18 9" />
                        </svg>
                    </span>
                </div>

                {hasError && (
                    <p
                        id={errorId}
                        role="alert"
                        aria-live="polite"
                        className="text-xs font-medium flex items-center gap-1"
                        style={{ color: 'var(--accent-danger)' }}
                    >
                        <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                        </svg>
                        {error}
                    </p>
                )}
            </div>
        );
    }
);

AccessibleSelect.displayName = 'AccessibleSelect';
export default AccessibleSelect;
