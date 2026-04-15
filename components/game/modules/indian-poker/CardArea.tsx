'use client';

import { useState, useEffect } from 'react';
import type { IPPlayerInfo } from '@/shared/types/indian-poker';

interface CardAreaProps {
  communityCards: [number, number] | null;
  myPlayer: IPPlayerInfo | undefined;
  opponentPlayer: IPPlayerInfo | undefined;
  revealMyCard?: boolean;
  isSpectator?: boolean;
}

function Card({
  value,
  hidden,
  label,
  size = 'md',
  animateIn = false,
}: {
  value: number | null;
  hidden?: boolean;
  label?: string;
  size?: 'sm' | 'md';
  animateIn?: boolean;
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
            : 'border-indigo-300 bg-indigo-50 text-indigo-300'}
          ${animateIn ? 'duration-500' : 'duration-200'}
        `}
      >
        {show ? value : '?'}
      </div>
    </div>
  );
}

export default function CardArea({ communityCards, myPlayer, opponentPlayer, revealMyCard = false, isSpectator = false }: CardAreaProps) {
  // 내 카드 reveal 애니메이션: revealMyCard가 true가 되면 짧은 딜레이 후 실제 값 표시
  const [myCardVisible, setMyCardVisible] = useState(revealMyCard);

  useEffect(() => {
    if (revealMyCard) {
      const t = setTimeout(() => setMyCardVisible(true), 300);
      return () => clearTimeout(t);
    } else {
      setMyCardVisible(false);
    }
  }, [revealMyCard]);

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

      {/* 다이아몬드 하단 — 내 카드 */}
      <div className="flex flex-col items-center gap-1">
        <span className="text-[10px] text-gray-400 lg:text-xs">
          {isSpectator ? `${myPlayer?.nickname ?? '플레이어'} 카드` : '내 카드 (이마)'}
        </span>
        <Card
          value={myCardVisible ? (myPlayer?.card ?? null) : null}
          hidden={!myCardVisible}
          size="md"
          animateIn={myCardVisible}
        />
      </div>
    </div>
  );
}
