import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import SocketProvider from '@/components/providers/SocketProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import NicknameModal from '@/components/lobby/NicknameModal';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: '더 지니어스',
  description: '브라우저에서 바로 즐기는 보드게임 플랫폼',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001'),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">
        <SocketProvider>
          {children}
          <NicknameModal />
          <ToastProvider />
        </SocketProvider>
      </body>
    </html>
  );
}
