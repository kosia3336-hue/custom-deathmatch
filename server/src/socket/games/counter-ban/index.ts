import { GAME_IDS } from '@shared/types/game.js';
import type { Game } from '@shared/types/game.js';
import { COUNTER_BAN_TURN_MS } from '@shared/types/rank.js';
import type { CounterBanPhase, CounterBanViewPayload } from '@shared/types/counter-ban.js';
import type { GameWinRate, BannedGame } from '@shared/types/ban-pick.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import { getGames } from '../../../routes/games.js';
import { sessions } from '../../../store/sessions.js';
import { roomStore } from '../../../store/rooms.js';
import { socketRoom } from '../../utils.js';
import type { IO, TypedSocket } from '../../types.js';
import { getRoomShopState } from '../../../shop/roomShopState.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getSupabaseAdmin } from '../../../db/supabase.js';

const BURN_MS = 2400;
const EVENT_IDS = new Set<string>([GAME_IDS.INDIAN_POKER_EVENT, GAME_IDS.SUN_MOON_STAR_EVENT]);

interface CounterBanState {
  games: Game[];
  remaining: Set<string>;
  gone: Set<string>;
  burningIds: string[];
  round: number;
  phase: CounterBanPhase;
  deadline: number | null;
  picks: Map<string, string>;
  keepId: string | null;
  playerIds: [string, string];
  playerMemberIds: [string | null, string | null];
  timerHandle: NodeJS.Timeout | null;
  magnifierStatsMap: Map<string, GameWinRate[]>;
  onGamePicked: (gameId: string, gameName: string) => void;
  onForfeit: (playerId: string) => void;
  onBothLose: () => void;
  onBanPickComplete?: (data: {
    bannedGames: BannedGame[];
    pickedGameId: string;
    playerIds: [string, string];
  }) => void;
}

const states = new Map<string, CounterBanState>();

function burnWait(count: number) {
  return BURN_MS + Math.min(Math.max(count - 1, 0), 10) * 90 + 200;
}

function poolGames(rankingActiveOnly: boolean): Game[] {
  return getGames().filter(
    (g) =>
      g.supportsMulti &&
      g.rankingActive !== false &&
      (!rankingActiveOnly || g.rankingActive) &&
      !EVENT_IDS.has(g.id) &&
      g.id !== GAME_IDS.BAN_PICK &&
      g.id !== GAME_IDS.RANDOM,
  );
}

async function fetchOpponentGameStats(memberId: string): Promise<GameWinRate[]> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from('member_game_stats')
      .select('game_id, total_games, wins, losses, draws')
      .eq('member_id', memberId);
    if (!data) return [];
    return (
      data as Array<{
        game_id: string;
        total_games: number;
        wins: number;
        losses: number;
        draws: number;
      }>
    )
      .filter((r) => r.total_games > 0)
      .map((r) => ({
        gameId: r.game_id,
        totalGames: r.total_games,
        wins: r.wins,
        losses: r.losses,
        draws: r.draws,
        winRate: Math.round(((r.wins + r.draws * 0.5) / r.total_games) * 1000) / 10,
      }));
  } catch {
    return [];
  }
}

function clearTimer(s: CounterBanState) {
  if (s.timerHandle) {
    clearTimeout(s.timerHandle);
    s.timerHandle = null;
  }
}

function payloadFor(roomId: string, s: CounterBanState, viewerToken: string | null): CounterBanViewPayload {
  const reveal = s.phase !== 'picking';
  const myPick = viewerToken ? (s.picks.get(viewerToken) ?? null) : null;
  const oppId = viewerToken
    ? s.playerIds.find((id) => id !== viewerToken) ?? null
    : null;
  const oppPick = reveal && oppId ? (s.picks.get(oppId) ?? null) : null;
  const playerView = (idx: number): { id: string; nickname: string } => {
    const id = s.playerIds[idx] ?? '';
    const nick = sessions.getNicknameByToken(id) ?? '';
    return { id, nickname: nicknameForViewer(roomId, id, nick, viewerToken) };
  };
  return {
    games: s.games,
    remainingIds: [...s.remaining],
    goneIds: [...s.gone],
    burningIds: s.burningIds,
    round: s.round,
    phase: s.phase,
    deadline: s.deadline,
    myPick,
    oppPick,
    keepId: s.keepId,
    revealedPicks: reveal ? Object.fromEntries(s.picks) : null,
    players: [playerView(0), playerView(1)],
    opponentGameStats: viewerToken ? s.magnifierStatsMap.get(viewerToken) : undefined,
  };
}

