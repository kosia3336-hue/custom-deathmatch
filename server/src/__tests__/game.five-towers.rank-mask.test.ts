/**
 * 5개의 탑 — 랭크 판을 관전할 때 플레이어 실명이 새지 않는지.
 *
 * 실제로 났던 버그: 관전자용 화면 데이터의 닉 가리기가 익명 물약만 보고 랭크는
 * 보지 않아, 랭크 판을 관전하면 탑 쌓기 알림에 실명이 그대로 떴다.
 * 같은 파일 안에 가리는 경로와 가리지 않는 경로가 함께 있었던 탓이라,
 * 똑같은 방식으로 되살아나기 쉽다. 그래서 내보내는 지점을 직접 붙잡아 둔다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { cleanupFiveTowers, initFiveTowers } from '../socket/games/five-towers/index.js';
import { emitStateToSocket, gameStates } from '../socket/games/five-towers/state.js';
import type { IO, TypedSocket } from '../socket/types.js';
import { rankedRoomTitle } from '../rank/maskRankIdentity.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';

function player(id: string, nickname: string, memberId: string): Player {
  return { id, nickname, isHost: id === 'ft-p1', isReady: true, joinedAt: Date.now(), memberId };
}

function ioStub() {
  return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
}

const socketIds = new Set<string>();

function socketFor(viewerId: string) {
  const socketId = `socket-${viewerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, viewerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket & { emit: ReturnType<typeof vi.fn> };
}

/** 마지막으로 내보낸 game:state 의 gameData */
function emittedGameData(socket: TypedSocket & { emit: ReturnType<typeof vi.fn> }) {
  const call = socket.emit.mock.calls.at(-1);
  expect(call?.[0]).toBe('game:state');
  return (call?.[1] as { gameData: Record<string, unknown> }).gameData;
}

function startRankedGame() {
  const first = player('ft-p1', '알파', 'm1');
  const second = player('ft-p2', '베타', 'm2');
  const room = roomStore.create({
    title: rankedRoomTitle('5개의 탑'),
    gameId: 'game-011',
    gameName: '5개의 탑',
    playMode: 'multi',
    roomType: 'rank',
    maxPlayers: 2,
    minPlayers: 2,
    host: first,
    isRanked: true,
  });
  roomStore.addPlayer(room.id, second);
  roomStore.addSpectator(room.id, player('ft-spec', '구경꾼', 'm3'));
  const io = ioStub();
  initFiveTowers(io, room.id, [first, second], 'multi', Date.now(), null, vi.fn());
  const state = gameStates.get(room.id)!;
  return { room: roomStore.get(room.id)!, state, first, second };
}

afterEach(() => {
  for (const r of roomStore.getAll()) {
    cleanupFiveTowers(r.id);
    roomStore.delete(r.id);
  }
  for (const socketId of socketIds) sessions.removeSession(socketId);
  socketIds.clear();
});

describe('5개의 탑 랭크 관전 신원 가리기', () => {
  it('관전자에게는 플레이어 닉과 탑 알림의 닉이 모두 ??? 로 나간다', () => {
    const { room, state, first, second } = startRankedGame();

    /*
      탑 쌓기 알림이 실제로 새던 자리. 액션을 재현하는 대신 로그를 직접 넣어,
      '내보낼 때 가리는가' 만 붙잡는다 — 버그는 그 지점에 있었다.
    */
    state.actionLog.push({
      turn: 1,
      actorId: first.id,
      actorNickname: first.nickname,
      kind: 'stack-public',
      tower: 'A',
      count: 2,
    });
    state.milestoneLog.push({
      turn: 1,
      tower: 'A',
      kind: 'half',
      actorId: second.id,
      actorNickname: second.nickname,
    });

    const spectator = socketFor('ft-spec');
    emitStateToSocket(spectator, gameStates.get(room.id)!);
    const data = emittedGameData(spectator) as {
      players: Record<string, { nickname: string }>;
      actionLog: { actorNickname: string }[];
      milestoneLog: { actorNickname: string }[];
    };

    expect(data.players[first.id].nickname).toBe(ANONYMOUS_NICKNAME);
    expect(data.players[second.id].nickname).toBe(ANONYMOUS_NICKNAME);
    expect(data.actionLog.at(-1)?.actorNickname).toBe(ANONYMOUS_NICKNAME);
    expect(data.milestoneLog.at(-1)?.actorNickname).toBe(ANONYMOUS_NICKNAME);
  });

  it('플레이어 본인에게는 자기 닉이 보이고 상대 닉은 가려진다', () => {
    const { room, state, first, second } = startRankedGame();
    state.actionLog.push({
      turn: 1,
      actorId: second.id,
      actorNickname: second.nickname,
      kind: 'stack-public',
      tower: 'B',
      count: 1,
    });

    const mine = socketFor(first.id);
    emitStateToSocket(mine, gameStates.get(room.id)!);
    const data = emittedGameData(mine) as {
      players: Record<string, { nickname: string }>;
      actionLog: { actorNickname: string }[];
    };

    expect(data.players[first.id].nickname).toBe('알파');
    expect(data.players[second.id].nickname).toBe(ANONYMOUS_NICKNAME);
    expect(data.actionLog.at(-1)?.actorNickname).toBe(ANONYMOUS_NICKNAME);
  });

  it('랭크가 아닌 방에서는 실명을 그대로 보여 준다', () => {
    const first = player('ft-c1', '감마', 'm4');
    const second = player('ft-c2', '델타', 'm5');
    const room = roomStore.create({
      title: '연습판',
      gameId: 'game-011',
      gameName: '5개의 탑',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host: first,
      isRanked: false,
    });
    roomStore.addPlayer(room.id, second);
    initFiveTowers(ioStub(), room.id, [first, second], 'multi', Date.now(), null, vi.fn());
    const state = gameStates.get(room.id)!;
    state.actionLog.push({
      turn: 1,
      actorId: first.id,
      actorNickname: first.nickname,
      kind: 'stack-public',
      tower: 'C',
      count: 3,
    });

    const spectator = socketFor('ft-c-spec');
    emitStateToSocket(spectator, state);
    const data = emittedGameData(spectator) as {
      players: Record<string, { nickname: string }>;
      actionLog: { actorNickname: string }[];
    };

    expect(data.players[first.id].nickname).toBe('감마');
    expect(data.actionLog.at(-1)?.actorNickname).toBe('감마');
  });
});
