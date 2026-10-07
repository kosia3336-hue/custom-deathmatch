'use client';
import { usePresentationEffect } from '@/hooks/usePresentationEffect';
import { useRef, useState } from 'react';

export function LiveSugarBadge({ value }: { value: number }) {
  const prevRef = useRef(value);
  const [deltas, setDeltas] = useState<{ id: number; diff: number }[]>([]);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const counterRef = useRef(0);

  usePresentationEffect(() => {
    const diff = value - prevRef.current;
    prevRef.current = value;
    if (diff === 0) return;

    const id = ++counterRef.current;
    setFlash(diff > 0 ? 'up' : 'down');
    setDeltas((prev) => [...prev, { id, diff }]);

    const t1 = setTimeout(() => setFlash(null), 400);
    const t2 = setTimeout(() => setDeltas((prev) => prev.filter((d) => d.id !== id)), 800);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [value]);

  const flashCls =
    flash === 'up'
      ? 'bg-emerald-100 border-emerald-400 scale-110'
      : flash === 'down'
        ? 'bg-rose-100 border-rose-400 scale-110'
        : 'bg-amber-50 border-amber-200 scale-100';

  return (
    <div className="relative flex flex-col items-center">
      {/* 떠오르는 델타 배지들 */}
      {deltas.map(({ id, diff }) => (
        <span
          key={id}
          className={`animate-out fade-out slide-out-to-top-3 fill-mode-forwards pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 text-sm font-extrabold duration-700 ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          {diff > 0 ? `+${diff}` : diff}
        </span>
      ))}
      <div
        className={`flex items-center gap-1 rounded-lg border-2 px-2 py-1 transition-all duration-300 ${flashCls}`}
      >
        <span
          key={value}
          className="animate-in zoom-in-50 text-sm font-bold text-amber-800 tabular-nums duration-300"
        >
          {value}
        </span>
      </div>
    </div>
  );
}
