import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { GACHA_ID, GACHA_PRICE_CDP, LEGEND_PRIZE_DEF_ID } from './constants';
import { loadPoolContext } from './build-pool-data';
import { pickPrize } from './pick';
import type { GachaDrawResult, PickResult, PoolContext, ResolvedPrize } from './types';
import type { ConsumableKind } from '@/lib/supabase/database.types';

export class GachaDrawError extends Error {
  constructor(
    message: string,
    public code: string,
  ) {
    super(message);
  }
}

async function upsertConsumable(
  sb: SupabaseClient,
  memberId: string,
  kind: ConsumableKind,
  qty: number,
): Promise<number> {
  const { data: existing } = await sb
    .from('shop_consumable_inventory')
    .select('count')
    .eq('member_id', memberId)
    .eq('kind', kind)
    .maybeSingle();
  const prev = Number((existing as { count?: number } | null)?.count ?? 0);
  const next = prev + qty;
  const { error } = await sb.from('shop_consumable_inventory').upsert(
    { member_id: memberId, kind, count: next, updated_at: new Date().toISOString() },
    { onConflict: 'member_id,kind' },
  );
  if (error) throw new GachaDrawError(error.message, 'internal_error');
  return next;
}

async function grantSkin7d(sb: SupabaseClient, memberId: string, skinId: string): Promise<string> {
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: row } = await sb
    .from('member_skins')
    .select('id, expires_at')
    .eq('member_id', memberId)
    .eq('skin_id', skinId)
    .is('revoked_at', null)
    .maybeSingle();

  const existing = row as { id: number; expires_at: string | null } | null;
  if (existing?.expires_at === null) {
    throw new GachaDrawError('permanent_skin', 'internal_error');
  }

  if (existing) {
    const base = new Date(
      Math.max(Date.now(), new Date(existing.expires_at ?? Date.now()).getTime()),
    );
    const newExp = new Date(base.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString();
    await sb.from('member_skins').update({ expires_at: newExp }).eq('id', existing.id);
    return newExp;
  }

  const { error } = await sb.from('member_skins').insert({
    member_id: memberId,
    skin_id: skinId,
    equipped: false,
    expires_at: expiresAt,
  });
  if (error) throw new GachaDrawError(error.message, 'internal_error');
  return expiresAt;
}

async function grantTitle(sb: SupabaseClient, memberId: string, titleId: string): Promise<void> {
  const { error } = await sb.from('member_titles').insert({
    member_id: memberId,
    title_id: titleId,
    granted_at: new Date().toISOString(),
  });
  if (error && !error.message.includes('duplicate')) {
    throw new GachaDrawError(error.message, 'internal_error');
  }
}

async function applyResolved(
  sb: SupabaseClient,
  memberId: string,
  resolved: ResolvedPrize,
): Promise<ResolvedPrize> {
  if (resolved.kind === 'nothing') return resolved;
  if (resolved.kind === 'cdp') return resolved;
  if (resolved.kind === 'consumable') {
    await upsertConsumable(sb, memberId, resolved.consumableKind, resolved.qty);
    return resolved;
  }
  if (resolved.kind === 'skin') {
    const expiresAt = await grantSkin7d(sb, memberId, resolved.skinId);
    return { ...resolved, expiresAt };
  }
  if (resolved.kind === 'title') {
    await grantTitle(sb, memberId, resolved.titleId);
    return resolved;
  }
  if (resolved.kind === 'legend') {
    await grantTitle(sb, memberId, resolved.titleId);
    return resolved;
  }
  return resolved;
}

function pickWithLegendGuard(ctx: PoolContext, maxAttempts = 5): PickResult {
  let localCtx = ctx;
  for (let i = 0; i < maxAttempts; i++) {
    const pick = pickPrize(localCtx, i);
    if (pick.prizeDefId === LEGEND_PRIZE_DEF_ID && localCtx.legendClaimedGlobally) {
      localCtx = { ...localCtx, legendClaimedGlobally: true };
      continue;
    }
    return pick;
  }
  throw new GachaDrawError('pick_failed', 'internal_error');
}

