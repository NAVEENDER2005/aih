'use client';

import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

/* ─── Types ─────────────────────────────────────────────── */
export type UserRole = 'HR' | 'CANDIDATE';

export interface AuthUser {
    id: string;
    name: string;
    email: string;
    role: UserRole;
}

interface AuthContextValue {
    user: AuthUser | null;
    token: string | null;
    isLoading: boolean;
    isAuthenticated: boolean;
    login: (email: string, password: string) => Promise<void>;
    register: (
        name: string,
        email: string,
        password: string,
        role: UserRole,
        experienceLevel?: string,
        githubProfile?: string,
        linkedinProfile?: string,
        interestedRole?: string
    ) => Promise<void>;
    logout: () => void;
}

/* ─── Token helpers (memory + localStorage fallback) ────── */
const TOKEN_KEY = 'aihirer_token';
const USER_KEY = 'aihirer_user';

// In-memory store (primary)
let _memToken: string | null = null;

function persistToken(token: string, user: AuthUser) {
    _memToken = token;
    try {
        localStorage.setItem(TOKEN_KEY, token);
        localStorage.setItem(USER_KEY, JSON.stringify(user));
    } catch {
        // Private browsing — silently ignore
    }
}

function clearToken() {
    _memToken = null;
    try {
        localStorage.removeItem(TOKEN_KEY);
        localStorage.removeItem(USER_KEY);
    } catch {
        /* noop */
    }
}

function loadToken(): { token: string | null; user: AuthUser | null } {
    if (_memToken) {
        // mem takes priority; try to restore user from storage
        try {
            const raw = localStorage.getItem(USER_KEY);
            return { token: _memToken, user: raw ? JSON.parse(raw) : null };
        } catch {
            return { token: _memToken, user: null };
        }
    }
    try {
        const token = localStorage.getItem(TOKEN_KEY);
        const raw = localStorage.getItem(USER_KEY);
        return { token, user: raw ? JSON.parse(raw) : null };
    } catch {
        return { token: null, user: null };
    }
}

/* ─── Context ───────────────────────────────────────────── */
const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [token, setToken] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const logoutTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    /* ── Hydrate from storage on mount ────────────────────── */
    useEffect(() => {
        const { token: stored, user: storedUser } = loadToken();
        if (stored && storedUser) {
            _memToken = stored;
            setToken(stored);
            setUser(storedUser);
        }
        setIsLoading(false);
    }, []);

    /* ── Auto-logout helper ────────────────────────────────── */
    const logout = useCallback(() => {
        clearToken();
        setToken(null);
        setUser(null);
        if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
        // Router navigation is handled by consuming components
    }, []);

    /* ── Login ─────────────────────────────────────────────── */
    const login = useCallback(
        async (email: string, password: string) => {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/auth/login`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ email, password }),
                }
            );

            if (!res.ok) {
                const body = await res.text().catch(() => '');
                let msg = 'Invalid credentials. Please try again.';
                try { msg = JSON.parse(body)?.message ?? msg; } catch { /* noop */ }
                throw new Error(msg);
            }

            // Backend returns flat: { token, id, email, role }
            const data: { token: string; id: string; email: string; role: string; name?: string } = await res.json();

            const authUser: AuthUser = {
                id: data.id,
                name: data.name ?? data.email.split('@')[0],   // use name if sent, else derive from email
                email: data.email,
                role: data.role as UserRole,
            };

            persistToken(data.token, authUser);
            setToken(data.token);
            setUser(authUser);
        },
        []
    );

    /* ── Register ──────────────────────────────────────────── */
    const register = useCallback(
        async (
            name: string,
            email: string,
            password: string,
            role: UserRole,
            experienceLevel?: string,
            githubProfile?: string,
            linkedinProfile?: string,
            interestedRole?: string
        ) => {
            const res = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL}/api/auth/register`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        name,
                        email,
                        password,
                        role,
                        experienceLevel,
                        githubProfile,
                        linkedinProfile,
                        interestedRole
                    }),
                }
            );

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.message ?? 'Registration failed. Please try again.');
            }
        },
        []
    );

    const value: AuthContextValue = {
        user,
        token,
        isLoading,
        isAuthenticated: !!token && !!user,
        login,
        register,
        logout,
    };

    return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/* ─── Hook ──────────────────────────────────────────────── */
export function useAuth(): AuthContextValue {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
    return ctx;
}
