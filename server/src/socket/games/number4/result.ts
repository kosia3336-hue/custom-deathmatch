import type { InternalState } from './types.js';
import type { IO } from './constants.js';
import { WIN_DISPLAY_MS } from './constants.js';
import { broadcastState } from './broadcast.js';
import { gameStates } from './store.js';
import { scheduleTransition } from './timers.js';

export function resolveGame(
  io: IO,
  s: InternalState,
  winnerId: string | null,
  winnerNick: string,
  loserId: string | null,
  loserNick: string,
  winType: InternalState['winType'],
) {
  s.winner = winnerId;
  s.winType = winType;
  s.gameOver = true;
  s.phase = 'finished';
  broadcastState(io, s);

  /* 무승부는 둘 다 1위다 — 자리 순서로 승패를 가르지 않는다 */
  const rankings =
    winnerId && loserId
      ? [
          {
            playerId: winnerId,
            nickname: winnerNick,
            rank: 1,
            score: s.player1.id === winnerId ? s.player1.score : s.player2.score,
          },
          {
            playerId: loserId,
            nickname: loserNick,
            rank: 2,
            score: s.player1.id === loserId ? s.player1.score : s.player2.score,
          },
        ]
      : [
          { playerId: s.player1.id, nickname: s.player1.nickname, rank: 1, score: s.player1.score },
          { playerId: s.player2.id, nickname: s.player2.nickname, rank: 1, score: s.player2.score },
        ];

  const payload = {
    rankings,
    totalTurns: s.round,
    gameResultData: {
      winType: s.winType,
      tiebreakerReason: s.tiebreakerReason,
      finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
      roundHistory: s.roundHistory,
      actions: s.actionLog,
      players: {
        [s.player1.id]: { nickname: s.player1.nickname },
        [s.player2.id]: { nickname: s.player2.nickname },
      },
    },
  };

  scheduleTransition(s, WIN_DISPLAY_MS, () => {
    gameStates.delete(s.roomId);
    s.endGameCallback(io, s.roomId, payload);
  });
}

/* ────────────────────── round processing ─────────────── */
export function getNumberFourResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return {
    ...(s.tutorialData ? { tutorial: true } : {}),
    winType: s.winType,
    tiebreakerReason: s.tiebreakerReason,
    finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
    roundHistory: s.tutorialData?.roundHistory ?? s.roundHistory,
    actions: s.actionLog,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
  };
}
