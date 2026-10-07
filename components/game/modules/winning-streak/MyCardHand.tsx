'use client';
import type { WSCardCount, WSCardType } from '@/shared/types/winning-streak';
import { CARD_COLORS, CARD_NAMES } from './constants';
import { getCardEntries } from './getCardEntries';

export function MyCardHand({
  cards,
  lastPlayed,
  available,
  onCardClick,
  canAct,
  submitted,
}: {
  cards: WSCardCount;
  lastPlayed: WSCardType | null;
  available: WSCardType[];
  onCardClick: (type: WSCardType, index: number, isLocked: boolean) => void;
  canAct: boolean;
  submitted: boolean;
}) {
  const entries = getCardEntries(cards);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2 lg:p-4">
      <p className="mb-1.5 text-center text-[11px] font-medium text-gray-500 lg:text-sm">
        {submitted ? '제출 완료 — 상대를 기다리는 중...' : '카드를 눌러 선택하세요'}
      </p>
      {/*
        손패는 넘치면 줄을 바꾼다.

        예전에는 한 줄로 두고 넘치면 가로로 밀게 했다. 판이 출렁이지 않는다는
        게 이유였는데, 실제로는 375px 폰에서 열 장 중 넉 장이 화면 밖으로
        나갔다 — 하필 조커 두 장이 거기 있었다. 가로 스크롤은 옆으로 더 있다는
        표시가 없어서 아예 없는 카드로 보인다. 손에 든 것을 못 보는 것보다는
        한 줄 늘어나는 편이 낫고, 무대가 flex-1 이라 늘어난 만큼은 무대가
        내준다.
      */}
      <div className="grid grid-cols-5 justify-center gap-2 pb-1 lg:gap-4">
        {entries.map(({ type, count }) => {
          if (count <= 0) return null;
          const style = CARD_COLORS[type];
          const isLocked = type === lastPlayed && !available.includes(type);
          const isAvailable = available.includes(type);

          return Array.from({ length: count }, (_, i) => (
            <button
              key={`${type}-${i}`}
              onClick={() => canAct && !submitted && onCardClick(type, i, isLocked)}
              className={`relative flex h-[clamp(76px,24cqh,128px)] w-full min-w-0 flex-col items-center justify-center rounded-xl border-2 transition-all select-none ${
                isLocked
                  ? `${style.border} cursor-pointer opacity-50`
                  : isAvailable && canAct && !submitted
                    ? `${style.border} cursor-pointer shadow-sm hover:-translate-y-2 hover:scale-105 hover:shadow-lg active:scale-95`
                    : `${style.border} cursor-not-allowed opacity-40`
              } ${style.bg} ${style.text} `}
            >
              <span className="text-xl sm:text-3xl lg:text-5xl">{style.icon}</span>
              <span className="mt-1 px-0.5 text-center text-[11px] leading-tight font-semibold sm:text-xs lg:text-base">
                {CARD_NAMES[type]}
              </span>
            </button>
          ));
        })}
      </div>
    </div>
  );
}
