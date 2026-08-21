import type { GameState } from '@shared/types/events.js';
import {
  FC_TOTAL_ROUNDS,
  type FormulaCompletionArchiveRecord,
  type FormulaCompletionGameData,
} from '@shared/types/formula-completion.js';
import { sessions } from '../../../store/sessions.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { socketRoom } from '../../utils.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import type { FormulaCompletionState } from './types.js';

export const formulaCompletionStates = new Map<string, FormulaCompletionState>();

function maskNickname(s: FormulaCompletionState, viewerId: string | null, playerId: string, nickname: string) {
  return isTokenAnonymized(s.roomId, playerId) && playerId !== viewerId
    ? ANONYMOUS_NICKNAME
    : nickname;
}

export function toFormulaCompletionGameData(
  s: FormulaCompletionState,
  viewerId: string | null,
): FormulaCompletionGameData {
  const [first, second] = s.players;
  return {
    phase: s.phase,
    round: s.round,
    totalRounds: FC_TOTAL_ROUNDS,
    numberCount: s.numberCount,
    numbers: [...s.numbers],
    target: s.target,
    scores: { ...s.scores },
    players: {
      [first.id]: { nickname: maskNickname(s, viewerId, first.id, first.nickname) },
      [second.id]: { nickname: maskNickname(s, viewerId, second.id, second.nickname) },
    },
    roundStartedAt: s.roundStartedAt,
    roundSeconds: s.roundSeconds,
    lastResult: s.lastResult,
    history: [...s.history],
    isSolo: s.playMode === 'solo',
  };
}

function toGameState(s: FormulaCompletionState, gameData: FormulaCompletionGameData): GameState {
  const message = s.phase === 'playing'
    ? `라운드 ${s.round}/${FC_TOTAL_ROUNDS} — 타깃 ${s.target}을(를) 완성하세요!`
    : s.phase === 'reveal'
      ? `라운드 ${s.round} 결과`
      : '게임 종료';

  return {
    roomId: s.roomId,
    message,
    currentTurn: null,
    turnNumber: s.round,
    startedAt: s.startedAt,
    turnStartedAt: s.roundStartedAt,
    gameData: gameData as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(s.roomId),
  };
}

export async function broadcastFormulaCompletionState(io: IO, s: FormulaCompletionState) {
  const sockets = await io.in(socketRoom(s.roomId)).fetchSockets();
  for (const socket of sockets) {
    const playerId = sessions.getToken(socket.id) ?? socket.id;
    const isPlayer = s.players.some((player) => player.id === playerId);
    socket.emit(
      'game:state',
      toGameState(s, toFormulaCompletionGameData(s, isPlayer ? playerId : null)),
    );
  }
}

export function emitFormulaCompletionStateToSocket(socket: TypedSocket, roomId: string) {
  const s = formulaCompletionStates.get(roomId);
  if (!s) return;
  const playerId = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = s.players.some((player) => player.id === playerId);
  socket.emit(
    'game:state',
    toGameState(s, toFormulaCompletionGameData(s, isPlayer ? playerId : null)),
  );
}

export function clearFormulaCompletionTimers(s: FormulaCompletionState) {
  if (s.roundTimer) clearTimeout(s.roundTimer);
  if (s.transitionTimer) clearTimeout(s.transitionTimer);
  s.roundTimer = null;
  s.transitionTimer = null;
}

export function toFormulaCompletionRecord(s: FormulaCompletionState): FormulaCompletionArchiveRecord {
  const [first, second] = s.players;
  return {
    numberCount: s.numberCount,
    finalScores: { ...s.scores },
    history: [...s.history],
    players: {
      [first.id]: { nickname: first.nickname },
      [second.id]: { nickname: second.nickname },
    },
  };
}
