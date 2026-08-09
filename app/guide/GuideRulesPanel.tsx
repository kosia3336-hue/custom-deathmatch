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
 * 소개 페이지 룰 뷰어 — 룰 이미지 캐러셀.
 * 위: 갈래 색 점으로 구분한 종목 버튼 / 아래: 이미지 크기에 딱 맞는 캔버스.
 * 좌우 화살표는 캔버스 안(이미지 위)에 겹쳐 둔다.
 *
 * items 는 룰 이미지(public/rules/<gameId>.webp)가 있는 종목만 서버에서 만들어 넘긴다.
 * 이미지를 새로 넣으면 코드 수정 없이 이 목록에 자동으로 추가된다.
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

      {/* 룰 캔버스 — 이미지 크기에 딱 맞는다(여백 없음).
          선택 안 된 항목은 hidden 이라 높이를 차지하지 않으므로,
          캔버스 높이 = 지금 보이는 이미지 높이가 된다. */}
      <div className="relative mt-4">
        {items.map((it) => (
          <div key={it.id} hidden={it.id !== selected.id}>
            {it.node}
          </div>
        ))}

        {/* 화살표 — 캔버스 안(이미지 위)에 겹쳐 놓는다 */}
        <button
          type="button"
          onClick={() => go(-1)}
          aria-label="이전 게임 룰"
          className="absolute top-1/2 left-2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/85 p-2 text-cdm-fg shadow-md transition hover:bg-white"
        >
          <Arrow dir="prev" />
        </button>
        <button
          type="button"
          onClick={() => go(1)}
          aria-label="다음 게임 룰"
          className="absolute top-1/2 right-2 z-10 flex -translate-y-1/2 items-center justify-center rounded-full bg-white/85 p-2 text-cdm-fg shadow-md transition hover:bg-white"
        >
          <Arrow dir="next" />
        </button>
      </div>
    </div>
  );
}
