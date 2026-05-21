/**
 * 이벤트 칩 DB 헬퍼.
 * - 잔액 조회
 * - 핸드 종료 정산 (settle_event_hand RPC)
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

export interface EventChipSummary {
  balance: number;
  totalBought: number;
  totalWon: number;
  totalLost: number;
}

/**
 * 회원의 이벤트 칩 잔액 조회. 미설정/실패 시 모든 값 0.
 */
export async function getEventChipSummary(memberId: string): Promise<EventChipSummary> {
  if (!isSupabaseConfigured()) return { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 };
  const sb = getSupabaseAdmin();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('get_event_chip_summary', {
      p_member_id: memberId,
    });
    if (error) {
      console.warn('[eventChips] get_event_chip_summary 실패:', error.message);
      return { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 };
    }
    const row = Array.isArray(data) ? data[0] : data;
    return {
      balance: Number(row?.balance ?? 0),
      totalBought: Number(row?.total_bought ?? 0),
      totalWon: Number(row?.total_won ?? 0),
      totalLost: Number(row?.total_lost ?? 0),
    };
  } catch (err) {
    console.warn('[eventChips] get_event_chip_summary 예외:', (err as Error).message);
    return { balance: 0, totalBought: 0, totalWon: 0, totalLost: 0 };
  }
}

export interface SettleHandEntry {
  memberId: string;
  delta: number;
  metadata?: Record<string, unknown>;
}

export interface SettleHandResultRow {
  memberId: string;
  newBalance: number;
}

/**
 * 핸드 종료 시 N명 일괄 정산.
 * - 단일 RPC 트랜잭션 → 부분 실패 없음.
 * - 음수 잔액 발생 시 예외 던짐 (invariant breach).
 */
export async function settleEventHand(
  handId: string,
  entries: SettleHandEntry[],
): Promise<SettleHandResultRow[]> {
  if (entries.length === 0) return [];
  if (!isSupabaseConfigured()) {
    console.warn('[eventChips] settle 시 Supabase 미설정 — 정산 스킵');
    return [];
  }
  const sb = getSupabaseAdmin();
  const payload = entries
    .filter((e) => e.delta !== 0)
    .map((e) => ({
      member_id: e.memberId,
      delta: e.delta,
      metadata: e.metadata ?? {},
    }));
  if (payload.length === 0) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('settle_event_hand', {
    p_hand_id: handId,
    p_entries: payload,
  });
  if (error) {
    console.error('[eventChips] settle_event_hand 실패:', error.message);
    throw new Error(`settle_event_hand: ${error.message}`);
  }

  const rows = (Array.isArray(data) ? data : []) as Array<{ member_id: string; new_balance: number }>;
  return rows.map((r) => ({ memberId: r.member_id, newBalance: Number(r.new_balance) }));
}
