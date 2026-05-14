import { AI_PLAYER_ID } from '@shared/types/room.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { FTAction } from '@shared/types/five-towers.js';
import type { IO, TypedSocket } from './constants.js';
import { FT_TOWERS } from './constants.js';
import type { EndGameFn, FTTowerSnapshot, InternalState } from './types.js';
import {
  gameStates,
  broadcastState,
  emitStateToSocket,
  startTurnTimer,
  clearTurnTimer,
  handleAction,
  makePlayer,
  makeTowers,
  performFiveTowersUndo,
  handleFiveTowersLeave,
  getFiveTowersResultData,
} from './state.js';
import { aiAct } from './ai.js';

export { performFiveTowersUndo, handleFiveTowersLeave, getFiveTowersResultData };
export type { EndGameFn };

export function initFiveTowers(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: EndGameFn,
) {
  const prev = gameStates.get(roomId);
  if (prev) clearTurnTimer(prev);
  gameStates.delete(roomId);

  const p1 = makePlayer(players[0].id, players[0].nickname);
  const p2 = makePlayer(players[1].id, players[1].nickname);
  const firstPlayerId = p1.id;
  const towers = makeTowers([p1.id, p2.id]);

  const s: InternalState = {
    endGameCallback,
    roomId,
    turn: 1,
    phase: 'turn',
    firstPlayerId,
    currentPlayerId: firstPlayerId,
    player1: p1,
    player2: p2,
    towers,
    infoResults: { [p1.id]: [], [p2.id]: [] },
    secretLog: { [p1.id]: [], [p2.id]: [] },
    actionLog: [],
    milestoneLog: [],
    winner: null,
    winType: null,
    finishReason: null,
    startedAt,
    turnStartedAt: Date.now(),
    timeLimitSeconds,
    turnTimer: null,
    playMode,
    gameOver: false,
    aiGeneration: 0,
    undoSnapshots: [],
    consecutiveTimeouts: { [p1.id]: 0, [p2.id]: 0 },
  };

  gameStates.set(roomId, s);

  if (playMode === 'com') {
    s.onAITurn = (io2, st) => {
      if (st.currentPlayerId === AI_PLAYER_ID) aiAct(io2, st);
    };
  }

  // 초기 스냅샷
  s.undoSnapshots.push(snapshotInit(s));

  startTurnTimer(io, s);
  void broadcastState(io, s);

  if (playMode === 'com' && s.currentPlayerId === AI_PLAYER_ID) {
    aiAct(io, s);
  }
}

function snapshotInit(s: InternalState) {
  // state.ts 의 pushUndoSnapshot 과 동일한 모양 — 직접 호출하지 않고 직렬화
  const towers = {} as Record<import('@shared/types/five-towers.js').FTTower, FTTowerSnapshot>;
  for (const id of FT_TOWERS) {
    const t = s.towers[id];
    towers[id] = {
      height: t.height,
      completed: t.completed,
      completedBy: t.completedBy,
      halfReached: t.halfReached,
      contributions: { ...t.contributions },
    };
  }
  return {
    turn: s.turn,
    phase: s.phase,
    currentPlayerId: s.currentPlayerId,
    player1: {
      score: s.player1.score,
      myStackedHeights: { ...s.player1.myStackedHeights },
      itemUsed: s.player1.itemUsed,
      itemUsedKind: s.player1.itemUsedKind,
      itemUsedTurn: s.player1.itemUsedTurn,
      itemUsedDetail: s.player1.itemUsedDetail,
    },
    player2: {
      score: s.player2.score,
      myStackedHeights: { ...s.player2.myStackedHeights },
      itemUsed: s.player2.itemUsed,
      itemUsedKind: s.player2.itemUsedKind,
      itemUsedTurn: s.player2.itemUsedTurn,
      itemUsedDetail: s.player2.itemUsedDetail,
    },
    towers,
    actionLog: [],
    milestoneLog: [],
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
    player1Info: [],
    player2Info: [],
    player1Secret: [],
    player2Secret: [],
  };
}

export function handleFiveTowersAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  data: Record<string, unknown>,
) {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return;
  const myId = sessions.getToken(socket.id) ?? socket.id;
  const action = data as FTAction;
  handleAction(io, socket, s, myId, action);
}

export function cleanupFiveTowers(roomId: string) {
  const s = gameStates.get(roomId);
  if (s) clearTurnTimer(s);
  gameStates.delete(roomId);
}

export function getFiveTowersState(roomId: string) {
  return gameStates.get(roomId);
}

export function emitFiveTowersStateToSocket(socket: TypedSocket, roomId: string) {
  const s = gameStates.get(roomId);
  if (!s) return;
  emitStateToSocket(socket, s);
}

export function canFiveTowersUndo(roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  return s.undoSnapshots.length >= 2;
}
