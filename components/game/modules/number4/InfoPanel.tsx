'use client';

import type { NF4PlayerInfo, NF4RoundRecord } from '@/shared/types/number4';
import RoundHistory from './RoundHistory';

interface InfoPanelProps {
  players: Record<string, NF4PlayerInfo>;
  roundHistory: NF4RoundRecord[];
  myId: string | undefined;
}

/**
 * 판 정보 — 데스크톱 우측·모바일 메모 모두 짙은 GameInfoPart 안에 놓인다.
 * ink-scope 는 --cdm-* 토큰만 바꾸고 Tailwind 회색은 그대로라, 글자는 ink 토큰으로 쓴다.
 */
export default function InfoPanel({ players, roundHistory, myId }: InfoPanelProps) {
  const playerEntries = Object.entries(players);

  return (
    <div className="flex flex-col gap-4">
      {playerEntries.map(([id, p]) => {
        const isMe = id === myId || id.replace('_p2', '') === myId;
        const scoreColor = p.score <= 1 ? 'text-red-400' : 'text-cdm-ink-fg';
        return (
          <div
            key={id}
            className={`rounded-lg border p-3 ${isMe ? 'border-cdm-primary/60 bg-cdm-primary/15' : 'border-cdm-ink-border bg-white/5'}`}
          >
            <div className="flex items-center justify-between">
              <span className="truncate text-sm font-medium text-cdm-ink-fg">{p.nickname}</span>
              <span className={`text-lg font-bold ${scoreColor}`}>{p.score}점</span>
            </div>
            <div className="mt-1 text-xs text-cdm-ink-fg-muted">
              {p.remainingWhite >= 0
                ? `□${p.remainingWhite} ■${p.remainingBlack}`
                : `남은 타일 ${p.remainingWhite + p.remainingBlack < 0 ? '?' : (p.remainingWhite + p.remainingBlack)}`
              }
            </div>
            {p.submitted && (
              <div className="mt-1 text-xs text-emerald-400">제출 완료</div>
            )}
          </div>
        );
      })}

      <div className="border-t border-cdm-ink-border pt-3">
        <RoundHistory roundHistory={roundHistory} players={players} />
      </div>
    </div>
  );
}
