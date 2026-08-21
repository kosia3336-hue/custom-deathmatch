/**
 * 페이지 콘텐츠 폭.
 *
 * 예전에는 페이지마다 max-w 가 제각각(3xl~6xl)이라, 탭을 옮길 때마다 본문 폭이
 * 출렁여 "페이지를 하나씩 만든 사이트"처럼 보였다. 두 가지로만 나눈다.
 *
 *   WIDE — 여러 열로 늘어놓는 화면(카드 그리드, 대문). 로비·상점·칭호·마이
 *   READ — 한 줄씩 읽어 내려가는 화면(목록, 문서). 랭킹·룰·공지·약관
 *
 * 새 페이지를 만들 때 둘 중 하나를 고르면 된다. 여기 없는 폭은 쓰지 않는다.
 */
export const CONTAINER_WIDE = 'mx-auto w-full max-w-6xl';
export const CONTAINER_READ = 'mx-auto w-full max-w-4xl';
