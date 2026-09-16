/**
 * 명추리 진행.
 *
 * 한 라운드: 선이 알파벳 2개(수식 앞 두 칸) → 후가 2개(뒤 두 칸) → 결과 공개 → 생각 시간(켜져 있으면)
 * → 선후를 바꿔 다음 라운드. 명추리는 언제든 선언할 수 있고, 선언해도 진행 시간은 계속 흐르되 10초를 더 준다.
 */
import {
  checkMyeongchuriAnswer,
  dealMyeongchuriTiles,
  evaluateMyeongchuri,
  isMyeongchuriLetter,
  isMyeongchuriToken,
  randomMyeongchuriLetters,
  resolveMyeongchuriOptions,
} from '@shared/logic/myeongchuri.js';
import {
  MYEONGCHURI_DECLARE_BONUS_SECONDS,
  MYEONGCHURI_DECLARE_SECONDS,
  MYEONGCHURI_LETTERS,
  MYEONGCHURI_LETTERS_PER_PICK,
  MYEONGCHURI_MAX_WARNINGS,
  type MyeongchuriLetter,
} from '@shared/types/myeongchuri.js';
import { AI_PLAYER_ID, type Player, type PlayMode } from '@shared/types/room.js';
import { sessions } from '../../../store/sessions.js';
import type { IO, TypedSocket } from '../../types.js';
import {
  broadcastMyeongchuriState,
  clearMyeongchuriTimers,
  emitMyeongchuriStateToSocket,
  myeongchuriStates,
  otherMyeongchuriPlayerId,
  toMyeongchuriRecord,
} from './state.js';
import type { MyeongchuriEndGameFn, MyeongchuriState } from './types.js';

const FINISH_DISPLAY_MS = 3000;

function isLive(state: MyeongchuriState) {
  return myeongchuriStates.get(state.roomId) === state && !state.gameOver;
}

function nicknameOf(state: MyeongchuriState, playerId: string) {
  return state.players.find((player) => player.id === playerId)?.nickname ?? '플레이어';
}

function armPhaseTimer(state: MyeongchuriState, milliseconds: number) {
  if (state.phaseTimer) clearTimeout(state.phaseTimer);
  state.phaseTimer = setTimeout(() => {
    state.phaseTimer = null;
    if (!isLive(state)) return;
    state.phaseExpire?.();
  }, Math.max(0, milliseconds));
}

/** 진행 시간(고르기·생각)을 새로 건다. seconds 가 null 이면 무제한. */
function startPhaseTimer(state: MyeongchuriState, seconds: number | null, onExpire: () => void) {
  if (state.phaseTimer) clearTimeout(state.phaseTimer);
  state.phaseTimer = null;
  state.phaseStartedAt = Date.now();
  state.phaseSeconds = seconds;
  state.phaseExpire = onExpire;
  if (seconds != null) armPhaseTimer(state, seconds * 1000);
}

function startRound(io: IO, state: MyeongchuriState) {
  state.phase = 'pick-first';
  state.picks = [];
  state.randomFirst = false;
  state.thinkSkips.clear();
  state.currentPlayerId = state.firstPlayerId;
  startPhaseTimer(state, state.pickSeconds, () => pickAtRandom(io, state));
  void broadcastMyeongchuriState(io, state);
}

function nextRound(io: IO, state: MyeongchuriState) {
  state.round += 1;
  state.firstPlayerId = otherMyeongchuriPlayerId(state, state.firstPlayerId);
  startRound(io, state);
}

/** 고르는 시간이 끝나면 이번 수식에 아직 없는 알파벳에서 무작위로 놓는다. */
function pickAtRandom(io: IO, state: MyeongchuriState) {
  if (!state.currentPlayerId) return;
  if (state.phase !== 'pick-first' && state.phase !== 'pick-second') return;
  applyPick(io, state, randomMyeongchuriLetters(state.picks, MYEONGCHURI_LETTERS_PER_PICK), true);
}

