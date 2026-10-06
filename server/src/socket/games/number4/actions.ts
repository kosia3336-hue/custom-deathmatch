import { AI_PLAYER_ID } from '@shared/types/room.js';
import { validateNumberFourSubmission } from '@shared/numberFourSubmission.js';
import { sessions } from '../../../store/sessions.js';
import { TILES_PER_ROUND, type IO, type TypedSocket } from './constants.js';
import type { InternalState, NF4PlayerInternal } from './types.js';
import { processRound } from './round.js';
import { broadcastState } from './broadcast.js';
import { aiSubmit } from './ai.js';

export function handleSubmit(
  io: IO,
  socket: TypedSocket,
  s: InternalState,
  data: Record<string, unknown>,
) {
  if (s.phase !== 'submit') {
    socket.emit('error', { message: '현재 단계에서는 수행할 수 없습니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const player = getActionPlayer(s, myId);
  if (!player) return;
  if (player.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }
  const check = validateNumberFourSubmission(data.white, data.black, data.number, player);
  if (!check.ok) {
    const message = {
      type: null,
      sum: `백색과 흑색 타일의 합이 ${TILES_PER_ROUND}개여야 합니다.`,
      number: '0~4 사이의 넘버를 선택해 주세요.',
      stock: '보유한 타일 수를 초과했습니다.',
    }[check.reason];
    if (message) socket.emit('error', { message });
    return;
  }
  const { white, black, number: num } = check.submission;

  player.submittedWhite = white;
  player.submittedBlack = black;
  player.submittedNumber = num;
  player.submitted = true;

  if (s.playMode === 'solo') {
    if (s.currentSide === 'player1') {
      s.currentSide = 'player2';
      broadcastState(io, s);
      return;
    } else {
      s.currentSide = null;
    }
  }

  if (s.player1.submitted && s.player2.submitted) {
    processRound(io, s);
    return;
  }

  broadcastState(io, s);

  if (s.playMode === 'com' && myId !== AI_PLAYER_ID) {
    aiSubmit(io, s);
  }
}

function getActionPlayer(s: InternalState, socketId: string): NF4PlayerInternal | null {
  if (s.playMode === 'solo') {
    if (socketId !== s.player1.id) return null;
    return s.currentSide === 'player1' ? s.player1 : s.player2;
  }
  if (s.player1.id === socketId) return s.player1;
  if (s.player2.id === socketId) return s.player2;
  return null;
}
