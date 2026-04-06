import type { NF4Number } from '@shared/types/number4.js';
import type { JudgeResult, InternalState, NF4PlayerInternal } from './types.js';

export function judgeNumber(
  myWhite: number,
  myBlack: number,
  opWhite: number,
  opBlack: number,
  myNumber: NF4Number,
): JudgeResult {
  switch (myNumber) {
    case 0: {
      const totalBlack = myBlack + opBlack;
      const success = totalBlack >= 11;
      return {
        success,
        scoreChange: success ? 5 : -1,
        conditionDetail: success ? '흑색 합계 ≥ 11' : '흑색 합계 < 11',
      };
    }
    case 1: {
      const success = myWhite >= opWhite;
      return {
        success,
        scoreChange: success ? 1 : -1,
        conditionDetail: success ? '내 백색 ≥ 상대 백색' : '내 백색 < 상대 백색',
      };
    }
    case 2: {
      const myProduct = myWhite * myBlack;
      const opProduct = opWhite * opBlack;
      const success = myProduct > opProduct;
      return {
        success,
        scoreChange: success ? 2 : -1,
        conditionDetail: success ? '내 (백×흑) > 상대 (백×흑)' : '내 (백×흑) ≤ 상대 (백×흑)',
      };
    }
    case 3: {
      const threshold = opBlack + 2;
      const success = myWhite >= threshold;
      return {
        success,
        scoreChange: success ? 3 : -1,
        conditionDetail: success ? '내 백색 ≥ 상대 흑색+2' : '내 백색 < 상대 흑색+2',
      };
    }
    case 4: {
      const threshold = opBlack * 2;
      const success = myWhite >= threshold;
      return {
        success,
        scoreChange: success ? 4 : -1,
        conditionDetail: success ? '내 백색 ≥ 상대 흑색×2' : '내 백색 < 상대 흑색×2',
      };
    }
    default:
      return { success: false, scoreChange: -1, conditionDetail: '알 수 없는 넘버' };
  }
}

/** 넘버 합 + 백색 총 수 계산 */
function getTiebreakerData(s: InternalState, player: NF4PlayerInternal) {
  let numberSum = 0;
  let totalWhite = 0;
  for (const record of s.roundHistory) {
    const pr = record.players[player.id];
    if (pr) {
      numberSum += pr.number;
      totalWhite += pr.white;
    }
  }
  return { numberSum, totalWhite };
}

export function tiebreaker(s: InternalState): { winnerId: string; reason: string } {
  const tb1 = getTiebreakerData(s, s.player1);
  const tb2 = getTiebreakerData(s, s.player2);

  if (tb1.numberSum !== tb2.numberSum) {
    const winnerId = tb1.numberSum < tb2.numberSum ? s.player1.id : s.player2.id;
    return {
      winnerId,
      reason: `넘버 합 ${tb1.numberSum} vs ${tb2.numberSum} (낮은 쪽 승리)`,
    };
  }

  if (tb1.totalWhite !== tb2.totalWhite) {
    const winnerId = tb1.totalWhite > tb2.totalWhite ? s.player1.id : s.player2.id;
    return {
      winnerId,
      reason: `백색 타일 총수 ${tb1.totalWhite} vs ${tb2.totalWhite} (많은 쪽 승리)`,
    };
  }

  return {
    winnerId: s.player1.id,
    reason: '완전 동점 (선 플레이어 승리)',
  };
}
