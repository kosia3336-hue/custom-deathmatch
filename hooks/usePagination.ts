'use client';

import { useCallback, useMemo } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import {
  DEFAULT_PAGE_KEY,
  DEFAULT_PAGE_SIZE,
  buildPageHref,
  parsePageParam,
} from '@/lib/pagination';

interface UsePaginationOptions {
  /** 한 페이지 당 항목 수. 기본 20 */
  pageSize?: number;
  /** URL 쿼리 키. 기본 'page'. 한 화면에 페이지네이션이 여러 개일 때 다른 키 사용 */
  paramKey?: string;
  /** 페이지 변경 후 자동 스크롤 (기본 true) */
  scrollToTop?: boolean;
}

interface UsePaginationReturn {
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
}

/**
 * URL 쿼리(`?page=N`) 와 동기화되는 페이지네이션 훅.
 * 정의: docs/v2/19_pagination.md §19.5.2
 */
export function usePagination(opts: UsePaginationOptions = {}): UsePaginationReturn {
  const {
    pageSize = DEFAULT_PAGE_SIZE,
    paramKey = DEFAULT_PAGE_KEY,
    scrollToTop = true,
  } = opts;

  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const page = useMemo(
    () => parsePageParam(searchParams.get(paramKey) ?? undefined),
    [searchParams, paramKey],
  );

  const setPage = useCallback(
    (next: number) => {
      const href = buildPageHref(pathname, searchParams, next, paramKey);
      router.replace(href, { scroll: false });
      if (scrollToTop && typeof window !== 'undefined') {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    },
    [router, pathname, searchParams, paramKey, scrollToTop],
  );

  return { page, pageSize, setPage };
}