export async function executeGachaDraw(
  sb: SupabaseClient,
  memberId: string,
  gachaId = GACHA_ID,
  payWith: 'cdp' | 'ticket' = 'cdp',
): Promise<GachaDrawResult> {
  // 티켓 결제는 CDP를 차감하는 draw_gacha RPC를 우회하고 TS 경로로 처리한다.
  if (payWith === 'cdp') {
    // RPC 우선 (마이그레이션 적용 시)
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb.rpc as any)('draw_gacha', {
        p_member_id: memberId,
        p_gacha_id: gachaId,
      });
      if (!error && data) {
        const row = Array.isArray(data) ? data[0] : data;
        if (row) return mapRpcDrawRow(row);
      }
      if (error && !isRpcMissing(error)) {
        throw mapRpcToGachaError(error);
      }
    } catch (e) {
      if (e instanceof GachaDrawError) throw e;
      if (!isRpcMissing(e)) {
        console.warn('[gacha] RPC draw_gacha 실패, TS 폴백:', (e as Error).message);
      }
    }
  }

  return executeGachaDrawTs(sb, memberId, gachaId, payWith);
}

function isRpcMissing(err: unknown): boolean {
  const msg = (err as { message?: string })?.message ?? '';
  return msg.includes('draw_gacha') && (msg.includes('does not exist') || msg.includes('Could not find'));
}

function mapRpcToGachaError(error: { message?: string }): GachaDrawError {
  const msg = error.message ?? '';
  if (msg.includes('insufficient_balance')) return new GachaDrawError(msg, 'insufficient_balance');
  if (msg.includes('member_not_active')) return new GachaDrawError(msg, 'member_not_active');
  if (msg.includes('gacha_inactive')) return new GachaDrawError(msg, 'gacha_inactive');
  return new GachaDrawError(msg, 'internal_error');
}

function mapRpcDrawRow(row: Record<string, unknown>): GachaDrawResult {
  const resolved = row.resolved_payload as ResolvedPrize;
  return {
    ok: true,
    drawId: String(row.draw_id),
    grade: row.grade as GachaDrawResult['grade'],
    prizeDefId: String(row.prize_def_id),
    displayName: String(row.display_name),
    resolved,
    newBalance: Number(row.new_balance),
    legendClaimed: Boolean(row.legend_claimed),
  };
}

