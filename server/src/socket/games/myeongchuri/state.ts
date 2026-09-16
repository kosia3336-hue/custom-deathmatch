import type { GameState } from '@shared/types/events.js';
import type {
  MyeongchuriArchiveRecord,
  MyeongchuriGameData,
  MyeongchuriRoundResult,
} from '@shared/types/myeongchuri.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { sessions } from '../../../store/sessions.js';
import { getActiveSkin } from '../../skins.js';
import type { IO, TypedSocket } from '../../types.js';
import { socketRoom } from '../../utils.js';
import type { MyeongchuriState } from './types.js';

export const myeongchuriStates = new Map<string, MyeongchuriState>();

export function otherMyeongchuriPlayerId(state: MyeongchuriState, playerId: string) {
  return state.players[0].id === playerId ? state.players[1].id : state.players[0].id;
}

function cloneRounds(rounds: MyeongchuriRoundResult[]): MyeongchuriRoundResult[] {
  return rounds.map((round) => ({ ...round, letters: [...round.letters] }));
}

/** 보는 사람 기준 화면 데이터. 타일은 게임이 끝나야 싣는다. */
export function toMyeongchuriGameData(
  state: MyeongchuriState,
  viewerId: string | null,
): MyeongchuriGameData {
  return {
    phase: state.phase,
    round: state.round,
    isSolo: state.playMode === 'solo',
    players: Object.fromEntries(
      state.players.map((player) => [
        player.id,
        { nickname: nicknameForViewer(state.roomId, player.id, player.nickname, viewerId) },
      ]),
    ),
    firstPlayerId: state.firstPlayerId,
    currentPlayerId: state.currentPlayerId,
    picks: [...state.picks],
    rounds: cloneRounds(state.rounds),
    warnings: { ...state.warnings },
    thinkEnabled: state.thinkEnabled,
    thinkSeconds: state.thinkSeconds,
    thinkSkips: [...state.thinkSkips],
    turnSeconds: state.gameOver ? null : state.phaseSeconds,
    turnStartedAt: state.gameOver || state.phaseSeconds == null ? null : state.phaseStartedAt,
    declaration: state.declaration ? { ...state.declaration } : null,
    declarations: state.declarations.map((entry) => ({ ...entry })),
    winnerId: state.winnerId,
    finishReason: state.finishReason,
    tiles: state.gameOver ? { ...state.tiles } : null,
  };
}

function toGameState(state: MyeongchuriState, data: MyeongchuriGameData): GameState {
  const currentName = state.currentPlayerId
    ? (data.players[state.currentPlayerId]?.nickname ?? '플레이어')
    : '';
  const message = state.gameOver
    ? (state.finishReason ?? '게임 종료')
    : state.phase === 'thinking'
      ? `${state.round}라운드 결과 공개 — 생각 시간`
      : state.playMode === 'solo'
        ? /* 혼자 두는 판에서 "나 님이 고르는 중"은 어색하다 — 어느 자리인지를 알린다 */
          `${state.round}라운드 — ${state.phase === 'pick-first' ? '선' : '후'} 자리에 놓을 알파벳을 고르는 중입니다.`
        : `${currentName} 님이 알파벳을 고르는 중입니다.`;
  return {
    roomId: state.roomId,
    message,
    currentTurn: state.gameOver ? null : state.currentPlayerId,
    turnNumber: state.round,
    startedAt: state.startedAt,
    turnStartedAt: data.turnStartedAt,
    gameData: data as unknown as Record<string, unknown>,
    activeSkin: getActiveSkin(state.roomId),
  };
}

function viewerOf(state: MyeongchuriState, socketId: string) {
  const viewerId = sessions.getToken(socketId) ?? socketId;
  return state.players.some((player) => player.id === viewerId) ? viewerId : null;
}

export async function broadcastMyeongchuriState(io: IO, state: MyeongchuriState) {
  const sockets = await io.in(socketRoom(state.roomId)).fetchSockets();
  for (const socket of sockets) {
    socket.emit('game:state', toGameState(state, toMyeongchuriGameData(state, viewerOf(state, socket.id))));
  }
}

export function emitMyeongchuriStateToSocket(socket: TypedSocket, roomId: string) {
  const state = myeongchuriStates.get(roomId);
  if (!state) return;
  socket.emit('game:state', toGameState(state, toMyeongchuriGameData(state, viewerOf(state, socket.id))));
}

export function clearMyeongchuriTimers(state: MyeongchuriState) {
  if (state.phaseTimer) clearTimeout(state.phaseTimer);
  if (state.declarationTimer) clearTimeout(state.declarationTimer);
  if (state.finishTimer) clearTimeout(state.finishTimer);
  state.phaseTimer = null;
  state.declarationTimer = null;
  state.finishTimer = null;
}

export function toMyeongchuriRecord(state: MyeongchuriState): MyeongchuriArchiveRecord {
  return {
    tiles: { ...state.tiles },
    rounds: cloneRounds(state.rounds),
    declarations: state.declarations.map((entry) => ({ ...entry })),
    warnings: { ...state.warnings },
    players: Object.fromEntries(
      state.players.map((player) => [player.id, { nickname: player.nickname }]),
    ),
    firstPlayerId: state.startingPlayerId,
    winnerId: state.winnerId,
    finishReason: state.finishReason ?? '게임 종료',
    isSolo: state.playMode === 'solo',
    thinkEnabled: state.thinkEnabled,
    thinkSeconds: state.thinkSeconds,
  };
}
