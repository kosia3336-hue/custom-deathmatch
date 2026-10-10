/**
 * 콰트로 — 관전자도 두 플레이어의 '공개한 카드' 는 본다.
 *
 * 예전에는 관전자에게 me/opp 가 모두 null 이라 관전 화면에 가상 플레이어 6명만 나오고
 * 두 사람 패가 통째로 비었다. 이제 seats 로 두 자리를 보내되, 오픈한 카드만 앞면이고
 * 나머지는 뒷면이다(플레이어가 상대 패를 보는 것과 같다).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import { gameModules } from '../socket/game.js';
import type { IO } from '../socket/types.js';
import { buildGameData, gameStates } from '../socket/games/quatro/state.js';
import { roomStore } from '../store/rooms.js';

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: id === 'qs-p1', isReady: true, joinedAt: Date.now() };
}

function ioStub(): IO {
  return {
    in: () => ({ fetchSockets: async () => [] }),
    to: () => ({ emit: () => {} }),
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
  } as unknown as IO;
}

let roomId = '';
afterEach(() => {
  if (roomId) gameModules[GAME_IDS.QUATRO].cleanup(roomId);
  for (const room of roomStore.getAll()) roomStore.delete(room.id);
});

describe('콰트로 관전 — 두 자리의 공개 카드', () => {
  it('관전자는 두 자리를 받고, 오픈한 카드만 앞면이다', () => {
    const p1 = player('qs-p1', '하나');
    const p2 = player('qs-p2', '둘');
    const room = roomStore.create({
      title: '콰트로',
      gameId: GAME_IDS.QUATRO,
      gameName: '콰트로',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host: p1,
    });
    roomStore.addPlayer(room.id, p2);
    roomId = room.id;
    gameModules[GAME_IDS.QUATRO].init(ioStub(), room.id, [p1, p2], 'multi', Date.now(), null, vi.fn());
    const s = gameStates.get(room.id)!;

    // p1 이 첫 카드를 오픈했다고 둔다
    const opened = s.players[0].hand[0];
    s.players[0].openIds.add(opened.id);

    const spectator = buildGameData(s, null);
    expect(spectator.me).toBeNull();
    expect(spectator.seats).toHaveLength(2);
    const [seat1, seat2] = spectator.seats!;
    expect(seat1.hand[0]).toEqual({ card: opened, open: true });
    expect(seat1.hand.slice(1).every((h) => h.card === null && !h.open)).toBe(true);
    expect(seat2.hand.every((h) => h.card === null)).toBe(true);

    // 플레이어는 seats 를 받지 않는다(me/opp 를 쓴다)
    const asPlayer = buildGameData(s, 'qs-p1');
    expect(asPlayer.seats).toBeUndefined();
    expect(asPlayer.me?.id).toBe('qs-p1');
  });
});
