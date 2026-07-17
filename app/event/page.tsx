import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import EventCouponClient from './EventCouponClient';

export const metadata: Metadata = { title: '이벤트 쿠폰함' };
export const dynamic = 'force-dynamic';

/**
 * 이벤트 쿠폰함 — 랭크게임 승리 시 받은 닉네임 쿠폰을 확인하고 쿠폰함에 투입.
 * 이벤트 종료 후 관리자가 모인 쿠폰으로 수동 추첨.
 */
export default async function EventPage() {
  const member = await getActiveMember();
  if (!member) redirect('/login');

  let boxOpen = false;
  let title = '이벤트 쿠폰함';
  let held = 0;
  let deposited = 0;

  if (isSupabaseServiceRoleConfigured()) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db = getSupabaseServiceRole() as any;
    const [{ data: box }, heldRes, depRes] = await Promise.all([
      db.from('event_coupon_box').select('title, is_open').eq('id', 1).maybeSingle(),
      db
        .from('event_coupons')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .is('deposited_at', null),
      db
        .from('event_coupons')
        .select('id', { count: 'exact', head: true })
        .eq('member_id', member.id)
        .not('deposited_at', 'is', null),
    ]);
    boxOpen = Boolean(box?.is_open);
    if (box?.title) title = box.title;
    held = heldRes.count ?? 0;
    deposited = depRes.count ?? 0;
  }

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto w-full max-w-xl flex-1 px-4 py-6 sm:px-6 sm:py-8">
        <header className="mb-4 flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-cdm-fg">{title}</h1>
          <p className="text-sm text-cdm-fg-muted">
            랭크게임에서 승리하면 자신의 닉네임이 적힌 이벤트 쿠폰을 1장씩 받아요. 이벤트 종료
            전까지 원하는 만큼 쿠폰함에 넣을 수 있고, 종료 후 추첨으로 당첨자를 뽑아요.
          </p>
        </header>
        <EventCouponClient boxOpen={boxOpen} held={held} deposited={deposited} />
      </main>
    </>
  );
}