function applyPick(io: IO, state: MyeongchuriState, letters: MyeongchuriLetter[], random: boolean) {
  if (state.phase === 'pick-first') {
    state.picks = [...letters];
    state.randomFirst = random;
    state.phase = 'pick-second';
    state.currentPlayerId = otherMyeongchuriPlayerId(state, state.firstPlayerId);
    startPhaseTimer(state, state.pickSeconds, () => pickAtRandom(io, state));
    void broadcastMyeongchuriState(io, state);
    return;
  }
  state.picks = [...state.picks, ...letters];
  resolveRound(io, state, random);
}

function resolveRound(io: IO, state: MyeongchuriState, randomSecond: boolean) {
  const evaluation = evaluateMyeongchuri(state.picks.map((letter) => state.tiles[letter]));
  state.rounds.push({
    round: state.round,
    firstPlayerId: state.firstPlayerId,
    secondPlayerId: otherMyeongchuriPlayerId(state, state.firstPlayerId),
    letters: [...state.picks],
    value: evaluation.value,
    hidden: evaluation.hidden,
    randomFirst: state.randomFirst,
    randomSecond,
  });
  state.currentPlayerId = null;
  if (!state.thinkEnabled) {
    nextRound(io, state);
    return;
  }
  state.phase = 'thinking';
  state.thinkSkips.clear();
  startPhaseTimer(state, state.thinkSeconds, () => nextRound(io, state));
  void broadcastMyeongchuriState(io, state);
}

function validatePick(
  state: MyeongchuriState,
  actorId: string,
  raw: unknown,
): MyeongchuriLetter[] | string {
  if (state.phase !== 'pick-first' && state.phase !== 'pick-second') {
    return '지금은 알파벳을 고르는 시간이 아닙니다.';
  }
  if (actorId !== state.currentPlayerId) return '상대가 고르는 차례입니다.';
  if (
    !Array.isArray(raw) ||
    raw.length !== MYEONGCHURI_LETTERS_PER_PICK ||
    !raw.every(isMyeongchuriLetter)
  ) {
    return `알파벳 ${MYEONGCHURI_LETTERS_PER_PICK}개를 골라야 합니다.`;
  }
  const letters = raw as MyeongchuriLetter[];
  if (new Set(letters).size !== letters.length || letters.some((letter) => state.picks.includes(letter))) {
    return '한 수식에 같은 알파벳을 두 번 쓸 수 없습니다.';
  }
  return letters;
}

function skipThink(io: IO, state: MyeongchuriState, actorId: string) {
  if (state.phase !== 'thinking') return '생각 시간이 아닙니다.';
  state.thinkSkips.add(actorId);
  // 두 사람이 모두 동의해야 넘어간다
  if (state.players.every((player) => state.thinkSkips.has(player.id))) {
    nextRound(io, state);
    return null;
  }
  void broadcastMyeongchuriState(io, state);
  return null;
}

function declare(io: IO, state: MyeongchuriState, actorId: string) {
  if (state.declaration) return '이미 명추리가 진행 중입니다.';
  state.declaration = {
    playerId: actorId,
    deadline: Date.now() + MYEONGCHURI_DECLARE_SECONDS * 1000,
  };
  state.declarationTimer = setTimeout(() => {
    state.declarationTimer = null;
    if (!isLive(state) || state.declaration?.playerId !== actorId) return;
    resolveDeclaration(io, state, actorId, null);
  }, MYEONGCHURI_DECLARE_SECONDS * 1000);
  // 선언해도 진행 시간은 계속 흐르되 10초를 더 준다
  if (state.phaseTimer && state.phaseStartedAt != null && state.phaseSeconds != null) {
    state.phaseSeconds += MYEONGCHURI_DECLARE_BONUS_SECONDS;
    armPhaseTimer(state, state.phaseStartedAt + state.phaseSeconds * 1000 - Date.now());
  }
  void broadcastMyeongchuriState(io, state);
  return null;
}