function emitToRoom(io: IO, roomId: string, s: CounterBanState, event: 'counterban:start' | 'counterban:update') {
  const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
  if (!sockets) return;
  for (const sid of sockets) {
    const sock = io.sockets.sockets.get(sid);
    if (!sock) continue;
    const token = sessions.getToken(sid) ?? null;
    sock.emit(event, payloadFor(roomId, s, token));
  }
}

function finishPicked(io: IO, roomId: string, s: CounterBanState, gameId: string) {
  const game = s.games.find((g) => g.id === gameId);
  if (!game) {
    s.phase = 'empty';
    emitToRoom(io, roomId, s, 'counterban:update');
    s.onBothLose();
    return;
  }
  const banned: BannedGame[] = s.games
    .filter((g) => g.id !== gameId)
    .map((g, i) => ({
      gameId: g.id,
      bannedBy: (i % 2 === 0 ? 'first' : 'second') as 'first' | 'second',
      bannedAt: Date.now(),
    }));
  s.onBanPickComplete?.({
    bannedGames: banned,
    pickedGameId: gameId,
    playerIds: s.playerIds,
  });
  s.phase = s.keepId ? 'overlap' : 'last';
  emitToRoom(io, roomId, s, 'counterban:update');
  s.timerHandle = setTimeout(() => {
    const live = states.get(roomId);
    if (!live || live !== s) return;
    live.onGamePicked(game.id, game.name);
  }, 900);
}

function beginRound(io: IO, roomId: string, s: CounterBanState) {
  clearTimer(s);
  s.picks.clear();
  s.keepId = null;
  s.burningIds = [];
  const left = [...s.remaining];
  if (left.length === 1) {
    s.keepId = left[0];
    s.phase = 'last';
    s.deadline = null;
    emitToRoom(io, roomId, s, 'counterban:update');
    finishPicked(io, roomId, s, left[0]);
    return;
  }
  if (left.length === 0) {
    s.phase = 'empty';
    s.deadline = null;
    emitToRoom(io, roomId, s, 'counterban:update');
    s.onBothLose();
    return;
  }
  s.phase = 'picking';
  s.deadline = Date.now() + COUNTER_BAN_TURN_MS;
  emitToRoom(io, roomId, s, s.round === 1 ? 'counterban:start' : 'counterban:update');
  s.timerHandle = setTimeout(() => onDeadline(io, roomId), Math.max(0, s.deadline - Date.now()));
}

function onDeadline(io: IO, roomId: string) {
  const s = states.get(roomId);
  if (!s || s.phase !== 'picking') return;
  const [a, b] = s.playerIds;
  const aPick = s.picks.get(a);
  const bPick = s.picks.get(b);
  if (aPick && bPick) {
    resolvePicks(io, roomId, s);
    return;
  }
  if (!aPick && !bPick) {
    s.phase = 'forfeit';
    s.deadline = null;
    emitToRoom(io, roomId, s, 'counterban:update');
    s.onBothLose();
    return;
  }
  s.phase = 'forfeit';
  s.deadline = null;
  emitToRoom(io, roomId, s, 'counterban:update');
  s.onForfeit(aPick ? b : a);
}

