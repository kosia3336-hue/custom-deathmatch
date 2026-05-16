/**
 * GET /api/me/consumables
 *  - 본인 소모성 인벤토리 (kind → count) 반환.
 *  - 비로그인 / 비활성 회원은 빈 객체.
 */

import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { ConsumableKind } from '@/lib/cdp/types';

export const dynamic = 'force-dynamic';

const ALL_KINDS: ConsumableKind[] = [
  'nickname_change',
  'rank_reset',
  'spectator_lock',
  'anonymity',
  'magnifier',
  'ban_eraser',
];

export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { items: ALL_KINDS.map((kind) => ({ kind, count: 0 })) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const sb = await getServerSupabase();
    const { data, error } = await sb
      .from('shop_consumable_inventory')
      .select('kind, count, updated_at')
      .eq('member_id', member.id);

    if (error) throw error;

    const map = new Map<string, { count: number; updatedAt: string | null }>();
    for (const r of (data ?? []) as Array<{ kind: string; count: number; updated_at: string }>) {
      map.set(r.kind, { count: Number(r.count), updatedAt: r.updated_at });
    }

    const items = ALL_KINDS.map((kind) => {
      const v = map.get(kind);
      return {
        kind,
        count: v?.count ?? 0,
        updatedAt: v?.updatedAt ?? null,
      };
    });

    return NextResponse.json(
      { items },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  } catch (err) {
    console.warn('[me/consumables] fetch 실패:', (err as Error).message);
    return NextResponse.json(
      { items: ALL_KINDS.map((kind) => ({ kind, count: 0 })) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
