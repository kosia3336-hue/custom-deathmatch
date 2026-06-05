'use client';

import { PlayerIdentity } from '@/components/cdm/PlayerIdentity';
import type { TitleColor } from '@/lib/supabase/database.types';
import type { SmsRoundScore, SmsSeatPublic } from '@/shared/types/sun-moon-star-event';
import { SMSE_MARK_ICONS } from '@/shared/types/sun-moon-star-event';

interface Props {
  seat: SmsSeatPublic;
  isMe: boolean;
}

function ScoreBadge({ score }: { score: SmsRoundScore }) {
  if (score > 0) {
    return <span className="font-bold text-amber-600">+{score}</span>;
  }
  if (score === -1) {
    return <span className="font-bold text-rose-600">-1</span>;
  }
  return null;
}

export default function SmsSeatChip({ seat, isMe }: Props) {
  return (
    <div
      className={`rounded-cdm-md border px-2.5 py-2 sm:px-3 sm:py-2.5 ${
        seat.departed
          ? 'border-cdm-border bg-cdm-surface opacity-60'
          : isMe
            ? 'border-indigo-400 bg-indigo-500/10'
            : 'border-cdm-border bg-cdm-surface'
      }`}
    >
      <div className="min-w-0">
        <PlayerIdentity
          nickname={seat.nickname}
          title={
            seat.displayedTitle
              ? { ...seat.displayedTitle, color: seat.displayedTitle.color as TitleColor }
              : null
          }
          isMe={isMe}
          size="sm"
          layout="stacked"
          className="max-w-full"
        />
        {seat.departed && (
          <span className="text-[10px] text-cdm-muted">(이탈)</span>
        )}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-cdm-muted">
        {seat.firstPick && (
          <span title="1차">{SMSE_MARK_ICONS[seat.firstPick]}</span>
        )}
        {seat.secondPick && (
          <span title="2차">{SMSE_MARK_ICONS[seat.secondPick]}</span>
        )}
        {seat.roundScore !== null && <ScoreBadge score={seat.roundScore} />}
      </div>
    </div>
  );
}
