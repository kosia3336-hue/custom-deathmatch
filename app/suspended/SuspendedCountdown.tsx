'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function diff(until: number) {
  const ms = Math.max(0, until - Date.now());
  const total = Math.floor(ms / 1000);
  const d = Math.floor(total / 86400);
  const h = Math.floor((total % 86400) / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return { ms, d, h, m, s };
}

export default function SuspendedCountdown({ until }: { until: string }) {
  const target = new Date(until).getTime();
  const router = useRouter();
  const [now, setNow] = useState<ReturnType<typeof diff> | null>(null);

  useEffect(() => {
    setNow(diff(target));
    const id = setInterval(() => {
      const next = diff(target);
      setNow(next);
      if (next.ms <= 0) {
        clearInterval(id);
        // 종료 도래 → 새로고침으로 정상 회원 처리
        setTimeout(() => router.refresh(), 1000);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [target, router]);

  if (now === null) return null;

  if (now.ms <= 0) {
    return (
      <p className="mt-1 text-xs text-cdm-success">
        정지가 해제되었습니다. 잠시 후 자동으로 새로고침합니다.
      </p>
    );
  }

  return (
    <p className="mt-1 font-mono text-xs tabular-nums text-cdm-fg-muted">
      남은 시간 {now.d}일 {String(now.h).padStart(2, '0')}:{String(now.m).padStart(2, '0')}:
      {String(now.s).padStart(2, '0')}
    </p>
  );
}
