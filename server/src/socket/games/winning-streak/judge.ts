import {
  wsGetMatchup,
  wsJudgeMatch,
  type WSCardType,
  type WSMatchResult,
} from '@shared/types/winning-streak.js';

export function judgeMatch(
  cardA: WSCardType,
  cardB: WSCardType,
): { resultA: WSMatchResult; resultB: WSMatchResult; description: string } {
  return wsJudgeMatch(cardA, cardB);
}

export function getMatchupResult(cardA: WSCardType, cardB: WSCardType): WSMatchResult {
  return wsGetMatchup(cardA, cardB);
}
