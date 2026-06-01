import type { Metadata, Viewport } from 'next';
import { Geist_Mono } from 'next/font/google';
import './globals.css';
import SocketProvider from '@/components/providers/SocketProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import NicknameModal from '@/components/lobby/NicknameModal';
import SessionTakeoverModal from '@/components/providers/SessionTakeoverModal';
import TitleGrantedModal from '@/components/TitleGrantedModal';
import { NoticePublishedListener } from '@/components/notice/NoticePublishedListener';
import BgmProvider from '@/components/providers/BgmProvider';
import { getServerSupabase } from '@/lib/supabase/server';
import { getSiteUrl } from '@/lib/site';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

const SITE_URL = getSiteUrl();
const SITE_DESCRIPTION =
  '커스텀 데스매치 — 브라우저에서 바로 즐기는 1:1 보드·카드 게임 플랫폼. 카카오 로그인, 칭호, 게임 로그, 랭킹 지원.';

export const metadata: Metadata = {
  title: {
    default: '커스텀 데스매치',
    template: '%s | 커스텀 데스매치',
  },
  description: SITE_DESCRIPTION,
  applicationName: 'Custom Deathmatch',
  metadataBase: new URL(SITE_URL),
  keywords: [
    '커스텀 데스매치',
    'Custom Deathmatch',
    '온라인 보드게임',
    '카드게임',
    '1대1 게임',
    '흑과백',
    '인디안 포커',
    '베팅 가위바위보',
    '사칙연산 게임',
    '더 지니어스',
  ],
  authors: [{ name: '천하' }],
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
    },
  },
  openGraph: {
    title: '커스텀 데스매치 — Custom Deathmatch',
    description: '브라우저에서 바로 즐기는 1:1 보드·카드 게임 플랫폼.',
    url: SITE_URL,
    type: 'website',
    locale: 'ko_KR',
    siteName: 'Custom Deathmatch',
  },
  twitter: {
    card: 'summary_large_image',
    title: '커스텀 데스매치 — Custom Deathmatch',
    description: '브라우저에서 바로 즐기는 1:1 보드·카드 게임 플랫폼.',
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

interface BgmInitial {
  bgmMuted?: boolean;
  bgmVolume?: number;
}

async function getBgmInitial(): Promise<{ isLoggedIn: boolean; initial: BgmInitial }> {
  try {
    const supabase = await getServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { isLoggedIn: false, initial: {} };

    const { data } = await supabase
      .from('members_private')
      .select('settings')
      .eq('member_id', user.id)
      .maybeSingle();

    const settings = (data as { settings?: Record<string, unknown> } | null)?.settings ?? {};
    const initial: BgmInitial = {};
    if (typeof settings.bgmMuted === 'boolean') initial.bgmMuted = settings.bgmMuted;
    if (typeof settings.bgmVolume === 'number') initial.bgmVolume = settings.bgmVolume;
    return { isLoggedIn: true, initial };
  } catch {
    return { isLoggedIn: false, initial: {} };
  }
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const { isLoggedIn, initial } = await getBgmInitial();

  return (
    <html lang="ko" className={`${geistMono.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cdm-bg text-cdm-fg">
        <SocketProvider>
          <BgmProvider isLoggedIn={isLoggedIn} initial={initial}>
            {children}
            <NicknameModal />
            <SessionTakeoverModal />
            <TitleGrantedModal />
            <NoticePublishedListener />
            <ToastProvider />
          </BgmProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
