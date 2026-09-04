'use client';

import { useEffect, useState } from 'react';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { Icon } from '@/components/cdm/Icon';
import { cn } from '@/lib/utils';

/* ════════════════════════════════════════════════════════════
 * 게임 상단 바 조각들.
 *
 * 상단 바는 '판이 도는 동안 계속 읽는 것' 만 둔다 — 라운드, 차례, 남은 시간.
 * 방 제목·플레이 모드처럼 한 번 확인하면 그만인 것은 'i' 안으로, 소리·룰·
 * 채팅·나가기처럼 가끔 누르는 것은 톱니 안으로 들어갔다. 상단 바에 물건이
 * 늘수록 무대가 줄고, 무대가 줄면 판이 작아진다.
 * ════════════════════════════════════════════════════════════ */

/** 남은 시간. 10초 아래로 내려가면 0.1초까지 센다 — 그때부터는 초 단위가 너무 굵다. */
export function CountdownTimer() {
  const { remaining, timeLimitSeconds } = useTurnTimer();
  if (remaining === null || timeLimitSeconds === null) return null;

  const min = Math.floor(remaining / 60);
  const sec = Math.floor(remaining % 60);
  const display =
    remaining <= 10 && remaining > 0
      ? remaining.toFixed(1)
      : `${min}:${sec.toString().padStart(2, '0')}`;

  const isCritical = remaining <= 5;
  const isDanger = remaining <= 10 && remaining > 5;
  const isWarning = remaining <= 30 && remaining > 10;

  return (
    <span
      aria-label="남은 시간"
      className={cn(
        'font-mono text-sm font-bold tabular-nums',
        isWarning && 'text-cdm-highlight',
        isDanger && 'animate-pulse text-cdm-accent',
        isCritical && 'animate-[pulse_0.5s_ease-in-out_infinite] text-cdm-accent-strong',
        !isWarning && !isDanger && !isCritical && 'text-cdm-fg',
      )}
    >
      {display}
    </span>
  );
}

/**
 * 판이 시작된 뒤로 흐른 시간. 설정 안에만 있다.
 * 상단 바에 두지 않는 것은, 이걸 보고 할 일이 없기 때문이다 — 남은 시간과
 * 나란히 두면 어느 쪽이 내 차례를 재는 건지 헷갈린다.
 */
export function ElapsedTime({ startedAt }: { startedAt: number | null | undefined }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!startedAt) return <span className="tabular-nums text-cdm-fg-subtle">—</span>;
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const text = h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
    : `${m}:${String(s).padStart(2, '0')}`;

  return <span className="font-mono font-semibold tabular-nums text-cdm-fg">{text}</span>;
}

/**
 * 상단 바 왼쪽 — 정보 · 라운드 · 차례 · 남은 시간. 방 제목 자리를 대신 쓴다.
 *
 * 'i' 가 맨 앞에 있는 것은 그 자리가 원래 방 제목이 있던 자리이기 때문이다.
 * 방 제목이 그 안으로 들어갔으니, 찾을 때 눈이 가는 곳도 그대로 왼쪽이다.
 */
export function GameHudLeft({
  round,
  order,
  ranked,
  onOpenInfo,
}: {
  round?: React.ReactNode;
  order?: React.ReactNode;
  ranked?: boolean;
  onOpenInfo?: () => void;
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      {onOpenInfo && (
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="방 정보"
          title="방 정보"
          className="-ml-1 shrink-0 rounded-cdm-md p-1.5 text-cdm-ink-fg-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="info" />
        </button>
      )}
      {ranked && (
        <span className="shrink-0 rounded-cdm-md bg-cdm-rank px-1.5 py-0.5 text-[10px] font-bold tracking-wide text-cdm-fg uppercase">
          랭크
        </span>
      )}
      {round != null && (
        <span className="shrink-0 text-sm font-bold text-cdm-fg tabular-nums">{round}</span>
      )}
      {order != null && (
        <span className="shrink-0 rounded-cdm-md bg-cdm-ink-border px-1.5 py-0.5 text-[11px] font-bold text-cdm-ink-fg">
          {order}
        </span>
      )}
      <span className="ml-auto shrink-0 pl-1">
        <CountdownTimer />
      </span>
    </div>
  );
}
