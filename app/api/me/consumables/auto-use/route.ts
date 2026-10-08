/**
 * PATCH /api/me/consumables/auto-use
 * body: { kind: ConsumableKind; autoUse: boolean }
 *
 * 자동사용 on/off 설정. 행이 없으면 count=0으로 upsert.
 */

import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import type { ConsumableKind } from '@/lib/cdp/types';

const AUTO_USE_KINDS: ConsumableKind[] = ['spectator_lock', 'anonymity', 'magnifier', 'word_search', 'counter_charm', 'calm_charm', 'demotion_shield'];

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

  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }

  // 회원 세션이 아니라 서버 권한으로 쓴다. 회원 세션에 이 테이블 쓰기 정책을
  // 열어 두면 브라우저에서 count 를 직접 고칠 수 있다 — 여기서는 auto_use 만 바꾼다.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;

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
    // 행이 없으면 count=0으로 신규 삽입 (그 사이 생긴 행의 count 는 건드리지 않는다)
    const { error: insertErr } = await db
      .from('shop_consumable_inventory')
      .upsert(
        { member_id: member.id, kind, count: 0, auto_use: autoUse },
        { onConflict: 'member_id,kind', ignoreDuplicates: true },
      );
    if (insertErr) {
      console.warn('[me/consumables/auto-use] insert 실패:', insertErr.message);
      return NextResponse.json({ error: '저장 실패' }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true, kind, autoUse });
}
