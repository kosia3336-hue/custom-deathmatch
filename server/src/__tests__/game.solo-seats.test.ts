/**
 * 삼층 오목·킹메이킹 1:1 솔로 — 한 사람이 두 자리를 번갈아 둘 수 있는지.
 *
 * 솔로에서는 후 자리에 소켓이 없다(reviewSeat 이 `<토큰>#review` 로 만든 가짜 자리).
 * 그래서 '지금 두는 사람' 을 소켓 주인이 아니라 차례 주인으로 잡아야 한다 —
 * 그 처리를 빼먹으면 첫 수 뒤에 아무것도 못 두고 판이 멈춘다.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Player } from '@shared/types/room.js';
import type { IO, TypedSocket } from '../socket/types.js';
import {
  cleanupTripleGomoku,
  handleTripleGomokuAction,
  initTripleGomoku,
} from '../socket/games/triple-gomoku/index.js';
import { tripleGomokuStates } from '../socket/games/triple-gomoku/state.js';
import {
  cleanupKingmaking,
  handleKingmakingAction,
  initKingmaking,
} from '../socket/games/kingmaking/index.js';
import { kingmakingStates } from '../socket/games/kingmaking/state.js';
import { sessions } from '../store/sessions.js';

const socketIds = new Set<string>();
const roomIds = new Set<string>();

function player(id: string, nickname: string): Player {
  return { id, nickname, isHost: true, isReady: true, joinedAt: Date.now() };
}

function ioStub() {
  return { in: () => ({ fetchSockets: async () => [] }) } as unknown as IO;
}

function socketFor(playerId: string) {
  const socketId = `socket-${playerId}`;
  socketIds.add(socketId);
  sessions.linkToken(socketId, playerId);
  return { id: socketId, emit: vi.fn() } as unknown as TypedSocket;
}

afterEach(() => {
  for (const roomId of roomIds) {
    cleanupTripleGomoku(roomId);
    cleanupKingmaking(roomId);
  }
  for (const socketId of socketIds) sessions.removeSession(socketId);
  roomIds.clear();
  socketIds.clear();
});

describe('1:1 솔로 좌석', () => {
  it('삼층 오목 — 혼자서 선·후 두 자리를 이어서 둔다', () => {
    const roomId = 'solo-tg';
    roomIds.add(roomId);
    const human = player('solo-human', '혼자');
    const socket = socketFor(human.id);
    const io = ioStub();

    initTripleGomoku(io, roomId, [human], 'solo', Date.now(), null, vi.fn());
    const state = tripleGomokuStates.get(roomId)!;

    /* 두 자리가 생기고, 후 자리는 사람의 소켓 토큰이 아니다 */
    expect(state.players).toHaveLength(2);
    expect(state.players[0].id).toBe(human.id);
    expect(state.players[1].id).toBe(`${human.id}#review`);
    expect(state.currentPlayerId).toBe(human.id);

    /*
      배치 단계 — 중앙과 자기 돌 옆은 못 둔다. 서로 멀리 떨어진 칸으로만 놓는다.
      순서(TG_SETUP_SEQUENCE)는 한 쪽이 연달아 두기도 하므로, 차례를 짚지 않고
      '한 소켓으로 계속 두어 두 자리에 모두 돌이 놓이는가' 만 본다.
    */
    const secondSeat = state.players[1].id;
    const spots = [
      { q: -4, r: 0 },
      { q: 4, r: 0 },
      { q: 0, r: 4 },
      { q: 0, r: -4 },
      { q: -4, r: 4 },
      { q: 4, r: -4 },
    ];
    for (const to of spots) {
      handleTripleGomokuAction(io, socket, roomId, { type: 'place', to });
    }

    const owners = new Set(Object.values(state.board).flat());
    expect(owners.has(human.id)).toBe(true);
    expect(owners.has(secondSeat)).toBe(true);
  });

  it('킹메이킹 — 혼자서 선·후 두 자리를 이어서 둔다', () => {
    const roomId = 'solo-km';
    roomIds.add(roomId);
    const human = player('solo-human2', '혼자');
    const socket = socketFor(human.id);
    const io = ioStub();

    initKingmaking(io, roomId, [human], 'solo', Date.now(), null, vi.fn());
    const state = kingmakingStates.get(roomId)!;

    expect(state.players).toHaveLength(2);
    expect(state.players[1].id).toBe(`${human.id}#review`);
    expect(state.currentPlayerId).toBe(human.id);

    handleKingmakingAction(io, socket, roomId, {
      type: 'place',
      kind: 'normal',
      to: { row: 0, col: 0 },
    });
    expect(state.board[0][0][0]).toMatchObject({ ownerId: human.id });

    const secondSeat = state.players[1].id;
    expect(state.currentPlayerId).toBe(secondSeat);

    handleKingmakingAction(io, socket, roomId, {
      type: 'place',
      kind: 'normal',
      to: { row: 4, col: 4 },
    });
    expect(state.board[4][4][0]).toMatchObject({ ownerId: secondSeat });
  });

  it('남이 끼어들어 대신 두지는 못한다', () => {
    const roomId = 'solo-tg2';
    roomIds.add(roomId);
    const human = player('solo-owner', '주인');
    const stranger = socketFor('남');
    const io = ioStub();

    initTripleGomoku(io, roomId, [human], 'solo', Date.now(), null, vi.fn());
    const state = tripleGomokuStates.get(roomId)!;

    handleTripleGomokuAction(io, stranger, roomId, { type: 'place', to: { q: -4, r: 0 } });
    expect(state.board['-4,0']).toBeUndefined();
  });
});
