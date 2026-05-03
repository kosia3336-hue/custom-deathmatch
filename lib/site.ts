/**
 * 사이트 URL 헬퍼.
 * NEXT_PUBLIC_SITE_URL 우선. 없으면 dev 기본값.
 */

export function getSiteUrl(): string {
  return process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3001';
}

export function getOAuthRedirectUrl(): string {
  return `${getSiteUrl().replace(/\/$/, '')}/auth/callback`;
}
