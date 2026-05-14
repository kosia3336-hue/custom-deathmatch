/**
 * POST /api/admin/consumables/adjust — 어드민 소모성 인벤토리 가감.
 *  body: { memberId: string; kind: ConsumableKind; delta: number; reason: string }
 *
 *  - service_role RPC admin_grant_consumable
 *  - 음수 delta 가 잔량보다 크면 0 으로 클램프 (RPC 측에서 처리)
 *  - 성공 시 inventory:updated 통보
 */

import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyInventoryUpdated } from '@/lib/cdp/notify';
import type { ConsumableKind } from '@/lib/cdp/types';

export const dynamic = 'force-dynamic';

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

const VALID_KINDS = new Set<ConsumableKind>([
  'nickname_change',
  'rank_reset',
  'spectator_lock',
  'anonymity',
]);

interface AdjustBody {
  memberId?: string;
  kind?: string;
  delta?: number;
  reason?: string;
}

interface RpcRow {
  count_after: number;
  applied_delta: number;
  clamped: boolean;
}

function err(msg: string, status = 400, code?: string) {
  return NextResponse.json({ error: msg, ...(code ? { code } : {}) }, { status });
}

export async function POST(req: NextRequest) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없어요.', 403, 'forbidden');
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없어요.', 503);

  let body: AdjustBody;
  try {
    body = (await req.json()) as AdjustBody;
  } catch {
    return err('잘못된 JSON');
  }

  const memberId = String(body.memberId ?? '').trim();
  const kind = String(body.kind ?? '').trim() as ConsumableKind;
  const delta = Number(body.delta);
  const reason = String(body.reason ?? '').trim();

  if (!UUID_RE.test(memberId)) return err('잘못된 memberId');
  if (!VALID_KINDS.has(kind)) return err('잘못된 kind');
  if (!Number.isInteger(delta) || delta === 0 || Math.abs(delta) > 1000) {
    return err('delta 는 0 이 아닌 정수, |delta| ≤ 1,000');
  }
  if (reason.length < 3 || reason.length > 200) return err('reason 은 3~200자');

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (sb.rpc as any)('admin_grant_consumable', {
    p_actor_id: admin.id,
    p_member_id: memberId,
    p_kind: kind,
    p_delta: delta,
    p_reason: reason,
  });

  if (error) {
    const msg = (error as { message?: string }).message ?? '';
    if (msg.includes('reason_invalid')) return err('사유 형식 오류', 400);
    if (msg.includes('delta_zero')) return err('delta 0 불가', 400);
    if (msg.includes('delta_out_of_range')) return err('delta 범위 초과', 400);
    if (msg.includes('invalid_kind')) return err('잘못된 kind', 400);
    console.warn('[admin/consumables/adjust] 실패:', msg);
    return err('조정 실패', 500);
  }

  const row: RpcRow | undefined = Array.isArray(data) ? data[0] : data;
  if (!row) return err('응답 비어있음', 500);

  console.log(
    `[consumable:admin] actor=${admin.id} target=${memberId} kind=${kind} delta=${delta} applied=${row.applied_delta} clamped=${row.clamped} after=${row.count_after}`,
  );

  if (Number(row.applied_delta) !== 0) {
    void notifyInventoryUpdated({
      memberId,
      kind,
      countAfter: Number(row.count_after),
      reason: 'admin_adjust',
    });
  }

  return NextResponse.json({
    ok: true,
    countAfter: Number(row.count_after),
    appliedDelta: Number(row.applied_delta),
    clamped: Boolean(row.clamped),
  });
}
