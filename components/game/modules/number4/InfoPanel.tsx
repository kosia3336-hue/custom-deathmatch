'use client';

import type { NF4PlayerInfo, NF4RoundRecord } from '@/shared/types/number4';
import RoundHistory from './RoundHistory';

interface InfoPanelProps {
  round: number;
  players: Record<string, NF4PlayerInfo>;
  roundHistory: NF4RoundRecord[];
  myId: string | undefined;
}

export default function InfoPanel({ round, players, roundHistory, myId }: InfoPanelProps) {
  const playerEntries = Object.entries(players);

  return (
    <div className="flex flex-col gap-4">
      <div className="text-sm font-semibold text-gray-500">라운드 {round}/6</div>

      {playerEntries.map(([id, p]) => {
        const isMe = id === myId || id.replace('_p2', '') === myId;
        const scoreColor = p.score <= 1 ? 'text-red-500' : 'text-gray-900';
        return (
          <div key={id} className={`rounded-lg border p-3 ${isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{p.nickname}</span>
              <span className={`text-lg font-bold ${scoreColor}`}>{p.score}점</span>
            </div>
            <div className="mt-1 text-xs text-gray-500">
              {p.remainingWhite >= 0
                ? `□${p.remainingWhite} ■${p.remainingBlack}`
                : `남은 타일 ${p.remainingWhite + p.remainingBlack < 0 ? '?' : (p.remainingWhite + p.remainingBlack)}`
              }
            </div>
            {p.submitted && (
              <div className="mt-1 text-xs text-green-600">제출 완료</div>
            )}
          </div>
        );
      })}

      <div className="border-t border-gray-200 pt-3">
        <RoundHistory roundHistory={roundHistory} players={players} />
      </div>
    </div>
  );
}
