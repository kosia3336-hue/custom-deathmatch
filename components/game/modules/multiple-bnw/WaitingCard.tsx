'use client';
import { WaitingDots } from './WaitingDots';

export function WaitingCard({ text, extra }: { text: string; extra?: string }) {
  return (
    <div className="mbnw-panel mbnw-waiting-card flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-8">
      <WaitingDots />
      <p className="text-sm text-gray-500">{text}</p>
      {extra && <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600">{extra}</p>}
    </div>
  );
}
