'use client';

import { MeLabel } from '@/components/cdm';
import { cn } from '@/lib/utils';
import { turnIndex, type RtbCard as Card, type RtbPlayer, type RtbState } from '@shared/guild-war';
import { waitingNextSet } from './play-view';
import { RtbCard } from './RtbCard';
import styles from './seat-plate.module.css';

function SeatHand({
  cards,
  dead,
  reveal,
  comboIds,
  compact = false,
}: {
  cards: Card[];
  dead: boolean;
  reveal: boolean;
  comboIds: Set<string>;
  compact?: boolean;
}) {
  const open = reveal && !dead && cards.length > 0;
  const showBacks = !open && cards.length > 0;

  return (
    <div
      className={styles.hand}
      aria-hidden={!open && !showBacks}
      aria-label={open ? '손패 공개' : showBacks ? `손패 ${cards.length}장` : undefined}
    >
      {open && (
        <div className={cn(styles.fan, styles.openFan)}>
          {cards.map((card) => (
            <div key={card.id} className={styles.fanItem}>
              <RtbCard card={card} size={compact ? 'sm' : 'play'} dimmed={comboIds.size > 0 && !comboIds.has(card.id)} />
            </div>
          ))}
        </div>
      )}
      {showBacks && (
        <div className={cn(styles.fan, dead && styles.deadFan)}>
          {Array.from({ length: cards.length }, (_, i) => (
            <div key={i} className={cn(styles.fanItem, dead && styles.deadCard)}>
              <RtbCard card={null} hidden size={compact ? 'sm' : 'play'} />
            </div>
          ))}
        </div>
      )}
      {dead && <span className={styles.stamp}>다이</span>}
    </div>
  );
}

