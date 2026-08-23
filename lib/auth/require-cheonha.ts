import { getActiveMember, type CurrentMember } from '@/lib/auth/server';

/** GNB 데브 전환. 닉 천하 + 관리자만. */
export async function requireCheonhaAdmin(): Promise<CurrentMember | null> {
  const m = await getActiveMember();
  if (!m || m.role !== 'admin' || m.nickname !== '천하') return null;
  return m;
}
