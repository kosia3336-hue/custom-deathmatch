import { AI_PLAYER_ID } from '@shared/types/room.js';
import { getGames } from '../../../routes/games.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import type {
  IO, BanTurn, BannedGame, BanPickState,
  BanPickStartPayload, BanPickUpdatePayload, BanPickLotteryPayload,
} from './types.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { TypedSocket } from '../../types.js';
import { getBiasTitleInfos } from '../../../shop/biasTitlesCache.js';
import { getRoomShopState } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';

const states = new Map<string, BanPickState>();

// ── 밴 시퀀스 계산 ────────────────────────────────────────────────────────────

function calcBanSequence(banCount: number): BanTurn[] {
  const remaining = [banCount, banCount];
  const sequence: BanTurn[] = [];
  let current = 0;
  let isFirst = true;

  while (remaining[0] > 0 || remaining[1] > 0) {
    if (remaining[current] <= 0) {
      current = 1 - current;
      continue;
    }
    const count = isFirst ? 1 : Math.min(2, remaining[current]);
    sequence.push({ playerIdx: current, count });
    remaining[current] -= count;
    isFirst = false;
    current = 1 - current;
  }

  return sequence;
}

// ── 헬퍼 ─────────────────────────────────────────────────────────────────────

function currentPlayerKey(s: BanPickState): 'first' | 'second' | 'com' {
  const idx = s.sequence[s.currentSequenceIdx]?.playerIdx ?? 0;
  if (s.comIdx === idx) return 'com';
  return idx === 0 ? 'first' : 'second';
}

function getBanCounts(s: BanPickState): [number, number] {
  const counts: [number, number] = [0, 0];
  for (const b of s.bannedGames) {
    if (b.bannedBy === 'first') counts[0]++;
    else counts[1]++;
  }
  return counts;
}

function buildUpdatePayload(s: BanPickState): BanPickUpdatePayload {
  return {
    bannedGames: s.bannedGames,
    currentSequenceIdx: s.currentSequenceIdx,
    bansRemainingInTurn: s.bansRemainingInTurn,
    currentPlayer: currentPlayerKey(s),
    banCounts: getBanCounts(s),
    turnDeadline: s.turnDeadline,
    phase: s.phase === 'done' ? 'lottery' : s.phase,
  };
}

function clearBanTimer(s: BanPickState) {
  if (s.timerHandle) { clearTimeout(s.timerHandle); s.timerHandle = null; }
  if (s.comTimerHandle) { clearTimeout(s.comTimerHandle); s.comTimerHandle = null; }
  s.turnDeadline = null;
}

// ── 타이머 ────────────────────────────────────────────────────────────────────

function startBanTimer(io: IO, roomId: string, s: BanPickState) {
  clearBanTimer(s);

  if (s.timeLimit > 0) {
    s.turnDeadline = Date.now() + s.timeLimit * 1000;
    s.timerHandle = setTimeout(() => {
      handleTimeout(io, roomId);
    }, s.timeLimit * 1000);
  }

  // COM 자동 밴
  const idx = s.sequence[s.currentSequenceIdx]?.playerIdx;
  if (s.comIdx !== null && idx === s.comIdx) {
    const isLastBan = s.bansRemainingInTurn === 1 && s.currentSequenceIdx === s.sequence.length - 1;
    const min = isLastBan ? 2000 : 1500;
    const max = isLastBan ? 3500 : 3000;
    const maxDelay = s.timeLimit > 0 ? s.timeLimit * 1000 - 2000 : Infinity;
    const delay = Math.min(min + Math.random() * (max - min), maxDelay > 0 ? maxDelay : 1000);
    s.comTimerHandle = setTimeout(() => {
      executeCOMBan(io, roomId);
    }, delay);
  }
}

function executeCOMBan(io: IO, roomId: string) {
  const s = states.get(roomId);
  if (!s || s.phase !== 'banning') return;

  const bannedIds = new Set(s.bannedGames.map((b) => b.gameId));
  const available = s.availableGames.filter((g) => !bannedIds.has(g.id));
  if (available.length === 0) return;

  const game = available[Math.floor(Math.random() * available.length)];
  processBan(io, roomId, s, game.id, 'com', false);
}

