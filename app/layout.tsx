import type { Metadata, Viewport } from 'next';
import './globals.css';
import { OfflineBanner } from '@/components/OfflineBanner';

export const metadata: Metadata = {
  title: 'Calo Utility Dashboard',
  description: 'Maintenance & Stewarding — UAE Central Warehouse',
};

// No maximum-scale: locking pinch-zoom blocks low-vision users from enlarging
// the page, which fails WCAG 1.4.4.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Lato:wght@400;700;900&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-dvh bg-slate-50 font-sans text-slate-900 antialiased">
        <OfflineBanner />
        {children}
      </body>
    </html>
  );
}
