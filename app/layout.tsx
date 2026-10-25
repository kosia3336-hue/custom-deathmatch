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
import { GuildChatLive } from '@/components/guild-v4/GuildChatLive';
import BgmProvider from '@/components/providers/BgmProvider';
import SiteFooter from '@/components/layout/SiteFooter';
import OfflineOverlay from '@/components/providers/OfflineOverlay';
import { getAccountSettings } from '@/lib/auth/server';
import { getSiteUrl } from '@/lib/site';
import { adsenseClient } from '@/lib/ads';

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
    // url 은 두지 않는다. openGraph 를 따로 쓰지 않는 페이지(/rules 등)까지
    // 홈 주소를 og:url 로 물려받아 canonical 과 어긋났다. 페이지별로 정한다.
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
  // 애드센스 사이트 소유 확인 — 애드센스를 켰을 때만(lib/ads.ts)
  ...(adsenseClient() ? { other: { 'google-adsense-account': adsenseClient()! } } : {}),
};

export const viewport: Viewport = {
  themeColor: '#FFFFFF',
  width: 'device-width',
  initialScale: 1,
};

/*
  앱(Capacitor 웹뷰)인지 첫 화면을 그리기 전에 표시해 둔다.

  푸터처럼 앱에는 두지 않는 것을 CSS(html[data-native-app])로 처음부터 뺀다 —
  React 가 뜬 뒤에 감추면 한 번 보였다가 사라진다. 웹뷰가 주입하는
  window.Capacitor, 또는 앱 셸이 붙이는 사용자 에이전트 표식으로 판단한다
  (mobile/capacitor.config.json appendUserAgent).
*/
const NATIVE_APP_SCRIPT = `try{var c=window.Capacitor;if((c&&c.isNativePlatform&&c.isNativePlatform())||/CustomDeathmatchApp/.test(navigator.userAgent)){document.documentElement.setAttribute('data-native-app','')}}catch(e){}`;

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
  const adsense = adsenseClient();

  return (
    // data-native-app 을 인라인 스크립트가 붙이므로 html 속성 불일치 경고는 끈다
    <html
      lang="ko"
      suppressHydrationWarning
      className={`${geistMono.variable} ${songMyung.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: NATIVE_APP_SCRIPT }} />
        {/* 애드센스 사이트 확인·광고 코드. 자동 광고는 애드센스 화면에서 꺼 둔다 — 광고는 AdSlot 두 자리에만 */}
        {adsense && (
          <script
            async
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense}`}
            crossOrigin="anonymous"
          />
        )}
      </head>
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
            <GuildChatLive />
            <OfflineOverlay />
            <ToastProvider />
          </BgmProvider>
        </SocketProvider>
      </body>
    </html>
  );
}
