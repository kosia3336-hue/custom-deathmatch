'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { GAME_CATEGORIES, categoryHue } from '@/lib/gameRules';

export interface IntroRuleItem {
  id: string;
  name: string;
  category: string;
  /** 갈래별 색상 (0=빨강 … 250=보라) */
  hue: number;
  /** 서버에서 렌더된 룰 본문 + 출처 — 전부 DOM 에 담아 두고 표시만 전환한다(검색 노출 유지) */
  node: ReactNode;
}

interface Props {
  items: IntroRuleItem[];
}

/** 접었을 때 보여 줄 최대 높이(px). 이보다 짧은 룰은 접기 버튼 없이 통째로 보인다. */
const COLLAPSED_MAX = 520;

/**
 * 소개 페이지 룰 뷰어.
 * 위: 갈래 필터 → 종목 버튼 / 아래: 선택한 종목의 룰지.
 */
export default function IntroRulesPanel({ items }: Props) {
  const [genre, setGenre] = useState<string>('전체');
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [expanded, setExpanded] = useState(false);
  const [overflowing, setOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const genres = useMemo(() => {
    const present = new Set(items.map((it) => it.category));
    return GAME_CATEGORIES.filter((c) => present.has(c));
  }, [items]);

  const visible = useMemo(
    () => (genre === '전체' ? items : items.filter((it) => it.category === genre)),
    [items, genre],
  );

  useEffect(() => {
    if (visible.length === 0) return;
    if (!visible.some((it) => it.id === selectedId)) {
      setSelectedId(visible[0].id);
      setExpanded(false);
    }
  }, [visible, selectedId]);

  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setOverflowing(el.scrollHeight > COLLAPSED_MAX + 24);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [selectedId]);

  if (items.length === 0) return null;

  const selected = items.find((it) => it.id === selectedId) ?? visible[0];
  if (!selected) return null;

  const selectGame = (id: string) => {
    setSelectedId(id);
    setExpanded(false);
  };

  const collapsed = overflowing && !expanded;

  return (
    <div>
      <ul className="flex flex-wrap gap-2">
        {['전체', ...genres].map((g) => {
          const active = genre === g;
          const hue = g === '전체' ? null : categoryHue(g);
          return (
            <li key={g}>
              <button
                type="button"
                onClick={() => setGenre(g)}
                aria-pressed={active}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  active
                    ? 'bg-cdm-primary text-white shadow-[0_6px_16px_-8px_rgba(74,79,181,0.9)]'
                    : 'bg-white/10 text-cdm-ink-fg hover:bg-white/15',
                ].join(' ')}
              >
                {hue != null && (
                  <span
                    aria-hidden
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ backgroundColor: `hsl(${hue} 62% 55%)` }}
                  />
                )}
                {g}
              </button>
            </li>
          );
        })}
      </ul>

      <ul className="mt-4 flex flex-wrap gap-2">
        {visible.map((it) => {
          const active = it.id === selected.id;
          return (
            <li key={it.id}>
              <button
                type="button"
                onClick={() => selectGame(it.id)}
                aria-pressed={active}
                className={[
                  'flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-semibold transition',
                  active
                    ? 'bg-cdm-primary text-white shadow-[0_6px_16px_-8px_rgba(74,79,181,0.9)]'
                    : 'bg-white text-cdm-fg hover:bg-[#c9ccdd]',
                ].join(' ')}
              >
                <span
                  aria-hidden
                  className="h-2 w-2 shrink-0 rounded-full"
                  style={{ backgroundColor: `hsl(${it.hue} 62% 55%)` }}
                />
                {it.name}
              </button>
            </li>
          );
        })}
      </ul>

      <div
        className="relative mt-4 overflow-hidden rounded-cdm-md"
        style={{ maxHeight: collapsed ? COLLAPSED_MAX : undefined }}
      >
        <div ref={contentRef}>
          {items.map((it) => (
            <div key={it.id} hidden={it.id !== selected.id}>
              {it.node}
            </div>
          ))}
        </div>

        {collapsed && (
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 bottom-0 h-28"
            style={{
              background: 'linear-gradient(to bottom, transparent, var(--cdm-ink))',
            }}
          />
        )}
      </div>

      {overflowing && (
        <div className="mt-3 flex justify-center">
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            aria-expanded={expanded}
            className="flex items-center gap-1.5 rounded-lg border border-white/15 px-4 py-2 text-sm font-semibold text-cdm-ink-fg transition hover:border-white/35 hover:bg-white/5"
          >
            {expanded ? '접기' : '전체 룰 펼치기'}
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
              className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'}
            >
              <path d="m6 9 6 6 6-6" />
            </svg>
          </button>
        </div>
      )}
    </div>
  );
}