function submitAnswer(io: IO, state: MyeongchuriState, actorId: string, raw: unknown) {
  if (!state.declaration || state.declaration.playerId !== actorId) {
    return '명추리를 선언한 사람만 답을 낼 수 있습니다.';
  }
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return '모든 알파벳의 숫자·기호를 골라야 합니다.';
  }
  const answer = raw as Record<string, unknown>;
  if (!MYEONGCHURI_LETTERS.every((letter) => isMyeongchuriToken(answer[letter]))) {
    return '모든 알파벳의 숫자·기호를 골라야 합니다.';
  }
  resolveDeclaration(io, state, actorId, answer);
  return null;
}

/** 명추리 판정. answer 가 null 이면 제출 시간 초과(오답). 실패해도 진행 차례는 그대로 둔다. */
function resolveDeclaration(
  io: IO,
  state: MyeongchuriState,
  actorId: string,
  answer: Record<string, unknown> | null,
) {
  if (state.declarationTimer) clearTimeout(state.declarationTimer);
  state.declarationTimer = null;
  state.declaration = null;
  const success = answer != null && checkMyeongchuriAnswer(state.tiles, answer);
  state.declarations.push({ round: state.round, playerId: actorId, success, timedOut: answer == null });
  if (success) {
    finishGame(io, state, actorId, `${nicknameOf(state, actorId)} 님이 명추리에 성공했습니다.`);
    return;
  }
  state.warnings[actorId] = (state.warnings[actorId] ?? 0) + 1;
  if (state.warnings[actorId] >= MYEONGCHURI_MAX_WARNINGS) {
    /* 솔로는 이길 상대가 없다 — 승자 없이 끝낸다 */
    if (state.playMode === 'solo') {
      finishGame(io, state, null, `명추리에 ${MYEONGCHURI_MAX_WARNINGS}번 실패해 게임이 끝났습니다.`);
      return;
    }
    const winnerId = otherMyeongchuriPlayerId(state, actorId);
    finishGame(
      io,
      state,
      winnerId,
      `${nicknameOf(state, actorId)} 님이 명추리에 ${MYEONGCHURI_MAX_WARNINGS}번 실패해 ${nicknameOf(state, winnerId)} 님이 승리했습니다.`,
    );
    return;
  }
  void broadcastMyeongchuriState(io, state);
}

/** 순위. 솔로는 한 줄만 — 명추리에 성공하면 1점, 경고 2회로 끝나면 0점. */
function rankingsFor(state: MyeongchuriState, winnerId: string | null) {
  const [first, second] = state.players;
  if (state.playMode === 'solo') {
    return [{ playerId: first.id, nickname: first.nickname, rank: 1, score: winnerId ? 1 : 0 }];
  }
  const winner = first.id === winnerId ? first : second;
  const loser = winner.id === first.id ? second : first;
  return [
    { playerId: winner.id, nickname: winner.nickname, rank: 1, score: 1 },
    { playerId: loser.id, nickname: loser.nickname, rank: 2, score: 0 },
  ];
}

function finishGame(io: IO, state: MyeongchuriState, winnerId: string | null, reason: string) {
  if (state.gameOver) return;
  clearMyeongchuriTimers(state);
  state.gameOver = true;
  state.phase = 'finished';
  state.currentPlayerId = null;
  state.declaration = null;
  state.phaseExpire = null;
  state.winnerId = winnerId;
  state.finishReason = reason;
  void broadcastMyeongchuriState(io, state);

  const payload = {
    rankings: rankingsFor(state, winnerId),
    totalTurns: state.rounds.length,
    gameResultData: toMyeongchuriRecord(state),
  };
  state.finishTimer = setTimeout(() => {
    if (myeongchuriStates.get(state.roomId) !== state) return;
    myeongchuriStates.delete(state.roomId);
    state.endGameCallback(io, state.roomId, payload);
  }, FINISH_DISPLAY_MS);
}

