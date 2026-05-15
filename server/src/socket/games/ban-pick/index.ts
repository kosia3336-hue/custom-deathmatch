import { AI_PLAYER_ID } from '@shared/types/room.js';
import { getGames } from '../../../routes/games.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import type {
  IO, BanTurn, BannedGame, BanPickState,
  BanPickStartPayload, BanPickUpdatePayload, BanPickLotteryPayload,
  BanPickUnbanTurnPayload, BanPickUnbanUpdatePayload,
  GameWinRate,
} from './types.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { TypedSocket } from '../../types.js';
import { getBiasTitleInfos } from '../../../shop/biasTitlesCache.js';
import { getRoomShopState } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { getSupabaseAdmin } from '../../../db/supabase.js';

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

function clearUnbanTimer(s: BanPickState) {
  if (s.unbanTimerHandle) { clearTimeout(s.unbanTimerHandle); s.unbanTimerHandle = null; }
  s.unbanTurnDeadline = null;
}

// ── 밴 타이머 ─────────────────────────────────────────────────────────────────

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
      // 모든 밴 완료 → lottery phase로 전환하고 클라에 알림
      s.phase = 'lottery';
      io.to(socketRoom(roomId)).emit('banpick:update', buildUpdatePayload(s));

      // 안전망: 1.5초 후 아직 lottery 상태면 바로 추첨 (ban_eraser 체크가 실패한 경우 대비)
      setTimeout(() => {
        const cur = states.get(roomId);
        if (cur && cur.phase === 'lottery') {
          void executeLottery(io, roomId, cur).catch((err) => {
            console.warn('[banpick] executeLottery 실패:', (err as Error).message);
          });
        }
      }, 1500);

      // ban_eraser 보유 여부 비동기 확인 — 있으면 unban phase로 전환
      void checkAndStartUnbanPhase(io, roomId).catch((err) => {
        console.warn('[banpick] ban_eraser 확인 실패(lottery 진행):', (err as Error).message);
      });

      return;
    }
    s.bansRemainingInTurn = s.sequence[s.currentSequenceIdx].count;
  }

  io.to(socketRoom(roomId)).emit('banpick:update', buildUpdatePayload(s));
  startBanTimer(io, roomId, s);
}

// ── 노밴 처리 ─────────────────────────────────────────────────────────────────

function processNoBan(
  io: IO,
  roomId: string,
  s: BanPickState,
  byKey: 'first' | 'second',
): void {
  clearBanTimer(s);

  s.bansRemainingInTurn--;

  if (s.bansRemainingInTurn === 0) {
    s.currentSequenceIdx++;
    if (s.currentSequenceIdx >= s.sequence.length) {
      // 모든 슬롯 소모 완료 → lottery 전환
      s.phase = 'lottery';
      io.to(socketRoom(roomId)).emit('banpick:update', { ...buildUpdatePayload(s), lastNobanBy: byKey });

      setTimeout(() => {
        const cur = states.get(roomId);
        if (cur && cur.phase === 'lottery') {
          void executeLottery(io, roomId, cur).catch((err) => {
            console.warn('[banpick] executeLottery 실패:', (err as Error).message);
          });
        }
      }, 1500);

      void checkAndStartUnbanPhase(io, roomId).catch((err) => {
        console.warn('[banpick] ban_eraser 확인 실패(lottery 진행):', (err as Error).message);
      });
      return;
    }
    s.bansRemainingInTurn = s.sequence[s.currentSequenceIdx].count;
  }

  io.to(socketRoom(roomId)).emit('banpick:update', { ...buildUpdatePayload(s), lastNobanBy: byKey });
  startBanTimer(io, roomId, s);
}

// ── 추첨 ──────────────────────────────────────────────────────────────────────

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

// ── 돋보기: 상대 전적 조회 ────────────────────────────────────────────────────

