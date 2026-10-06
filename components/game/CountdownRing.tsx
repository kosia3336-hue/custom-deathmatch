'use client';
import { useEffect, useState } from 'react';
import { ProgressRing } from '@/components/cdm/ProgressRing';
import { serverNow } from '@/lib/serverClock';
import { remainingProgress } from '@/lib/progressRing';

export default function CountdownRing({
  deadline,
  durationMs,
  label,
  size = 32,
}: {
  deadline?: number;
  durationMs: number;
  label: string;
  size?: number;
}) {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    if (deadline === undefined) return;
    const update = () => setNow(serverNow());
    update();
    const timer = setInterval(update, 100);
    return () => clearInterval(timer);
  }, [deadline]);
  const value =
    deadline === undefined || now === null
      ? undefined
      : remainingProgress(deadline, durationMs, now);
  return <ProgressRing value={value} label={label} size={size} />;
}
