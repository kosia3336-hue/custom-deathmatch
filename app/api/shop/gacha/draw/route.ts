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
import { GACHA_MAX_BULK_COUNT } from '@/lib/gacha/constants';
import type { ConsumableKind } from '@/lib/cdp/types';
import type { GachaDrawResult } from '@/lib/gacha/types';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';

export const dynamic = 'force-dynamic';

type PayMode = 'auto' | 'cdp' | 'ticket';

interface DrawBody {
  gachaId?: string;
  /** @deprecated payMode 로 대체. true 면 뽑기권 우선 */
  useTicket?: boolean;
  /** 'auto' = 뽑기권 있으면 뽑기권 먼저, 없으면 CDP */
  payMode?: PayMode;
  /** 한 번에 뽑을 횟수 (1 ~ GACHA_MAX_BULK_COUNT) */
  count?: number;
}

async function readTicketCount(
  sb: ReturnType<typeof getSupabaseServiceRole>,
  memberId: string,
): Promise<number> {
  const { data } = await sb
    .from('shop_consumable_inventory')
    .select('count')
    .eq('member_id', memberId)
    .eq('kind', 'gacha_ticket')
    .maybeSingle();
  return Number((data as { count?: number } | null)?.count ?? 0);
}

export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: '서비스 설정이 없습니다.', code: 'service_unavailable' },
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
  const payMode: PayMode =
    body.payMode === 'cdp' || body.payMode === 'ticket' || body.payMode === 'auto'
      ? body.payMode
      : body.useTicket === true
        ? 'ticket'
        : 'auto';
  const count = Math.max(1, Math.min(GACHA_MAX_BULK_COUNT, Math.floor(Number(body.count ?? 1)) || 1));

  const sb = getSupabaseServiceRole();

  // 시작 시점의 잔액/뽑기권 — delta 계산과 auto 결제 판단에 사용
  const { data: startCdpRow } = await sb
    .from('member_cdp')
    .select('balance')
    .eq('member_id', member.id)
    .maybeSingle();
  const startBalance = Number((startCdpRow as { balance?: number } | null)?.balance ?? 0);
  let ticketsLeft = await readTicketCount(sb, member.id);
  const startTickets = ticketsLeft;

  const results: GachaDrawResult[] = [];
  const consumableKinds = new Set<ConsumableKind>();
  let grantedTitle = false;
  let newBalance = startBalance;
  let stopCode: string | null = null;
  let stopMessage: string | null = null;

  for (let i = 0; i < count; i++) {
    // auto: 뽑기권이 남아 있으면 뽑기권을 우선 소모한다.
    const payWith: 'cdp' | 'ticket' =
      payMode === 'cdp' ? 'cdp'
      : payMode === 'ticket' ? 'ticket'
      : ticketsLeft > 0 ? 'ticket' : 'cdp';

    try {
      const r = await executeGachaDraw(sb, member.id, gachaId, payWith);
      results.push(r);
      newBalance = r.newBalance;
      if (payWith === 'ticket') ticketsLeft = Math.max(0, ticketsLeft - 1);
      if (r.resolved.kind === 'consumable') {
        consumableKinds.add(r.resolved.consumableKind as ConsumableKind);
      }
      if (r.resolved.kind === 'title' || r.resolved.kind === 'legend') grantedTitle = true;
    } catch (e) {
      if (e instanceof GachaDrawError) {
        stopCode = e.code;
        stopMessage =
          e.code === 'insufficient_balance' ? 'CDP가 부족합니다.'
          : e.code === 'insufficient_ticket' ? '뽑기권이 없습니다.'
          : e.code === 'gacha_inactive' ? '뽑기가 준비 중입니다.'
          : '뽑기에 실패했습니다.';
      } else {
        console.error('[gacha/draw]', e);
        stopCode = 'internal_error';
        stopMessage = '뽑기에 실패했습니다.';
      }
      break;
    }
  }

  // 한 번도 못 뽑았으면 기존과 동일하게 에러 응답
  if (results.length === 0) {
    const status =
      stopCode === 'insufficient_balance' ? 402
      : stopCode === 'insufficient_ticket' ? 409
      : stopCode === 'gacha_inactive' ? 404
      : stopCode === 'member_not_active' ? 403
      : 500;
    return NextResponse.json(
      { error: stopMessage ?? '뽑기에 실패했습니다.', code: stopCode ?? 'internal_error' },
      { status },
    );
  }

  const lastDrawId = results[results.length - 1].drawId;
  const ticketsUsed = startTickets - ticketsLeft;

  const delta = newBalance - startBalance;
  if (delta !== 0) {
    void notifyCdpAdjusted({
      memberId: member.id,
      newBalance,
      delta,
      reason: 'shop_purchase',
      ref: { kind: 'gacha_draw', id: lastDrawId },
    });
  }

  if (ticketsUsed > 0) {
    try {
      void notifyInventoryUpdated({
        memberId: member.id,
        kind: 'gacha_ticket',
        countAfter: await readTicketCount(sb, member.id),
        reason: 'manual_use',
        ref: { kind: 'gacha_draw', id: lastDrawId },
      });
    } catch {
      // ignore
    }
  }

  for (const kind of consumableKinds) {
    try {
      const { data: invRow } = await sb
        .from('shop_consumable_inventory')
        .select('count')
        .eq('member_id', member.id)
        .eq('kind', kind)
        .maybeSingle();
      void notifyInventoryUpdated({
        memberId: member.id,
        kind,
        countAfter: Number((invRow as { count?: number } | null)?.count ?? 0),
        reason: 'purchase',
        ref: { kind: 'gacha_draw', id: lastDrawId },
      });
    } catch {
      // ignore
    }
  }

  if (grantedTitle) {
    void notifyInvalidateBiasTitles();
    void notifyInvalidateOwnedTitles(member.id);
    void notifyHiddenTitleCheck('title_granted', member.id);
  }

  // 단일 뽑기는 기존 응답 형태를 그대로 유지 (results 는 추가 필드)
  const head = results[0];
  return NextResponse.json({
    ...head,
    newBalance,
    results,
    requestedCount: count,
    drawnCount: results.length,
    ticketsUsed,
    ticketsLeft,
    ...(stopCode ? { stoppedCode: stopCode, stoppedError: stopMessage } : {}),
  });
}
