import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import EventCouponBoxToggle from './EventCouponBoxToggle';

interface DepositedRow {
  member_id: string;
  nickname: string;
  deposited_at: string;
}

/** 관리자 — 이벤트 쿠폰함: 투입된 쿠폰 집계 확인 + 쿠폰함 열기/닫기 (수동 추첨용) */
export default async function EventCouponsTab() {
  if (!isSupabaseServiceRoleConfigured()) {
    return <p className="text-sm text-cdm-fg-muted">서비스 롤 설정이 없어요.</p>;
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;

  const [{ data: box }, { data: depositedRows }, heldRes] = await Promise.all([
    db.from('event_coupon_box').select('title, is_open, updated_at').eq('id', 1).maybeSingle(),
    db
      .from('event_coupons')
      .select('member_id, nickname, deposited_at')
      .not('deposited_at', 'is', null)
      .order('deposited_at', { ascending: false })
      .limit(10000),
    db
      .from('event_coupons')
      .select('id', { count: 'exact', head: true })
      .is('deposited_at', null),
  ]);

  const rows = (depositedRows ?? []) as DepositedRow[];
  const totalDeposited = rows.length;
  const totalHeld = heldRes.count ?? 0;

  // 회원별 집계 (추첨 확률 확인용)
  const byMember = new Map<string, { nickname: string; count: number }>();
  for (const r of rows) {
    const cur = byMember.get(r.member_id);
    if (cur) cur.count++;
    else byMember.set(r.member_id, { nickname: r.nickname, count: 1 });
  }
  const summary = [...byMember.entries()]
    .map(([memberId, v]) => ({ memberId, ...v }))
    .sort((a, b) => b.count - a.count);

  return (
    <div className="flex flex-col gap-4">
      {/* 쿠폰함 상태 */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg p-4">
        <div>
          <p className="text-sm font-bold text-cdm-fg">
            {box?.title ?? '이벤트 쿠폰함'}{' '}
            <span className={box?.is_open ? 'text-cdm-primary' : 'text-cdm-accent'}>
              {box?.is_open ? '· 진행 중 (열림)' : '· 종료됨 (닫힘)'}
            </span>
          </p>
          <p className="mt-0.5 text-xs text-cdm-fg-muted">
            닫으면 랭크 승리 쿠폰 지급과 유저의 쿠폰 투입이 모두 중단돼요. 추첨은 아래 목록으로
            수동 진행하세요.
          </p>
        </div>
        <EventCouponBoxToggle isOpen={Boolean(box?.is_open)} />
      </div>

      {/* 집계 */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg p-3 text-center">
          <p className="text-xs text-cdm-fg-muted">쿠폰함 총 투입</p>
          <p className="text-xl font-bold tabular-nums text-cdm-primary">{totalDeposited}장</p>
        </div>
        <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg p-3 text-center">
          <p className="text-xs text-cdm-fg-muted">참여 인원</p>
          <p className="text-xl font-bold tabular-nums text-cdm-fg">{summary.length}명</p>
        </div>
        <div className="rounded-cdm-lg border border-cdm-border bg-cdm-bg p-3 text-center">
          <p className="text-xs text-cdm-fg-muted">미투입 보유 쿠폰(전체)</p>
          <p className="text-xl font-bold tabular-nums text-cdm-fg-muted">{totalHeld}장</p>
        </div>
      </div>

      {/* 회원별 투입 현황 */}
      <div className="overflow-x-auto rounded-cdm-lg border border-cdm-border">
        <table className="w-full min-w-[420px] text-sm">
          <thead>
            <tr className="border-b border-cdm-border bg-cdm-bg-elev-1 text-left text-xs text-cdm-fg-muted">
              <th className="px-3 py-2">닉네임 (쿠폰 표기)</th>
              <th className="px-3 py-2 text-right">투입 쿠폰</th>
              <th className="px-3 py-2 text-right">당첨 확률</th>
            </tr>
          </thead>
          <tbody>
            {summary.length === 0 && (
              <tr>
                <td colSpan={3} className="px-3 py-6 text-center text-cdm-fg-muted">
                  아직 투입된 쿠폰이 없어요.
                </td>
              </tr>
            )}
            {summary.map((s) => (
              <tr key={s.memberId} className="border-b border-cdm-border last:border-0">
                <td className="px-3 py-2 font-semibold text-cdm-fg">{s.nickname}</td>
                <td className="px-3 py-2 text-right tabular-nums">{s.count}장</td>
                <td className="px-3 py-2 text-right tabular-nums text-cdm-fg-muted">
                  {totalDeposited > 0 ? ((s.count / totalDeposited) * 100).toFixed(1) : '0.0'}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
