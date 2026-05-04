'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';
import { usePagination } from '@/hooks/usePagination';

interface PaginationProps {
  /** 1-based 현재 페이지 */
  currentPage: number;
  /** 총 페이지 수. 1 이하면 컴포넌트는 null 을 반환 */
  totalPages: number;
  /** 페이지 변경 핸들러 — URL 동기화는 호출부 책임 */
  onPageChange: (page: number) => void;
  /** 현재 페이지 양 옆에 표시할 페이지 수 (기본 1) */
  siblingCount?: number;
  /** 모바일 미니 모드 강제. 기본은 md 미만에서 자동 */
  forceMini?: boolean;
  className?: string;
}

type PageItem = number | 'dots-left' | 'dots-right';

/**
 * 표준 페이지네이션 — docs/v2/19_pagination.md §19.4
 *
 * - dumb 컴포넌트: 현재/총 페이지/onChange 만 받음
 * - 데스크톱: 숫자 페이지 / 모바일: `« N / M »` 미니 모드
 * - totalPages <= 1 이면 렌더 안 함
 */
export function Pagination({
  currentPage,
  totalPages,
  onPageChange,
  siblingCount = 1,
  forceMini = false,
  className,
}: PaginationProps) {
  const safePage = Math.min(
    Math.max(1, Math.floor(currentPage)),
    Math.max(1, totalPages),
  );
  const isFirst = safePage <= 1;
  const isLast = safePage >= totalPages;

  const items = React.useMemo(
    () => getPageItems(safePage, totalPages, siblingCount),
    [safePage, totalPages, siblingCount],
  );

  if (totalPages <= 1) return null;

  const go = (p: number) => {
    if (p < 1 || p > totalPages || p === safePage) return;
    onPageChange(p);
  };

  return (
    <nav
      role="navigation"
      aria-label="페이지네이션"
      className={cn('mt-4 flex w-full items-center justify-center', className)}
    >
      {/* 데스크톱 — 숫자 페이지 */}
      <div className={cn('items-center gap-1', forceMini ? 'hidden' : 'hidden md:flex')}>
        <ArrowButton
          direction="prev"
          disabled={isFirst}
          onClick={() => go(safePage - 1)}
        />
        {items.map((item, i) => {
          if (item === 'dots-left' || item === 'dots-right') {
            return (
              <span
                key={`${item}-${i}`}
                aria-hidden
                className="inline-flex h-9 min-w-9 items-center justify-center px-1 text-sm text-cdm-fg-subtle select-none"
              >
                …
              </span>
            );
          }
          const active = item === safePage;
          return (
            <button
              key={item}
              type="button"
              aria-current={active ? 'page' : undefined}
              aria-label={`페이지 ${item}`}
              onClick={() => go(item)}
              className={cn(
                'inline-flex h-9 min-w-9 items-center justify-center rounded-cdm-md px-3 text-sm tabular-nums',
                'transition-colors duration-(--cdm-duration-fast)',
                active
                  ? 'bg-cdm-primary text-white font-semibold'
                  : 'text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg',
              )}
            >
              {item}
            </button>
          );
        })}
        <ArrowButton
          direction="next"
          disabled={isLast}
          onClick={() => go(safePage + 1)}
        />
      </div>

      {/* 모바일 — 미니 모드 */}
      <div
        className={cn(
          'flex w-full items-center justify-between gap-3',
          forceMini ? 'flex' : 'md:hidden',
        )}
      >
        <ArrowButton
          direction="prev"
          disabled={isFirst}
          onClick={() => go(safePage - 1)}
        />
        <span
          aria-live="polite"
          className="text-sm font-medium text-cdm-fg tabular-nums"
        >
          {safePage} <span className="text-cdm-fg-subtle">/</span> {totalPages}
        </span>
        <ArrowButton
          direction="next"
          disabled={isLast}
          onClick={() => go(safePage + 1)}
        />
      </div>
    </nav>
  );
}