function handleTimeout(io: IO, roomId: string) {
  const s = states.get(roomId);
  if (!s || s.phase !== 'banning') return;

  const bannedIds = new Set(s.bannedGames.map((b) => b.gameId));
  const available = s.availableGames.filter((g) => !bannedIds.has(g.id));
  if (available.length === 0) return;

  const game = available[Math.floor(Math.random() * available.length)];
  const playerKey = currentPlayerKey(s);
  processBan(io, roomId, s, game.id, playerKey, true);
}

// ── 핵심 밴 처리 ──────────────────────────────────────────────────────────────

function processBan(
  io: IO,
  roomId: string,
  s: BanPickState,
  gameId: string,
  bannedBy: 'first' | 'second' | 'com',
  isTimeout: boolean,
) {
  clearBanTimer(s);

  s.bannedGames.push({
    gameId,
    bannedBy,
    bannedAt: s.bannedGames.length + 1,
    ...(isTimeout && { isTimeout: true }),
  });
  s.bansRemainingInTurn--;

  if (s.bansRemainingInTurn === 0) {
    s.currentSequenceIdx++;
    if (s.currentSequenceIdx >= s.sequence.length) {
      // 모든 밴 완료 → 1.5초 텀 후 추첨
      s.phase = 'lottery';
      io.to(socketRoom(roomId)).emit('banpick:update', buildUpdatePayload(s));
      setTimeout(() => {
        const cur = states.get(roomId);
        if (cur && cur.phase === 'lottery') {
          void executeLottery(io, roomId, cur).catch((err) => {
            console.warn('[banpick] executeLottery 실패:', (err as Error).message);
          });
        }
      }, 1500);
      return;
    }
    s.bansRemainingInTurn = s.sequence[s.currentSequenceIdx].count;
  }

  io.to(socketRoom(roomId)).emit('banpick:update', buildUpdatePayload(s));
  startBanTimer(io, roomId, s);
}

function finalizeBanPick(s: BanPickState, picked: { id: string; name: string }) {
  s.phase = 'done';
  if (s.onBanPickComplete && s.pickedGameId) {
    s.onBanPickComplete({
      bannedGames: s.bannedGames,
      pickedGameId: s.pickedGameId,
      playerIds: s.playerIds,
    });
  }
  s.onGamePicked(picked.id, picked.name);
}

async function executeLottery(io: IO, roomId: string, s: BanPickState) {
  const bannedIds = new Set(s.bannedGames.map((b) => b.gameId));
  const remaining = s.availableGames.filter((g) => !bannedIds.has(g.id));
  if (remaining.length === 0) return;

  // ── 가중치 추첨: 기본 1.0 + (해당 게임을 부스트하는 칭호를 보유한 플레이어 수 × bias_weight)
  // bias 정보는 roomShopState 에 캐시된 boundary titles 와 cache 의 weight 를 합쳐 계산.
  const weights = remaining.map(() => 1);
  const shopState = getRoomShopState(roomId);
  if (shopState && shopState.biasTitlesByToken.size > 0) {
    const allTitleIds = new Set<string>();
    for (const set of shopState.biasTitlesByToken.values()) {
      for (const t of set) allTitleIds.add(t);
    }
    if (allTitleIds.size > 0) {
      try {
        const infos = await getBiasTitleInfos(allTitleIds);
        // 각 player 가 보유한 bias title 별로 weight 가산. CAP 3.0 (=1 base + 2 stack max).
        const BIAS_WEIGHT_CAP = 3.0;
        for (const titles of shopState.biasTitlesByToken.values()) {
          for (const tid of titles) {
            const info = infos.get(tid);
            if (!info) continue;
            const idx = remaining.findIndex((g) => g.id === info.gameId);
            if (idx >= 0) {
              weights[idx] = Math.min(BIAS_WEIGHT_CAP, weights[idx]! + info.weight);
            }
          }
        }
      } catch (err) {
        console.warn('[banpick:lottery] bias 추첨 실패(균등 추첨으로 폴백):', (err as Error).message);
      }
    }
  }

  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  let pickIdx = remaining.length - 1;
  for (let i = 0; i < remaining.length; i++) {
    r -= weights[i]!;
    if (r <= 0) { pickIdx = i; break; }
  }
  const picked = remaining[pickIdx]!;
  s.pickedGameId = picked.id;

  const payload: BanPickLotteryPayload = {
    remainingGameIds: remaining.map((g) => g.id),
    pickedGameId: picked.id,
  };
  io.to(socketRoom(roomId)).emit('banpick:lottery', payload);

  if (s.playMode === 'com') {
    setTimeout(() => {
      const cur = states.get(roomId);
      if (cur && cur.pickedGameId && cur.phase === 'lottery') finalizeBanPick(cur, picked);
    }, 10_000);
  } else {
    setTimeout(() => {
      const cur = states.get(roomId);
      if (cur && cur.pickedGameId && cur.phase === 'lottery') finalizeBanPick(cur, picked);
    }, 12_000);
  }
}

