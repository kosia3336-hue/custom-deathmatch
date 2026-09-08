import type { Player, Room } from '@shared/types/room.js';

/**
 * 한 판에서 사용할 선후공을 확정하고 방의 참가자 순서에도 반영한다.
 * 기록 저장은 room.players 순서를 사용하므로 엔진에만 뒤집힌 배열을 넘기면 안 된다.
 */
export function applyGameTurnOrder(room: Room, randomValue = Math.random()): Player[] {
  if (room.turnOrderMode === 'random' && room.players.length === 2 && randomValue < 0.5) {
    [room.players[0], room.players[1]] = [room.players[1], room.players[0]];
  }
  return room.players;
}
