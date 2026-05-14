import { NextResponse, type NextRequest } from 'next/server';
import { requireAdminMember } from '@/lib/admin/require-admin';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { notifyInvalidateBiasTitles, notifyShopItemChanged } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';
const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

interface ActiveBody {
  active?: boolean;
}

function err(msg: string, status = 400) {
  return NextResponse.json({ error: msg }, { status });
}

/** POST /api/admin/shop/items/[itemId]/active — 활성/비활성 토글 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ itemId: string }> },
) {
  const admin = await requireAdminMember();
  if (!admin) return err('권한이 없습니다.', 403);
  if (!isSupabaseServiceRoleConfigured()) return err('서비스 설정이 없어요.', 503);

  const { itemId } = await params;
  if (!UUID_RE.test(itemId)) return err('잘못된 itemId');

  let body: ActiveBody;
  try {
    body = (await req.json()) as ActiveBody;
  } catch {
    return err('잘못된 JSON');
  }
  const active = Boolean(body.active);

  const sb = getSupabaseServiceRole();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { error } = await (sb.rpc as any)('admin_set_shop_item_active', {
    p_actor_id: admin.id,
    p_item_id: itemId,
    p_active: active,
  });
  if (error) {
    console.warn('[admin/shop/items/active]', error.message);
    return err('실패', 500);
  }

  // 현재 stock 도 함께 broadcast
  const { data: row } = await sb
    .from('shop_items')
    .select('stock, type, payload')
    .eq('id', itemId)
    .maybeSingle();
  const r = row as { stock?: number | null; type?: string; payload?: Record<string, unknown> } | null;
  void notifyShopItemChanged({
    itemId,
    stock: r?.stock ?? null,
    isActive: active,
  });

  // bias 칭호의 활성 토글이면 캐시 무효화.
  if (r?.type === 'title' && (r.payload as { subtype?: string } | undefined)?.subtype === 'bias') {
    void notifyInvalidateBiasTitles();
  }

  return NextResponse.json({ ok: true });
}
