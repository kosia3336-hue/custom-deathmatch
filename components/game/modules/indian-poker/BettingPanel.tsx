'use client';

import { useState } from 'react';
import type { IndianPokerAction, IndianPokerGameData } from '@/shared/types/indian-poker';
import type { SkinTheme } from '@/lib/skins/registry';
import { sfxNocturneCall, sfxNocturneDie, sfxNocturneRaise } from '@/lib/audio/skins/nocturne';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import { formatBettingVerb, getLastActionByPlayer } from './constants';
import type { IndianPokerViewModel } from './viewModel';
import BettingSummary from './betting/BettingSummary';
import BettingActions from './betting/BettingActions';
import RaiseInput from './betting/RaiseInput';
import styles from './indian-poker.module.css';

export default function BettingPanel({
  data,
  model,
  spectator,
  skin,
  remaining,
  onAction,
}: {
  data: IndianPokerGameData;
  model: IndianPokerViewModel;
  spectator: boolean;
  skin?: SkinTheme | null;
  remaining?: number | null;
  onAction: (action: IndianPokerAction) => void;
}) {
  const [raising, setRaising] = useState(false);
  const timedOut = remaining != null && remaining <= 0;
  const canAct = model.canAct && !timedOut;
  const opponentName = opponentDisplayName(model.bettingOpponent?.nickname, spectator);
  const lastOpponent = model.bettingOpponentId
    ? getLastActionByPlayer(data.currentRoundActions, model.bettingOpponentId)
    : undefined;
  const last = data.currentRoundActions.at(-1);
  const status =
    (spectator || !model.canAct) && last
      ? `${!spectator && last.playerId === model.bettingPlayerId ? '나' : opponentDisplayName(data.players[last.playerId]?.nickname, spectator)} · ${formatBettingVerb(last)}`
      : `${opponentName} · ${formatBettingVerb(lastOpponent)}`;
  const act = (action: IndianPokerAction) => {
    if (!canAct) return;
    if (skin === 'nocturne') {
      if (action.type === 'die') sfxNocturneDie();
      else if (action.type === 'raise') sfxNocturneRaise();
      else sfxNocturneCall();
    }
    onAction(action);
    setRaising(false);
  };
  return (
    <section aria-label="플레이어 조작판" className={styles.bettingPanel}>
      <BettingSummary
        chips={model.bettingPlayer?.chips ?? 0}
        pot={data.pot}
        callCost={model.limits.callCost}
        status={status}
      />
      {canAct ? (
        raising && model.limits.canRaise ? (
          <RaiseInput
            limits={model.limits}
            onCancel={() => setRaising(false)}
            onConfirm={(amount) => act({ type: 'raise', amount })}
          />
        ) : (
          <BettingActions
            canCheck={model.canCheck}
            limits={model.limits}
            onRaise={() => setRaising(true)}
            onAction={act}
          />
        )
      ) : (
        <p className="ip-betting-wait" role="status">
          {spectator
            ? '관전 중'
            : timedOut
              ? '시간 종료 · 판정 대기 중'
              : '상대의 선택을 기다리고 있습니다.'}
        </p>
      )}
    </section>
  );
}
