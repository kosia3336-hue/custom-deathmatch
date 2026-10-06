import type { InternalState, NF4PlayerInternal } from './types.js';

export { judgeNumber } from '@shared/numberFourJudge.js';

/** 선택한 넘버의 합 */
function getNumberSum(s: InternalState, player: NF4PlayerInternal) {
  let numberSum = 0;
  for (const record of s.roundHistory) {
    const pr = record.players[player.id];
    if (pr) numberSum += pr.number;
  }
  return numberSum;
}

/**
 * 승점 동점 판정 (룰 I).
 * 1. 선택한 넘버의 합이 낮은 쪽 승리
 * 2. 넘버 합도 같으면 **잔여** 백색 타일이 많은 쪽 승리
 *
 * 2 는 예전에 라운드마다 *제출한* 백색을 더해 많은 쪽을 이기게 했다. 시작 타일 수가
 * 같으므로 백색을 많이 쓴 쪽 = 잔여 백색이 적은 쪽이라 룰과 정반대였다(잔여가 많은데
 * 졌다는 제보). 잔여 수는 매 라운드(시간 초과 자동 제출 포함) processRound 가 실제
 * 제출분만큼 깎은 remainingWhite 를 그대로 쓴다.
 */
export function tiebreaker(s: InternalState): { winnerId: string | null; reason: string } {
  const sum1 = getNumberSum(s, s.player1);
  const sum2 = getNumberSum(s, s.player2);

  if (sum1 !== sum2) {
    const winnerId = sum1 < sum2 ? s.player1.id : s.player2.id;
    return {
      winnerId,
      reason: `넘버 합 ${sum1} vs ${sum2} (낮은 쪽 승리)`,
    };
  }

  const white1 = s.player1.remainingWhite;
  const white2 = s.player2.remainingWhite;
  if (white1 !== white2) {
    const winnerId = white1 > white2 ? s.player1.id : s.player2.id;
    return {
      winnerId,
      reason: `넘버 합 ${sum1} 동점 · 잔여 백색 타일 ${white1} vs ${white2} (많은 쪽 승리)`,
    };
  }

  /*
    승점·넘버 합·잔여 백색까지 모두 같으면 무승부다.
    예전에는 선 플레이어를 이기게 했는데, 룰 I 에 그런 근거가 없고 자리만으로
    승패가 갈리는 셈이었다. 승자 없음(null)으로 돌려주고 부르는 쪽이 무승부로 끝낸다.
  */
  return {
    winnerId: null,
    reason: '완전 동점 (무승부)',
  };
}
