import type { Metadata } from 'next';
import { Inter, Playfair_Display } from 'next/font/google';
import { AppShell } from '@/components/layout/AppShell';
import { LenisProvider } from '@/components/layout/LenisProvider';
import { NotificationHost } from '@/components/ui/Notification';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const playfair = Playfair_Display({
  subsets: ['latin'],
  variable: '--font-playfair',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Dear Tennis — Join the Community',
  description:
    'A vibrant tennis community for players of all levels. Training, social events, tournaments, and a place to belong.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable}`}>
      <body className="min-h-screen flex flex-col">
        <LenisProvider>
          <AppShell>{children}</AppShell>
          <NotificationHost />
        </LenisProvider>
      </body>
    </html>
  );
}