// ── Public API ────────────────────────────────────────────────────────────────

export function initBanPick(
  io: IO,
  roomId: string,
  players: Player[],
  playMode: PlayMode,
  _startedAt: number,
  timeLimitSeconds: number | null,
  _endGameCallback: unknown,
  gameOptions?: Record<string, unknown>,
  onGamePickedCallback?: (gameId: string, gameName: string) => void,
  onBanPickCompleteCallback?: (data: {
    bannedGames: BannedGame[];
    pickedGameId: string;
    playerIds: [string, string];
  }) => void,
) {
  const prev = states.get(roomId);
  if (prev) cleanupBanPick(roomId);

  const allGames = getGames().filter((g) =>
    playMode === 'com' ? g.supportsCom : g.supportsMulti,
  );
  const maxBanCount = Math.floor((allGames.length - 1) / 2);
  const rawBanCount = typeof gameOptions?.banCount === 'number' ? gameOptions.banCount : 3;
  const banCount = Math.max(1, Math.min(rawBanCount, maxBanCount));
  const banTurnOverride =
    typeof gameOptions?.banTurnSeconds === 'number' ? gameOptions.banTurnSeconds : null;
  const timeLimit = banTurnOverride ?? timeLimitSeconds ?? 0;

  const comIdx = players.findIndex((p) => p.id === AI_PLAYER_ID);

  const s: BanPickState = {
    banCount,
    timeLimit,
    availableGames: allGames,
    phase: 'banning',
    sequence: calcBanSequence(banCount),
    currentSequenceIdx: 0,
    bansRemainingInTurn: 0,
    bannedGames: [],
    playerIds: [players[0]?.id ?? '', players[1]?.id ?? ''],
    playMode: playMode as 'multi' | 'com',
    comIdx: comIdx >= 0 ? comIdx : null,
    timerHandle: null,
    turnDeadline: null,
    comTimerHandle: null,
    readyPlayers: new Set(),
    pickedGameId: null,
    onGamePicked: onGamePickedCallback ?? (() => {}),
    onBanPickComplete: onBanPickCompleteCallback,
  };

  s.bansRemainingInTurn = s.sequence[0]?.count ?? 1;
  states.set(roomId, s);

  const buildPayloadFor = (viewerToken: string | null): BanPickStartPayload => {
    const shopState = getRoomShopState(roomId);
    const anon = shopState?.anonymizedTokens ?? new Set<string>();
    const playerView = (idx: number): { id: string; nickname: string } => {
      const p = players[idx];
      const id = p?.id ?? '';
      const nick = p?.nickname ?? '';
      if (id && id !== viewerToken && anon.has(id)) {
        return { id, nickname: ANONYMOUS_NICKNAME };
      }
      return { id, nickname: nick };
    };
    return {
      games: allGames,
      sequence: s.sequence,
      currentSequenceIdx: 0,
      bansRemainingInTurn: s.bansRemainingInTurn,
      currentPlayer: currentPlayerKey(s),
      banCount,
      timeLimit,
      turnDeadline: null,
      bannedGames: [],
      banCounts: [0, 0],
      players: [playerView(0), playerView(1)],
    };
  };

  const shopState = getRoomShopState(roomId);
  if (shopState && shopState.anonymizedTokens.size > 0) {
    const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
    if (sockets) {
      for (const sid of sockets) {
        const t = sessions.getToken(sid) ?? null;
        io.sockets.sockets.get(sid)?.emit('banpick:start', buildPayloadFor(t));
      }
    } else {
      io.to(socketRoom(roomId)).emit('banpick:start', buildPayloadFor(null));
    }
  } else {
    io.to(socketRoom(roomId)).emit('banpick:start', buildPayloadFor(null));
  }

  startBanTimer(io, roomId, s);
}

