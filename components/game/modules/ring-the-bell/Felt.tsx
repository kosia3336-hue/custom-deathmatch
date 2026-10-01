'use client';

import { Button } from '@/components/cdm';
import { RtbCard } from './RtbCard';
import { settlePayouts, type PlayViewProps } from './play-view';

export function Felt({
  meId,
  state,
  flags,
  remaining,
  dispatch,
  idleSlot,
  compact = false,
}: Pick<PlayViewProps, 'meId' | 'state' | 'flags' | 'remaining' | 'dispatch' | 'idleSlot'> & {
  compact?: boolean;
}) {
  const fourMine = state.phase === 'four_choice' && flags.canFour;
  const settling = state.phase === 'settle' || state.phase === 'countdown';
  const showTimer = remaining != null && !settling;
  const sec =
    remaining == null ? null : remaining <= 10_000 ? (remaining / 1000).toFixed(1) : String(Math.ceil(remaining / 1000));
  const critical = remaining != null && remaining <= 10_000;
  const cardSize = compact ? 'sm' : 'play';
  const payouts = settling ? settlePayouts(state) : [];

  return (
    <div
      className={
        compact
          ? 'relative flex shrink-0 flex-col items-center justify-center gap-1 px-2 pt-0.5 pb-1'
          : 'relative flex shrink-0 flex-col items-center justify-center gap-2 px-4 pt-1 pb-2'
      }
    >
      <div className={compact ? 'flex items-end justify-center gap-2' : 'flex items-end justify-center gap-6'}>
        <div className="flex flex-col items-center gap-0.5">
          <p className="text-cdm-fg-subtle text-xs font-bold">팟</p>
          <p
            className={
              compact
                ? 'text-cdm-fg text-lg font-black tabular-nums leading-none'
                : 'text-cdm-fg text-2xl font-black tabular-nums leading-none'
            }
          >
            {state.pot}
          </p>
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-cdm-fg-muted text-[11px] font-bold">덱 잔여</p>
          <RtbCard
            card={null}
            hidden
            size={cardSize}
            count={state.deck.length}
            playable={flags.canPickDeck}
            onClick={flags.canPickDeck ? () => dispatch(meId, { type: 'pick', source: 'deck' }) : undefined}
          />
        </div>
        <div className="flex flex-col items-center gap-1">
          <p className="text-cdm-fg-muted text-[11px] font-bold">앞면</p>
          <RtbCard
            card={state.face}
            hidden={!state.face}
            size={cardSize}
            playable={flags.canPickFace}
            onClick={flags.canPickFace ? () => dispatch(meId, { type: 'pick', source: 'face' }) : undefined}
          />
        </div>
        {showTimer && (
          <div className="flex flex-col items-center gap-0.5">
            <p className="text-cdm-fg-subtle text-xs font-bold">남은 시간</p>
            <p
              className={
                critical
                  ? compact
                    ? 'text-cdm-accent font-mono text-xl font-black tabular-nums leading-none motion-safe:animate-pulse'
                    : 'text-cdm-accent font-mono text-2xl font-black tabular-nums leading-none motion-safe:animate-pulse'
                  : compact
                    ? 'text-cdm-fg font-mono text-xl font-black tabular-nums leading-none'
                    : 'text-cdm-fg font-mono text-2xl font-black tabular-nums leading-none'
              }
            >
              {sec}초
            </p>
          </div>
        )}
      </div>

      {settling && state.settle && (
        <div className={compact ? 'flex flex-col items-center gap-0.5' : 'flex flex-col items-center gap-1'}>
          <p
            className={
              compact
                ? 'text-cdm-fg-muted line-clamp-1 text-center text-[11px] font-bold'
                : 'text-cdm-fg-muted text-center text-xs font-bold'
            }
          >
            {state.settle.note}
          </p>
          {payouts.map((row) => (
            <p
              key={row.playerId}
              className={
                compact
                  ? 'text-cdm-fg text-center text-xs font-black'
                  : 'text-cdm-fg text-center text-sm font-black'
              }
            >
              [{row.guildName}] {row.nickname} +{row.amount}칩
            </p>
          ))}
          {payouts.length > 0 && state.settle.vanished > 0 && (
            <p className={compact ? 'text-cdm-fg-muted text-[11px] font-bold' : 'text-cdm-fg-muted text-xs font-bold'}>
              나누다 남은 {state.settle.vanished}칩 소멸
            </p>
          )}
          {state.phase === 'countdown' && sec != null && (
            <p
              className={
                compact
                  ? 'text-cdm-fg font-mono text-xs font-bold tabular-nums'
                  : 'text-cdm-fg font-mono text-sm font-bold tabular-nums'
              }
            >
              다음 세트 {sec}초
            </p>
          )}
        </div>
      )}

      {state.phase === 'idle' && idleSlot}

      {fourMine && !compact && (
        <div className="bg-cdm-bg/95 absolute inset-0 z-10 flex items-center justify-center gap-3">
          <p className="text-cdm-fg text-sm font-black">포카드</p>
          <Button onClick={() => dispatch(meId, { type: 'four' })}>선언</Button>
          <Button variant="secondary" onClick={() => dispatch(meId, { type: 'skip_four' })}>
            계속
          </Button>
        </div>
      )}
    </div>
  );
}
