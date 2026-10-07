'use client';
import type { GS2PlayerPublic } from '@/shared/types/grape-sugar-2';
import { CARD_IDS, CARD_LABELS } from '@/shared/types/grape-sugar-2';
import { CARD_NAMES, CARD_STYLES } from './constants';

export function PlayerPanel({
  player,
  label,
  isMe,
  showSubmittedBadge,
  candy,
  showHand = true,
  showStats = true,
}: {
  player: GS2PlayerPublic;
  label: string;
  isMe: boolean;
  showSubmittedBadge: boolean;
  candy?: boolean;
  showHand?: boolean;
  showStats?: boolean;
}) {
  return (
    <div
      className={`relative z-10 flex min-w-0 flex-wrap items-center gap-2 px-3 py-2 ${
        candy
          ? `skin-candy-panel ${isMe ? 'ring-1 ring-white' : ''}`
          : `rounded-lg border ${isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`
      }`}
    >
      {/* 닉네임 + 배지 */}
      <div className="flex min-w-0 flex-1 items-center gap-1.5">
        <span className="truncate text-sm font-bold text-gray-800">{player.nickname}</span>
        <span className="shrink-0 text-xs text-gray-400">{label}</span>
        {showSubmittedBadge && player.submitted && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[11px] font-bold text-emerald-700">
            제출
          </span>
        )}
        {player.hrPenaltyPending > 0 && (
          <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[11px] font-bold text-orange-700">
            -{player.hrPenaltyPending}
          </span>
        )}
      </div>

      {/* 스탯 */}
      {showStats && (
        <div className="flex w-full shrink-0 flex-wrap items-center gap-1 text-xs">
          <span
            className={`font-bold whitespace-nowrap ${player.score < 0 ? 'text-red-500' : 'text-purple-700'}`}
          >
            {player.score}점
          </span>
          <span className="font-bold whitespace-nowrap text-amber-700">
            설탕 {player.sugarRemain}
          </span>
          <span className="font-bold whitespace-nowrap text-sky-600">{player.hand.length}장</span>
        </div>
      )}

      {/*
        잔여 카드 미니 배지.
        예전에는 sm 미만에서 숨겨 두어, 휴대폰에서는 상대에게 무슨 카드가 남았는지
        볼 방법이 아예 없었다. 좁은 화면에서는 한 줄을 접어 내려 폭을 다 쓴다.
      */}
      {showHand && (
        <div
          aria-label={`${player.nickname} 잔여 카드`}
          className="flex w-full shrink-0 flex-wrap justify-start gap-0.5"
        >
          {CARD_IDS.map((c) => {
            const has = player.hand.includes(c);
            const style = CARD_STYLES[c];
            return (
              <span
                key={c}
                className={`inline-flex items-center justify-center rounded px-1 py-0.5 text-[11px] leading-none font-bold whitespace-nowrap ${
                  has
                    ? `${style.bg} ${style.text} border ${style.border}`
                    : 'bg-gray-100 text-gray-300 line-through'
                }`}
                title={CARD_NAMES[c]}
              >
                {CARD_LABELS[c]}
              </span>
            );
          })}
        </div>
      )}
    </div>
  );
}
