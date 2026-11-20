import type { Metadata } from 'next';
import { Providers } from '@/lib/hooks';
import './globals.css';

export const metadata: Metadata = {
  title: 'Okidoc — Clinic console & admin',
  description: 'Know your queue. Skip the wait.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="antialiased">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
