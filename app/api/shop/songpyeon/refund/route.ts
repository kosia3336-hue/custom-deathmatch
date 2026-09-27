import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { notifyShopItemChanged } from '@/lib/cdp/notify';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 });
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.' }, { status: 503 });
  }
  const body = (await req.json().catch(() => null)) as { pendingId?: string; itemId?: string } | null;
  const pendingId = String(body?.pendingId ?? '');
  if (!pendingId) return NextResponse.json({ error: '잘못된 요청입니다.' }, { status: 400 });
  const sb = getSupabaseServiceRole();
  const { data, error } = await (sb.rpc as any)('refund_songpyeon_skin_pick', {
    p_member_id: member.id,
    p_pending_id: pendingId,
  });
  if (error) return NextResponse.json({ error: '환불하지 못했습니다.' }, { status: 400 });
  if (body?.itemId) {
    const { data: item } = await sb.from('shop_items').select('stock, is_active').eq('id', body.itemId).maybeSingle();
    const row = item as { stock?: number | null; is_active?: boolean } | null;
    void notifyShopItemChanged({
      itemId: body.itemId,
      stock: row?.stock ?? null,
      isActive: row?.is_active !== false,
    });
  }
  return NextResponse.json({ ok: true, songpyeonBalance: Number(data ?? 0) });
}
