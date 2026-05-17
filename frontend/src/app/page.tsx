import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'AI Hirer – Intelligent Hiring Platform',
  description:
    'AI-powered hiring platform for smarter recruitment. Multi-round screening, explainable AI decisions, and seamless HR workflows.',
};

export default function HomePage() {
  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Ambient gradient background */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] opacity-20 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(ellipse, #6366f1 0%, #8b5cf6 40%, transparent 70%)' }}
        />
        <div
          className="absolute bottom-20 right-0 w-96 h-96 opacity-10 blur-3xl rounded-full"
          style={{ background: 'radial-gradient(circle, #ec4899, transparent)' }}
        />
      </div>

      {/* Nav */}
      <header role="banner" className="relative z-10 flex items-center justify-between px-6 py-5 max-w-7xl mx-auto w-full">
        <div className="flex items-center gap-3">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg, #6366f1, #8b5cf6)' }}
            aria-hidden="true"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
              <circle cx="12" cy="8" r="4" /><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" /><path d="M18 8l2 2 4-4" />
            </svg>
          </div>
          <span className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>AI Hirer</span>
        </div>
        <nav aria-label="Primary navigation">
          <ul className="flex items-center gap-3" role="list">
            <li>
              <Link
                href="/login"
                className="px-4 py-2 rounded-lg text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                style={{ color: 'var(--text-secondary)', border: '1px solid var(--border-subtle)' }}
              >
                Sign in
              </Link>
            </li>
            <li>
              <Link
                href="/register"
                className="px-4 py-2 rounded-lg text-sm font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-[var(--bg-base)]"
                style={{
                  background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                  color: '#fff',
                  boxShadow: 'var(--shadow-glow)',
                }}
              >
                Get started
              </Link>
            </li>
          </ul>
        </nav>
      </header>

      {/* Hero */}
      <main id="main-content" role="main" className="relative z-10 flex-1 flex flex-col items-center justify-center text-center px-6 py-24">
        <div className="animate-fade-in max-w-4xl mx-auto">
          <p
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold mb-8 badge badge-primary"
          >
            <span aria-hidden="true">✦</span>
            AI-Powered Hiring Platform
          </p>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-black tracking-tight mb-6 leading-tight">
            <span className="gradient-text">Smarter hiring,</span>
            <br />
            <span style={{ color: 'var(--text-primary)' }}>powered by AI.</span>
          </h1>

          <p className="text-lg sm:text-xl max-w-2xl mx-auto mb-10" style={{ color: 'var(--text-secondary)' }}>
            Multi-round intelligent screening with explainable decisions.
            Connect top talent with the right opportunities — transparently and fairly.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              href="/register"
              className="px-8 py-4 rounded-xl text-base font-bold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-[var(--bg-base)]"
              style={{
                background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
                color: '#fff',
                boxShadow: '0 0 40px rgb(99 102 241 / 0.4)',
              }}
            >
              Start hiring smarter →
            </Link>
            <Link
              href="/login"
              className="px-8 py-4 rounded-xl text-base font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              style={{
                color: 'var(--text-primary)',
                border: '1px solid var(--border-default)',
              }}
            >
              Sign in to dashboard
            </Link>
          </div>
        </div>

        {/* Feature grid */}
        <div className="mt-24 grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto w-full">
          {[
            {
              icon: '🤖',
              title: '5-Round AI Screening',
              desc: 'Aptitude → Technical → Coding → HR → Final. Each round scored by AI.',
            },
            {
              icon: '📊',
              title: 'Explainable Decisions',
              desc: 'Every recommendation comes with clear reasoning — no black-box AI.',
            },
            {
              icon: '♿',
              title: 'WCAG 2.1 AA Accessible',
              desc: 'Fully keyboard navigable, screen reader friendly, and high contrast by default.',
            },
          ].map((f) => (
            <div
              key={f.title}
              className="glass-card p-6 text-left animate-fade-in"
            >
              <p className="text-3xl mb-3" aria-hidden="true">{f.icon}</p>
              <h2 className="text-base font-bold mb-2" style={{ color: 'var(--text-primary)' }}>
                {f.title}
              </h2>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{f.desc}</p>
            </div>
          ))}
        </div>
      </main>

      {/* Footer */}
      <footer
        role="contentinfo"
        className="relative z-10 text-center py-6 text-xs border-t"
        style={{ color: 'var(--text-muted)', borderColor: 'var(--border-subtle)' }}
      >
        <p>© {new Date().getFullYear()} AI Hirer Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