async function executeGachaDrawTs(
  sb: SupabaseClient,
  memberId: string,
  gachaId: string,
  payWith: 'cdp' | 'ticket' = 'cdp',
  forcedCtx?: PoolContext,
  depth = 0,
): Promise<GachaDrawResult> {
  if (depth > 3) throw new GachaDrawError('draw_reroll_exhausted', 'internal_error');
  const { data: banner } = await sb
    .from('gacha_banners')
    .select('price_cdp, is_active, name')
    .eq('id', gachaId)
    .maybeSingle();

  if (!banner || !(banner as { is_active: boolean }).is_active) {
    throw new GachaDrawError('gacha_inactive', 'gacha_inactive');
  }

  const price = Number((banner as { price_cdp: number }).price_cdp ?? GACHA_PRICE_CDP);

  const ctx = forcedCtx ?? (await loadPoolContext(sb, memberId));
  const pick = pickWithLegendGuard(ctx);

  await sb.from('member_cdp').upsert({ member_id: memberId }, { onConflict: 'member_id' });
  const { data: cdpRow, error: cdpErr } = await sb
    .from('member_cdp')
    .select('balance')
    .eq('member_id', memberId)
    .single();
  if (cdpErr) throw new GachaDrawError(cdpErr.message, 'internal_error');

  const balance = Number((cdpRow as { balance: number }).balance ?? 0);

  // ── 결제 수단 검증 ──────────────────────────────────────────
  //  cdp   : CDP 잔액 >= price 확인 → price 만큼 차감
  //  ticket: gacha_ticket 1장 확인 → 1장 차감 (CDP 미차감)
  if (payWith === 'cdp' && balance < price) {
    throw new GachaDrawError('insufficient_balance', 'insufficient_balance');
  }
  if (payWith === 'ticket') {
    const { data: tRow } = await sb
      .from('shop_consumable_inventory')
      .select('count')
      .eq('member_id', memberId)
      .eq('kind', 'gacha_ticket')
      .maybeSingle();
    if (Number((tRow as { count?: number } | null)?.count ?? 0) < 1) {
      throw new GachaDrawError('insufficient_ticket', 'insufficient_ticket');
    }
  }

  const pricePaid = payWith === 'cdp' ? price : 0;
  let newBalance = balance - pricePaid;

  const { data: drawRow, error: drawErr } = await sb
    .from('gacha_draws')
    .insert({
      gacha_id: gachaId,
      member_id: memberId,
      price_paid: pricePaid,
      grade: pick.grade,
      prize_def_id: pick.prizeDefId,
      resolved_payload: {},
    })
    .select('id')
    .single();
  if (drawErr) throw new GachaDrawError(drawErr.message, 'internal_error');
  const drawId = (drawRow as { id: string }).id;

  let legendClaimed = false;

  if (pick.prizeDefId === LEGEND_PRIZE_DEF_ID) {
    const { error: claimErr } = await sb.from('gacha_global_claims').insert({
      prize_def_id: LEGEND_PRIZE_DEF_ID,
      member_id: memberId,
      draw_id: drawId,
    });
    if (claimErr) {
      await sb.from('gacha_draws').delete().eq('id', drawId);
      return executeGachaDrawTs(
        sb,
        memberId,
        gachaId,
        payWith,
        { ...ctx, legendClaimedGlobally: true },
        depth + 1,
      );
    }
    legendClaimed = true;
  }

  // ── 비용 차감 ──────────────────────────────────────────────
  if (payWith === 'cdp') {
    const { data: spentRow } = await sb.from('member_cdp').select('total_spent').eq('member_id', memberId).single();
    const totalSpent = Number((spentRow as { total_spent?: number } | null)?.total_spent ?? 0);
    const { error: deductErr } = await sb
      .from('member_cdp')
      .update({
        balance: newBalance,
        total_spent: totalSpent + price,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId);
    if (deductErr) throw new GachaDrawError(deductErr.message, 'internal_error');

    await sb.from('cdp_ledger').insert({
      member_id: memberId,
      delta: -price,
      balance_after: newBalance,
      reason: 'gacha_draw',
      ref_kind: 'gacha_draw',
      ref_id: drawId,
      metadata: { grade: pick.grade, prizeDefId: pick.prizeDefId },
    });
  } else {
    // ticket: 뽑기권 1장 차감
    const { data: tRow } = await sb
      .from('shop_consumable_inventory')
      .select('count')
      .eq('member_id', memberId)
      .eq('kind', 'gacha_ticket')
      .maybeSingle();
    const ticketsNow = Number((tRow as { count?: number } | null)?.count ?? 0);
    const { error: tErr } = await sb
      .from('shop_consumable_inventory')
      .update({ count: Math.max(0, ticketsNow - 1), updated_at: new Date().toISOString() })
      .eq('member_id', memberId)
      .eq('kind', 'gacha_ticket');
    if (tErr) throw new GachaDrawError(tErr.message, 'internal_error');
  }

  let resolved = await applyResolved(sb, memberId, pick.resolved);

  if (resolved.kind === 'cdp') {
    newBalance += resolved.amount;
    await sb.from('member_cdp').update({ balance: newBalance, updated_at: new Date().toISOString() }).eq('member_id', memberId);
    await sb.from('cdp_ledger').insert({
      member_id: memberId,
      delta: resolved.amount,
      balance_after: newBalance,
      reason: 'gacha_draw',
      ref_kind: 'gacha_draw',
      ref_id: drawId,
      metadata: { prize: 'c_cdp_150', refund: true },
    });
  }

  await sb
    .from('gacha_draws')
    .update({ resolved_payload: resolved })
    .eq('id', drawId);

  return {
    ok: true,
    drawId,
    grade: pick.grade,
    prizeDefId: pick.prizeDefId,
    displayName: pick.displayName,
    resolved,
    newBalance,
    legendClaimed,
  };
}