async function fetchOpponentGameStats(memberId: string): Promise<GameWinRate[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('member_game_stats')
      .select('game_id, total_games, wins, losses, draws')
      .eq('member_id', memberId);
    if (!data) return [];
    return (data as Array<{ game_id: string; total_games: number; wins: number; losses: number; draws: number }>)
      .filter((r) => r.total_games > 0)
      .map((r) => ({
        gameId: r.game_id,
        totalGames: r.total_games,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        winRate: Math.round((r.wins + r.draws * 0.5) / r.total_games * 1000) / 10,
      }));
  } catch {
    return [];
  }
}

// ── 밴 삭제: 인벤토리 확인 및 phase 전환 ─────────────────────────────────────

async function checkAndStartUnbanPhase(io: IO, roomId: string): Promise<void> {
  const s = states.get(roomId);
  if (!s || s.phase !== 'lottery') return;

  // 후플(second) 먼저, 선플(first) 순으로 ban_eraser 보유 확인
  const sb = getSupabaseAdmin();
  const queue: Array<'first' | 'second'> = [];

  for (const pos of ['second', 'first'] as const) {
    const memberId = s.playerMemberIds[pos === 'first' ? 0 : 1];
    if (!memberId) continue;
    try {
      const { data } = await sb
        .from('shop_consumable_inventory')
        .select('count')
        .eq('member_id', memberId)
        .eq('kind', 'ban_eraser')
        .maybeSingle();
      const count = Number((data as { count?: number } | null)?.count ?? 0);
      if (count > 0) queue.push(pos);
    } catch {
      // 조회 실패 시 해당 플레이어는 스킵
    }
  }

  // await 후 상태 재확인 — 1.5초 타이머가 먼저 터졌다면 이미 lottery 진행 중
  const cur = states.get(roomId);
  if (!cur || cur.phase !== 'lottery') return;

  if (queue.length === 0) return; // 보유자 없음 → lottery 타이머가 자연스럽게 진행

  // unban phase 진입 — lottery 타이머 체크가 phase !== 'lottery'로 막힘
  cur.phase = 'unban';
  cur.unbanQueue = queue;
  cur.unbanQueueIdx = 0;

  emitNextUnbanTurn(io, roomId, cur);
}

function getErasableGames(s: BanPickState, turn: 'first' | 'second') {
  const opponentKey = turn === 'first' ? 'second' : 'first';
  return s.bannedGames.filter((b) => b.bannedBy === opponentKey);
}

function emitNextUnbanTurn(io: IO, roomId: string, s: BanPickState): void {
  // 큐 소진 시 lottery로 진행
  if (s.unbanQueueIdx >= s.unbanQueue.length) {
    s.phase = 'lottery';
    void executeLottery(io, roomId, s).catch((err) => {
      console.warn('[banpick:unban] executeLottery 실패:', (err as Error).message);
    });
    return;
  }

  const currentTurn = s.unbanQueue[s.unbanQueueIdx]!;
  const erasableGames = getErasableGames(s, currentTurn);

  // 지울 수 있는 게임이 없으면 자동 스킵
  if (erasableGames.length === 0) {
    s.unbanQueueIdx++;
    emitNextUnbanTurn(io, roomId, s);
    return;
  }

  const deadline = Date.now() + 15_000;
  s.unbanTurnDeadline = deadline;
  s.unbanTimerHandle = setTimeout(() => handleUnbanTimeout(io, roomId), 15_000);

  const payload: BanPickUnbanTurnPayload = {
    queue: s.unbanQueue,
    currentTurn,
    erasableGames,
    turnDeadline: deadline,
  };
  io.to(socketRoom(roomId)).emit('banpick:unban_turn', payload);
}

function handleUnbanTimeout(io: IO, roomId: string): void {
  const s = states.get(roomId);
  if (!s || s.phase !== 'unban') return;
  // 타임아웃 = 스킵 (아이템 소모 없음)
  advanceUnbanQueue(io, roomId, s, null);
}

