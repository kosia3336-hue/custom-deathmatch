import { describe, expect, it } from 'vitest';
import type { Player, Room } from '@shared/types/room.js';
import { applyGameTurnOrder } from '../socket/gameTurnOrder.js';

function player(id: string): Player {
  return {
    id,
    nickname: id,
    isHost: id === 'first',
    isReady: true,
    joinedAt: 0,
  };
}

function room(turnOrderMode: Room['turnOrderMode']): Room {
  return {
    id: 'turn-order-test',
    title: '선후공 테스트',
    gameId: 'game-001',
    gameName: '사중력 사목',
    playMode: 'multi',
    roomType: 'public',
    maxPlayers: 2,
    players: [player('first'), player('second')],
    spectators: [],
    status: 'waiting',
    hostId: 'first',
    inviteToken: null,
    timeLimitSeconds: null,
    gameOptions: {},
    turnOrderMode,
    createdAt: 0,
  };
}

describe('applyGameTurnOrder', () => {
  it('랜덤 결과가 뒤집힘이면 엔진 반환값과 방 저장 순서를 함께 바꾼다', () => {
    const target = room('random');

    const selected = applyGameTurnOrder(target, 0.25);

    expect(selected.map((item) => item.id)).toEqual(['second', 'first']);
    expect(target.players.map((item) => item.id)).toEqual(['second', 'first']);
  });

  it('고정 선후공은 방의 순서를 유지한다', () => {
    const target = room('fixed');

    applyGameTurnOrder(target, 0.25);

    expect(target.players.map((item) => item.id)).toEqual(['first', 'second']);
  });
});
