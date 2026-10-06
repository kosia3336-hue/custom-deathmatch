import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import { createNumberFourTutorial } from '@shared/numberFourTutorial.js';
import { INITIAL_SCORE, INITIAL_WHITE, INITIAL_BLACK } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn, NF4PlayerInternal } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startRoundTimer,
  clearGameTimers,
  performNumberFourUndo,
} from './state.js';
import { handleNumberFourTutorial } from './tutorialAdapter.js';
import { buildNumberFourDummyView } from './projection.js';
import { handleSubmit } from './actions.js';

export type { EndGameFn };
export { performNumberFourUndo };

export function initNumberFour(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
  _gameOptions?: Record<string, unknown>,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearGameTimers(prev);
  gameStates.delete(roomId);

  let p1: NF4PlayerInternal;
  let p2: NF4PlayerInternal;

  if (playMode === 'solo') {
    p1 = makePlayer(players[0].id, `${players[0].nickname} (1P)`);
    p2 = makePlayer(players[0].id + '_p2', `${players[0].nickname} (2P)`);
  } else if (playMode === 'tutorial') {
    p1 = makePlayer(players[0].id, players[0].nickname);
    p2 = makePlayer('tutorial_guide', '연습 상대');
  } else {
    p1 = makePlayer(players[0].id, players[0].nickname);
    p2 = makePlayer(players[1].id, players[1].nickname);
  }

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    round: 1,
    phase: 'submit',
    player1: p1,
    player2: p2,
    roundHistory: [],
    winner: null,
    winType: null,
    tiebreakerReason: null,
    startedAt,
    turnStartedAt: Date.now(),
    revealEndsAt: null,
    timeLimitSeconds: playMode === 'tutorial' ? null : timeLimitSeconds,
    tutorialData:
      playMode === 'tutorial' ? createNumberFourTutorial(p1.id, p1.nickname) : undefined,
    roundTimer: null,
    transitionTimer: null,
    playMode,
    gameOver: false,
    actionLog: [],
    currentSide: playMode === 'solo' ? 'player1' : null,
    aiTargetNumber: null,
    undoSnapshots: [],
    aiGeneration: 0,
  });

  const s = gameStates.get(roomId)!;
  startRoundTimer(io, s);
  broadcastState(io, s);
}

function makePlayer(id: string, nickname: string): NF4PlayerInternal {
  return {
    id,
    nickname,
    score: INITIAL_SCORE,
    remainingWhite: INITIAL_WHITE,
    remainingBlack: INITIAL_BLACK,
    submitted: false,
    submittedWhite: null,
    submittedBlack: null,
    submittedNumber: null,
  };
}

export function handleNumberFourAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  if (handleNumberFourTutorial(io, socket, s, data)) return;

  switch (data.type) {
    case 'submit':
      handleSubmit(io, socket, s, data);
      break;
  }
}

export function canNumberFourUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver || s.playMode === 'tutorial') return false;
  const partial =
    s.phase !== 'submit' ||
    s.player1.submitted ||
    s.player2.submitted ||
    s.player1.submittedWhite !== null ||
    s.player2.submittedWhite !== null;
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

export function cleanupNumberFour(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) {
    s.aiGeneration++;
    clearGameTimers(s);
  }
  gameStates.delete(roomId);
}

export function getNumberFourState(roomId: string) {
  return gameStates.get(roomId);
}

/**
 * 더미용 공개 뷰. 사람 game:state 와 같이 상대 잔여 타일·이번 제출은 숨긴다.
 * roundHistory 도 클라처럼 타일 수치 없이 넘버·성공·점수만.
 */
export function getNumberFourDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  return buildNumberFourDummyView(s, viewerId);
}

export function emitNumberFourStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export { getNumberFourResultData } from './state.js';
