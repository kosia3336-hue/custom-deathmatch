import type { InternalState, BRPSRoundActionLog } from './types.js';
import { brpsMatchWinBonus, brpsBetMultiplier } from '@shared/types/betting-rps.js';
import { judgeBet, settleChips } from './judge.js';
import { getChoiceRightId } from './players.js';

export function settleRound(s: InternalState) {
  const matchPlayer = s.player1.role === 'match' ? s.player1 : s.player2;
  const betPlayer = s.player1.role === 'bet' ? s.player1 : s.player2;

  const matchResult = matchPlayer.matchResult!;
  const prediction = betPlayer.prediction!;
  const betChipsAmt = betPlayer.betChips ?? 0;

  const outcome = judgeBet(matchResult, prediction);
  const successMultiplier = brpsBetMultiplier(prediction);
  const chipsBefore = betPlayer.chips;
  betPlayer.chips = settleChips(betPlayer.chips, betChipsAmt, outcome, successMultiplier);
  const chipsAfter = betPlayer.chips;

  const matchBonus = matchResult === 'win' ? brpsMatchWinBonus(s.round) : 0;
  const matchChipsBefore = matchPlayer.chips;
  matchPlayer.chips += matchBonus;
  const matchChipsAfter = matchPlayer.chips;

  const log: BRPSRoundActionLog = {
    round: s.round,
    choiceRightPlayerId: getChoiceRightId(s),
    players: {
      [matchPlayer.id]: {
        nickname: matchPlayer.nickname,
        role: 'match',
        matchResult,
        prediction: null,
        betChips: null,
        betOutcome: null,
        chipsBefore: matchChipsBefore,
        chipsAfter: matchChipsAfter,
        chipChange: matchBonus,
      },
      [betPlayer.id]: {
        nickname: betPlayer.nickname,
        role: 'bet',
        matchResult: null,
        prediction,
        betChips: betChipsAmt,
        betOutcome: outcome,
        chipsBefore,
        chipsAfter,
        chipChange: chipsAfter - chipsBefore,
      },
    },
  };
  s.actionLog.push(log);
}
