/** 길드 상점 로고 탭. 파일은 `public/guild/logos/{id}.png` */

export type DevGuildLogo = { id: string; name: string };

export const DEV_GUILD_LOGOS: DevGuildLogo[] = [
  { id: 'crown', name: '왕관' },
  { id: 'shield', name: '방패' },
  { id: 'sword', name: '검' },
  { id: 'dual-swords', name: '쌍검' },
  { id: 'axe', name: '도끼' },
  { id: 'spear', name: '창' },
  { id: 'bow', name: '활' },
  { id: 'star', name: '별' },
  { id: 'moon', name: '달' },
  { id: 'sun', name: '해' },
  { id: 'lightning', name: '번개' },
  { id: 'flame', name: '불꽃' },
  { id: 'wave', name: '파도' },
  { id: 'rose', name: '장미' },
  { id: 'skull', name: '해골' },
  { id: 'dragon', name: '용' },
  { id: 'wolf', name: '늑대' },
  { id: 'tiger', name: '호랑이' },
  { id: 'eagle', name: '독수리' },
  { id: 'lion', name: '사자' },
  { id: 'bear', name: '곰' },
  { id: 'stag', name: '사슴' },
  { id: 'fox', name: '여우' },
  { id: 'owl', name: '부엉이' },
  { id: 'snake', name: '뱀' },
  { id: 'rabbit', name: '토끼' },
  { id: 'phoenix', name: '불사조' },
  { id: 'griffin', name: '그리핀' },
  { id: 'raven', name: '까마귀' },
  { id: 'panther', name: '흑표' },
  { id: 'hydra', name: '히드라' },
  { id: 'falcon', name: '매' },
  { id: 'scorpion', name: '전갈' },
  { id: 'ram', name: '산양' },
  { id: 'horse', name: '말' },
  { id: 'boar', name: '멧돼지' },
  { id: 'kraken', name: '크라켄' },
  { id: 'hammer', name: '망치' },
  { id: 'trident', name: '삼지창' },
  { id: 'helm', name: '투구' },
  { id: 'castle', name: '성' },
  { id: 'gem', name: '보석' },
  { id: 'eye', name: '눈' },
  { id: 'mask', name: '가면' },
  { id: 'comet', name: '혜성' },
  { id: 'crystal', name: '수정' },
  { id: 'ship', name: '배' },
  { id: 'dagger', name: '단검' },
];

/** 화면 표시용 로고 주소. 320px WebP (원본 PNG 는 1024px·약 2MB 였다). */
export function devGuildLogoSrc(id: string): string {
  return `/guild/logos/${id}.webp`;
}

/**
 * 저장된 마크 주소(DB 는 `/guild/logos/{id}.png`)를 화면에 그릴 주소로 바꾼다.
 * 카탈로그 로고면 WebP 로, 그 밖의 주소(스토리지 업로드 등)는 그대로.
 */
export function guildMarkDisplaySrc(url: string): string {
  const id = catalogLogoIdFromUrl(url);
  if (id && /^\/guild\/logos\//.test(url)) return devGuildLogoSrc(id);
  return url;
}

/** 상점 카탈로그 URL만. 예전 버킷 업로드는 인정하지 않는다. */
export function catalogLogoIdFromUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  const m = url.match(/\/(?:dev\/)?guild\/logos\/([a-z0-9-]+)\.png/i);
  return m?.[1] ?? null;
}
