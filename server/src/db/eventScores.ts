/**
 * 해달별 (이벤트) 점수 DB 헬퍼.
 * RPC 미설정 시 정산 스킵 (게임은 계속).
 */

import { getSupabaseAdmin, isSupabaseConfigured } from './supabase.js';

export interface SettleRoundEntry {
  memberId: string;
  delta: number;
  metadata?: Record<string, unknown>;
}

export interface SettleRoundResultRow {
  memberId: string;
  newTotal: number;
}

export async function insertEventRound(row: {
  seasonId: string;
  roundNumber: number;
  playerCount: number;
  countsSecond: Record<string, number>;
  litMark: string | null;
  litReason: string | null;
  voidRound: boolean;
}): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from as any)('event_rounds').insert({
      season_id: row.seasonId,
      round_number: row.roundNumber,
      player_count: row.playerCount,
      counts_second: row.countsSecond,
      lit_mark: row.litMark,
      lit_reason: row.litReason,
      void: row.voidRound,
      started_at: new Date().toISOString(),
    }).select('id').single();
    if (error) {
      console.warn('[eventScores] insertEventRound 실패:', error.message);
      return null;
    }
    return data?.id ?? null;
  } catch (err) {
    console.warn('[eventScores] insertEventRound 예외:', (err as Error).message);
    return null;
  }
}

export async function settleEventRound(
  seasonId: string,
  roundId: string,
  entries: SettleRoundEntry[],
): Promise<SettleRoundResultRow[]> {
  if (entries.length === 0) return [];
  if (!isSupabaseConfigured()) {
    console.warn('[eventScores] settle 스킵 — Supabase 미설정');
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

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('settle_event_round', {
      p_season_id: seasonId,
      p_round_id: roundId,
      p_entries: payload,
    });
    if (error) {
      console.error('[eventScores] settle_event_round 실패:', error.message);
      throw new Error(error.message);
    }
    const rows = (Array.isArray(data) ? data : []) as Array<{ member_id: string; new_total: number }>;
    return rows.map((r) => ({ memberId: r.member_id, newTotal: Number(r.new_total) }));
  } catch (err) {
    console.error('[eventScores] settle_event_round 예외:', (err as Error).message);
    throw err;
  }
}

export async function loadActiveSeasonId(gameId: string): Promise<string | null> {
  const fromEnv = process.env.EVENT_SMS_SEASON_ID?.trim();
  if (fromEnv) return fromEnv;
  if (!isSupabaseConfigured()) return null;
  const sb = getSupabaseAdmin();
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.from as any)('event_seasons')
      .select('id')
      .eq('game_id', gameId)
      .eq('is_active', true)
      .maybeSingle();
    if (error) {
      console.warn('[eventScores] loadActiveSeasonId 실패:', error.message);
      return process.env.EVENT_SMS_SEASON_ID ?? null;
    }
    return data?.id ?? process.env.EVENT_SMS_SEASON_ID ?? null;
  } catch {
    return process.env.EVENT_SMS_SEASON_ID ?? null;
  }
}
