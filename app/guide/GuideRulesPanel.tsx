'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';

export interface GuideRuleItem {
  id: string;
  name: string;
  category: string;
  /** 갈래별 색상 (0=빨강 … 250=보라) */
  hue: number;
  /** 서버에서 렌더된 룰 본문 + 출처 — 전부 DOM 에 담아 두고 표시만 전환한다(검색 노출 유지) */
  node: ReactNode;
}

interface Props {
  items: GuideRuleItem[];
}

/** 접었을 때 보여 줄 최대 높이(px). 이보다 짧은 룰은 접기 버튼 없이 통째로 보인다. */
const COLLAPSED_MAX = 520;

/**
 * 소개 페이지 룰 뷰어.
 * 위: 갈래 색 점으로 구분한 종목 버튼 / 아래: 선택한 종목의 룰지.
 *
 * 예전에는 높이를 고정하고 안쪽에서 스크롤시켰는데, 룰을 읽으려면 페이지 스크롤과
 * 캔버스 스크롤이 겹쳐 오히려 답답했다. 지금은 긴 룰만 접어 두고 펼치면 전체가
 * 페이지 흐름에 그대로 펴진다 — 안쪽 스크롤이 없어 한눈에 읽힌다.
 */
export default function GuideRulesPanel({ items }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');
  const [expanded, setExpanded] = useState(false);
  /** 접기 버튼이 필요한지 — 지금 보이는 룰이 COLLAPSED_MAX 를 넘을 때만 */
  const [overflowing, setOverflowing] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  /*
    선택된 항목만 보이므로 래퍼의 높이 = 지금 보이는 룰의 높이.
    ResizeObserver 는 관측을 시작할 때 한 번 즉시 불리므로 초기 측정도 여기서 끝난다
    (effect 본문에서 직접 setState 하지 않아도 된다).
  */
  useEffect(() => {
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setOverflowing(el.scrollHeight > COLLAPSED_MAX + 24);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  if (items.length === 0) return null;

  const idx = Math.max(
    0,
    items.findIndex((it) => it.id === selectedId),
  );
  const selected = items[idx];

  // 종목을 바꾸면 다시 접힌 상태로 — 이전 종목에서 펼친 게 그대로 이어지면 들쭉날쭉하다
  const selectGame = (id: string) => {
    setSelectedId(id);
    setExpanded(false);
  };

  const collapsed = overflowing && !expanded;

  return (
    <div>
      {/* 종목 버튼 — 갈래 색 점으로 구분 */}
      <ul className="flex flex-wrap gap-2">
        {items.map((it) => {
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
                {/* 갈래 색 점 — 심리=빨강, 언어=초록 … */}
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

      {/* 룰지 — 접혀 있으면 아래를 그라데이션으로 흐려 '더 있음'을 알린다 */}
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
              strokeWidth="2.2"
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
