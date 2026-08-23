import type { LiveDummyRuntime } from './roster.js';

const memberIds = new Set<string>();
const byMemberId = new Map<string, LiveDummyRuntime>();
const memberIdBySocket = new Map<string, string>();

export function registerLiveDummy(memberId: string, dummy: LiveDummyRuntime): void {
  memberIds.add(memberId);
  byMemberId.set(memberId, dummy);
  memberIdBySocket.set(dummy.socketId, memberId);
}

export function getLiveDummyRuntime(memberId: string | null | undefined): LiveDummyRuntime | undefined {
  if (!memberId) return undefined;
  return byMemberId.get(memberId);
}

export function getLiveDummyMemberIdBySocket(socketId: string): string | undefined {
  return memberIdBySocket.get(socketId);
}

/** @deprecated 타이탄만 쓰던 API. 첫 등록 더미 id. */
export function setLiveDummyMemberId(id: string | null): void {
  if (!id) return;
}

export function getLiveDummyMemberId(): string | null {
  return [...memberIds][0] ?? null;
}

export function isLiveDummyMemberId(memberId: string | null | undefined): boolean {
  return !!memberId && memberIds.has(memberId);
}

export function listLiveDummyMemberIds(): string[] {
  return [...memberIds];
}

/** startLiveDummy가 등록한 전원. 채팅 접속·식별은 이 맵을 돈다. */
export function listRegisteredLiveDummies(): { memberId: string; dummy: LiveDummyRuntime }[] {
  return [...byMemberId.entries()].map(([memberId, dummy]) => ({ memberId, dummy }));
}

export function resetLiveDummyStateForTests(): void {
  memberIds.clear();
  byMemberId.clear();
  memberIdBySocket.clear();
}
