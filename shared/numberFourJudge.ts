import { nf4ScoreDelta, type NF4Number } from './types/number4';

export function judgeNumber(
  myWhite: number,
  myBlack: number,
  opWhite: number,
  opBlack: number,
  myNumber: NF4Number,
): { success: boolean; scoreChange: number; conditionDetail: string } {
  switch (myNumber) {
    case 0: {
      const totalBlack = myBlack + opBlack;
      const success = totalBlack >= 11;
      return {
        success,
        scoreChange: nf4ScoreDelta(myNumber, success),
        conditionDetail: success ? '흑색 합계 ≥ 11' : '흑색 합계 < 11',
      };
    }
    case 1: {
      const success = myWhite >= opWhite;
      return {
        success,
        scoreChange: nf4ScoreDelta(myNumber, success),
        conditionDetail: success ? '내 백색 ≥ 상대 백색' : '내 백색 < 상대 백색',
      };
    }
    case 2: {
      const myProduct = myWhite * myBlack;
      const opProduct = opWhite * opBlack;
      const success = myProduct > opProduct;
      return {
        success,
        scoreChange: nf4ScoreDelta(myNumber, success),
        conditionDetail: success ? '내 (백×흑) > 상대 (백×흑)' : '내 (백×흑) ≤ 상대 (백×흑)',
      };
    }
    case 3: {
      const threshold = opBlack + 2;
      const success = myWhite >= threshold;
      return {
        success,
        scoreChange: nf4ScoreDelta(myNumber, success),
        conditionDetail: success ? '내 백색 ≥ 상대 흑색+2' : '내 백색 < 상대 흑색+2',
      };
    }
    case 4: {
      const threshold = opBlack * 2;
      const success = myWhite >= threshold;
      return {
        success,
        scoreChange: nf4ScoreDelta(myNumber, success),
        conditionDetail: success ? '내 백색 ≥ 상대 흑색×2' : '내 백색 < 상대 흑색×2',
      };
    }
    default:
      return { success: false, scoreChange: -1, conditionDetail: '알 수 없는 넘버' };
  }
}
