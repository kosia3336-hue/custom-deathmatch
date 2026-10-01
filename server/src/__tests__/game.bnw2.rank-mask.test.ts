/**
 * 흑과백2 — 랭크 판을 관전할 때 플레이어 실명이 새지 않는지.
 *
 * 실제로 났던 버그: 관전자용 화면 데이터의 닉 가리기가 익명 물약(isTokenAnonymized)만
 * 보고 랭크는 보지 않아, 랭크 판을 관전하면 두 사람의 실명이 그대로 떴다.
 * 플레이어용 경로는 nicknameForViewer 로 제대로 가리고 있었던 탓에, 한 파일 안에
 * 가리는 경로와 가리지 않는 경로가 나란히 있었다 — 같은 방식으로 되살아나기 쉽다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import { initBNW2 } from '../socket/games/bnw2/index.js';
import { emitStateToSocket, gameStates, clearRoundTimer } from '../socket/games/bnw2/state.js';
import type { IO, TypedSocket } from '../socket/games/bnw2/constants.js';
import { rankedRoomTitle } from '../rank/maskRankIdentity.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';

function player(id: string, nickname: string, memberId: string): Player {
  return { id, nickname, isHost: id === 'bw-p1', isReady: true, joinedAt: Date.now(), memberId };
}

function ioStub() {
  return {
    in: () => ({ fetchSockets: async () => [] }),
    to: () => ({ emit: () => {} }),
  } as unknown as IO;
}

const socketIds = new Set<string>();

function socketFor(viewerId: string) {
  const socketId = `socket-${viewerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, viewerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket & { emit: ReturnType<typeof vi.fn> };
}

function emittedGameData(socket: TypedSocket & { emit: ReturnType<typeof vi.fn> }) {
  const call = socket.emit.mock.calls.at(-1);
  expect(call?.[0]).toBe('game:state');
  return (call?.[1] as { gameData: Record<string, unknown> }).gameData as {
    players: Record<string, { nickname: string }>;
  };
}

function startRankedGame() {
  const first = player('bw-p1', '알파', 'm1');
  const second = player('bw-p2', '베타', 'm2');
  const room = roomStore.create({
    title: rankedRoomTitle('흑과백2'),
    gameId: 'game-009',
    gameName: '흑과백2',
    playMode: 'multi',
    roomType: 'rank',
    maxPlayers: 2,
    minPlayers: 2,
    host: first,
    isRanked: true,
  });
  roomStore.addPlayer(room.id, second);
  roomStore.addSpectator(room.id, player('bw-spec', '구경꾼', 'm3'));
  initBNW2(ioStub(), room.id, [first, second], 'multi', Date.now(), null, vi.fn());
  return { room: roomStore.get(room.id)!, first, second };
}

afterEach(() => {
  for (const r of roomStore.getAll()) {
    const s = gameStates.get(r.id);
    if (s) clearRoundTimer(s);
    gameStates.delete(r.id);
    roomStore.delete(r.id);
  }
  for (const socketId of socketIds) sessions.removeSession(socketId);
  socketIds.clear();
});

describe('흑과백2 랭크 관전 신원 가리기', () => {
  it('관전자에게는 두 플레이어 닉이 모두 ??? 로 나간다', () => {
    const { room, first, second } = startRankedGame();

    const spectator = socketFor('bw-spec');
    emitStateToSocket(spectator, gameStates.get(room.id)!);
    const data = emittedGameData(spectator);

    expect(data.players[first.id].nickname).toBe(ANONYMOUS_NICKNAME);
    expect(data.players[second.id].nickname).toBe(ANONYMOUS_NICKNAME);
  });

  it('플레이어에게는 자기 닉만 보이고 상대는 ??? 다', () => {
    const { room, first, second } = startRankedGame();

    const mine = socketFor('bw-p1');
    emitStateToSocket(mine, gameStates.get(room.id)!);
    const data = emittedGameData(mine);

    expect(data.players[first.id].nickname).toBe('알파');
    expect(data.players[second.id].nickname).toBe(ANONYMOUS_NICKNAME);
  });
});
