/**
 * POST /api/admin/consumables/search — 회원 검색 + 인벤토리 조인.
 *  body: { query: string }
 *
 *  - 어드민 페이지 "소모성 조정" 탭에서 회원을 찾을 때 사용.
 *  - 닉 ILIKE 검색 후 4종 인벤토리 (없으면 0) 함께 반환.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import type { ConsumableKind } from '@/lib/cdp/types';

export const dynamic = 'force-dynamic';

interface SearchBody {
  query?: string;
}

interface MemberSel {
  id: string;
  nickname: string;
}

interface InvSel {
  member_id: string;
  kind: string;
  count: number;
}

const ALL_KINDS: ConsumableKind[] = [
  'nickname_change',
  'rank_reset',
  'spectator_lock',
  'anonymity',
  'magnifier',
  'ban_eraser',
  'gacha_box',
  'gacha_ticket',
  'guild_charter',
  'word_search',
];

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없습니다.', 503);

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

    const { data: invRows } = await sb
      .from('shop_consumable_inventory')
      .select('member_id, kind, count')
      .in('member_id', memberIds);

    const invMap = new Map<string, Map<string, number>>();
    for (const r of (invRows ?? []) as unknown as InvSel[]) {
      let m = invMap.get(r.member_id);
      if (!m) {
        m = new Map();
        invMap.set(r.member_id, m);
      }
      m.set(r.kind, Number(r.count));
    }

    const rows = memberRows.map((m) => {
      const counts = invMap.get(m.id);
      const inventory = ALL_KINDS.reduce<Record<ConsumableKind, number>>((acc, k) => {
        acc[k] = counts?.get(k) ?? 0;
        return acc;
      }, { nickname_change: 0, rank_reset: 0, spectator_lock: 0, anonymity: 0, magnifier: 0, ban_eraser: 0, gacha_box: 0, gacha_ticket: 0, guild_charter: 0, word_search: 0 });
      return { memberId: m.id, nickname: m.nickname, inventory };
    });

    return NextResponse.json({ rows });
  } catch (e) {
    console.warn('[admin/consumables/search]', (e as Error).message);
    return err('검색 실패', 500);
  }
}
