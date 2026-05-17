import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'AI Hirer – Intelligent Hiring Platform',
    template: '%s | AI Hirer',
  },
  description:
    'AI-powered hiring platform connecting top candidates with the right opportunities through intelligent screening, scoring, and explainable decisions.',
  keywords: ['AI hiring', 'recruitment', 'HR platform', 'candidate screening'],
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="antialiased min-h-screen" suppressHydrationWarning>
        {/* Skip-to-content link for keyboard / screen-reader users */}
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
