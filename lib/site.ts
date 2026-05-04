/**
 * 사이트 URL 헬퍼.
 * NEXT_PUBLIC_SITE_URL 우선. 없으면 dev 기본값.
 *
 * production 환경에서 미설정 시 빌드/런타임 경고 — OG/canonical 이 localhost 로 새는 것을 방지.
 */

const DEV_FALLBACK = 'http://localhost:3001';

let warned = false;

export function getSiteUrl(): string {
  const url = process.env.NEXT_PUBLIC_SITE_URL;
  if (url) return url;

  if (process.env.NODE_ENV === 'production' && !warned) {
    warned = true;
    // eslint-disable-next-line no-console
    console.warn(
      '[site] NEXT_PUBLIC_SITE_URL 가 설정되지 않았습니다. OG/canonical/sitemap 이 localhost 로 출력될 수 있습니다.',
    );
  }
  return DEV_FALLBACK;
}

export function getOAuthRedirectUrl(): string {
  return `${getSiteUrl().replace(/\/$/, '')}/auth/callback`;
}
