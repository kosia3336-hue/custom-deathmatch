'use client';
import type { FTActionLogEntry } from '@/shared/types/five-towers';
import { renderActionDesc } from './renderActionDesc';

export function ActionLogList({ log, myId }: { log: FTActionLogEntry[]; myId: string }) {
  if (log.length === 0) {
    return <p className="px-3 py-4 text-center text-xs text-gray-400">아직 행동이 없습니다.</p>;
  }
  return (
    <ul className="flex flex-col gap-1 p-2">
      {log
        .slice(-40)
        .reverse()
        .map((e, i) => (
          <li
            key={`${e.turn}-${i}`}
            className={`rounded-md px-2 py-1.5 text-xs leading-relaxed ${
              e.actorId === myId ? 'bg-indigo-50 text-indigo-800' : 'bg-gray-50 text-gray-700'
            }`}
          >
            <span className="mr-1 font-mono text-[11px] text-gray-400">{e.turn}T</span>
            <span className="font-semibold">{e.actorNickname}</span> {renderActionDesc(e, myId)}
            {e.milestone === 'half' && (
              <span className="ml-1 rounded bg-yellow-200 px-1 text-[11px] font-bold text-yellow-800">
                6칸
              </span>
            )}
            {e.milestone === 'complete' && (
              <span className="ml-1 rounded bg-amber-400 px-1 text-[11px] font-bold text-white">
                완성
              </span>
            )}
          </li>
        ))}
    </ul>
  );
}
