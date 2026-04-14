'use client';

import type { IPPlayerInfo } from '@/shared/types/indian-poker';

interface CardAreaProps {
  communityCards: [number, number] | null;
  myPlayer: IPPlayerInfo | undefined;
  opponentPlayer: IPPlayerInfo | undefined;
  /** 결과 페이즈(showdown/dieResult/finished)에서 내 카드 공개 */
  revealMyCard?: boolean;
  isSpectator?: boolean;
}

function Card({
  value,
  hidden,
  label,
  size = 'md',
}: {
  value: number | null;
  hidden?: boolean;
  label?: string;
  size?: 'sm' | 'md';
}) {
  const show = !hidden && value !== null;
  return (
    <div className="flex flex-col items-center gap-1">
      {label && (
        <span className="text-[10px] text-gray-400 lg:text-xs">{label}</span>
      )}
      <div
        className={`flex items-center justify-center rounded-lg border-2 font-bold shadow-sm transition-all
          ${size === 'md'
            ? 'h-14 w-11 text-xl lg:h-20 lg:w-14 lg:text-3xl'
            : 'h-11 w-9 text-lg lg:h-16 lg:w-12 lg:text-2xl'}
          ${show
            ? 'border-gray-300 bg-white text-gray-900'
            : 'border-indigo-300 bg-indigo-50 text-indigo-300'
          }`}
      >
        {show ? value : '?'}
      </div>
    </div>
  );
}

export default function CardArea({ communityCards, myPlayer, opponentPlayer, revealMyCard = false, isSpectator = false }: CardAreaProps) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3 lg:gap-3 lg:p-5">
      {/* 다이아몬드 상단 — 상대 카드 */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-400 lg:text-xs">
          {opponentPlayer?.nickname ?? '상대'} 카드
        </span>
        <Card value={opponentPlayer?.card ?? null} size="md" />
      </div>

      {/* 다이아몬드 중단 — 공유카드 좌우 배치 */}
      <div className="flex w-32 items-end justify-between lg:w-44">
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-gray-400 lg:text-xs">공유</span>
          <Card value={communityCards?.[0] ?? null} size="sm" />
        </div>
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] text-gray-400 lg:text-xs">공유</span>
          <Card value={communityCards?.[1] ?? null} size="sm" />
        </div>
      </div>

      {/* 다이아몬드 하단 — 내 카드 (결과 페이즈에만 공개) */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-400 lg:text-xs">
          {isSpectator ? `${myPlayer?.nickname ?? '플레이어'} 카드` : '내 카드 (이마)'}
        </span>
        <Card value={revealMyCard ? (myPlayer?.card ?? null) : null} hidden={!revealMyCard} size="md" />
      </div>
    </div>
  );
}
