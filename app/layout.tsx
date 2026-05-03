import type { Metadata, Viewport } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';
import SocketProvider from '@/components/providers/SocketProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import NicknameModal from '@/components/lobby/NicknameModal';
import SessionTakeoverModal from '@/components/providers/SessionTakeoverModal';
import TitleGrantedModal from '@/components/TitleGrantedModal';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';

export const metadata: Metadata = {
  title: {
    default: '커스텀 데스매치',
    template: '%s | 커스텀 데스매치',
  },
  description:
    'Custom Deathmatch — 브라우저에서 바로 즐기는 1:1 보드/카드 게임 플랫폼. 카카오 로그인, 칭호, 게임 로그, 랭킹 지원.',
  applicationName: 'Custom Deathmatch',
  metadataBase: new URL(SITE_URL),
  openGraph: {
    title: 'Custom Deathmatch',
    description: '브라우저에서 바로 즐기는 1:1 보드/카드 게임 플랫폼.',
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Custom Deathmatch',
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cdm-bg text-cdm-fg">
        <SocketProvider>
          {children}
          <NicknameModal />
          <SessionTakeoverModal />
          <TitleGrantedModal />
          <ToastProvider />
        </SocketProvider>
      </body>
    </html>
  );
}
