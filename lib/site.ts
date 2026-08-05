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

/**
 * JSON-LD 를 <script type="application/ld+json"> 안에 넣을 수 있게 직렬화한다.
 *
 * JSON.stringify 는 `<` `>` 를 그대로 두기 때문에, 값에 `</script>` 가 섞이면
 * (관리자가 쓰는 룰 본문·작성자명 등이 그대로 흘러 들어온다) 스크립트 태그를 빠져나가
 * 임의 마크업이 주입된다. HTML 파서가 태그로 볼 수 있는 문자를 유니코드 이스케이프한다.
 */
export function jsonLdScript(data: unknown): string {
  return JSON.stringify(data)
    .replace(/</g, '\\u003c')
    .replace(/>/g, '\\u003e')
    .replace(/\u2028/g, '\\u2028')
    .replace(/\u2029/g, '\\u2029');
}
