import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { GNB } from '@/components/cdm/GNB';
import { getActiveMember } from '@/lib/auth/server';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import AttendanceClient from './AttendanceClient';

export const metadata: Metadata = { title: '출석판' };
export const dynamic = 'force-dynamic';

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
function todayKst(): string {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' });
}

export default async function AttendancePage() {
  const member = await getActiveMember();
  if (!member) redirect('/login');

  const today = todayKst();

  let cycleDays = 0;
  let totalDays = 0;
  let checkedInToday = false;
  let winCount = 0;
  let cdpRewarded = false;
  let boxRewarded = false;

  if (isSupabaseServiceRoleConfigured()) {
    const sb = getSupabaseServiceRole();

    const { data: att } = await sb
      .from('attendance')
      .select('last_check_date, cycle_days, total_days')
      .eq('member_id', member.id)
      .maybeSingle();
    if (att) {
      const a = att as { last_check_date: string | null; cycle_days: number; total_days: number };
      cycleDays = Number(a.cycle_days ?? 0);
      totalDays = Number(a.total_days ?? 0);
      checkedInToday = a.last_check_date === today;
    }

    const { data: drs } = await sb
      .from('daily_rank_stats')
      .select('win_count, cdp_rewarded, box_rewarded')
      .eq('member_id', member.id)
      .eq('stat_date', today)
      .maybeSingle();
    if (drs) {
      const d = drs as { win_count: number; cdp_rewarded: boolean; box_rewarded: boolean };
      winCount = Number(d.win_count ?? 0);
      cdpRewarded = Boolean(d.cdp_rewarded);
      boxRewarded = Boolean(d.box_rewarded);
    }
  }

  return (
    <>
      <GNB member={member} />
      <main className="mx-auto flex w-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <h1 className="text-2xl font-bold text-cdm-fg sm:text-3xl">출석판</h1>
          <p className="mt-1 text-sm text-cdm-fg-muted">
            매일 출석하고 보상을 받아보세요. 오늘의 랭크 보상 진행 상황도 여기서 확인할 수 있어요.
          </p>
        </div>
        <AttendanceClient
          initialCycleDays={cycleDays}
          initialTotalDays={totalDays}
          initialCheckedInToday={checkedInToday}
          winCount={winCount}
          cdpRewarded={cdpRewarded}
          boxRewarded={boxRewarded}
        />
      </main>
    </>
  );
}
