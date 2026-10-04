import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ConsumableKind, Database } from '@/lib/supabase/database.types';
import { loadPermanentlyClaimedEffectIds } from '@/lib/cdp/claimed-effects';
import { hasMerchantDiscount } from '@/lib/cdp/merchant';
import {
  notifyCdpAdjusted,
  notifyInvalidateBiasTitles,
  notifyInvalidateOwnedTitles,
  notifyInventoryUpdated,
} from '@/lib/cdp/notify';
import {
  devPackSlots,
  packPaidPrice,
  packPurchaseBlock,
  rollDevPackPair,
  type DevPackId,
  type DevPackReward,
} from '@/lib/shop/dev-pack';
import type { RankTier } from '@/shared/types/rank';

type Sb = SupabaseClient;

export class PackError extends Error {
  constructor(
    message: string,
    public code: 'insufficient_balance' | 'rank_too_low' | 'invalid_request' | 'conflict' | 'internal_error',
  ) {
    super(message);
  }
}

const PACK_EFFECT_KEYS = new Set(['issen', 'sakura', 'frost', 'lightning', 'wave', 'dojang']);

const CONSUMABLE_BY_NAME: Record<string, { kind: ConsumableKind; qty: number }> = {
  '밴 삭제권': { kind: 'ban_eraser', qty: 1 },
  '돋보기': { kind: 'magnifier', qty: 1 },
  '관전 잠금권': { kind: 'spectator_lock', qty: 1 },
  '카운터 부적': { kind: 'counter_charm', qty: 1 },
  '평온의 부적': { kind: 'calm_charm', qty: 1 },
  '익명물약': { kind: 'anonymity', qty: 1 },
  '검색 찬스': { kind: 'word_search', qty: 1 },
  '뽑기권 2장': { kind: 'gacha_ticket', qty: 2 },
  '돋보기 5개': { kind: 'magnifier', qty: 5 },
  '밴 삭제권 5개': { kind: 'ban_eraser', qty: 5 },
  '관전 잠금권 5개': { kind: 'spectator_lock', qty: 5 },
  '익명물약 5개': { kind: 'anonymity', qty: 5 },
  '검색 찬스 5개': { kind: 'word_search', qty: 5 },
};

const FALLBACK: DevPackReward = {
  key: 'sub:magnifier',
  grade: 'C',
  name: '돋보기',
  detail: '소모품',
};

interface SessionRow {
  id: string;
  member_id: string;
  pack_id: DevPackId;
  price_paid: number;
  slot: number;
  slots: number;
  status: 'choosing' | 'granting' | 'done';
  current_pair: [DevPackReward, DevPackReward] | null;
  used: string[];
}

function sessions(sb: Sb) {
  return (sb as unknown as { from: (table: string) => any }).from('shop_pack_sessions');
}

function isPackId(value: string): value is DevPackId {
  return value === 'bronze' || value === 'gold' || value === 'diamond';
}

function isRankTier(value: string | undefined): value is RankTier {
  return (
    value === 'unranked' ||
    value === 'bronze' ||
    value === 'silver' ||
    value === 'gold' ||
    value === 'diamond' ||
    value === 'challenger'
  );
}

function asPair(value: unknown): [DevPackReward, DevPackReward] | null {
  if (!Array.isArray(value) || value.length !== 2) return null;
  const [a, b] = value as DevPackReward[];
  if (!a?.key || !b?.key || !a.grade || !b.grade) return null;
  return [a, b];
}

async function viewerTier(sb: Sb, memberId: string): Promise<RankTier> {
  const seasonRes = await sb
    .from('rank_seasons')
    .select('id')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();
  const seasonId = (seasonRes.data as { id?: number } | null)?.id ?? null;
  if (seasonId == null) return 'unranked';
  const statsRes = await sb
    .from('rank_stats')
    .select('tier')
    .eq('season_id', seasonId)
    .eq('member_id', memberId)
    .maybeSingle();
  const tier = (statsRes.data as { tier?: string } | null)?.tier;
  return isRankTier(tier) ? tier : 'unranked';
}

