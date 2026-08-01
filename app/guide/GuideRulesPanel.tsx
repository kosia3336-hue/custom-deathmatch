'use client';

import { useState, type ReactNode } from 'react';

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

function Arrow({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d={dir === 'prev' ? 'M15 18 9 12l6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  );
}

/**
 * 소개 페이지 룰 뷰어.
 * 위: 갈래 색 점으로 구분한 종목 버튼 / 아래: 고정 높이 캔버스(넘치면 스크롤) + 좌우 이동 화살표.
 *
 * items 는 서버에서 DB(game_rule_texts)를 읽어 만들기 때문에,
 * 관리자 페이지에서 룰을 추가·수정하면 별도 작업 없이 이 목록에 자동 반영된다.
 */
export default function GuideRulesPanel({ items }: Props) {
  const [selectedId, setSelectedId] = useState(items[0]?.id ?? '');

  if (items.length === 0) return null;

  const idx = Math.max(
    0,
    items.findIndex((it) => it.id === selectedId),
  );
  const selected = items[idx];

  const go = (delta: number) => {
    const next = (idx + delta + items.length) % items.length;
    setSelectedId(items[next].id);
  };

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
                onClick={() => setSelectedId(it.id)}
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

      {/* 룰 캔버스 — 버튼 아래. 제목 없이 본문만, 좌우 화살표로 이동 */}
      <div className="relative mt-4">
        <div className="h-[240px] overflow-y-auto overscroll-contain rounded-xl bg-cdm-page px-4 py-4 md:h-[280px] md:px-12">
          {items.map((it) => (
            <div key={it.id} hidden={it.id !== selected.id}>
              {it.node}
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="이전 게임 룰"
          className="absolute top-1/2 left-1.5 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/85 p-2 text-cdm-fg shadow-md transition hover:bg-white md:flex"
        >
          <Arrow dir="prev" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="다음 게임 룰"
          className="absolute top-1/2 right-1.5 hidden -translate-y-1/2 items-center justify-center rounded-full bg-white/85 p-2 text-cdm-fg shadow-md transition hover:bg-white md:flex"
        >
          <Arrow dir="next" />
        </button>
      </div>

      {/* 모바일 — 캔버스 폭이 좁아 화살표를 아래에 배치 */}
      <div className="mt-3 flex items-center justify-center gap-3 md:hidden">
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="이전 게임 룰"
          className="flex items-center justify-center rounded-full bg-white/10 p-2 text-cdm-ink-fg transition hover:bg-white/20"
        >
          <Arrow dir="prev" />
        </button>
        <span className="text-xs text-cdm-ink-fg-muted">
          {idx + 1} / {items.length}
        </span>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="다음 게임 룰"
          className="flex items-center justify-center rounded-full bg-white/10 p-2 text-cdm-ink-fg transition hover:bg-white/20"
        >
          <Arrow dir="next" />
        </button>
      </div>
    </div>
  );
}
