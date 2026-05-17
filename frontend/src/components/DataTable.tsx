'use client';

import React, { useCallback, useId, useState } from 'react';
import LoadingSpinner from './LoadingSpinner';

/* ─── Types ─────────────────────────────────────────────── */
export type SortDirection = 'asc' | 'desc' | null;

export interface Column<T> {
    key: keyof T | string;
    header: string;
    sortable?: boolean;
    render?: (value: unknown, row: T) => React.ReactNode;
    className?: string;
}

interface DataTableProps<T extends { id?: string | number }> {
    caption: string;
    columns: Column<T>[];
    data: T[];
    isLoading?: boolean;
    emptyMessage?: string;
    keyExtractor?: (row: T, index: number) => string;
}

function getNestedValue<T>(obj: T, path: string): unknown {
    return (path as string)
        .split('.')
        .reduce((acc: unknown, key) => (acc as Record<string, unknown>)?.[key], obj);
}

export default function DataTable<T extends { id?: string | number }>({
    caption,
    columns,
    data,
    isLoading = false,
    emptyMessage = 'No data available.',
    keyExtractor,
}: DataTableProps<T>) {
    const tableId = useId();
    const [sortKey, setSortKey] = useState<string | null>(null);
    const [sortDirection, setSortDirection] = useState<SortDirection>(null);

    const handleSort = useCallback((key: string) => {
        setSortKey((prev) => {
            if (prev === key) {
                setSortDirection((d) => {
                    if (d === 'asc') return 'desc';
                    if (d === 'desc') return null;
                    return 'asc';
                });
                return key;
            }
            setSortDirection('asc');
            return key;
        });
    }, []);

    const sortedData = React.useMemo(() => {
        if (!sortKey || !sortDirection) return data;
        return [...data].sort((a, b) => {
            const av = getNestedValue(a, sortKey);
            const bv = getNestedValue(b, sortKey);
            if (av == null) return 1;
            if (bv == null) return -1;
            const cmp =
                typeof av === 'number' && typeof bv === 'number'
                    ? av - bv
                    : String(av).localeCompare(String(bv));
            return sortDirection === 'asc' ? cmp : -cmp;
        });
    }, [data, sortKey, sortDirection]);

    const sortIcon = (key: string) => {
        if (sortKey !== key) {
            return (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" opacity="0.4">
                    <polyline points="6 9 12 3 18 9" /><polyline points="6 15 12 21 18 15" />
                </svg>
            );
        }
        if (sortDirection === 'asc') {
            return (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 9 12 3 18 9" />
                </svg>
            );
        }
        if (sortDirection === 'desc') {
            return (
                <svg aria-hidden="true" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <polyline points="6 15 12 21 18 15" />
                </svg>
            );
        }
        return null;
    };

    return (
        <div className="w-full overflow-x-auto rounded-xl border" style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-card)' }}>
            <table
                id={tableId}
                className="w-full text-sm border-collapse"
                aria-label={caption}
            >
                <caption className="sr-only">{caption}</caption>
                <thead>
                    <tr style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                        {columns.map((col) => (
                            <th
                                key={String(col.key)}
                                scope="col"
                                className={[
                                    'px-4 py-3.5 text-left text-xs font-semibold tracking-wider uppercase',
                                    col.sortable ? 'table-sortable-header' : '',
                                    col.className ?? '',
                                ].join(' ')}
                                style={{ color: 'var(--text-secondary)' }}
                                aria-sort={
                                    col.sortable && sortKey === String(col.key)
                                        ? sortDirection === 'asc'
                                            ? 'ascending'
                                            : sortDirection === 'desc'
                                                ? 'descending'
                                                : 'none'
                                        : undefined
                                }
                                onClick={col.sortable ? () => handleSort(String(col.key)) : undefined}
                                onKeyDown={
                                    col.sortable
                                        ? (e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSort(String(col.key));
                                            }
                                        }
                                        : undefined
                                }
                                tabIndex={col.sortable ? 0 : undefined}
                                role={col.sortable ? 'columnheader' : undefined}
                            >
                                <span className="inline-flex items-center gap-1.5">
                                    {col.header}
                                    {col.sortable && sortIcon(String(col.key))}
                                </span>
                            </th>
                        ))}
                    </tr>
                </thead>

                <tbody>
                    {isLoading ? (
                        Array.from({ length: 4 }).map((_, i) => (
                            <tr key={i} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                                {columns.map((col) => (
                                    <td key={String(col.key)} className="px-4 py-3">
                                        <div className="skeleton h-4 rounded" style={{ width: '60%' }} />
                                    </td>
                                ))}
                            </tr>
                        ))
                    ) : sortedData.length === 0 ? (
                        <tr>
                            <td
                                colSpan={columns.length}
                                className="px-4 py-12 text-center"
                                style={{ color: 'var(--text-muted)' }}
                            >
                                <div className="flex flex-col items-center gap-3">
                                    <svg aria-hidden="true" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" opacity="0.4">
                                        <path d="M9 17H7A5 5 0 0 1 7 7h2" /><path d="M15 7h2a5 5 0 1 1 0 10h-2" /><line x1="8" y1="12" x2="16" y2="12" />
                                    </svg>
                                    <span className="text-sm">{emptyMessage}</span>
                                </div>
                            </td>
                        </tr>
                    ) : (
                        sortedData.map((row, index) => {
                            const rowKey = keyExtractor
                                ? keyExtractor(row, index)
                                : String(row.id ?? index);
                            return (
                                <tr
                                    key={rowKey}
                                    className="transition-colors"
                                    style={{ borderBottom: '1px solid var(--border-subtle)' }}
                                    onMouseEnter={(e) => (e.currentTarget.style.background = 'var(--bg-hover)')}
                                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                                >
                                    {columns.map((col) => {
                                        const rawVal = getNestedValue(row, String(col.key));
                                        return (
                                            <td
                                                key={String(col.key)}
                                                className={`px-4 py-3.5 ${col.className ?? ''}`}
                                                style={{ color: 'var(--text-primary)' }}
                                            >
                                                {col.render ? col.render(rawVal, row) : String(rawVal ?? '—')}
                                            </td>
                                        );
                                    })}
                                </tr>
                            );
                        })
                    )}
                </tbody>
            </table>

            {isLoading && (
                <div className="flex justify-center py-4">
                    <LoadingSpinner size="md" label="Loading table data…" />
                </div>
            )}
        </div>
    );
}
