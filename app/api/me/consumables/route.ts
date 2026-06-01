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
      { items: ALL_KINDS.map((kind) => ({ kind, count: 0, autoUse: true })) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }

  try {
    const sb = await getServerSupabase();

    // auto_use 컬럼 포함해서 시도, 없으면 컬럼 없이 재시도 (마이그레이션 미적용 대비)
    type RowWithAutoUse = { kind: string; count: number; auto_use: boolean; updated_at: string };
    type RowBase = { kind: string; count: number; updated_at: string };

    let rows: RowWithAutoUse[];
    let hasAutoUseColumn = true;

    const { data, error } = await sb
      .from('shop_consumable_inventory')
      .select('kind, count, auto_use, updated_at')
      .eq('member_id', member.id);

    if (error) {
      if (error.code === '42703') {
        // auto_use 컬럼 미존재 → 컬럼 없이 재조회
        hasAutoUseColumn = false;
        const { data: data2, error: error2 } = await sb
          .from('shop_consumable_inventory')
          .select('kind, count, updated_at')
          .eq('member_id', member.id);
        if (error2) throw error2;
        rows = ((data2 ?? []) as RowBase[]).map((r) => ({ ...r, auto_use: true }));
      } else {
        throw error;
      }
    } else {
      rows = (data ?? []) as RowWithAutoUse[];
    }

    const map = new Map<string, { count: number; autoUse: boolean; updatedAt: string | null }>();
    for (const r of rows) {
      map.set(r.kind, {
        count: Number(r.count),
        autoUse: hasAutoUseColumn ? (r.auto_use ?? true) : true,
        updatedAt: r.updated_at,
      });
    }

    const items = ALL_KINDS.map((kind) => {
      const v = map.get(kind);
      return {
        kind,
        count: v?.count ?? 0,
        autoUse: v?.autoUse ?? true,
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
      { items: ALL_KINDS.map((kind) => ({ kind, count: 0, autoUse: true })) },
      { headers: { 'Cache-Control': 'private, no-store' } },
    );
  }
}
