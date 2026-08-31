import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

const LIMIT = 20;

/**
 * GET /api/admin/member-search?q=닉네임
 *
 * 관리자 화면에서 회원을 닉네임으로 찾는다. UUID 는 DB 안에서만 쓰고
 * 사람은 닉네임으로 고르게 하기 위한 것이다. 결과의 id 는 화면에 보이지 않고
 * 발송 요청에만 실려 나간다.
 */
export async function GET(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return NextResponse.json({ error: '권한이 없습니다.' }, { status: 403 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  const q = (req.nextUrl.searchParams.get('q') ?? '').trim();
  if (q.length < 1) return NextResponse.json({ items: [] });
  if (q.length > 40) return NextResponse.json({ error: '검색어가 너무 깁니다.' }, { status: 400 });

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.from('members') as any)
    .select('id, nickname')
    .ilike('nickname', `%${q}%`)
    .is('withdrawn_at', null)
    .order('nickname')
    .limit(LIMIT);

  if (error) {
    console.warn('[admin:member-search]', error.message);
    return NextResponse.json({ error: '검색에 실패했습니다.' }, { status: 500 });
  }

  const items = ((data ?? []) as { id: string; nickname: string }[]).map((m) => ({
    id: m.id,
    nickname: m.nickname,
  }));
  return NextResponse.json({ items });
}
