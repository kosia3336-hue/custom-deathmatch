/**
 * PATCH /api/me/consumables/auto-use
 * body: { kind: ConsumableKind; autoUse: boolean }
 *
 * 자동사용 on/off 설정. 행이 없으면 count=0으로 upsert.
 */

import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getServerSupabase } from '@/lib/supabase/server';
import type { ConsumableKind } from '@/lib/cdp/types';

const AUTO_USE_KINDS: ConsumableKind[] = ['spectator_lock', 'anonymity', 'magnifier'];

export async function PATCH(req: Request) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인 필요' }, { status: 401 });

  let body: { kind: ConsumableKind; autoUse: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const { kind, autoUse } = body;
  if (!AUTO_USE_KINDS.includes(kind) || typeof autoUse !== 'boolean') {
    return NextResponse.json({ error: '잘못된 요청' }, { status: 400 });
  }

  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  // UPDATE 시도 → 행 없으면 INSERT (count는 건드리지 않음)
  const { data: updated, error: updateErr } = await db
    .from('shop_consumable_inventory')
    .update({ auto_use: autoUse })
    .eq('member_id', member.id)
    .eq('kind', kind)
    .select('member_id');

  if (updateErr) {
    console.warn('[me/consumables/auto-use] update 실패:', updateErr.message);
    return NextResponse.json({ error: '저장 실패' }, { status: 500 });
  }

  if (!updated || updated.length === 0) {
    // 행이 없으면 count=0으로 신규 삽입
    const { error: insertErr } = await db
      .from('shop_consumable_inventory')
      .insert({ member_id: member.id, kind, count: 0, auto_use: autoUse });
    if (insertErr) {
      console.warn('[me/consumables/auto-use] insert 실패:', insertErr.message);
      return NextResponse.json({ error: '저장 실패' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, kind, autoUse });
}
