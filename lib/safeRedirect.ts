/**
 * 로그인 뒤 돌아갈 경로(next / state) 정리.
 *
 * startsWith('/') 만 보면 '//evil.com' 이나 '/\evil.com' 이 통과하고,
 * new URL(path, siteUrl) 이 이걸 다른 호스트로 해석해 외부로 보내 버린다.
 * 사이트 안의 절대 경로만 남기고 나머지는 fallback 으로 돌린다.
 */
export function safeNextPath(raw: string | null | undefined, fallback = '/'): string {
  if (!raw || !raw.startsWith('/')) return fallback;
  if (raw.startsWith('//') || raw.includes('\\')) return fallback;
  // 탭·개행 같은 제어 문자는 브라우저가 지우고 해석해서 '//' 로 바뀔 수 있다
  if (/[\u0000-\u001f\u007f]/.test(raw)) return fallback;
  return raw;
}
