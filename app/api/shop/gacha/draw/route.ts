import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  notifyCdpAdjusted,
  notifyHiddenTitleCheck,
  notifyInvalidateBiasTitles,
  notifyInvalidateOwnedTitles,
  notifyInventoryUpdated,
} from '@/lib/cdp/notify';
import { executeGachaDraw, GachaDrawError } from '@/lib/gacha/execute-draw';
import type { ConsumableKind } from '@/lib/cdp/types';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

interface DrawBody {
  gachaId?: string;
  /** true 면 CDP 대신 뽑기권(gacha_ticket) 1장으로 뽑기 */
  useTicket?: boolean;
}

export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요해요.', code: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: '서비스 설정이 없어요.', code: 'service_unavailable' },
      { status: 503 },
    );
  }

  let body: DrawBody = {};
  try {
    body = (await req.json()) as DrawBody;
  } catch {
    body = {};
  }

  const gachaId = body.gachaId ?? 'default';
  const useTicket = body.useTicket === true;
  const sb = getSupabaseServiceRole();

  try {
    const result = await executeGachaDraw(sb, member.id, gachaId, useTicket ? 'ticket' : 'cdp');

    // 뽑기권 결제 시 CDP 비용은 0 (상품이 CDP면 그만큼만 증가)
    const cost = useTicket ? 0 : 100;
    const delta =
      result.resolved.kind === 'cdp'
        ? -cost + result.resolved.amount
        : -cost;

    void notifyCdpAdjusted({
      memberId: member.id,
      newBalance: result.newBalance,
      delta,
      reason: 'shop_purchase',
      ref: { kind: 'gacha_draw', id: result.drawId },
    });

    // 뽑기권 결제 시 뽑기권 잔량 갱신 통보
    if (useTicket) {
      try {
        const { data: tRow } = await sb
          .from('shop_consumable_inventory')
          .select('count')
          .eq('member_id', member.id)
          .eq('kind', 'gacha_ticket')
          .maybeSingle();
        void notifyInventoryUpdated({
          memberId: member.id,
          kind: 'gacha_ticket',
          countAfter: Number((tRow as { count?: number } | null)?.count ?? 0),
          reason: 'manual_use',
          ref: { kind: 'gacha_draw', id: result.drawId },
        });
      } catch {
        // ignore
      }
    }

    if (result.resolved.kind === 'consumable') {
      try {
        const { data: invRow } = await sb
          .from('shop_consumable_inventory')
          .select('count')
          .eq('member_id', member.id)
          .eq('kind', result.resolved.consumableKind)
          .maybeSingle();
        void notifyInventoryUpdated({
          memberId: member.id,
          kind: result.resolved.consumableKind as ConsumableKind,
          countAfter: Number((invRow as { count?: number } | null)?.count ?? 0),
          reason: 'purchase',
          ref: { kind: 'gacha_draw', id: result.drawId },
        });
      } catch {
        // ignore
      }
    }

    if (result.resolved.kind === 'title' || result.resolved.kind === 'legend') {
      void notifyInvalidateBiasTitles();
      void notifyInvalidateOwnedTitles(member.id);
      void notifyHiddenTitleCheck('title_granted', member.id);
    }

    return NextResponse.json(result);
  } catch (e) {
    if (e instanceof GachaDrawError) {
      const status =
        e.code === 'insufficient_balance' ? 402
        : e.code === 'insufficient_ticket' ? 409
        : e.code === 'gacha_inactive' ? 404
        : e.code === 'member_not_active' ? 403
        : 500;
      const msg =
        e.code === 'insufficient_balance' ? 'CDP가 부족해요.'
        : e.code === 'insufficient_ticket' ? '뽑기권이 없어요.'
        : e.code === 'gacha_inactive' ? '뽑기가 준비 중이에요.'
        : '뽑기에 실패했어요.';
      return NextResponse.json({ error: msg, code: e.code }, { status });
    }
    console.error('[gacha/draw]', e);
    return NextResponse.json({ error: '뽑기에 실패했어요.', code: 'internal_error' }, { status: 500 });
  }
}