function resolvePicks(io: IO, roomId: string, s: CounterBanState) {
  const [a, b] = s.playerIds;
  const aPick = s.picks.get(a);
  const bPick = s.picks.get(b);
  if (!aPick || !bPick) return;
  clearTimer(s);
  s.phase = 'reveal';
  s.deadline = null;
  emitToRoom(io, roomId, s, 'counterban:update');
  s.timerHandle = setTimeout(() => {
    const cur = states.get(roomId);
    if (!cur || cur !== s) return;
    const overlap = aPick === bPick;
    const left = [...cur.remaining];
    cur.keepId = overlap ? aPick : null;
    cur.burningIds = overlap ? left.filter((id) => id !== aPick) : [aPick, bPick].filter((id, i, arr) => arr.indexOf(id) === i);
    cur.phase = 'burning';
    emitToRoom(io, roomId, cur, 'counterban:update');
    cur.timerHandle = setTimeout(() => {
      const live = states.get(roomId);
      if (!live || live !== cur) return;
      if (overlap) {
        for (const id of live.games.map((g) => g.id)) {
          if (id !== aPick) {
            live.remaining.delete(id);
            live.gone.add(id);
          }
        }
        live.burningIds = [];
        live.keepId = aPick;
        finishPicked(io, roomId, live, aPick);
        return;
      }
      live.remaining.delete(aPick);
      live.remaining.delete(bPick);
      live.gone.add(aPick);
      live.gone.add(bPick);
      live.burningIds = [];
      live.round += 1;
      beginRound(io, roomId, live);
    }, burnWait(cur.burningIds.length));
  }, 520);
}

export async function initCounterBan(
  io: IO,
  roomId: string,
  players: Player[],
  _playMode: PlayMode,
  onGamePicked: (gameId: string, gameName: string) => void,
  onForfeit: (playerId: string) => void,
  onBothLose: () => void,
  onBanPickComplete?: CounterBanState['onBanPickComplete'],
) {
  cleanupCounterBan(roomId);
  const ranked = roomStore.get(roomId)?.isRanked === true;
  const games = poolGames(ranked);
  const s: CounterBanState = {
    games,
    remaining: new Set(games.map((g) => g.id)),
    gone: new Set(),
    burningIds: [],
    round: 1,
    phase: 'picking',
    deadline: null,
    picks: new Map(),
    keepId: null,
    playerIds: [players[0]?.id ?? '', players[1]?.id ?? ''],
    playerMemberIds: [players[0]?.memberId ?? null, players[1]?.memberId ?? null],
    timerHandle: null,
    magnifierStatsMap: new Map(),
    onGamePicked,
    onForfeit,
    onBothLose,
    onBanPickComplete,
  };
  states.set(roomId, s);

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

  beginRound(io, roomId, s);
}

export function handleCounterBan(
  io: IO,
  socket: TypedSocket,
  roomId: string,
  gameId: string,
) {
  const s = states.get(roomId);
  if (!s || s.phase !== 'picking') return;
  const token = sessions.getToken(socket.id);
  if (!token || !s.playerIds.includes(token)) return;
  if (s.picks.has(token)) return;
  if (!s.remaining.has(gameId)) return;
  s.picks.set(token, gameId);
  emitToRoom(io, roomId, s, 'counterban:update');
  if (s.picks.size >= 2) resolvePicks(io, roomId, s);
}

export function emitCounterBanStateToSocket(socket: TypedSocket, roomId: string) {
  const s = states.get(roomId);
  if (!s) return;
  const token = sessions.getToken(socket.id) ?? null;
  socket.emit(s.round === 1 && s.phase === 'picking' ? 'counterban:start' : 'counterban:update', payloadFor(roomId, s, token));
}

export function getCounterBanState(roomId: string) {
  const s = states.get(roomId);
  if (!s) return undefined;
  return { gameOver: false, totalTurns: s.round };
}

export function getCounterBanDummyView(roomId: string, dummyId: string) {
  const s = states.get(roomId);
  if (!s) return null;
  if (!s.playerIds.includes(dummyId)) return null;
  return {
    phase: s.phase,
    canPick: s.phase === 'picking' && !s.picks.has(dummyId),
    remainingIds: [...s.remaining],
  };
}

export function cleanupCounterBan(roomId: string) {
  const s = states.get(roomId);
  if (!s) return;
  clearTimer(s);
  states.delete(roomId);
}
