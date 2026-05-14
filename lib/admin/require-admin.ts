import { getActiveMember } from '@/lib/auth/server';

export async function requireAdminMember() {
  const m = await getActiveMember();
  if (!m || m.role !== 'admin') return null;
  return m;
}
