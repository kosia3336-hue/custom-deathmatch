import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyCdpAdjusted, notifyInventoryUpdated } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

interface CheckRpcRow {
  reward_kind: 'cdp' | 'ticket';
  cdp_amount: number;
  new_balance: number;
  ticket_count: number;
  cycle_days: number;
  total_days: number;
  completed: boolean;
  box_count: number;
}

/**
 * POST /api/attendance/check
 * 하루 1회 출석 체크 → 랜덤 보상(100 CDP / 뽑기권 1개), 누적 30회 시 뽑기 박스 10개.
 */
export async function POST() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json(
      { error: '로그인이 필요해요.', code: 'unauthorized' as const },
      { status: 401 },
    );
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json(
      { error: '서비스 설정이 없어요.', code: 'service_unavailable' as const },
      { status: 503 },
    );
  }

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('check_attendance', {
    p_member_id: member.id,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    if (msg.includes('already_checked_in')) {
      return NextResponse.json(
        { error: '오늘은 이미 출석했어요.', code: 'already_checked_in' as const },
        { status: 409 },
      );
    }
    console.warn(`[attendance:check] 실패 member=${member.id} msg=${msg}`);
    return NextResponse.json(
      { error: '출석 처리 중 오류가 발생했어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  const row: CheckRpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row) {
    return NextResponse.json(
      { error: '출석 응답이 비었어요.', code: 'internal_error' as const },
      { status: 500 },
    );
  }

  console.log(
    `[attendance:check] member=${member.id} reward=${row.reward_kind} cycle=${row.cycle_days} total=${row.total_days} completed=${row.completed}`,
  );

  // CDP 보상 시 잔액 갱신 통보
  if (row.reward_kind === 'cdp' && row.cdp_amount > 0) {
    void notifyCdpAdjusted({
      memberId: member.id,
      newBalance: Number(row.new_balance),
      delta: Number(row.cdp_amount),
      reason: 'attendance',
      ref: { kind: 'attendance', id: member.id },
    });
  }
  // 뽑기권 보상 시 인벤 갱신 통보
  if (row.reward_kind === 'ticket') {
    void notifyInventoryUpdated({
      memberId: member.id,
      kind: 'gacha_ticket',
      countAfter: Number(row.ticket_count),
      reason: 'purchase',
      ref: { kind: 'attendance', id: member.id },
    });
  }
  // 30회 완주 시 뽑기 박스 10개 인벤 갱신 통보
  if (row.completed) {
    void notifyInventoryUpdated({
      memberId: member.id,
      kind: 'gacha_box',
      countAfter: Number(row.box_count),
      reason: 'purchase',
      ref: { kind: 'attendance', id: member.id },
    });
  }

  return NextResponse.json({
    ok: true,
    rewardKind: row.reward_kind,
    cdpAmount: Number(row.cdp_amount),
    newBalance: Number(row.new_balance),
    ticketCount: Number(row.ticket_count),
    cycleDays: Number(row.cycle_days),
    totalDays: Number(row.total_days),
    completed: Boolean(row.completed),
    boxCount: Number(row.box_count),
  });
}
