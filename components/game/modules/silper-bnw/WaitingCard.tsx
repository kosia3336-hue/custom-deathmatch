'use client';
import { WaitingDots } from './WaitingDots';

export function WaitingCard({ text, meow }: { text: string; meow?: boolean }) {
  if (meow) {
    return (
      <div className="skin-meow-panel flex flex-col items-center gap-2 p-6">
        <div className="skin-meow-cat-img skin-meow-cat-img--sleep h-14 w-20" aria-hidden />
        <span className="inline-flex items-center gap-1" aria-hidden>
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="skin-meow-waiting-paw text-sm"
              style={{ animationDelay: `${i * 0.18}s` }}
            >
              🐾
            </span>
          ))}
        </span>
        <p className="skin-meow-subtext text-sm">{text}</p>
      </div>
    );
  }
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <WaitingDots />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}
