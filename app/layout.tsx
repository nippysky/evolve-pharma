/**
 * ENVOLVE PHARMACEUTICALS — Root Layout
 *
 * Sets up:
 *   • next/font: Geist Sans (body + display) + Geist Mono (codes/SKUs)
 *   • Global stylesheet (design tokens + reset)
 *   • Toast provider (custom, no third-party)
 *   • App-wide metadata
 *   • Production favicon / app-icon metadata
 */

import type { Metadata, Viewport } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import { ToastProvider } from '@/contexts/ToastContext';
import { QueryProvider } from '@/providers/QueryProvider';
import { SITE } from '@/lib/constants';
import './globals.css';

// ---------- Fonts --------------------------------------------------------

const geistSans = Geist({
  subsets: ['latin'],
  variable: '--font-geist-sans',
  display: 'swap',
  // preload: false prevents the "preloaded but not used" browser warning that
  // fires on heavily client-rendered pages (like the console) where fonts
  // aren't consumed within the browser's 3-second preload window.
  preload: false,
});

const geistMono = Geist_Mono({
  subsets: ['latin'],
  variable: '--font-geist-mono',
  display: 'swap',
  preload: false,
});

// ---------- Metadata -----------------------------------------------------

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),

  title: {
    default: `${SITE.name} — ${SITE.tagline}`,
    template: `%s · ${SITE.shortName}`,
  },

  description: SITE.description,
  applicationName: SITE.name,

  keywords: [
    'pharmaceutical wholesaler Nigeria',
    'B2B pharmacy supply',
    'NAFDAC verified medicines',
    'Envolve Pharmaceuticals',
    'pharmacy procurement',
  ],

  authors: [{ name: SITE.name }],
  creator: SITE.name,
  publisher: SITE.name,

  openGraph: {
    type: 'website',
    locale: 'en_NG',
    url: SITE.url,
    siteName: SITE.name,
    title: `${SITE.name} — ${SITE.tagline}`,
    description: SITE.description,
  },

  twitter: {
    card: 'summary_large_image',
    title: SITE.name,
    description: SITE.tagline,
  },

  icons: {
    icon: [
      {
        url: '/favicon.ico',
        sizes: 'any',
      },
      {
        url: '/favicon-32x32.png',
        type: 'image/png',
        sizes: '32x32',
      },
      {
        url: '/favicon-16x16.png',
        type: 'image/png',
        sizes: '16x16',
      },
    ],
    apple: [
      {
        url: '/apple-touch-icon.png',
        type: 'image/png',
        sizes: '180x180',
      },
    ],
  },

  manifest: '/site.webmanifest',

  appleWebApp: {
    capable: true,
    title: SITE.shortName,
    statusBarStyle: 'default',
  },

  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0b1417' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
};

// ---------- Layout -------------------------------------------------------

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      className={`${geistSans.variable} ${geistMono.variable}`}
    >
      <body>
        <QueryProvider>
          <ToastProvider>{children}</ToastProvider>
        </QueryProvider>
      </body>
    </html>
  );
}