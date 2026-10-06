import type { InvestDonateGameData } from '@/shared/types/invest-donate';
import { opponentDisplayName } from '../../../../lib/anonymousOpponents';

export function buildInvestDonateView(
  gameData: InvestDonateGameData,
  myId: string,
  isSpectator: boolean,
) {
  const entries = Object.entries(gameData.players);
  const myPlayer = isSpectator ? undefined : gameData.players[myId];
  const opponent = entries.find(([id]) => id !== myId)?.[1];
  const submitted = myPlayer?.submitted ?? false;
  const phaseLabel =
    gameData.phase === 'submit'
      ? submitted
        ? '상대 대기 · 배분 제출 완료'
        : '(공동 차례) 투자·기부 배분'
      : gameData.phase === 'reveal'
        ? '투자·기부 결과 공개'
        : '게임 종료';
  return {
    entries,
    myPlayer,
    opponent,
    opponentName: opponent ? opponentDisplayName(opponent.nickname) : '',
    canAct: !!myPlayer && !isSpectator && gameData.phase === 'submit',
    canCancel:
      !!myPlayer?.submitted && !!opponent && !opponent.submitted && gameData.phase === 'submit',
    phaseLabel,
    orderedIds: myPlayer
      ? [myId, ...entries.map(([id]) => id).filter((id) => id !== myId)]
      : entries.map(([id]) => id),
  };
}
