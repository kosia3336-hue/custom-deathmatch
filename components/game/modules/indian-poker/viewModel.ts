import type { IndianPokerGameData } from '../../../../shared/types/indian-poker';
import { indianPokerBettingLimits } from '../../../../shared/indianPokerBetting';

export function buildIndianPokerViewModel(
  data: IndianPokerGameData,
  myId: string,
  spectator: boolean,
) {
  const entries = Object.entries(data.players);
  const me = data.players[myId];
  const opponentEntry = entries.find(([id]) => id !== myId);
  const activeEntry = entries.find(([id]) => id === data.currentTurnId);
  const actorEntry = spectator
    ? (activeEntry ?? entries[0])
    : me
      ? ([myId, me] as const)
      : undefined;
  const otherEntry = entries.find(([id]) => id !== actorEntry?.[0]);
  const actor = actorEntry?.[1];
  const opponent = otherEntry?.[1];
  const betting = data.phase === 'betting';
  const canAct = betting && !spectator && Boolean(me && opponent) && data.currentTurnId === myId;
  const canCheck = canAct && !data.bettingStarted && data.currentTurnId === data.firstBettorId;
  return {
    betting,
    result: ['showdown', 'dieResult', 'finished'].includes(data.phase),
    phaseLabel: betting
      ? spectator
        ? '(관전) 베팅 선택'
        : canAct
          ? '(내 차례) 베팅 선택'
          : '(상대 차례) 베팅 선택'
      : data.phase === 'dealing'
        ? '카드 배분'
        : data.phase === 'finished'
          ? '종료'
          : '카드 공개',
    tableMe: spectator ? entries[0]?.[1] : me,
    tableOpponent: spectator ? entries[1]?.[1] : opponentEntry?.[1],
    bettingPlayer: actor,
    bettingOpponent: opponent,
    bettingPlayerId: actorEntry?.[0],
    bettingOpponentId: otherEntry?.[0],
    canAct,
    canCheck,
    limits: indianPokerBettingLimits(actor, opponent),
    // 라운드·행동·조작자가 바뀌면 입력을 다시 만들고 이전 선택을 다음 차례에 넘기지 않는다.
    inputKey: `${data.round}:${data.currentRoundActions.length}:${actorEntry?.[0]}:${canAct}`,
  };
}

export type IndianPokerViewModel = ReturnType<typeof buildIndianPokerViewModel>;