async function exclusionKeys(sb: Sb, memberId: string): Promise<Set<string>> {
  const used = new Set<string>();
  const [skinsRes, titlesRes, claimed] = await Promise.all([
    sb.from('member_skins').select('skin_id, expires_at, revoked_at').eq('member_id', memberId),
    sb.from('member_titles').select('title_id, revoked_at').eq('member_id', memberId),
    loadPermanentlyClaimedEffectIds(sb as SupabaseClient<Database>),
  ]);

  for (const row of (skinsRes.data ?? []) as Array<{ skin_id: string; expires_at: string | null; revoked_at: string | null }>) {
    if (row.revoked_at || row.expires_at !== null) continue;
    used.add(`skin-perm:${row.skin_id}`);
    used.add(`skin-7:${row.skin_id}`);
    used.add(`skin-1:${row.skin_id}`);
  }

  const ownedTitleIds = ((titlesRes.data ?? []) as Array<{ title_id: string; revoked_at: string | null }>)
    .filter((row) => !row.revoked_at)
    .map((row) => row.title_id);
  if (ownedTitleIds.length > 0) {
    const { data } = await sb.from('titles').select('name').in('id', ownedTitleIds);
    for (const row of (data ?? []) as Array<{ name: string }>) used.add(`title:${row.name}`);
  }

  if (claimed.length > 0) {
    const { data } = await sb.from('title_effect_defs').select('key').in('id', claimed);
    for (const row of (data ?? []) as Array<{ key: string }>) {
      if (!PACK_EFFECT_KEYS.has(row.key)) continue;
      used.add(`effect-perm:${row.key}`);
      used.add(`effect-7:${row.key}`);
      used.add(`effect-1:${row.key}`);
    }
  }
  return used;
}

async function charge(sb: Sb, memberId: string, price: number, sessionId: string, packId: DevPackId): Promise<number> {
  await sb.from('member_cdp').upsert({ member_id: memberId }, { onConflict: 'member_id' });
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const { data: row, error } = await sb
      .from('member_cdp')
      .select('balance, total_spent')
      .eq('member_id', memberId)
      .single();
    if (error || !row) throw new PackError('잔액을 확인하지 못했습니다.', 'internal_error');
    const balance = Number((row as { balance: number }).balance ?? 0);
    if (balance < price) throw new PackError('CDP가 부족합니다.', 'insufficient_balance');
    const newBalance = balance - price;
    const totalSpent = Number((row as { total_spent?: number }).total_spent ?? 0);
    const { data: updated } = await sb
      .from('member_cdp')
      .update({
        balance: newBalance,
        total_spent: totalSpent + price,
        updated_at: new Date().toISOString(),
      })
      .eq('member_id', memberId)
      .eq('balance', balance)
      .select('balance')
      .maybeSingle();
    if (!updated) continue;
    const { error: ledgerErr } = await sb.from('cdp_ledger').insert({
      member_id: memberId,
      delta: -price,
      balance_after: newBalance,
      reason: 'shop_pack',
      ref_kind: 'shop_pack',
      ref_id: sessionId,
      metadata: { packId },
    });
    if (ledgerErr) throw new PackError(ledgerErr.message, 'internal_error');
    return newBalance;
  }
  throw new PackError('잔액이 바뀌었습니다. 다시 시도해 주세요.', 'conflict');
}

async function refund(sb: Sb, memberId: string, price: number, sessionId: string): Promise<void> {
  const { data: row } = await sb.from('member_cdp').select('balance, total_spent').eq('member_id', memberId).single();
  if (!row) return;
  const balance = Number((row as { balance: number }).balance ?? 0);
  const totalSpent = Number((row as { total_spent?: number }).total_spent ?? 0);
  const newBalance = balance + price;
  await sb
    .from('member_cdp')
    .update({
      balance: newBalance,
      total_spent: Math.max(0, totalSpent - price),
      updated_at: new Date().toISOString(),
    })
    .eq('member_id', memberId)
    .eq('balance', balance);
  await sb.from('cdp_ledger').insert({
    member_id: memberId,
    delta: price,
    balance_after: newBalance,
    reason: 'shop_pack_refund',
    ref_kind: 'shop_pack',
    ref_id: sessionId,
    metadata: { refund: true },
  });
}

