import { afterEach, describe, expect, it, vi } from 'vitest';
import { GAME_IDS } from '@shared/types/game.js';
import type { Player } from '@shared/types/room.js';
import type { GameTimeExpiry } from '@shared/types/events.js';
import { gameModules, registerGameHandlers, clearAutoEnd } from '../socket/game.js';
import { clearTurnExpiry } from '../socket/gameTurnExpiry.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { kingmakingStates } from '../socket/games/kingmaking/state.js';

vi.mock('../socket/gameEndPersistence.js', () => ({ persistGameEndLog: vi.fn(async () => {}) }));
vi.mock('../socket/lobby.js', () => ({
  broadcastRoomUpdated: vi.fn(),
  broadcastRoomRemoved: vi.fn(),
}));

const emit = vi.fn();
const io = {
  to: () => ({ emit }),
  in: () => ({ fetchSockets: async () => [] }),
  sockets: { sockets: new Map(), adapter: { rooms: new Map() } },
} as unknown as IO;
const created: { id: string; gameId: string }[] = [];
const tokens: string[] = [];
const player = (id: string): Player => ({
  id,
  nickname: id,
  isHost: false,
  isReady: true,
  joinedAt: 0,
});

function setup(gameId: string, ranked = false, com = false) {
  vi.useFakeTimers();
  emit.mockClear();
  const host = player('expiry-host');
  const room = roomStore.create({
    title: '시간 초과 테스트',
    gameId,
    gameName: gameId,
    playMode: com ? 'com' : 'multi',
    roomType: 'public',
    maxPlayers: 2,
    minPlayers: 2,
    host,
    isRanked: ranked,
    timeLimitSeconds: 10,
  });
  if (!com) roomStore.addPlayer(room.id, player('expiry-guest'));
  roomStore.setStatus(room.id, 'playing');
  const actual = roomStore.get(room.id)!;
  created.push({ id: room.id, gameId });
  gameModules[gameId].init(
    io,
    room.id,
    actual.players,
    actual.playMode,
    Date.now(),
    10,
    vi.fn(),
    {},
  );
  return actual;
}
function socketFor(roomId: string, id: string) {
  const handlers = new Map<string, (data: unknown) => void>();
  const socket = {
    id: `socket-${id}`,
    emit: vi.fn(),
    on: (event: string, handler: (data: unknown) => void) => handlers.set(event, handler),
  } as unknown as TypedSocket;
  sessions.linkToken(socket.id, id);
  sessions.setRoom(socket.id, roomId);
  tokens.push(socket.id);
  registerGameHandlers(io, socket);
  return handlers;
}
const proposal = (): GameTimeExpiry | undefined =>
  emit.mock.calls.filter(([event, data]) => event === 'game:time-expiry' && data).at(-1)?.[1];

afterEach(() => {
  for (const room of created) {
    clearTurnExpiry(io, room.id);
    clearAutoEnd(room.id);
    gameModules[room.gameId]?.cleanup(room.id);
    roomStore.delete(room.id);
  }
  for (const id of tokens) sessions.removeSession(id);
  tokens.length = 0;
  created.length = 0;
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe('실제 게임 모듈과 시간 초과 소켓 통합', () => {
  it.each([
    GAME_IDS.FOUR_GRAVITY,
    GAME_IDS.DOUBLE_SIDED_CHESS,
    GAME_IDS.INDIAN_POKER,
    GAME_IDS.MULTIPLE_BNW,
    GAME_IDS.BNW2,
    GAME_IDS.SILPER_BNW,
    GAME_IDS.FIVE_TOWERS,
    GAME_IDS.BANK_GAME,
    GAME_IDS.QUATRO,
    GAME_IDS.KINGMAKING,
    GAME_IDS.TRIPLE_GOMOKU,
    GAME_IDS.CHOICE_HOLDEM,
    GAME_IDS.DOUBLE_SIDED_POKER,
  ])('%s 개인 착수 시간은 첫 초과에 선택 대기하며 자동 행동을 하지 않는다', (gameId) => {
    const room = setup(gameId);
    vi.advanceTimersByTime(10000);
    expect(proposal()).toMatchObject({
      roomId: room.id,
      loserId: room.players[0].id,
      deciderId: room.players[1].id,
    });
    expect(gameModules[gameId].getState(room.id)?.gameOver).toBe(false);
  });
  it.each([GAME_IDS.SEED_SEOTDA, GAME_IDS.SUN_MOON_STAR_2])(
    '%s 공동 단계는 유지하고 다음 개인 단계부터 적용한다',
    (gameId) => {
      const room = setup(gameId);
      vi.advanceTimersByTime(10000);
      expect(proposal()).toBeUndefined();
      vi.advanceTimersByTime(10000);
      expect(proposal()).toMatchObject({ roomId: room.id, loserId: room.players[0].id });
    },
  );
  it('선택 대기 중 착수 차단 → 봐주기 → 동일 판에 정상 착수', () => {
    const room = setup(GAME_IDS.KINGMAKING);
    const host = socketFor(room.id, room.players[0].id);
    const guest = socketFor(room.id, room.players[1].id);
    vi.advanceTimersByTime(10000);
    const action = { type: 'place', kind: 'normal', to: { row: 2, col: 2 } };
    host.get('game:action')!(action);
    expect(kingmakingStates.get(room.id)!.board[2][2]).toHaveLength(0);
    guest.get('game:time-expiry:respond')!({
      requestId: proposal()!.requestId,
      decision: 'continue',
    });
    host.get('game:action')!(action);
    expect(kingmakingStates.get(room.id)!.board[2][2]).toHaveLength(1);
  });
  it.each(['rank', 'multi', 'com'])('%s 몰수패 결과를 즉시 확정하고 엔진을 정리한다', (mode) => {
    const room = setup(GAME_IDS.KINGMAKING, mode === 'rank', mode === 'com');
    vi.advanceTimersByTime(10000);
    if (mode !== 'rank') {
      const p = proposal()!;
      const client = socketFor(room.id, p.deciderId);
      client.get('game:time-expiry:respond')!({ requestId: p.requestId, decision: 'finish' });
    }
    expect(roomStore.get(room.id)?.status).toBe('finished');
    expect(kingmakingStates.has(room.id)).toBe(false);
    const result = emit.mock.calls.find(([event]) => event === 'game:ended')?.[1];
    expect(result).toMatchObject({ endedByForfeit: true, gameResultData: { winType: 'timeout' } });
    expect(result.rankings[0].playerId).toBe(room.players[1].id);
  });
});
