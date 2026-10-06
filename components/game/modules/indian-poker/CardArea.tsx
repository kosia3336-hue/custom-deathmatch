'use client';

import { useDelayedCardReveal } from './useIndianPokerPresentation';
import { PlayingCard } from '@/components/game/cards';
import type { IPPlayerInfo } from '@/shared/types/indian-poker';
import type { SkinTheme } from '@/lib/skins/registry';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import MoonlitCard, { type MoonlitDealFly } from './skins/MoonlitCard';
import MoonlitTableShell from './skins/MoonlitTableShell';
import MoonlitDeckPile from './skins/MoonlitDeckPile';
import styles from './indian-poker.module.css';

interface CardAreaProps {
  communityCards: [number, number] | null;
  myPlayer: IPPlayerInfo | undefined;
  opponentPlayer: IPPlayerInfo | undefined;
  revealMyCard?: boolean;
  round?: number;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  /** 무월 딜 연출: 0~4 (4=전부 공개) */
  dealStep?: number;
  showShuffle?: boolean;
}

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
        className={`${styles.tableCard} ${size === 'sm' ? styles.tableCardSmall : ''}`}
      />
    );
  }

  return (
    <PlayingCard
      value={value}
      hidden={hidden}
      animateIn={animateIn}
      className={`${styles.tableCard} ${size === 'sm' ? styles.tableCardSmall : ''}`}
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
  round = 0,
}: Omit<CardAreaProps, 'skin'> & { isNocturne: boolean; dealStep: number }) {
  const myCardVisible = useDelayedCardReveal(Boolean(revealMyCard), round);

  const showComm0 = !isNocturne || dealStep >= 1;
  const showComm1 = !isNocturne || dealStep >= 2;
  const showOpp = !isNocturne || dealStep >= 3;
  const showMySlot = !isNocturne || dealStep >= 4;

  const labelClass = isNocturne ? 'text-slate-300/80' : 'text-gray-400';

  const flyCommL: MoonlitDealFly = { x: 24, y: 20 };
  const flyCommR: MoonlitDealFly = { x: -24, y: 20 };
  const flyOpp: MoonlitDealFly = { x: 0, y: 36 };
  const flyMe: MoonlitDealFly = { x: 0, y: -36 };

  const myLabel = isSpectator ? `${myPlayer?.nickname ?? '플레이어'} 카드` : '내 카드 (이마)';

  return (
    <>
      <div className={`${styles.cardSlot} ${styles.opponentSlot}`}>
        <span className={`text-[11px] lg:text-xs ${labelClass}`}>
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
          <div className={styles.tableCard} />
        )}
      </div>

      <div className={`${styles.cardSlot} ${styles.communitySlot}`}>
        <span className={`text-[11px] lg:text-xs ${labelClass}`}>공유 카드</span>
        <div className={styles.communityCards}>
          <div className="flex flex-col items-center gap-1">
            {showComm0 ? (
              <TableCard
                value={communityCards?.[0] ?? null}
                size="sm"
                isNocturne={isNocturne}
                dealEnter={isNocturne && dealStep === 1}
                dealFly={flyCommL}
              />
            ) : (
              <div className={`${styles.tableCard} ${styles.tableCardSmall}`} />
            )}
          </div>
          <div className="flex flex-col items-center gap-1">
            {showComm1 ? (
              <TableCard
                value={communityCards?.[1] ?? null}
                size="sm"
                isNocturne={isNocturne}
                dealEnter={isNocturne && dealStep === 2}
                dealFly={flyCommR}
              />
            ) : (
              <div className={`${styles.tableCard} ${styles.tableCardSmall}`} />
            )}
          </div>
          {isNocturne && (
            <div className={styles.deckPile}>
              <MoonlitDeckPile showShuffle={showShuffle} />
            </div>
          )}
        </div>
      </div>

      <div
        className={`${styles.cardSlot} ${styles.mySlot} ${
          isNocturne && !showMySlot ? 'skin-nocturne-forehead-slot' : ''
        }`}
      >
        <span className={`text-[11px] lg:text-xs ${labelClass}`}>{myLabel}</span>
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
          <div className={styles.tableCard} />
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
      <MoonlitTableShell contentClassName={styles.cardTable}>
        <CardAreaContent {...rest} isNocturne dealStep={dealStep} />
      </MoonlitTableShell>
    );
  }

  return (
    <div
      className={`${styles.cardTable} border-cdm-border bg-cdm-bg-elev-1 rounded-xl border p-3 lg:p-5`}
    >
      <CardAreaContent {...rest} isNocturne={false} dealStep={dealStep} />
    </div>
  );
}