async function addConsumable(sb: Sb, memberId: string, kind: ConsumableKind, qty: number): Promise<number> {
  const { data: existing } = await sb
    .from('shop_consumable_inventory')
    .select('count')
    .eq('member_id', memberId)
    .eq('kind', kind)
    .maybeSingle();
  const next = Number((existing as { count?: number } | null)?.count ?? 0) + qty;
  const { error } = await sb.from('shop_consumable_inventory').upsert(
    { member_id: memberId, kind, count: next, updated_at: new Date().toISOString() },
    { onConflict: 'member_id,kind' },
  );
  if (error) throw new PackError(error.message, 'internal_error');
  void notifyInventoryUpdated({
    memberId,
    kind,
    countAfter: next,
    reason: 'purchase',
    ref: { kind: 'shop_pack', id: memberId },
  });
  return next;
}

async function grantSkin(sb: Sb, memberId: string, skinId: string, days: number | null): Promise<boolean> {
  const { data } = await sb
    .from('member_skins')
    .select('id, expires_at, revoked_at')
    .eq('member_id', memberId)
    .eq('skin_id', skinId)
    .maybeSingle();
  const existing = data as { id: number; expires_at: string | null; revoked_at: string | null } | null;
  if (existing && !existing.revoked_at && existing.expires_at === null) return false;

  if (days === null) {
    if (existing) {
      const { error } = await sb
        .from('member_skins')
        .update({ expires_at: null, revoked_at: null })
        .eq('id', existing.id);
      if (error) throw new PackError(error.message, 'internal_error');
      return true;
    }
    const { error } = await sb.from('member_skins').insert({
      member_id: memberId,
      skin_id: skinId,
      equipped: false,
      expires_at: null,
    });
    if (error) throw new PackError(error.message, 'internal_error');
    return true;
  }

  const add = days * 24 * 60 * 60 * 1000;
  const base =
    existing && !existing.revoked_at && existing.expires_at
      ? Math.max(Date.now(), new Date(existing.expires_at).getTime())
      : Date.now();
  const expiresAt = new Date(base + add).toISOString();
  if (existing) {
    const { error } = await sb
      .from('member_skins')
      .update({ expires_at: expiresAt, revoked_at: null })
      .eq('id', existing.id);
    if (error) throw new PackError(error.message, 'internal_error');
    return true;
  }
  const { error } = await sb.from('member_skins').insert({
    member_id: memberId,
    skin_id: skinId,
    equipped: false,
    expires_at: expiresAt,
  });
  if (error) throw new PackError(error.message, 'internal_error');
  return true;
}

async function grantEffect(sb: Sb, memberId: string, key: string, days: number | null): Promise<boolean> {
  const { data: def } = await sb.from('title_effect_defs').select('id').eq('key', key).maybeSingle();
  const effectId = (def as { id?: string } | null)?.id;
  if (!effectId) return false;

  const { data: rows } = await sb
    .from('member_title_effects')
    .select('id, expires_at')
    .eq('member_id', memberId)
    .eq('effect_id', effectId)
    .is('revoked_at', null);
  const owned = (rows ?? []) as Array<{ id: number; expires_at: string | null }>;
  if (owned.some((row) => row.expires_at === null)) return false;
  if (days === null) {
    const claimed = await loadPermanentlyClaimedEffectIds(sb as SupabaseClient<Database>);
    if (claimed.includes(effectId)) return false;
    const { error } = await sb.from('member_title_effects').insert({
      member_id: memberId,
      effect_id: effectId,
      reason: 'shop_pack',
      expires_at: null,
    });
    if (error) throw new PackError(error.message, 'internal_error');
    return true;
  }

  const add = days * 24 * 60 * 60 * 1000;
  const timed = owned.find((row) => row.expires_at !== null);
  const base = timed?.expires_at
    ? Math.max(Date.now(), new Date(timed.expires_at).getTime())
    : Date.now();
  const expiresAt = new Date(base + add).toISOString();
  if (timed) {
    const { error } = await sb.from('member_title_effects').update({ expires_at: expiresAt }).eq('id', timed.id);
    if (error) throw new PackError(error.message, 'internal_error');
    return true;
  }
  const { error } = await sb.from('member_title_effects').insert({
    member_id: memberId,
    effect_id: effectId,
    reason: 'shop_pack',
    expires_at: expiresAt,
  });
  if (error) throw new PackError(error.message, 'internal_error');
  return true;
}

