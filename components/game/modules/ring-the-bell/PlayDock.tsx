'use client';

import { Button } from '@/components/cdm';
import { available, BELL_FAIL } from '@shared/guild-war';
import { RtbCard } from './RtbCard';
import { type PlayViewProps } from './play-view';

export function PlayDock({
  meId,
  state,
  flags,
  selected,
  comboOk,
  dispatch,
  toggleCard,
}: PlayViewProps) {
  const myHand = state.hands[meId] ?? [];
  const myAvail = available(state, meId);
  const inThisSet = state.players.some((p) => p.id === meId);
  const dead = inThisSet && !flags.alive;
  const showCombo = state.phase === 'combo' && flags.comboOpen;
  const showBellDie = flags.isCurrent && flags.alive && state.phase === 'turn';

  if (dead) {
    return (
      <div className="border-cdm-border bg-cdm-bg-elev-1 flex shrink-0 items-center justify-center gap-4 border-t px-5 py-4">
        <p className="text-cdm-fg-muted text-sm font-bold">다이</p>
      </div>
    );
  }

  return (
    <div className="border-cdm-border bg-cdm-bg flex shrink-0 flex-col items-center gap-2 border-t px-5 py-2">
      {showBellDie && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            disabled={!flags.canBell}
            onClick={() => dispatch(meId, { type: 'bell' })}
            title={flags.canBell ? `실패하면 칩 ${BELL_FAIL}` : `실패 대비 칩 ${BELL_FAIL}개가 필요합니다`}
          >
            벨
          </Button>
          <Button
            size="sm"
            variant="danger"
            disabled={!flags.canDie}
            onClick={() => dispatch(meId, { type: 'die' })}
          >
            다이
          </Button>
        </div>
      )}
      <div className="flex items-end justify-center gap-3">
        <div className="flex items-end gap-2">
          {myHand.map((card) => (
            <RtbCard
              key={card.id}
              card={card}
              selected={selected.includes(card.id)}
              dimmed={state.phase === 'combo' && selected.length > 0 && !selected.includes(card.id)}
              onClick={
                (state.phase === 'discard' && flags.canDiscard) || showCombo
                  ? () => toggleCard(card.id)
                  : undefined
              }
            />
          ))}
        </div>
        <p className="text-cdm-fg shrink-0 pb-1 text-sm font-black tabular-nums">길드 공용칩 {myAvail}</p>
        {showCombo && (
          <Button
            className="mb-0.5"
            disabled={!comboOk}
            onClick={() => dispatch(meId, { type: 'combo', cardIds: selected })}
          >
            조합 제출
          </Button>
        )}
        {state.phase === 'combo' && flags.alive && !flags.comboOpen && (
          <p className="text-cdm-fg-muted pb-1 text-sm font-bold">제출함</p>
        )}
      </div>
    </div>
  );
}
