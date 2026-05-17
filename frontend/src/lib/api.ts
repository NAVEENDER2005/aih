/**
 * Authenticated Fetch Utility
 *
 * Wraps the native Fetch API:
 * - Attaches Authorization: Bearer <token> header automatically
 * - Throws a typed ApiError on non-2xx responses
 * - Handles 401 globally (token expired → triggers logout)
 */

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080';

/* ─── Error type ────────────────────────────────────────── */
export class ApiError extends Error {
    constructor(
        public readonly status: number,
        message: string,
        public readonly body?: unknown
    ) {
        super(message);
        this.name = 'ApiError';
    }
}

/* ─── Token accessor (import from AuthContext at runtime) ── */
let _onUnauthorized: (() => void) | null = null;

/** Call this once in a client component to register the logout handler. */
export function registerUnauthorizedHandler(fn: () => void) {
    _onUnauthorized = fn;
}

/* ─── Core fetch wrapper ────────────────────────────────── */
export async function apiFetch<T = unknown>(
    path: string,
    options: RequestInit & { token?: string | null } = {}
): Promise<T> {
    const { token, headers: extraHeaders, ...rest } = options;

    const headers: Record<string, string> = {
        ...(rest.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...(extraHeaders as Record<string, string>),
    };

    if (token) {
        headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${BASE_URL}${path}`, { ...rest, headers });

    if (res.status === 401) {
        _onUnauthorized?.();
        throw new ApiError(401, 'Session expired. Please log in again.');
    }

    if (!res.ok) {
        let body: unknown;
        try { body = await res.json(); } catch { body = null; }
        const message =
            (body as { message?: string })?.message ??
            `Request failed with status ${res.status}`;
        throw new ApiError(res.status, message, body);
    }

    // Handle 204 No Content
    if (res.status === 204) return undefined as T;

    return res.json() as Promise<T>;
}

/* ─── Convenience wrappers ──────────────────────────────── */
export const api = {
    get: <T = unknown>(path: string, token?: string | null) =>
        apiFetch<T>(path, { method: 'GET', token, cache: 'no-store' }),

    post: <T = unknown>(path: string, body: unknown, token?: string | null) =>
        apiFetch<T>(path, { method: 'POST', body: JSON.stringify(body), token }),

    put: <T = unknown>(path: string, body: unknown, token?: string | null) =>
        apiFetch<T>(path, { method: 'PUT', body: JSON.stringify(body), token }),

    patch: <T = unknown>(path: string, body: unknown, token?: string | null) =>
        apiFetch<T>(path, { method: 'PATCH', body: JSON.stringify(body), token }),

    delete: <T = unknown>(path: string, token?: string | null) =>
        apiFetch<T>(path, { method: 'DELETE', token }),

    upload: <T = unknown>(path: string, formData: FormData, token?: string | null) => {
        // We must NOT set Content-Type for FormData, 
        // fetch will set it with the correct boundary.
        const headers: Record<string, string> = token ? { 'Authorization': `Bearer ${token}` } : {};
        return apiFetch<T>(path, {
            method: 'POST',
            body: formData,
            headers,
        } as any);
    },
};
