/**
 * 광고 설정 — 환경변수로만 켠다. 값이 없으면 광고 자리 자체를 그리지 않는다.
 *
 * NEXT_PUBLIC_* 는 빌드할 때 들어가므로, 값을 넣거나 바꾼 뒤에는 다시 배포해야 한다
 * (운영: /Users/example/apps/custom-deathmatch/shared/.env.production).
 *
 *   NEXT_PUBLIC_AD_PROVIDER     adsense | adfit
 *   ── 구글 애드센스 ──
 *   NEXT_PUBLIC_ADSENSE_CLIENT  ca-pub-XXXXXXXXXXXXXXXX
 *   NEXT_PUBLIC_AD_SLOT_LOBBY   광고 단위 ID (숫자)
 *   NEXT_PUBLIC_AD_SLOT_RESULT  광고 단위 ID (숫자)
 *   ── 카카오 애드핏 ──
 *   NEXT_PUBLIC_AD_SLOT_LOBBY   광고 단위 ID (DAN-...)
 *   NEXT_PUBLIC_AD_SLOT_RESULT  광고 단위 ID (DAN-...)
 *   NEXT_PUBLIC_AD_SIZE_LOBBY   광고 단위 크기, 예: 320x100 (기본 320x100)
 *   NEXT_PUBLIC_AD_SIZE_RESULT  광고 단위 크기, 예: 300x250 (기본 300x250)
 */
export type AdProvider = 'adsense' | 'adfit';
export type AdPlacement = 'lobby' | 'result';

export interface AdUnit {
  provider: AdProvider;
  /** 애드센스 게시자 ID (ca-pub-…). 애드핏은 없음 */
  client: string | null;
  slot: string;
  width: number;
  height: number;
}

/* process.env.X 를 그대로 적어야 빌드 때 값이 들어간다(동적 키로 읽으면 비어 있다) */
const ENV = {
  provider: process.env.NEXT_PUBLIC_AD_PROVIDER,
  client: process.env.NEXT_PUBLIC_ADSENSE_CLIENT,
  slots: {
    lobby: process.env.NEXT_PUBLIC_AD_SLOT_LOBBY,
    result: process.env.NEXT_PUBLIC_AD_SLOT_RESULT,
  } as Record<AdPlacement, string | undefined>,
  sizes: {
    lobby: process.env.NEXT_PUBLIC_AD_SIZE_LOBBY,
    result: process.env.NEXT_PUBLIC_AD_SIZE_RESULT,
  } as Record<AdPlacement, string | undefined>,
};

const DEFAULT_SIZE: Record<AdPlacement, [number, number]> = {
  lobby: [320, 100],
  result: [300, 250],
};

function parseSize(raw: string | undefined, fallback: [number, number]): [number, number] {
  const m = /^(\d{2,4})x(\d{2,4})$/.exec(raw?.trim() ?? '');
  return m ? [Number(m[1]), Number(m[2])] : fallback;
}

/** 애드센스 게시자 ID — 사이트 소유 확인 태그·ads.txt 에 쓴다 */
export function adsenseClient(): string | null {
  if (ENV.provider !== 'adsense') return null;
  const c = ENV.client?.trim();
  return c && /^ca-pub-\d{10,20}$/.test(c) ? c : null;
}

export function adUnit(placement: AdPlacement): AdUnit | null {
  const slot = ENV.slots[placement]?.trim();
  if (!slot) return null;
  const [width, height] = parseSize(ENV.sizes[placement], DEFAULT_SIZE[placement]);
  if (ENV.provider === 'adsense') {
    const client = adsenseClient();
    return client && /^\d{6,20}$/.test(slot) ? { provider: 'adsense', client, slot, width, height } : null;
  }
  if (ENV.provider === 'adfit') {
    return /^DAN-[A-Za-z0-9]+$/.test(slot) ? { provider: 'adfit', client: null, slot, width, height } : null;
  }
  return null;
}
