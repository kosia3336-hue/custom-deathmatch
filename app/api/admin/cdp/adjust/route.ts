import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyCdpAdjusted } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface AdjustBody {
  memberId?: string;
  delta?: number;
  reason?: string;
}

interface AdjustRpcRow {
  new_balance: number;
  applied_delta: number;
  clamped: boolean;
}

function err(msg: string, status = 400, code?: string) {
  return NextResponse.json({ error: msg, ...(code ? { code } : {}) }, { status });
}

/** POST /api/admin/cdp/adjust */
export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403, 'forbidden');
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없습니다.', 503);

  let body: AdjustBody;
  try {
    body = (await req.json()) as AdjustBody;
  } catch {
    return err('잘못된 JSON');
  }

  const memberId = String(body.memberId ?? '').trim();
  const delta = Number(body.delta);
  const reason = String(body.reason ?? '').trim();

  if (!UUID_RE.test(memberId)) return err('잘못된 memberId');
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 100_000)
    return err('delta 는 0 이 아닌 정수, |delta| ≤ 100,000');
  if (reason.length < 3 || reason.length > 200) return err('reason 은 3~200자');

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('admin_adjust_cdp', {
    p_actor_id: admin.id,
    p_member_id: memberId,
    p_delta: delta,
    p_reason: reason,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    if (msg.includes('reason_invalid')) return err('사유 형식 오류', 400);
    if (msg.includes('delta_zero')) return err('delta 0 불가', 400);
    if (msg.includes('delta_out_of_range')) return err('delta 범위 초과', 400);
    console.warn('[cdp:admin] 실패', msg);
    return err('조정 실패', 500);
  }

  const row: AdjustRpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row) return err('조정 응답 비어있음', 500);

  console.log(
    `[cdp:admin] actor=${admin.id} target=${memberId} delta=${delta} applied=${row.applied_delta} clamped=${row.clamped} balance=${row.new_balance}`,
  );

  // 대상 회원 소켓 통보 (실패 무시)
  if (Number(row.applied_delta) !== 0) {
    void notifyCdpAdjusted({
      memberId,
      newBalance: Number(row.new_balance),
      delta: Number(row.applied_delta),
      reason: 'admin_adjust',
    });
  }

  return NextResponse.json({
    ok: true,
    newBalance: Number(row.new_balance),
    appliedDelta: Number(row.applied_delta),
    clamped: Boolean(row.clamped),
  });
}
