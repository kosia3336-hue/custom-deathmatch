'use client';
import type { FTMilestoneEntry } from '@/shared/types/five-towers';

export function MilestoneOverlay({
  entry,
  visible,
  citadel,
}: {
  entry: FTMilestoneEntry | null;
  visible: boolean;
  citadel?: boolean;
}) {
  const isComplete = entry?.kind === 'complete';
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {entry &&
        (isComplete ? (
          citadel ? (
            <div className="skin-citadel-milestone-complete flex flex-col items-center gap-3 px-14 py-10 text-center shadow-2xl">
              <span className="skin-citadel-milestone-kicker text-sm font-semibold tracking-widest uppercase">
                탑 완성
              </span>
              <span className="text-6xl font-black">{entry.tower}</span>
              <span className="text-xl font-bold">{entry.actorNickname}</span>
              <span className="skin-citadel-milestone-score rounded-full px-5 py-1.5 text-base font-black">
                +1 점
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-amber-900/80 px-14 py-10 text-center text-white shadow-2xl backdrop-blur-sm">
              <span className="text-sm font-semibold tracking-widest uppercase opacity-70">
                탑 완성
              </span>
              <span className="text-6xl font-black">{entry.tower}</span>
              <span className="text-xl font-bold">{entry.actorNickname}</span>
              <span className="rounded-full bg-amber-400 px-5 py-1.5 text-base font-black text-amber-900">
                +1 점
              </span>
            </div>
          )
        ) : citadel ? (
          <div
            className="skin-citadel-milestone-half px-10 py-5 text-center shadow-2xl"
            style={{ marginTop: '-30vh' }}
          >
            <span className="skin-citadel-milestone-kicker block text-xs font-semibold tracking-widest uppercase">
              6칸 공개
            </span>
            <span className="mt-1 block text-3xl font-black">{entry.tower}탑</span>
            <span className="mt-0.5 block text-sm font-medium opacity-90">
              {entry.actorNickname}
            </span>
          </div>
        ) : (
          <div
            className="rounded-2xl border-2 border-yellow-400 bg-yellow-50 px-10 py-5 text-center shadow-2xl"
            style={{ marginTop: '-30vh' }}
          >
            <span className="block text-xs font-semibold tracking-widest text-yellow-600 uppercase">
              6칸 공개
            </span>
            <span className="mt-1 block text-3xl font-black text-yellow-800">{entry.tower}탑</span>
            <span className="mt-0.5 block text-sm font-medium text-yellow-700">
              {entry.actorNickname}
            </span>
          </div>
        ))}
    </div>
  );
}
