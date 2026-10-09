'use client';

import { useContext, useEffect, useState, useRef } from 'react';
import { RoomLayoutContext } from '@/contexts/RoomLayoutContext';
import { createCountdownTickGate, formatCountdown } from '@/lib/countdownTick';
import { playCountdownTickSfx } from '@/lib/audio/synth/general';
import { serverNow } from '@/lib/serverClock';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { Icon } from '@/components/cdm/Icon';
import { formatTurnLabel } from '@/lib/gameSeat';
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
  const { remaining, timeLimitSeconds, clockKey, deadline } = useTurnTimer();
  const tickGate = useRef(createCountdownTickGate());
  useEffect(() => {
    // 새 턴의 첫 렌더에서 이전 턴 remaining 값으로 소리가 나지 않도록 현재 마감을 사용한다.
    const second = tickGate.current(
      clockKey,
      deadline === null ? null : (deadline - serverNow()) / 1000,
    );
    if (second !== null && document.visibilityState === 'visible') playCountdownTickSfx(second);
  }, [clockKey, deadline, remaining]);
  if (remaining === null || timeLimitSeconds === null) return null;

  const display = formatCountdown(remaining);

  const isCritical = remaining <= 5;
  const isDanger = remaining <= 10 && remaining > 5;
  const isWarning = remaining <= 30 && remaining > 10;

  return (
    <span
      aria-label="남은 시간"
      className={cn(
        'font-mono text-sm font-bold tabular-nums',
        isWarning && 'text-cdm-highlight',
        isDanger && 'text-cdm-accent animate-pulse',
        isCritical && 'text-cdm-accent-strong animate-[pulse_0.5s_ease-in-out_infinite]',
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

  if (!startedAt) return <span className="text-cdm-fg-subtle tabular-nums">—</span>;
  const sec = Math.max(0, Math.floor((now - startedAt) / 1000));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const text =
    h > 0
      ? `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
      : `${m}:${String(s).padStart(2, '0')}`;

  return <span className="text-cdm-fg font-mono font-semibold tabular-nums">{text}</span>;
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
  onOpenInfo,
}: {
  round?: React.ReactNode;
  order?: React.ReactNode;
  onOpenInfo?: () => void;
}) {
  const setHeaderGuide = useContext(RoomLayoutContext)?.setHeaderGuide;
  const textArea = useRef<HTMLDivElement>(null);
  const orderMeasure = useRef<HTMLSpanElement>(null);
  const [orderOverflow, setOrderOverflow] = useState(false);
  const orderLabel = typeof order === 'string' ? formatTurnLabel(order) : null;
  useEffect(() => {
    if (!setHeaderGuide || !textArea.current || !orderMeasure.current) return;
    const area = textArea.current;
    const measure = orderMeasure.current;
    const update = () =>
      setOrderOverflow(measure.getBoundingClientRect().width > area.clientWidth + 1);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(area);
    observer.observe(measure);
    const desktop = window.matchMedia('(min-width: 1024px)');
    window.addEventListener('resize', update);
    desktop.addEventListener('change', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
      desktop.removeEventListener('change', update);
    };
  }, [orderLabel, setHeaderGuide]);
  useEffect(() => {
    setHeaderGuide?.(
      orderOverflow && orderLabel ? (
        <p data-game-round-guide className="m-0 text-xs leading-relaxed break-words text-slate-200">
          {orderLabel}
        </p>
      ) : null,
    );
    return () => setHeaderGuide?.(null);
  }, [orderOverflow, orderLabel, setHeaderGuide]);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-2">
      {onOpenInfo && (
        <button
          type="button"
          onClick={onOpenInfo}
          aria-label="방 정보"
          title="방 정보"
          className="rounded-cdm-md text-cdm-ink-fg-muted -ml-1 flex h-8 w-8 shrink-0 items-center justify-center transition-colors hover:bg-white/10 hover:text-white"
        >
          <Icon name="info" />
        </button>
      )}
      <div
        ref={textArea}
        className="relative flex min-w-0 flex-1 flex-wrap items-center gap-x-1.5 gap-y-0.5"
      >
        {round != null && (
          <span className="text-cdm-fg text-xs font-bold tabular-nums sm:text-sm">{round}</span>
        )}
        {/* 랭크 여부는 'i'(방 정보)에 있다. 판 위에 늘 띄워 둘 정보가 아니라 뺐다. */}
        {orderLabel && setHeaderGuide && (
          <div
            aria-hidden
            className="pointer-events-none invisible absolute inset-x-0 top-0 h-0 overflow-hidden"
          >
            <span
              ref={orderMeasure}
              className="inline-block w-max px-1.5 py-0.5 text-[11px] leading-relaxed font-bold whitespace-nowrap"
            >
              {orderLabel}
            </span>
          </div>
        )}
        {orderLabel && !(orderOverflow && setHeaderGuide) && (
          <span
            className="rounded-cdm-md bg-cdm-ink-border text-cdm-ink-fg max-w-full px-1.5 py-0.5 text-[11px] leading-relaxed font-bold [overflow-wrap:anywhere] whitespace-normal"
            title={orderLabel}
          >
            {orderLabel}
          </span>
        )}
        {order != null && typeof order !== 'string' && order}
      </div>
      <span className="ml-auto shrink-0 pl-1">
        <CountdownTimer />
      </span>
    </div>
  );
}