async function grantTitle(sb: Sb, memberId: string, name: string): Promise<boolean> {
  const { data: title } = await sb.from('titles').select('id').eq('name', name).maybeSingle();
  const titleId = (title as { id?: string } | null)?.id;
  if (!titleId) return false;
  const { data: owned } = await sb
    .from('member_titles')
    .select('id, revoked_at')
    .eq('member_id', memberId)
    .eq('title_id', titleId)
    .maybeSingle();
  const row = owned as { id: number; revoked_at: string | null } | null;
  if (row && !row.revoked_at) return false;
  if (row) {
    const { error } = await sb
      .from('member_titles')
      .update({ revoked_at: null, granted_at: new Date().toISOString(), reason: 'shop_pack' })
      .eq('id', row.id);
    if (error) throw new PackError(error.message, 'internal_error');
  } else {
    const { error } = await sb.from('member_titles').insert({
      member_id: memberId,
      title_id: titleId,
      granted_at: new Date().toISOString(),
      reason: 'shop_pack',
    });
    if (error) throw new PackError(error.message, 'internal_error');
  }
  void notifyInvalidateOwnedTitles(memberId);
  void notifyInvalidateBiasTitles();
  return true;
}

async function grantReward(sb: Sb, memberId: string, reward: DevPackReward): Promise<{ granted: DevPackReward; replaced: boolean }> {
  const key = reward.key;
  let ok = false;
  if (key.startsWith('skin-perm:')) ok = await grantSkin(sb, memberId, key.slice('skin-perm:'.length), null);
  else if (key.startsWith('skin-7:')) ok = await grantSkin(sb, memberId, key.slice('skin-7:'.length), 7);
  else if (key.startsWith('skin-1:')) ok = await grantSkin(sb, memberId, key.slice('skin-1:'.length), 1);
  else if (key.startsWith('effect-perm:')) ok = await grantEffect(sb, memberId, key.slice('effect-perm:'.length), null);
  else if (key.startsWith('effect-7:')) ok = await grantEffect(sb, memberId, key.slice('effect-7:'.length), 7);
  else if (key.startsWith('effect-1:')) ok = await grantEffect(sb, memberId, key.slice('effect-1:'.length), 1);
  else if (key.startsWith('title:')) ok = await grantTitle(sb, memberId, key.slice('title:'.length));
  else if (key === 'rank-reset') {
    await addConsumable(sb, memberId, 'rank_reset', 1);
    ok = true;
  } else if (key === 'demotion') {
    await addConsumable(sb, memberId, 'demotion_shield', 1);
    ok = true;
  } else if (key === 'nick') {
    await addConsumable(sb, memberId, 'nickname_change', 1);
    ok = true;
  } else if (key.startsWith('c:') || key.startsWith('five:')) {
    const name = key.slice(key.indexOf(':') + 1);
    const spec = CONSUMABLE_BY_NAME[name];
    if (spec) {
      await addConsumable(sb, memberId, spec.kind, spec.qty);
      ok = true;
    }
  }
  if (ok) return { granted: reward, replaced: false };
  await addConsumable(sb, memberId, 'magnifier', 1);
  return { granted: FALLBACK, replaced: true };
}

