'use client';
import { WaitingDots } from './WaitingDots';

export function WaitingCard({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <WaitingDots />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
