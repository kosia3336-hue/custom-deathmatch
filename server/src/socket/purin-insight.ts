import type { PlayMode } from '@shared/types/room.js';

export const PURIN_INSIGHT_NICKNAME = '푸린';

export function isPurinInsightPlayMode(playMode: PlayMode): boolean {
  return playMode === 'multi' || playMode === 'com';
}

export function isPurinInsightViewer(
  playMode: PlayMode,
  viewerId: string,
  p1: { id: string; nickname: string },
  p2: { id: string; nickname: string },
): boolean {
  if (!isPurinInsightPlayMode(playMode)) return false;
  if (viewerId !== p1.id && viewerId !== p2.id) return false;
  const nick = viewerId === p1.id ? p1.nickname : p2.nickname;
  return nick === PURIN_INSIGHT_NICKNAME;
}