export async function openShopPack(
  sb: Sb,
  memberId: string,
  packIdRaw: string,
): Promise<{ sessionId: string; newBalance: number; pricePaid: number; pair: [DevPackReward, DevPackReward] }> {
  if (!isPackId(packIdRaw)) throw new PackError('팩이 올바르지 않습니다.', 'invalid_request');
  const packId = packIdRaw;
  const tier = await viewerTier(sb, memberId);
  const blocked = packPurchaseBlock(packId, tier);
  if (blocked) throw new PackError(blocked, 'rank_too_low');

  const merchant = await hasMerchantDiscount(sb as SupabaseClient<Database>, memberId);
  const price = packPaidPrice(packId, merchant);
  const used = await exclusionKeys(sb, memberId);
  const pair = rollDevPackPair(packId, used);
  const sessionId = crypto.randomUUID();
  const newBalance = await charge(sb, memberId, price, sessionId, packId);

  const { error } = await sessions(sb).insert({
    id: sessionId,
    member_id: memberId,
    pack_id: packId,
    price_paid: price,
    slot: 0,
    slots: devPackSlots(packId),
    status: 'choosing',
    current_pair: pair,
    used: [...used],
    updated_at: new Date().toISOString(),
  });
  if (error) {
    await refund(sb, memberId, price, sessionId);
    throw new PackError(error.message, 'internal_error');
  }

  void notifyCdpAdjusted({
    memberId,
    newBalance,
    delta: -price,
    reason: 'shop_purchase',
    ref: { kind: 'shop_pack', id: sessionId },
  });
  return { sessionId, newBalance, pricePaid: price, pair };
}

export async function pickShopPack(
  sb: Sb,
  memberId: string,
  sessionId: string,
  choice: number,
): Promise<{ granted: DevPackReward; replaced: boolean; nextPair: [DevPackReward, DevPackReward] | null }> {
  if (!/^[0-9a-f-]{36}$/i.test(sessionId) || (choice !== 0 && choice !== 1)) {
    throw new PackError('선택이 올바르지 않습니다.', 'invalid_request');
  }
  const { data: locked } = await sessions(sb)
    .update({ status: 'granting', updated_at: new Date().toISOString() })
    .eq('id', sessionId)
    .eq('member_id', memberId)
    .eq('status', 'choosing')
    .select('id, pack_id, slot, slots, current_pair, used')
    .maybeSingle();
  const session = locked as Omit<SessionRow, 'member_id' | 'price_paid' | 'status'> | null;
  if (!session) throw new PackError('이미 고른 칸입니다.', 'conflict');
  const pair = asPair(session.current_pair);
  const reward = pair?.[choice];
  if (!pair || !reward || !isPackId(session.pack_id)) {
    await sessions(sb).update({ status: 'choosing', updated_at: new Date().toISOString() }).eq('id', sessionId);
    throw new PackError('팩 상태가 올바르지 않습니다.', 'internal_error');
  }

  try {
    const result = await grantReward(sb, memberId, reward);
    const used = new Set(Array.isArray(session.used) ? session.used : []);
    used.add(reward.key);
    const nextSlot = Number(session.slot) + 1;
    const done = nextSlot >= Number(session.slots);
    const nextPair = done ? null : rollDevPackPair(session.pack_id, used);
    const { error } = await sessions(sb)
      .update({
        status: done ? 'done' : 'choosing',
        slot: nextSlot,
        current_pair: nextPair,
        used: [...used],
        updated_at: new Date().toISOString(),
      })
      .eq('id', sessionId);
    if (error) throw new PackError(error.message, 'internal_error');
    return { granted: result.granted, replaced: result.replaced, nextPair };
  } catch (err) {
    await sessions(sb).update({ status: 'choosing', updated_at: new Date().toISOString() }).eq('id', sessionId);
    throw err;
  }
}
