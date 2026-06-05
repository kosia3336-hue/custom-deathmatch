import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { loadPoolContext } from '@/lib/gacha/build-pool-data';
import { buildPoolResponse } from '@/lib/gacha/pool';
import { getServerSupabase } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const member = await getActiveMember();
  if (!member) {
    return NextResponse.json({ error: '로그인이 필요해요.', code: 'unauthorized' }, { status: 401 });
  }

  const sb = await getServerSupabase();

  const [ctx, cdpRes, bannerRes] = await Promise.all([
    loadPoolContext(sb, member.id),
    sb.from('member_cdp').select('balance').eq('member_id', member.id).maybeSingle(),
    sb.from('gacha_banners').select('name, price_cdp, is_active').eq('id', 'default').maybeSingle(),
  ]);

  const balance = Number((cdpRes.data as { balance?: number } | null)?.balance ?? 0);
  const banner = bannerRes.data as { name?: string; price_cdp?: number; is_active?: boolean } | null;

  if (banner && banner.is_active === false) {
    return NextResponse.json({ error: '뽑기가 비활성화됐어요.', code: 'gacha_inactive' }, { status: 404 });
  }

  const pool = buildPoolResponse(ctx, balance, banner?.name ?? 'CDP 뽑기');
  if (banner?.price_cdp) pool.priceCdp = Number(banner.price_cdp);

  return NextResponse.json(pool);
}
