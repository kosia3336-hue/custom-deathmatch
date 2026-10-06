import type { InternalState } from './types.js';
import type { IO } from './constants.js';
import type { TypedSocket } from './constants.js';
import { sessions } from '../../../store/sessions.js';
import { advanceNumberFourTutorial } from '@shared/numberFourTutorial.js';
import type { NumberFourAction } from '@shared/types/number4.js';
import { broadcastState } from './broadcast.js';

export function handleNumberFourTutorial(
  io: IO,
  socket: TypedSocket,
  s: InternalState,
  data: Record<string, unknown>,
): boolean {
  if (!s.tutorialData) return false;
  const roomId = s.roomId;
  const myId = sessions.getToken(socket.id) ?? socket.id;
  if (myId !== s.player1.id) {
    socket.emit('error', { message: '튜토리얼은 플레이어만 진행할 수 있습니다.' });
    return true;
  }
  if (data.type !== 'submit' && data.type !== 'tutorial-ack') return true;
  const result = advanceNumberFourTutorial(s.tutorialData, data as NumberFourAction);
  if (result.error) {
    socket.emit('error', { message: result.error });
    return true;
  }
  s.tutorialData = result.data;
  s.round = result.data.round;
  s.phase = result.data.phase;
  for (const player of [s.player1, s.player2])
    Object.assign(player, result.data.players[player.id]);
  broadcastState(io, s);
  if (result.complete) {
    s.gameOver = true;
    s.endGameCallback(io, roomId, {
      rankings: [
        { playerId: s.player1.id, nickname: s.player1.nickname, rank: 1, score: s.player1.score },
      ],
      totalTurns: s.round,
      gameResultData: {
        tutorial: true,
        roundHistory: result.data.roundHistory,
        finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
        players: {
          [s.player1.id]: { nickname: s.player1.nickname },
          [s.player2.id]: { nickname: s.player2.nickname },
        },
      },
    });
  }
  return true;
}