export function performMyeongchuriAction(
  io: IO,
  state: MyeongchuriState,
  actorId: string,
  rawData: Record<string, unknown>,
): string | null {
  switch (rawData.type) {
    case 'pick': {
      const letters = validatePick(state, actorId, rawData.letters);
      if (typeof letters === 'string') return letters;
      applyPick(io, state, letters, false);
      return null;
    }
    case 'skip-think':
      return skipThink(io, state, actorId);
    case 'declare':
      return declare(io, state, actorId);
    case 'answer':
      return submitAnswer(io, state, actorId, rawData.answer);
    default:
      return '알 수 없는 행동입니다.';
  }
}

export function initMyeongchuri(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  startedAt: number,
  timeLimitSeconds: number | null,
  endGameCallback: MyeongchuriEndGameFn,
  gameOptions: Record<string, unknown> = {},
) {
  const previous = myeongchuriStates.get(roomId);
  if (previous) clearMyeongchuriTimers(previous);
  myeongchuriStates.delete(roomId);
  const first = players[0];
  if (!first) throw new Error('명추리를 시작할 플레이어가 필요합니다.');
  /* 1:1 솔로 — 한 사람이 선·후 두 자리를 모두 둔다(수식완성N·나이트의 여행과 같은 방식) */
  const isSolo = playMode === 'solo';
  const second = isSolo ? first : players[1];
  if (!second) throw new Error('멀티 명추리에는 두 명의 플레이어가 필요합니다.');
  const options = resolveMyeongchuriOptions(gameOptions);

  const state: MyeongchuriState = {
    roomId,
    playMode,
    players: [first, second],
    tiles: dealMyeongchuriTiles(),
    phase: 'pick-first',
    round: 1,
    startingPlayerId: first.id,
    firstPlayerId: first.id,
    currentPlayerId: first.id,
    picks: [],
    randomFirst: false,
    rounds: [],
    warnings: { [first.id]: 0, [second.id]: 0 },
    pickSeconds: timeLimitSeconds != null && timeLimitSeconds > 0 ? timeLimitSeconds : null,
    // 혼자 두는 판에서는 결과를 보고 쉬어 갈 상대가 없다 — 생각 시간을 두지 않는다
    thinkEnabled: isSolo ? false : options.thinkEnabled,
    thinkSeconds: options.thinkSeconds,
    thinkSkips: new Set(),
    phaseStartedAt: null,
    phaseSeconds: null,
    phaseTimer: null,
    phaseExpire: null,
    declaration: null,
    declarationTimer: null,
    declarations: [],
    winnerId: null,
    finishReason: null,
    gameOver: false,
    startedAt,
    finishTimer: null,
    endGameCallback,
  };
  myeongchuriStates.set(roomId, state);
  startRound(io, state);
}

export function handleMyeongchuriAction(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  rawData: Record<string, unknown>,
) {
  const state = myeongchuriStates.get(roomId);
  if (!state || state.gameOver) return;
  const actorId = sessions.getToken(socket.id) ?? socket.id;
  if (!state.players.some((player) => player.id === actorId) || actorId === AI_PLAYER_ID) return;
  const error = performMyeongchuriAction(io, state, actorId, rawData);
  if (error) socket.emit('error', { message: error });
}

export function cleanupMyeongchuri(roomId: string) {
  const state = myeongchuriStates.get(roomId);
  if (state) clearMyeongchuriTimers(state);
  myeongchuriStates.delete(roomId);
}

export function getMyeongchuriState(roomId: string) {
  const state = myeongchuriStates.get(roomId);
  return state ? { gameOver: state.gameOver, totalTurns: state.rounds.length } : undefined;
}

export function getMyeongchuriResultData(roomId: string) {
  const state = myeongchuriStates.get(roomId);
  return state ? toMyeongchuriRecord(state) : undefined;
}

export function performMyeongchuriUndo(): boolean {
  return false;
}

export function canMyeongchuriUndo(): boolean {
  return false;
}

export { emitMyeongchuriStateToSocket };
