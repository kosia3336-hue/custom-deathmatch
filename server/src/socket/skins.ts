/**
 * 룸별 활성 스킨 관리.
 *
 * OR 규칙: 플레이어 중 한 명이라도 해당 게임 스킨을 착용했으면 그 스킨이 적용된다.
 * 게임 시작 시 1회 확정하고, 종료까지 유지한다.
 */

import type { Player } from '@shared/types/room.js';

const roomActiveSkin = new Map<string, string | null>();

/** 플레이어 목록 + 게임 ID 로 적용할 스킨을 계산한다 (OR 규칙, 첫 매치 우선) */
export function resolveActiveSkin(players: Player[], gameId: string): string | null {
  for (const p of players) {
    for (const s of p.equippedSkins ?? []) {
      if (s.gameId === gameId) return s.skinId;
    }
  }
  return null;
}

/** 게임 시작 시 호출 — 룸의 활성 스킨을 확정 저장 */
export function setActiveSkinForRoom(roomId: string, players: Player[], gameId: string): void {
  roomActiveSkin.set(roomId, resolveActiveSkin(players, gameId));
}

export function getActiveSkin(roomId: string): string | null {
  return roomActiveSkin.get(roomId) ?? null;
}

export function clearActiveSkin(roomId: string): void {
  roomActiveSkin.delete(roomId);
}
