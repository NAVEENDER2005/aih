import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PUBLIC_PATHS = ['/login', '/register', '/'];
const HR_PREFIX = '/hr';
const CANDIDATE_PREFIX = '/candidate';

export function middleware(request: NextRequest) {
    const { pathname } = request.nextUrl;

    // Allow public paths through
    if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '?'))) {
        return NextResponse.next();
    }

    // We cannot read in-memory token from middleware (Edge Runtime).
    // We check the presence of the localStorage-persisted token via a
    // cookie that the client sets on login (aihirer_authed=1).
    const authed = request.cookies.get('aihirer_authed')?.value === '1';
    const role = request.cookies.get('aihirer_role')?.value;

    if (!authed) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('from', pathname);
        return NextResponse.redirect(loginUrl);
    }

    // Role-based protection
    if (pathname.startsWith(HR_PREFIX) && role !== 'HR') {
        return NextResponse.redirect(new URL('/candidate/dashboard', request.url));
    }

    if (pathname.startsWith(CANDIDATE_PREFIX) && role !== 'CANDIDATE') {
        return NextResponse.redirect(new URL('/hr/dashboard', request.url));
    }

    return NextResponse.next();
}

export const config = {
    matcher: ['/hr/:path*', '/candidate/:path*'],
};
