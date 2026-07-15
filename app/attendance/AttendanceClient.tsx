'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Card } from '@/components/cdm/Card';
import { Button } from '@/components/cdm/Button';
import { useInventoryStore } from '@/stores/inventory';

const CYCLE_TARGET = 30;

interface Props {
  initialCycleDays: number;
  initialTotalDays: number;
  initialCheckedInToday: boolean;
  winCount: number;
  cdpRewarded: boolean;
  boxRewarded: boolean;
}

interface CheckOk {
  ok: true;
  rewardKind: 'cdp' | 'ticket';
  cdpAmount: number;
  newBalance: number;
  ticketCount: number;
  cycleDays: number;
  totalDays: number;
  completed: boolean;
  boxCount: number;
}

export default function AttendanceClient({
  initialCycleDays,
  initialTotalDays,
  initialCheckedInToday,
  winCount,
  cdpRewarded,
  boxRewarded,
}: Props) {
  const router = useRouter();
  const setOne = useInventoryStore((s) => s.setOne);
  const [cycleDays, setCycleDays] = useState(initialCycleDays);
  const [totalDays, setTotalDays] = useState(initialTotalDays);
  const [checkedIn, setCheckedIn] = useState(initialCheckedInToday);
  const [busy, setBusy] = useState(false);

  // 완주 직후(cycleDays=0)엔 30칸을 꽉 채워 보여줌
  const filled = checkedIn && cycleDays === 0 ? CYCLE_TARGET : cycleDays;

  async function handleCheckIn() {
    if (busy || checkedIn) return;
    setBusy(true);
    try {
      const res = await fetch('/api/attendance/check', { method: 'POST' });
      const json = (await res.json()) as CheckOk | { error: string; code: string };
      if (!res.ok || !('ok' in json)) {
        const e = json as { error: string; code: string };
        if (e.code === 'already_checked_in') setCheckedIn(true);
        toast.error(e.error ?? '출석에 실패했어요.');
        return;
      }
      setCheckedIn(true);
      setCycleDays(json.cycleDays);
      setTotalDays(json.totalDays);

      if (json.rewardKind === 'cdp') {
        toast.success(`출석 완료! ${json.cdpAmount.toLocaleString()} CDP를 받았어요.`);
      } else {
        setOne('gacha_ticket', json.ticketCount);
        toast.success('출석 완료! 뽑기권 1개를 받았어요.');
      }
      if (json.completed) {
        setOne('gacha_box', json.boxCount);
        toast.success('30일 개근 달성! 뽑기 박스 10개를 받았어요!', { duration: 6000 });
      }
      // GNB CDP 칩 등 동기화
      router.refresh();
    } catch {
      toast.error('네트워크 오류가 발생했어요.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      {/* ── 출석 체크 ── */}
      <Card>
        <div className="flex items-center justify-between">
          <h2 className="text-base font-semibold text-cdm-fg">
            출석 <span className="text-cdm-fg-muted">({filled}/{CYCLE_TARGET})</span>
          </h2>
          <span className="text-xs text-cdm-fg-subtle">누적 {totalDays}일</span>
        </div>

        <div className="mt-3 grid grid-cols-10 gap-1.5">
          {Array.from({ length: CYCLE_TARGET }).map((_, i) => {
            const done = i < filled;
            const isMilestone = i === CYCLE_TARGET - 1;
            return (
              <div
                key={i}
                className={[
                  'flex aspect-square items-center justify-center rounded-cdm-sm text-[11px] font-semibold tabular-nums',
                  done
                    ? 'bg-cdm-primary text-white'
                    : 'bg-cdm-bg-elev-2 text-cdm-fg-subtle',
                  isMilestone && !done ? 'ring-1 ring-cdm-highlight' : '',
                ].join(' ')}
                title={isMilestone ? '30일 개근 → 뽑기 박스 10개' : undefined}
              >
                {i + 1}
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <Button fullWidth size="md" disabled={checkedIn} loading={busy} onClick={handleCheckIn}>
            {checkedIn ? '오늘 출석 완료' : '출석 체크 (100 CDP 또는 뽑기권 랜덤)'}
          </Button>
          <ul className="mt-2 ml-4 list-disc text-xs text-cdm-fg-muted">
            <li>하루 1회 출석할 수 있어요. (한국시간 자정 기준)</li>
            <li>출석 시 100 CDP 또는 뽑기권 1개를 랜덤으로 받아요.</li>
            <li>30회를 모두 채우면 뽑기 박스 10개를 받고 새 판이 시작돼요.</li>
          </ul>
        </div>
      </Card>

      {/* ── 오늘의 랭크 보상 (#3 · #4) ── */}
      <Card>
        <h2 className="text-base font-semibold text-cdm-fg">오늘의 랭크 보상</h2>
        <ul className="mt-3 flex flex-col gap-2">
          <li className="flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cdm-fg">첫 랭크 승리 보너스</p>
              <p className="mt-0.5 text-xs text-cdm-fg-muted">오늘 처음 이기면 100 CDP</p>
            </div>
            <span
              className={[
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold',
                cdpRewarded ? 'bg-cdm-primary text-white' : 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
              ].join(' ')}
            >
              {cdpRewarded ? '받음' : '대기 중'}
            </span>
          </li>
          <li className="flex items-center justify-between rounded-cdm-md border border-cdm-border bg-cdm-bg-elev-1 p-3">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-cdm-fg">하루 5승 뽑기 박스</p>
              <p className="mt-0.5 text-xs text-cdm-fg-muted">오늘 랭크 5승 시 뽑기 박스 1개</p>
            </div>
            <span
              className={[
                'shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums',
                boxRewarded ? 'bg-cdm-primary text-white' : 'bg-cdm-bg-elev-2 text-cdm-fg-muted',
              ].join(' ')}
            >
              {boxRewarded ? '받음' : `${Math.min(winCount, 5)}/5`}
            </span>
          </li>
        </ul>
      </Card>
    </>
  );
}
