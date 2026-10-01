/**
 * 랭크 판을 관전할 때 어떤 게임에서도 플레이어 실명이 새지 않는지 — 전 종목 일괄.
 *
 * 같은 버그가 5개의 탑, 흑과백2, 베팅 가위바위보, 투자와 기부에서 차례로 났다.
 * 원인이 매번 같았다: 관전자용 화면 데이터에서 닉을 가릴 때 익명 물약만 보는
 * isTokenAnonymized 를 쓰고, 랭크 익명까지 보는 nicknameForViewer 를 안 썼다.
 * 게임마다 사람이 눈으로 확인하는 방식으로는 다음 게임에서 또 난다.
 *
 * 그래서 게임 하나하나를 아는 대신, 레지스트리에 등록된 모든 게임을 같은 방식으로
 * 굴린다 — 랭크 방을 만들고, 관전자 소켓으로 화면 데이터를 받아, 그 안에 실명이
 * 한 글자라도 들어 있으면 실패한다. 새 게임이 등록되면 자동으로 함께 검사된다.
 *
 * 한계: 여기서 보는 것은 '시작 직후' 한 장면이다. 게임이 진행되며 쌓이는 기록·알림은
 * 게임마다 손이 달라 일괄로 굴릴 수 없다(5개의 탑의 탑 쌓기 알림이 그랬다).
 * 그런 자리는 게임별 테스트로 따로 붙잡는다 — game.five-towers.rank-mask,
 * game.bnw2.rank-mask 가 그것이다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import { gameModules } from '../socket/game.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { rankedRoomTitle } from '../rank/maskRankIdentity.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';

/** 실명은 화면 어디에도 나오면 안 된다 — 닉으로 쓰기 힘든 글자를 골라 오탐을 막는다. */
const NICK_A = 'ZZ실명알파ZZ';
const NICK_B = 'ZZ실명베타ZZ';

/**
 * 일괄 검사에서 빼는 것들. 뺄 때는 이유를 적는다 — 조용히 빠지면 구멍이 된다.
 */
const SKIP: Record<string, string> = {
  [GAME_IDS.BAN_PICK]: '게임이 아니라 밴픽 단계. 랭크 방의 게임 데이터를 만들지 않는다.',
  [GAME_IDS.RANDOM]: '실제 게임이 아니라 무작위 선택용 표식.',
  [GAME_IDS.INDIAN_POKER_EVENT]: '이벤트 룸 전용. 랭크로 열리지 않는다.',
  [GAME_IDS.SUN_MOON_STAR_EVENT]: '이벤트 룸 전용. 랭크로 열리지 않는다.',
  [GAME_IDS.RING_THE_BELL]: '길드전 시스템 룸 전용. 랭크로 열리지 않는다.',
};

function player(id: string, nickname: string, memberId: string): Player {
  return { id, nickname, isHost: id === 'rm-p1', isReady: true, joinedAt: Date.now(), memberId };
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
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket & { emit: ReturnType<typeof vi.fn> };
}

/** 소켓으로 나간 모든 것을 한 덩어리 문자열로 — 어느 칸에 담겼든 잡는다. */
function everythingEmitted(socket: TypedSocket & { emit: ReturnType<typeof vi.fn> }): string {
  return socket.emit.mock.calls
    .map((call) => {
      try {
        return JSON.stringify(call);
      } catch {
        return '';
      }
    })
    .join('|');
}

afterEach(() => {
  for (const room of roomStore.getAll()) {
    for (const mod of Object.values(gameModules)) {
      try {
        mod.cleanup(room.id);
      } catch {
        /* 이 게임의 방이 아니면 그만 */
      }
    }
    roomStore.delete(room.id);
  }
  for (const socketId of socketIds) sessions.removeSession(socketId);
  socketIds.clear();
});

const targets = Object.keys(gameModules).filter((gameId) => !(gameId in SKIP));

describe('랭크 관전 — 전 종목 실명 가리기', () => {
  it('검사 대상이 비어 있지 않다', () => {
    expect(targets.length).toBeGreaterThan(20);
  });

  it.each(targets)('%s — 관전자에게 나가는 데이터에 실명이 없다', (gameId) => {
    const first = player('rm-p1', NICK_A, 'm1');
    const second = player('rm-p2', NICK_B, 'm2');
    const spectator = player('rm-spec', '구경꾼', 'm3');

    const room = roomStore.create({
      title: rankedRoomTitle(gameId),
      gameId,
      gameName: gameId,
      playMode: 'multi',
      roomType: 'rank',
      maxPlayers: 2,
      minPlayers: 2,
      host: first,
      isRanked: true,
    });
    roomStore.addPlayer(room.id, second);
    roomStore.addSpectator(room.id, spectator);

    const io = ioStub();
    const mod = gameModules[gameId];
    mod.init(io, room.id, [first, second], 'multi', Date.now(), null, vi.fn());

    const socket = viewerSocket('rm-spec');
    mod.emitStateToSocket(socket, room.id);

    const sent = everythingEmitted(socket);
    expect(sent).not.toBe('');
    expect(sent).not.toContain(NICK_A);
    expect(sent).not.toContain(NICK_B);
  });

  /*
    상대 플레이어도 남의 이름을 보면 안 된다. 관전자 경로만 고치고 플레이어 경로를
    빼먹는 실수를 함께 막는다 — 자기 이름은 보여야 하므로 상대 것만 본다.
  */
  it.each(targets)('%s — 상대 플레이어에게 나가는 데이터에 상대 실명이 없다', (gameId) => {
    const first = player('rm-p1', NICK_A, 'm1');
    const second = player('rm-p2', NICK_B, 'm2');

    const room = roomStore.create({
      title: rankedRoomTitle(gameId),
      gameId,
      gameName: gameId,
      playMode: 'multi',
      roomType: 'rank',
      maxPlayers: 2,
      minPlayers: 2,
      host: first,
      isRanked: true,
    });
    roomStore.addPlayer(room.id, second);

    const mod = gameModules[gameId];
    mod.init(ioStub(), room.id, [first, second], 'multi', Date.now(), null, vi.fn());

    const socket = viewerSocket('rm-p1');
    mod.emitStateToSocket(socket, room.id);

    const sent = everythingEmitted(socket);
    expect(sent).not.toBe('');
    expect(sent).not.toContain(NICK_B);
  });
});
