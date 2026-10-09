/**
 * 해달별2 — 게임 중에는 양쪽 빛가루 합산(판정 합계·소멸량)을 아무에게도 보내지 않는다.
 *
 * 룰상 공개는 '남은 빛가루의 20g 구간(단계)' 뿐이다. 그런데 정산 스텝의
 * litDecision.totals · powderBurn.total, 라운드 기록의 markTotalsBefore/After 가
 * 출시 때부터 두 플레이어에게 그대로 나갔다. 화면이 안 쓰는 동안은 드러나지
 * 않다가, 결과판 개편(1d1c7bd)이 소멸량을 'Ng 소멸' 로 띄우면서 보였다.
 * 내 기여를 빼면 상대가 어디에 몇 g 넣었는지가 나오므로 데이터에서부터 막는다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import type { SMS2GameData } from '@shared/types/sun-moon-star-2.js';
import { gameModules } from '../socket/game.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  emitStateToSocket,
  gameStates,
  trySubmitBet,
  trySubmitPowder,
} from '../socket/games/sun-moon-star-2/state.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: id === 'ht-p1', isReady: true, joinedAt: Date.now() };
}

function ioStub(): IO {
  return {
    in: () => ({ fetchSockets: async () => [] }),
    to: () => ({ emit: () => {} }),
    sockets: { adapter: { rooms: new Map() }, sockets: new Map() },
  } as unknown as IO;
}

const socketIds = new Set<string>();
function viewerSocket(viewerId: string) {
  const socketId = `socket-${viewerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, viewerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket & {
    emit: ReturnType<typeof vi.fn>;
  };
}

function lastGameData(socket: TypedSocket & { emit: ReturnType<typeof vi.fn> }): SMS2GameData {
  const call = socket.emit.mock.calls.filter((c) => c[0] === 'game:state').at(-1);
  return (call?.[1] as { gameData: SMS2GameData }).gameData;
}

let roomId = '';
afterEach(() => {
  vi.useRealTimers();
  if (roomId) gameModules[GAME_IDS.SUN_MOON_STAR_2].cleanup(roomId);
  for (const room of roomStore.getAll()) roomStore.delete(room.id);
  for (const socketId of socketIds) sessions.removeSession(socketId);
  socketIds.clear();
});

describe('해달별2 빛가루 합산 비공개', () => {
  it('정산 중 두 플레이어·관전자 모두 판정 합계와 소멸량을 받지 않는다', () => {
    vi.useFakeTimers();
    const p1 = player('ht-p1', '하나');
    const p2 = player('ht-p2', '둘');
    const room = roomStore.create({
      title: '해달별2',
      gameId: GAME_IDS.SUN_MOON_STAR_2,
      gameName: '해달별2',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host: p1,
    });
    roomStore.addPlayer(room.id, p2);
    roomId = room.id;
    const io = ioStub();
    gameModules[GAME_IDS.SUN_MOON_STAR_2].init(io, room.id, [p1, p2], 'multi', Date.now(), null, vi.fn());
    const s = gameStates.get(room.id)!;

    expect(trySubmitPowder(io, s, 'ht-p1', { sun: 12, moon: 0, star: 0 })).toBeNull();
    expect(trySubmitPowder(io, s, 'ht-p2', { sun: 9, moon: 0, star: 0 })).toBeNull();
    const first = s.firstPlayerSide === 'p1' ? 'ht-p1' : 'ht-p2';
    const second = first === 'ht-p1' ? 'ht-p2' : 'ht-p1';
    expect(trySubmitBet(io, s, first, { sun: 0, moon: 0, star: 0 })).toBeNull();
    expect(trySubmitBet(io, s, second, { sun: 0, moon: 0, star: 0 })).toBeNull();
    expect(s.phase).toBe('resolve');

    for (const viewer of ['ht-p1', 'ht-p2', 'ht-spec']) {
      const socket = viewerSocket(viewer);
      emitStateToSocket(socket, s);
      const data = lastGameData(socket);
      const decision = data.resolveSteps?.find((step) => step.type === 'litDecision');
      const burn = data.resolveSteps?.find((step) => step.type === 'powderBurn');
      expect(decision && 'totals' in decision, viewer).toBe(false);
      expect(burn && 'total' in burn, viewer).toBe(false);
      expect(data.history[0].markTotalsBefore, viewer).toEqual({ sun: 0, moon: 0, star: 0 });
      expect(data.roundResult?.markTotalsBefore, viewer).toEqual({ sun: 0, moon: 0, star: 0 });
      // 소멸된 21g(12+9) 이 어디에도 숫자로 실려 나가지 않는다
      expect(JSON.stringify(data.resolveSteps), viewer).not.toContain('21');
    }
  });
});
