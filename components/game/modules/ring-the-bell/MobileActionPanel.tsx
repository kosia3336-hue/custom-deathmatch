'use client';

import { Button } from '@/components/cdm';
import { available } from '@shared/guild-war';
import { RtbCard } from './RtbCard';
import type { PlayViewProps } from './play-view';

export function MobileActionPanel({
  meId,
  state,
  flags,
  selected,
  comboOk,
  prompt,
  dispatch,
  toggleCard,
}: PlayViewProps) {
  const myHand = state.hands[meId] ?? [];
  const myAvail = available(state, meId);
  const showCombo = state.phase === 'combo' && flags.comboOpen;
  const showBellDie = flags.isCurrent && flags.alive && state.phase === 'turn';
  const showPick = flags.canPickDeck || flags.canPickFace;
  const showFour = state.phase === 'four_choice' && flags.canFour;
  const handClickable = (state.phase === 'discard' && flags.canDiscard) || showCombo;

  return (
    <div className="flex flex-col items-center gap-3 pb-1">
      {prompt && <p className="text-cdm-fg text-center text-sm font-bold">{prompt}</p>}

      {showPick && (
        <div className="flex items-end justify-center gap-4">
          <div className="flex flex-col items-center gap-1">
            <p className="text-cdm-fg-muted text-[11px] font-bold">덱 잔여</p>
            <RtbCard
              card={null}
              hidden
              size="sm"
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
              size="sm"
              playable={flags.canPickFace}
              onClick={flags.canPickFace ? () => dispatch(meId, { type: 'pick', source: 'face' }) : undefined}
            />
          </div>
        </div>
      )}

      {showBellDie && (
        <div className="flex items-center justify-center gap-2">
          <Button
            size="sm"
            disabled={!flags.canBell}
            onClick={() => dispatch(meId, { type: 'bell' })}
            title={flags.canBell ? '실패하면 칩 2' : '실패 대비 칩 2개가 필요합니다'}
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

      {showFour && (
        <div className="flex items-center justify-center gap-2">
          <p className="text-cdm-fg text-sm font-black">포카드</p>
          <Button size="sm" onClick={() => dispatch(meId, { type: 'four' })}>
            선언
          </Button>
          <Button size="sm" variant="secondary" onClick={() => dispatch(meId, { type: 'skip_four' })}>
            계속
          </Button>
        </div>
      )}

      <div className="flex flex-wrap items-end justify-center gap-2">
        {myHand.map((card) => (
          <RtbCard
            key={card.id}
            card={card}
            size="sm"
            selected={selected.includes(card.id)}
            dimmed={state.phase === 'combo' && selected.length > 0 && !selected.includes(card.id)}
            onClick={handClickable ? () => toggleCard(card.id) : undefined}
          />
        ))}
      </div>

      <p className="text-cdm-fg text-sm font-black tabular-nums">길드 공용칩 {myAvail}</p>

      {showCombo && (
        <Button disabled={!comboOk} onClick={() => dispatch(meId, { type: 'combo', cardIds: selected })}>
          조합 제출
        </Button>
      )}
      {state.phase === 'combo' && flags.alive && !flags.comboOpen && (
        <p className="text-cdm-fg-muted text-sm font-bold">제출함</p>
      )}
    </div>
  );
}
