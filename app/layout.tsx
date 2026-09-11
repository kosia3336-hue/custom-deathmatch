import type { Metadata, Viewport } from 'next';
import { Geist_Mono, Song_Myung } from 'next/font/google';
import './globals.css';
import SocketProvider from '@/components/providers/SocketProvider';
import ToastProvider from '@/components/providers/ToastProvider';
import NicknameModal from '@/components/lobby/NicknameModal';
import SessionTakeoverModal from '@/components/providers/SessionTakeoverModal';
import TitleGrantedModal from '@/components/TitleGrantedModal';
import { GuildRankPayoutModal } from '@/components/guild-v4/GuildRankPayoutModal';
import { NoticePublishedListener } from '@/components/notice/NoticePublishedListener';
import { GuildScoutMailListener } from '@/components/guild-v4/GuildScoutMailListener';
import BgmProvider from '@/components/providers/BgmProvider';
import SiteFooter from '@/components/layout/SiteFooter';
import { getAccountSettings } from '@/lib/auth/server';
import { getSiteUrl } from '@/lib/site';

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
  display: 'swap',
});

/**
 * 룰지 제목·갈래 태그용 명조 (SIL OFL — 웹 임베딩 허용).
 * 원본 룰지의 '빛의계승자체' 는 라이선스상 게임 임베딩·재배포가 막혀 있어
 * 결이 비슷한 이 서체로 대체한다. 본문은 그대로 Pretendard 를 쓴다.
 * (next/font 가 서브셋을 알아서 처리한다 — subsets 옵션을 받지 않는 서체다.)
 */
const songMyung = Song_Myung({
  variable: '--font-display',
  weight: '400',
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
  verification: {
    google: 'UxESEsMWsheNCtlgaP13lSYt5-52sNc8w4CXFjFPrzw',
    other: {
      'naver-site-verification': '63e940384c0b56ae3779d9de83e5d817ba01b5fa',
    },
  },
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
};

interface BgmInitial {
  bgmMuted?: boolean;
  bgmVolume?: number;
}

async function getBgmInitial(): Promise<{ isLoggedIn: boolean; initial: BgmInitial }> {
  try {
    // 페이지 쪽 getAuthState 와 같은 요청 캐시를 쓰므로 왕복이 추가되지 않는다.
    const { isLoggedIn, settings } = await getAccountSettings();
    if (!isLoggedIn) return { isLoggedIn: false, initial: {} };

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
    <html lang="ko" className={`${geistMono.variable} ${songMyung.variable} h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-cdm-bg text-cdm-fg">
        <SocketProvider>
          <BgmProvider isLoggedIn={isLoggedIn} initial={initial}>
            {children}
            <SiteFooter />
            <NicknameModal />
            <SessionTakeoverModal />
            <TitleGrantedModal />
            <GuildRankPayoutModal />
            <NoticePublishedListener />
            <GuildScoutMailListener />
            <ToastProvider />
          </BgmProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
