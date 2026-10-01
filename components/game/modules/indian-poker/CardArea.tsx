'use client';

import { useState, useEffect } from 'react';
import { PlayingCard } from '@/components/game/cards';
import type { IPPlayerInfo } from '@/shared/types/indian-poker';
import type { SkinTheme } from '@/lib/skins/registry';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import MoonlitCard, { type MoonlitDealFly } from './skins/MoonlitCard';
import MoonlitTableShell from './skins/MoonlitTableShell';
import MoonlitDeckPile from './skins/MoonlitDeckPile';

interface CardAreaProps {
  communityCards: [number, number] | null;
  myPlayer: IPPlayerInfo | undefined;
  opponentPlayer: IPPlayerInfo | undefined;
  revealMyCard?: boolean;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  /** 무월 딜 연출: 0~4 (4=전부 공개) */
  dealStep?: number;
  showShuffle?: boolean;
}

/* 판 자리에 맞춘 너비 — 예전 카드와 같은 크기라 판 배치가 바뀌지 않는다 */
const TABLE_CARD_WIDTH = { sm: 'w-9 lg:w-12', md: 'w-11 lg:w-14' } as const;

function TableCard({
  value,
  hidden,
  size = 'md',
  animateIn = false,
  isNocturne,
  dealEnter,
  dealFly,
}: {
  value: number | null;
  hidden?: boolean;
  size?: 'sm' | 'md';
  animateIn?: boolean;
  isNocturne: boolean;
  dealEnter?: boolean;
  dealFly?: MoonlitDealFly;
}) {
  if (isNocturne) {
    return (
      <MoonlitCard
        value={value}
        hidden={hidden}
        size={size}
        animateIn={animateIn}
        dealEnter={dealEnter}
        dealFly={dealFly}
      />
    );
  }

  return (
    <PlayingCard
      value={value}
      hidden={hidden}
      animateIn={animateIn}
      className={TABLE_CARD_WIDTH[size]}
    />
  );
}

function CardAreaContent({
  communityCards,
  myPlayer,
  opponentPlayer,
  revealMyCard,
  isSpectator,
  isNocturne,
  dealStep,
  showShuffle,
}: Omit<CardAreaProps, 'skin'> & { isNocturne: boolean; dealStep: number }) {
  const [myCardVisible, setMyCardVisible] = useState(revealMyCard);

  useEffect(() => {
    if (revealMyCard) {
      const t = setTimeout(() => setMyCardVisible(true), 300);
      return () => clearTimeout(t);
    }
    setMyCardVisible(false);
  }, [revealMyCard]);

  const showComm0 = !isNocturne || dealStep >= 1;
  const showComm1 = !isNocturne || dealStep >= 2;
  const showOpp = !isNocturne || dealStep >= 3;
  const showMySlot = !isNocturne || dealStep >= 4;

  const labelClass = isNocturne ? 'text-slate-300/80' : 'text-gray-400';

  const flyCommL: MoonlitDealFly = { x: 24, y: 20 };
  const flyCommR: MoonlitDealFly = { x: -24, y: 20 };
  const flyOpp: MoonlitDealFly = { x: 0, y: 36 };
  const flyMe: MoonlitDealFly = { x: 0, y: -36 };

  const myLabel = isSpectator
    ? `${myPlayer?.nickname ?? '플레이어'} 카드`
    : '내 카드 (이마)';

  return (
    <>
      <div className="flex flex-col items-center gap-1">
        <span className={`text-[10px] lg:text-xs ${labelClass}`}>
          {opponentDisplayName(opponentPlayer?.nickname, isSpectator)} 카드
        </span>
        {showOpp ? (
          <TableCard
            value={opponentPlayer?.card ?? null}
            size="md"
            isNocturne={isNocturne}
            dealEnter={isNocturne && dealStep === 3}
            dealFly={flyOpp}
          />
        ) : (
          <div className="h-14 w-11 lg:h-20 lg:w-14" />
        )}
      </div>

      <div className="flex w-32 items-end justify-between lg:w-44">
        <div className="flex flex-col items-center gap-1">
          <span className={`text-[10px] lg:text-xs ${labelClass}`}>공유</span>
          {showComm0 ? (
            <TableCard
              value={communityCards?.[0] ?? null}
              size="sm"
              isNocturne={isNocturne}
              dealEnter={isNocturne && dealStep === 1}
              dealFly={flyCommL}
            />
          ) : (
            <div className="h-11 w-9 lg:h-16 lg:w-12" />
          )}
        </div>
        {isNocturne && <MoonlitDeckPile showShuffle={showShuffle} />}
        <div className="flex flex-col items-center gap-1">
          <span className={`text-[10px] lg:text-xs ${labelClass}`}>공유</span>
          {showComm1 ? (
            <TableCard
              value={communityCards?.[1] ?? null}
              size="sm"
              isNocturne={isNocturne}
              dealEnter={isNocturne && dealStep === 2}
              dealFly={flyCommR}
            />
          ) : (
            <div className="h-11 w-9 lg:h-16 lg:w-12" />
          )}
        </div>
      </div>

      <div
        className={`flex flex-col items-center gap-1 ${
          isNocturne && !showMySlot ? 'skin-nocturne-forehead-slot' : ''
        }`}
      >
        <span className={`text-[10px] lg:text-xs ${labelClass}`}>{myLabel}</span>
        {showMySlot ? (
          <TableCard
            value={myCardVisible ? (myPlayer?.card ?? null) : null}
            hidden={!myCardVisible}
            size="md"
            isNocturne={isNocturne}
            animateIn={myCardVisible}
            dealEnter={isNocturne && dealStep === 4 && !myCardVisible}
            dealFly={flyMe}
          />
        ) : (
          <div className="h-14 w-11 lg:h-20 lg:w-14" />
        )}
      </div>
    </>
  );
}

export default function CardArea(props: CardAreaProps) {
  const { skin, dealStep = 4, ...rest } = props;
  const isNocturne = skin === 'nocturne';

  if (isNocturne) {
    return (
      <MoonlitTableShell>
        <CardAreaContent {...rest} isNocturne dealStep={dealStep} />
      </MoonlitTableShell>
    );
  }

  return (
    <div className="flex flex-col items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 p-1.5 lg:gap-3 lg:p-5">
      <CardAreaContent {...rest} isNocturne={false} dealStep={dealStep} />
    </div>
  );
}