function ArrowButton({
  direction,
  disabled,
  onClick,
}: {
  direction: 'prev' | 'next';
  disabled: boolean;
  onClick: () => void;
}) {
  const isPrev = direction === 'prev';
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={isPrev ? '이전 페이지' : '다음 페이지'}
      className={cn(
        'inline-flex h-9 items-center gap-1 rounded-cdm-md px-3 text-sm',
        'transition-colors duration-(--cdm-duration-fast)',
        'text-cdm-fg-muted hover:bg-cdm-bg-elev-1 hover:text-cdm-fg',
        'disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:text-cdm-fg-muted',
      )}
    >
      {isPrev ? (
        <>
          <ChevronIcon direction="left" />
          <span className="hidden sm:inline">이전</span>
        </>
      ) : (
        <>
          <span className="hidden sm:inline">다음</span>
          <ChevronIcon direction="right" />
        </>
      )}
    </button>
  );
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg
      aria-hidden
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {direction === 'left' ? (
        <path d="M15 18l-6-6 6-6" />
      ) : (
        <path d="M9 18l6-6-6-6" />
      )}
    </svg>
  );
}

interface RoutePaginationProps {
  /** 총 페이지 수 */
  totalPages: number;
  /** URL 쿼리 키 (기본 'page'). 한 화면에 여러 페이지네이션이 있을 때 다른 키 사용 */
  paramKey?: string;
  /** 현재 페이지 양 옆에 표시할 페이지 수 (기본 1) */
  siblingCount?: number;
  /** 모바일 미니 모드 강제 */
  forceMini?: boolean;
  /** 페이지 변경 후 자동 스크롤 (기본 true) */
  scrollToTop?: boolean;
  className?: string;
}

/**
 * URL 쿼리(`?page=N`) 와 자동 동기화되는 라우터 연결 페이지네이션.
 * RSC 페이지에서 그대로 사용 가능 (내부에 'use client' 경계 포함).
 *
 * @example
 * <RoutePagination totalPages={getTotalPages(count)} />
 * <RoutePagination totalPages={...} paramKey="logsPage" />
 */
export function RoutePagination({
  totalPages,
  paramKey,
  siblingCount,
  forceMini,
  scrollToTop,
  className,
}: RoutePaginationProps) {
  const { page, setPage } = usePagination({ paramKey, scrollToTop });
  return (
    <Pagination
      currentPage={page}
      totalPages={totalPages}
      onPageChange={setPage}
      siblingCount={siblingCount}
      forceMini={forceMini}
      className={className}
    />
  );
}

/**
 * 표시할 페이지 슬롯 계산.
 * siblingCount=1 기준 최대 7개 슬롯: [1, …, c-1, c, c+1, …, total]
 */
function getPageItems(
  currentPage: number,
  totalPages: number,
  siblingCount: number,
): PageItem[] {
  const totalDisplayed = 5 + siblingCount * 2;

  if (totalPages <= totalDisplayed) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const leftSibling = Math.max(currentPage - siblingCount, 1);
  const rightSibling = Math.min(currentPage + siblingCount, totalPages);

  const showLeftDots = leftSibling > 2;
  const showRightDots = rightSibling < totalPages - 1;

  if (!showLeftDots && showRightDots) {
    const leftCount = 3 + 2 * siblingCount;
    return [
      ...Array.from({ length: leftCount }, (_, i) => i + 1),
      'dots-right',
      totalPages,
    ];
  }

  if (showLeftDots && !showRightDots) {
    const rightCount = 3 + 2 * siblingCount;
    return [
      1,
      'dots-left',
      ...Array.from(
        { length: rightCount },
        (_, i) => totalPages - rightCount + 1 + i,
      ),
    ];
  }

  return [
    1,
    'dots-left',
    ...Array.from(
      { length: rightSibling - leftSibling + 1 },
      (_, i) => leftSibling + i,
    ),
    'dots-right',
    totalPages,
  ];
}
