import type { BettingRpsGameData } from '@/shared/types/betting-rps';
import { opponentDisplayName } from '../../../../lib/anonymousOpponents';
export function buildBettingRpsView(data: BettingRpsGameData, myId: string, spectator: boolean) {
  const me = spectator ? undefined : data.players[myId];
  const opponent = Object.entries(data.players).find(([id]) => id !== myId)?.[1];
  const choosing = data.phase === 'roleSelect';
  const submitting = data.phase === 'submit';
  const phaseLabel = choosing
    ? spectator
      ? '역할 선택'
      : me?.hasChoiceRight
        ? '(내 차례) 역할 선택'
        : '(상대 차례) 역할 선택'
    : submitting
      ? me?.submitted
        ? '상대 대기 · 제출 완료'
        : '(공동 차례) 결과·베팅 제출'
      : data.phase === 'reveal'
        ? '라운드 결과 공개'
        : '게임 종료';
  return {
    me,
    phaseLabel,
    canChoose: !!me?.hasChoiceRight && choosing,
    canSubmit: !!me && submitting && !me.submitted,
    opponentName: opponentDisplayName(opponent?.nickname),
  };
}
