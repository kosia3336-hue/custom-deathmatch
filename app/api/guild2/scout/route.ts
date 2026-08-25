import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { listPendingScoutInvites, listScoutTargets } from '@/lib/guild-v4/scout';

export const dynamic = 'force-dynamic';

function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/** GET /api/guild2/scout — 내게 온 스카우트 초대 */
export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) return jsonError('서비스 설정이 없습니다.', 503);
  const member = await getActiveMember();
  if (!member) return jsonError('로그인이 필요합니다.', 401);
  try {
    const invites = await listPendingScoutInvites(member.id);
    return NextResponse.json({ invites });
  } catch (err) {
    console.error('[guild2:scout:GET]', (err as Error).message);
    return jsonError('초대를 불러오지 못했습니다.', 500);
  }
}

/** POST /api/guild2/scout — 스카우트 대상 목록 */
export async function POST() {
  if (!isSupabaseServiceRoleConfigured()) return jsonError('서비스 설정이 없습니다.', 503);
  const member = await getActiveMember();
  if (!member) return jsonError('로그인이 필요합니다.', 401);

  try {
    const result = await listScoutTargets(member.id);
    if ('error' in result) return jsonError('길드장·부길드장만 볼 수 있습니다.', 403);
    return NextResponse.json({ rows: result });
  } catch (err) {
    console.error('[guild2:scout:POST]', (err as Error).message);
    return jsonError('대상을 불러오지 못했습니다.', 500);
  }
}
