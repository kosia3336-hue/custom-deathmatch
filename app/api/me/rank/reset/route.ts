/**
 * POST /api/me/rank/reset
 *  body: {} (현재 active season 기준)
 *
 *  - 본인 시즌 진행도(rank_stats)를 초기화하고 랭크 초기화권을 1개 차감.
 *  - service_role RPC use_rank_reset_ticket 사용.
 *  - 시즌당 3회 제한.
 */

import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyInventoryUpdated, notifyRankStatsReset } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

interface RpcRow {
  success: boolean;
  used_count_in_season: number;
  ticket_count_after: number;
}

const ERROR_HTTP: Record<string, { status: number; msg: string; code: string }> = {
  no_ticket: { status: 409, msg: '랭크 초기화권이 없습니다.', code: 'no_ticket' },
  season_use_limit_exceeded: {
    status: 409,
    msg: '이번 시즌에는 더 이상 사용할 수 없습니다. (시즌당 3회)',
    code: 'season_use_limit_exceeded',
  },
  season_not_active: { status: 409, msg: '진행 중인 시즌이 없습니다.', code: 'season_not_active' },
  invalid_args: { status: 400, msg: '잘못된 요청입니다.', code: 'invalid_args' },
  forbidden: { status: 403, msg: '권한이 없습니다.', code: 'forbidden' },
};

function parseError(msg: string | undefined): { status: number; msg: string; code: string } {
  if (!msg) return { status: 500, msg: '랭크 초기화에 실패했습니다.', code: 'internal_error' };
  for (const k of Object.keys(ERROR_HTTP)) {
    if (msg.includes(k)) return ERROR_HTTP[k];
  }
  return { status: 500, msg: '랭크 초기화에 실패했습니다.', code: 'internal_error' };
}

export async function POST() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { error: '로그인이 필요합니다.', code: 'unauthorized' },
      { status: 401 },
    );
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: '서비스 설정이 없습니다.', code: 'service_unavailable' },
      { status: 503 },
    );
  }

  const sb = getSupabaseServiceRole();

  // (1) 현재 active season ID 조회
  const { data: season, error: seasonErr } = await sb
    .from('rank_seasons')
    .select('id')
    .eq('is_active', true)
    .order('id', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (seasonErr || !season) {
    return NextResponse.json(
      { error: '진행 중인 시즌이 없습니다.', code: 'season_not_active' },
      { status: 409 },
    );
  }
  const seasonId = Number((season as { id: number }).id);

  // (2) RPC
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('use_rank_reset_ticket', {
    p_member_id: member.id,
    p_season_id: seasonId,
  });

  if (error) {
    const e = error as { message?: string };
    const mapped = parseError(e.message);
    if (mapped.code === 'internal_error') {
      console.warn('[me/rank/reset] RPC 실패:', e.message);
    }
    return NextResponse.json({ error: mapped.msg, code: mapped.code }, { status: mapped.status });
  }

  const row: RpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row?.success) {
    return NextResponse.json(
      { error: '랭크 초기화에 실패했습니다.', code: 'internal_error' },
      { status: 500 },
    );
  }

  const ticketAfter = Number(row.ticket_count_after);

  // (3) 알림 — 큐에서 제거 + rank:stats:reset emit
  void notifyRankStatsReset({
    memberId: member.id,
    seasonId,
    ticketCountAfter: ticketAfter,
  });
  void notifyInventoryUpdated({
    memberId: member.id,
    kind: 'rank_reset',
    countAfter: ticketAfter,
    reason: 'manual_use',
    ref: { kind: 'rank_season', id: String(seasonId) },
  });

  return NextResponse.json({
    ok: true,
    seasonId,
    usedCountInSeason: Number(row.used_count_in_season),
    ticketCountAfter: ticketAfter,
  });
}
