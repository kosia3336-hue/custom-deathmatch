'use client';

import { getOrCreateSessionToken } from '@/lib/socket';

/**
 * 현재 플레이어의 고유 ID를 반환합니다.
 * Player.id = localStorage 세션 토큰 (재연결 후에도 동일)
 */
export function useMySocketId(): string {
  return getOrCreateSessionToken();
}
