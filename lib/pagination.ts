/**
 * 페이지네이션 표준 헬퍼 (서버·공용).
 * 정의: docs/v2/19_pagination.md §19.5
 */

export const DEFAULT_PAGE_SIZE = 20;

/** 한 화면에 페이지네이션이 여러 개일 때 prefix 키. 단일은 'page' */
export const DEFAULT_PAGE_KEY = 'page';

type RawParams = URLSearchParams | Record<string, string | string[] | undefined>;

/**
 * `?page=N` 파싱.
 * - 비어있거나 NaN/0/음수/소수 → 1
 * - totalPages 가 주어지면 상한 클램프
 */
export function parsePageParam(raw: string | undefined, totalPages?: number): number {
  if (raw == null || raw === '') return 1;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return 1;
  const page = Math.floor(n);
  if (typeof totalPages === 'number' && totalPages >= 1) {
    return Math.min(page, totalPages);
  }
  return page;
}

/** Supabase `.range(from, to)` 인자 계산 (둘 다 inclusive). */
export function getRange(
  page: number,
  pageSize: number = DEFAULT_PAGE_SIZE,
): { from: number; to: number } {
  const safePage = page < 1 ? 1 : Math.floor(page);
  const safeSize = pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.floor(pageSize);
  const from = (safePage - 1) * safeSize;
  const to = from + safeSize - 1;
  return { from, to };
}

/** 총 건수 → 총 페이지 수 (최소 1). */
export function getTotalPages(
  totalCount: number | null | undefined,
  pageSize: number = DEFAULT_PAGE_SIZE,
): number {
  const count = typeof totalCount === 'number' && totalCount > 0 ? totalCount : 0;
  const safeSize = pageSize < 1 ? DEFAULT_PAGE_SIZE : Math.floor(pageSize);
  return Math.max(1, Math.ceil(count / safeSize));
}

/**
 * 현재 쿼리스트링을 유지한 채 page 파라미터만 교체한 href 생성.
 * - page === 1 인 경우 해당 키를 제거 (canonical URL)
 * - basePath 는 절대/상대 경로 (예: '/admin', '/admin/members/abc')
 */
export function buildPageHref(
  basePath: string,
  currentParams: RawParams,
  page: number,
  pageKey: string = DEFAULT_PAGE_KEY,
): string {
  const next = toURLSearchParams(currentParams);
  if (page <= 1) {
    next.delete(pageKey);
  } else {
    next.set(pageKey, String(Math.floor(page)));
  }
  const qs = next.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

function toURLSearchParams(input: RawParams): URLSearchParams {
  if (input instanceof URLSearchParams) {
    return new URLSearchParams(input);
  }
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      for (const v of value) {
        if (v != null) params.append(key, v);
      }
    } else {
      params.append(key, value);
    }
  }
  return params;
}