function advanceUnbanQueue(
  io: IO,
  roomId: string,
  s: BanPickState,
  erasedGameId: string | null,
): void {
  clearUnbanTimer(s);

  const erasedBy = erasedGameId ? s.unbanQueue[s.unbanQueueIdx] ?? null : null;

  if (erasedGameId) {
    s.bannedGames = s.bannedGames.filter((b) => b.gameId !== erasedGameId);
  }

  s.unbanQueueIdx++;

  const nextTurn = s.unbanQueueIdx < s.unbanQueue.length ? s.unbanQueue[s.unbanQueueIdx] ?? null : null;

  const update: BanPickUnbanUpdatePayload = {
    currentTurn: nextTurn,
    erasedGameId,
    erasedBy,
    turnDeadline: null,
  };
  io.to(socketRoom(roomId)).emit('banpick:unban_update', update);

  emitNextUnbanTurn(io, roomId, s);
}

// ── Public API ────────────────────────────────────────────────────────────────

export async function initBanPick(
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
    playerMemberIds: [players[0]?.memberId ?? null, players[1]?.memberId ?? null],
    playMode: playMode as 'multi' | 'com',
    comIdx: comIdx >= 0 ? comIdx : null,
    timerHandle: null,
    turnDeadline: null,
    comTimerHandle: null,
    readyPlayers: new Set(),
    pickedGameId: null,
    onGamePicked: onGamePickedCallback ?? (() => {}),
    onBanPickComplete: onBanPickCompleteCallback,
    magnifierStatsMap: new Map(),
    unbanQueue: [],
    unbanQueueIdx: 0,
    unbanTimerHandle: null,
    unbanTurnDeadline: null,
  };

  s.bansRemainingInTurn = s.sequence[0]?.count ?? 1;
  states.set(roomId, s);

  // 돋보기 사용자별 상대 전적 pre-fetch
  const shopState = getRoomShopState(roomId);
  if (shopState && shopState.magnifierTokens.size > 0) {
    for (let i = 0; i < players.length; i++) {
      const p = players[i];
      if (!p?.id || !shopState.magnifierTokens.has(p.id)) continue;
      const opp = players[1 - i];
      if (!opp?.memberId) continue;
      const stats = await fetchOpponentGameStats(opp.memberId);
      s.magnifierStatsMap.set(p.id, stats);
    }
  }

  const buildPayloadFor = (viewerToken: string | null): BanPickStartPayload => {
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
    const opponentGameStats = viewerToken ? s.magnifierStatsMap.get(viewerToken) : undefined;
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
      opponentGameStats,
    };
  };

  const needsPerSocket =
    (shopState?.anonymizedTokens.size ?? 0) > 0 ||
    (shopState?.magnifierTokens.size ?? 0) > 0;

  if (needsPerSocket) {
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

export function handleBanPickNoBan(
  io: IO,
  socket: TypedSocket,
  roomId: string,
): void {
  const s = states.get(roomId);
  if (!s || s.phase !== 'banning') {
    socket.emit('error', { message: '지금은 노밴을 할 수 없습니다.' });
    return;
  }

  const myId = sessions.getToken(socket.id) ?? socket.id;
  const expectedIdx = s.sequence[s.currentSequenceIdx]?.playerIdx ?? -1;
  const myIdx = s.playerIds.indexOf(myId);

  if (myIdx !== expectedIdx || s.comIdx === myIdx) {
    socket.emit('error', { message: '지금은 당신의 밴 차례가 아닙니다.' });
    return;
  }

  const byKey: 'first' | 'second' = myIdx === 0 ? 'first' : 'second';
  processNoBan(io, roomId, s, byKey);
}

export function handleBanPickUnban(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  gameId: string,
): void {
  const s = states.get(roomId);
  if (!s || s.phase !== 'unban') {
    socket.emit('error', { message: '지금은 밴 삭제를 할 수 없습니다.' });
    return;
  }

  const myToken = sessions.getToken(socket.id) ?? socket.id;
  const currentTurn = s.unbanQueue[s.unbanQueueIdx];
  if (!currentTurn) return;

  const expectedToken = s.playerIds[currentTurn === 'first' ? 0 : 1];
  if (myToken !== expectedToken) {
    socket.emit('error', { message: '지금은 당신의 밴 삭제 차례가 아닙니다.' });
    return;
  }

  const erasable = getErasableGames(s, currentTurn);
  if (!erasable.find((b) => b.gameId === gameId)) {
    socket.emit('error', { message: '삭제할 수 없는 게임입니다.' });
    return;
  }

  const memberId = s.playerMemberIds[currentTurn === 'first' ? 0 : 1];
  if (!memberId) {
    advanceUnbanQueue(io, roomId, s, null);
    return;
  }

  // 아이템 소모 후 진행
  void (async () => {
    try {
      const sb = getSupabaseAdmin();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb.rpc as any)('use_consumable', {
        p_member_id: memberId,
        p_kind: 'ban_eraser',
        p_ref_kind: 'room_unban',
        p_ref_id: `${roomId}_${currentTurn}`,
        p_metadata: { roomId, turn: currentTurn, erasedGameId: gameId },
      });
      if (error) throw new Error(error.message);

      const row = Array.isArray(data) ? data[0] : data;
      if (!row?.used) {
        // 인벤토리 없음 — 스킵 처리
        socket.emit('error', { message: '밴 삭제권이 없습니다.' });
        advanceUnbanQueue(io, roomId, s, null);
        return;
      }

      // 소모 성공 — 밴 복원
      advanceUnbanQueue(io, roomId, s, gameId);

      // 인벤토리 업데이트 알림 (fire-and-forget)
      void sb.from('shop_consumable_inventory')
        .select('count')
        .eq('member_id', memberId)
        .eq('kind', 'ban_eraser')
        .maybeSingle()
        .then(({ data: invData }) => {
          const countAfter = Number((invData as { count?: number } | null)?.count ?? 0);
          socket.emit('inventory:updated', { kind: 'ban_eraser', countAfter });
        })
        .catch(() => {});
    } catch (err) {
      console.warn('[banpick:unban] use_consumable 실패:', (err as Error).message);
      socket.emit('error', { message: '밴 삭제 처리 중 오류가 발생했습니다.' });
      advanceUnbanQueue(io, roomId, s, null);
    }
  })();
}

