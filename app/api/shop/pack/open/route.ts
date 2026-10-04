import { NextResponse, type NextRequest } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { getSupabaseServiceRole, isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { PackError, openShopPack } from '@/lib/shop/pack-session';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요합니다.', code: 'unauthorized' }, { status: 401 });
  }
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ error: '서비스 설정이 없습니다.', code: 'service_unavailable' }, { status: 503 });
  }

  let packId = '';
  try {
    const body = (await req.json()) as { packId?: string };
    packId = String(body.packId ?? '');
  } catch {
    return NextResponse.json({ error: '잘못된 요청입니다.', code: 'invalid_request' }, { status: 400 });
  }

  try {
    const opened = await openShopPack(getSupabaseServiceRole(), member.id, packId);
    return NextResponse.json({ ok: true, ...opened });
  } catch (err) {
    if (err instanceof PackError) {
      const status =
        err.code === 'insufficient_balance' ? 402
        : err.code === 'rank_too_low' ? 403
        : err.code === 'invalid_request' ? 400
        : err.code === 'conflict' ? 409
        : 500;
      return NextResponse.json({ error: err.message, code: err.code }, { status });
    }
    console.warn('[shop-pack:open]', (err as Error).message);
    return NextResponse.json({ error: '팩을 열지 못했습니다.', code: 'internal_error' }, { status: 500 });
  }
}
