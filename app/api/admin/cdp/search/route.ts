import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

interface SearchBody {
  query?: string;
}

interface MemberSel {
  id: string;
  nickname: string;
}

interface CdpSel {
  member_id: string;
  balance: number;
  total_earned: number;
  total_spent: number;
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/**
 * POST /api/admin/cdp/search — 닉 검색 → 잔액 조인 (어드민 전용).
 * query 2자 이상 부분일치 (ILIKE).
 */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없어요.', 503);

  let body: SearchBody;
  try {
    body = (await req.json()) as SearchBody;
  } catch {
    return err('잘못된 JSON');
  }

  const query = String(body.query ?? '').trim();
  if (query.length < 2) return NextResponse.json({ rows: [] });

  try {
    const sb = getSupabaseServiceRole();
    const { data: members, error: mErr } = await sb
      .from('members')
      .select('id, nickname')
      .ilike('nickname', `%${query}%`)
      .is('withdrawn_at', null)
      .limit(20);

    if (mErr || !members?.length) return NextResponse.json({ rows: [] });

    const memberRows = members as unknown as MemberSel[];
    const memberIds = memberRows.map((m) => m.id);

    const { data: cdpRows } = await sb
      .from('member_cdp')
      .select('member_id, balance, total_earned, total_spent')
      .in('member_id', memberIds);

    const cdpMap = new Map<string, CdpSel>();
    for (const r of (cdpRows ?? []) as unknown as CdpSel[]) {
      cdpMap.set(r.member_id, r);
    }

    const rows = memberRows.map((m) => {
      const c = cdpMap.get(m.id);
      return {
        memberId: m.id,
        nickname: m.nickname,
        balance: Number(c?.balance ?? 0),
        totalEarned: Number(c?.total_earned ?? 0),
        totalSpent: Number(c?.total_spent ?? 0),
      };
    });

    return NextResponse.json({ rows });
  } catch (e) {
    console.warn('[cdp:search]', (e as Error).message);
    return err('검색 실패', 500);
  }
}
