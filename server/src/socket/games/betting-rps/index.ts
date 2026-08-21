import type { Player, PlayMode } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { BettingRpsAction } from '@shared/types/betting-rps.js';
import { BRPS_TOTAL_ROUNDS } from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import type { EndGameFn } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startRoundTimer,
  clearRoundTimer,
  processRound,
  assignRoles,
  getChoiceRightId,
  makePlayer,
  getPlayer,
  performBettingRpsUndo,
} from './state.js';

export { performBettingRpsUndo };
import { aiSelectRole, aiSubmit } from './ai.js';

export type { EndGameFn };

export function initBettingRps(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearRoundTimer(prev);
  gameStates.delete(roomId);

  const round = 1;
  const p1 = makePlayer(players[0].id, players[0].nickname, round);
  const p2 = makePlayer(players[1].id, players[1].nickname, round);

  // 1라운드는 player1이 선택권
  p1.hasChoiceRight = true;
  p2.hasChoiceRight = false;

  gameStates.set(roomId, {
    endGameCallback,
    roomId,
    round,
    totalRounds: BRPS_TOTAL_ROUNDS,
    phase: 'roleSelect',
    player1: p1,
    player2: p2,
    roundHistory: [],
    winner: null,
    winType: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    roundTimer: null,
    playMode,
    gameOver: false,
    actionLog: [],
    aiGeneration: 0,
    undoSnapshots: [],
  });

  const s = gameStates.get(roomId)!;

  if (playMode === 'com') {
    s.onAITurn = (io, state) => {
      if (getChoiceRightId(state) === AI_PLAYER_ID) {
        aiSelectRole(io, state);
      }
    };
  }

  startRoundTimer(io, s);
  broadcastState(io, s);

  if (playMode === 'com' && getChoiceRightId(s) === AI_PLAYER_ID) {
    aiSelectRole(io, s);
  }
}

export function handleBettingRpsAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;

  const action = data as BettingRpsAction;

  switch (action.type) {
    case 'selectRole':
      handleSelectRole(io, socket, s, action.role);
      break;
    case 'submitMatch':
      handleSubmitMatch(io, socket, s, action.result);
      break;
    case 'submitBet':
      handleSubmitBet(io, socket, s, action.prediction, action.chips);
      break;
  }
}

function handleSelectRole(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  role: unknown,
) {
  if (s.phase !== 'roleSelect') {
    socket.emit('error', { message: '역할 선택 단계가 아닙니다.' });
    return;
  }
  if (role !== 'match' && role !== 'bet') {
    socket.emit('error', { message: '유효하지 않은 역할입니다.' });
    return;
  }
  const myId = sessions.getToken(socket.id) ?? socket.id;
  if (getChoiceRightId(s) !== myId) {
    socket.emit('error', { message: '선택권이 없습니다.' });
    return;
  }

  assignRoles(s, myId, role as 'match' | 'bet');
  s.phase = 'submit';
  broadcastState(io, s);

  if (s.playMode === 'com' && myId !== AI_PLAYER_ID) {
    aiSubmit(io, s);
  }
}

