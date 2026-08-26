import { getActiveMember, type CurrentMember } from '@/lib/auth/server';

/** GNB 데브 전환. 천하(관리자) 또는 더미 세션. */
export async function requireDevSwitchActor(): Promise<CurrentMember | null> {
  const m = await getActiveMember();
  if (!m?.canDevSwitch) return null;
  return m;
}