export function handleBanPickBan(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  gameId: string,
): void {
  const s = states.get(roomId);
  if (!s || s.phase !== 'banning') {
    socket.emit('error', { message: '지금은 밴할 수 없습니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const expectedIdx = s.sequence[s.currentSequenceIdx]?.playerIdx ?? -1;
  const myIdx = s.playerIds.indexOf(myId);

  if (myIdx !== expectedIdx || s.comIdx === myIdx) {
    socket.emit('error', { message: '지금은 당신의 밴 차례가 아닙니다.' });
    return;
  }

  if (!s.availableGames.find((g) => g.id === gameId)) {
    socket.emit('error', { message: '존재하지 않는 게임입니다.' });
    return;
  }
  if (s.bannedGames.some((b) => b.gameId === gameId)) {
    socket.emit('error', { message: '이미 밴된 게임입니다.' });
    return;
  }

  const bannedBy = myIdx === 0 ? 'first' : 'second';
  processBan(io, roomId, s, gameId, bannedBy, false);
}

export function handleBanPickReady(
  io: IO,
  roomId: string,
  playerId: string,
): void {
  const s = states.get(roomId);
  if (!s || s.phase !== 'lottery' || !s.pickedGameId) return;

  s.readyPlayers.add(playerId);

  const humanCount = s.comIdx !== null ? 1 : 2;
  if (s.readyPlayers.size >= humanCount) {
    const picked = s.availableGames.find((g) => g.id === s.pickedGameId);
    if (picked) finalizeBanPick(s, picked);
  }
}

export function emitBanPickStateToSocket(socket: TypedSocket, roomId: string): void {
  const s = states.get(roomId);
  if (!s) return;

  const viewerToken = sessions.getToken(socket.id) ?? null;
  const shopState = getRoomShopState(roomId);
  const anon = shopState?.anonymizedTokens ?? new Set<string>();
  const playerView = (idx: number): { id: string; nickname: string } => {
    const id = s.playerIds[idx] ?? '';
    const baseNick = sessions.getNicknameByToken(id) ?? '';
    if (id && id !== viewerToken && anon.has(id)) {
      return { id, nickname: ANONYMOUS_NICKNAME };
    }
    return { id, nickname: baseNick };
  };

  if (s.phase === 'banning') {
    const payload: BanPickStartPayload = {
      games: s.availableGames,
      sequence: s.sequence,
      currentSequenceIdx: s.currentSequenceIdx,
      bansRemainingInTurn: s.bansRemainingInTurn,
      currentPlayer: currentPlayerKey(s),
      banCount: s.banCount,
      timeLimit: s.timeLimit,
      turnDeadline: s.turnDeadline,
      bannedGames: s.bannedGames,
      banCounts: getBanCounts(s),
      players: [playerView(0), playerView(1)],
    };
    socket.emit('banpick:start', payload);
  } else if (s.phase === 'lottery' && s.pickedGameId) {
    const bannedIds = new Set(s.bannedGames.map((b) => b.gameId));
    const remaining = s.availableGames.filter((g) => !bannedIds.has(g.id));
    socket.emit('banpick:lottery', {
      remainingGameIds: remaining.map((g) => g.id),
      pickedGameId: s.pickedGameId,
    } satisfies BanPickLotteryPayload);
  }
}

export function getBanPickState(roomId: string) {
  const s = states.get(roomId);
  if (!s) return undefined;
  return { gameOver: s.phase === 'done', totalTurns: s.bannedGames.length };
}

export function canBanPickUndo(_roomId: string): boolean {
  return false;
}

export function performBanPickUndo(_io: IO, _roomId: string): boolean {
  return false;
}

export function cleanupBanPick(roomId: string): void {
  const s = states.get(roomId);
  if (!s) return;
  clearBanTimer(s);
  states.delete(roomId);
}