function handleSubmitMatch(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  result: unknown,
) {
  if (s.phase !== 'submit') {
    socket.emit('error', { message: '제출 단계가 아닙니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const player = getPlayer(s, myId);
  if (!player) return;

  if (player.role !== 'match') {
    socket.emit('error', { message: '승부 플레이어가 아닙니다.' });
    return;
  }
  if (player.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }
  if (result !== 'win' && result !== 'draw' && result !== 'lose') {
    socket.emit('error', { message: '유효하지 않은 결과입니다.' });
    return;
  }

  player.matchResult = result as 'win' | 'draw' | 'lose';
  player.submitted = true;

  const other = player.id === s.player1.id ? s.player2 : s.player1;
  if (other.submitted) {
    processRound(io, s);
  } else {
    broadcastState(io, s);
    if (s.playMode === 'com' && myId !== AI_PLAYER_ID) {
      aiSubmit(io, s);
    }
  }
}

function handleSubmitBet(
  io: IO,
  socket: TypedSocket,
  s: import('./types.js').InternalState,
  prediction: unknown,
  chips: unknown,
) {
  if (s.phase !== 'submit') {
    socket.emit('error', { message: '제출 단계가 아닙니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const player = getPlayer(s, myId);
  if (!player) return;

  if (player.role !== 'bet') {
    socket.emit('error', { message: '베팅 플레이어가 아닙니다.' });
    return;
  }
  if (player.submitted) {
    socket.emit('error', { message: '이미 제출했습니다.' });
    return;
  }
  if (prediction !== 'win' && prediction !== 'draw' && prediction !== 'lose') {
    socket.emit('error', { message: '유효하지 않은 예측입니다.' });
    return;
  }
  const minBet = player.chips > 0 ? 1 : 0;
  if (typeof chips !== 'number' || !Number.isInteger(chips) || chips < minBet || chips > player.chips) {
    socket.emit('error', { message: '유효하지 않은 베팅 칩 수입니다.' });
    return;
  }

  player.prediction = prediction as 'win' | 'draw' | 'lose';
  player.betChips = chips;
  player.submitted = true;

  const other = player.id === s.player1.id ? s.player2 : s.player1;
  if (other.submitted) {
    processRound(io, s);
  } else {
    broadcastState(io, s);
    if (s.playMode === 'com' && myId !== AI_PLAYER_ID) {
      aiSubmit(io, s);
    }
  }
}

export function cleanupBettingRps(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearRoundTimer(s);
  gameStates.delete(roomId);
}

export function getBettingRpsState(roomId: string) {
  return gameStates.get(roomId);
}

/**
 * 더미용 공개 뷰. 양측 칩·역할·과거 라운드는 UI와 같이 공개.
 * 이번 라운드 상대 matchResult / prediction / betChips 는 숨김.
 */
export function getBettingRpsDummyView(roomId: string, viewerId: string) {
  const s = gameStates.get(roomId);
  if (!s) return null;
  const me = s.player1.id === viewerId ? s.player1 : s.player2.id === viewerId ? s.player2 : null;
  const opp = me === s.player1 ? s.player2 : me === s.player2 ? s.player1 : null;
  if (!me || !opp) return null;

  return {
    gameOver: s.gameOver,
    phase: s.phase,
    round: s.round,
    totalRounds: s.totalRounds,
    myId: me.id,
    oppId: opp.id,
    my: {
      chips: me.chips,
      role: me.role,
      hasChoiceRight: me.hasChoiceRight,
      submitted: me.submitted,
    },
    opp: {
      chips: opp.chips,
      role: opp.role,
      hasChoiceRight: opp.hasChoiceRight,
      submitted: opp.submitted,
    },
    roundHistory: s.actionLog.map((r) => ({
      round: r.round,
      choiceRightPlayerId: r.choiceRightPlayerId,
      players: Object.fromEntries(
        Object.entries(r.players).map(([pid, pr]) => [
          pid,
          {
            role: pr.role,
            matchResult: pr.matchResult,
            prediction: pr.prediction,
            betChips: pr.betChips,
            betOutcome: pr.betOutcome,
            chipsBefore: pr.chipsBefore,
            chipsAfter: pr.chipsAfter,
            chipChange: pr.chipChange,
          },
        ]),
      ),
    })),
    winner: s.winner,
    turnStartedAt: s.turnStartedAt,
    timeLimitSeconds: s.timeLimitSeconds,
  };
}

export function emitBettingRpsStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function canBettingRpsUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  const partial = s.phase !== 'roleSelect';
  return partial ? s.undoSnapshots.length >= 1 : s.undoSnapshots.length >= 2;
}

export { getBettingRpsResultData } from './state.js';