export function handleBanPickUnbanSkip(
  socket: TypedSocket,
  roomId: string,
  io: IO,
): void {
  const s = states.get(roomId);
  if (!s || s.phase !== 'unban') return;

  const myToken = sessions.getToken(socket.id) ?? socket.id;
  const currentTurn = s.unbanQueue[s.unbanQueueIdx];
  if (!currentTurn) return;

  const expectedToken = s.playerIds[currentTurn === 'first' ? 0 : 1];
  if (myToken !== expectedToken) return;

  // 스킵 — 아이템 소모 없음
  advanceUnbanQueue(io, roomId, s, null);
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

  const baseStartPayload = (): BanPickStartPayload => ({
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
    opponentGameStats: viewerToken ? s.magnifierStatsMap.get(viewerToken) : undefined,
  });

  if (s.phase === 'banning') {
    socket.emit('banpick:start', baseStartPayload());
  } else if (s.phase === 'unban') {
    // 현재 밴 목록을 포함한 start 페이로드로 화면 초기화
    socket.emit('banpick:start', { ...baseStartPayload(), turnDeadline: null });

    // 현재 unban 차례 재전송
    const currentTurn = s.unbanQueue[s.unbanQueueIdx];
    if (currentTurn !== undefined) {
      const erasableGames = getErasableGames(s, currentTurn);
      const payload: BanPickUnbanTurnPayload = {
        queue: s.unbanQueue,
        currentTurn,
        erasableGames,
        turnDeadline: s.unbanTurnDeadline ?? Date.now() + 15_000,
      };
      socket.emit('banpick:unban_turn', payload);
    }
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
  clearUnbanTimer(s);
  states.delete(roomId);
}