export function SeatPlate({
  meId,
  player,
  state,
  seatNo,
  compact = false,
  onSitEmpty,
  spectateReserved = false,
}: {
  meId: string;
  player: RtbPlayer | null;
  state: RtbState;
  seatNo: number;
  compact?: boolean;
  onSitEmpty?: () => void;
  spectateReserved?: boolean;
}) {
  if (!player) {
    if (onSitEmpty) {
      return (
        <button
          type="button"
          onClick={onSitEmpty}
          className={cn(
            styles.plate,
            compact && styles.compact,
            'border-cdm-border bg-cdm-bg-elev-1 hover:border-cdm-primary hover:bg-cdm-primary-soft rounded-cdm-lg cursor-pointer border-2 border-dashed text-left',
          )}
          aria-label={`${seatNo}번 빈자리, 눌러서 앉기`}
        >
          <p className={cn('text-cdm-fg-subtle min-w-0 truncate text-sm font-black tabular-nums', compact && 'text-xs')}>
            {seatNo}번 빈자리
          </p>
          <p className={cn('text-cdm-primary font-bold', compact ? 'text-[10px]' : 'text-xs')}>앉기</p>
          <div className={styles.emptyWell} />
        </button>
      );
    }
    return (
      <div
        className={cn(
          styles.plate,
          compact && styles.compact,
          'border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-lg border-2 border-dashed',
        )}
        aria-label={`${seatNo}번 빈자리`}
      >
        <p className={cn('text-cdm-fg-subtle min-w-0 truncate text-sm font-black tabular-nums', compact && 'text-xs')}>
          {seatNo}번 빈자리
        </p>
        <div className={styles.emptyWell} />
      </div>
    );
  }

  const waitingNext = waitingNextSet(state, player.id);
  const idx = turnIndex(state, player.id);
  const no = idx >= 0 ? idx + 1 : seatNo;
  const isMe = player.id === meId;
  const isTurn = state.currentId === player.id;
  const dead = state.alive[player.id] === false;
  const submitted = Boolean(state.combo[player.id]);
  const revealing = state.phase === 'settle' || state.phase === 'countdown';
  const won = Boolean(state.settle?.winners.some((w) => w.playerId === player.id) && revealing);
  const hand = state.hands[player.id] ?? [];
  const seatCards = isMe && !revealing && !dead && !compact ? [] : hand;
  const showMyFaces = compact && isMe && !dead && !revealing;
  const comboIds = new Set((state.combo[player.id] ?? []).map((c) => c.id));
  const line = revealing ? state.settle?.lines.find((l) => l.playerId === player.id) : undefined;
  const score = !dead && line?.score != null ? line.score : null;

  const marks = (
    <>
      {waitingNext && (
        <span className={cn('bg-cdm-bg-elev-2 text-cdm-fg-muted shrink-0 rounded-full font-bold', compact ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]')}>
          다음
        </span>
      )}
      {spectateReserved && isMe && (
        <span className={cn('bg-cdm-primary-soft text-cdm-primary shrink-0 rounded-full font-bold', compact ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]')}>
          예약
        </span>
      )}
      {won && (
        <span className={cn('bg-cdm-highlight text-cdm-fg shrink-0 rounded-full font-black', compact ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]')}>
          WIN
        </span>
      )}
      {isMe && <MeLabel className={cn('text-cdm-primary shrink-0', compact ? 'text-[9px]' : 'text-[11px]')} />}
      {player.id === state.firstId && (
        <span className={cn('bg-cdm-highlight text-cdm-fg shrink-0 rounded-full font-bold', compact ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]')}>
          선
        </span>
      )}
      {player.id === state.bellId && (
        <span className={cn('bg-cdm-primary shrink-0 rounded-full font-bold text-white', compact ? 'px-1 py-0 text-[9px]' : 'px-1.5 py-0.5 text-[10px]')}>
          벨
        </span>
      )}
      {submitted && state.phase === 'combo' && (
        <span className={cn('text-cdm-success shrink-0 font-bold', compact ? 'text-[9px]' : 'text-[10px]')}>제출</span>
      )}
    </>
  );

  return (
    <div
      aria-current={isTurn ? 'true' : undefined}
      aria-label={`${no}번 ${player.nickname}${dead ? ' 다이' : ''}${won ? ' 승' : ''}`}
      className={cn(
        styles.plate,
        compact && styles.compact,
        'rounded-cdm-lg border-2',
        won
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : isTurn
            ? 'border-cdm-highlight bg-cdm-highlight-soft'
            : isMe
              ? 'border-cdm-primary bg-cdm-primary-soft'
              : 'border-cdm-border bg-cdm-bg',
        dead && 'border-cdm-accent bg-cdm-bg-elev-1',
      )}
    >
      {compact ? (
        <>
          <div className="flex min-w-0 items-center gap-0.5">
            <span
              className={cn(
                'shrink-0 text-xs leading-none font-black tabular-nums',
                isMe ? 'text-cdm-primary' : 'text-cdm-fg',
                dead && 'text-cdm-fg-muted',
              )}
            >
              {no}번
            </span>
            <div className="ml-auto flex min-w-0 items-center justify-end gap-0.5 overflow-hidden">
              {marks}
            </div>
          </div>
          <p className={cn('min-w-0 truncate text-[11px] font-bold', dead ? 'text-cdm-fg-muted' : 'text-cdm-fg')}>
            {player.nickname}
          </p>
        </>
      ) : (
        <div className="flex min-w-0 items-center gap-1">
          <span
            className={cn(
              'shrink-0 text-base leading-none font-black tabular-nums',
              isMe ? 'text-cdm-primary' : 'text-cdm-fg',
              dead && 'text-cdm-fg-muted',
            )}
          >
            {no}번
          </span>
          <p className={cn('min-w-0 truncate text-sm font-bold', dead ? 'text-cdm-fg-muted' : 'text-cdm-fg')}>
            {player.nickname}
          </p>
          <div className="ml-auto flex shrink-0 items-center gap-1">{marks}</div>
        </div>
      )}
      <div className="flex min-w-0 items-center justify-between gap-1">
        <p className={cn(styles.guild, 'min-w-0 truncate')}>[{player.guildName}]</p>
        {score != null && <p className={styles.score}>{score}점</p>}
      </div>
      <SeatHand
        cards={seatCards}
        dead={dead}
        reveal={revealing || showMyFaces}
        comboIds={comboIds}
        compact={compact}
      />
    </div>
  );
}
