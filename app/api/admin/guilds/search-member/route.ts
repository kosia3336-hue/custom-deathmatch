import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** POST /api/admin/guilds/search-member — 미가입 회원만 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없습니다.', 503);

  let body: { query?: string };
  try {
    body = (await req.json()) as { query?: string };
  } catch {
    return err('잘못된 JSON');
  }

  const query = String(body.query ?? '').trim();
  if (query.length < 2) return err('닉네임 2자 이상');

  const sb = getSupabaseServiceRole();
  const { data: members } = await sb
    .from('members')
    .select('id, nickname')
    .is('withdrawn_at', null)
    .ilike('nickname', `%${query}%`)
    .limit(20);
  const rows = (members ?? []) as { id: string; nickname: string }[];
  if (rows.length === 0) return NextResponse.json({ rows: [] });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: memberships } = await (sb as any)
    .from('guild_members')
    .select('member_id')
    .in(
      'member_id',
      rows.map((r) => r.id),
    );
  const taken = new Set(
    ((memberships ?? []) as { member_id: string }[]).map((r) => r.member_id),
  );

  return NextResponse.json({
    rows: rows.filter((r) => !taken.has(r.id)).map((r) => ({ memberId: r.id, nickname: r.nickname })),
  });
}
