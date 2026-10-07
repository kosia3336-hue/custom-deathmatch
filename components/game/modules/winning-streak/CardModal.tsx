'use client';
import type { WSCardType } from '@/shared/types/winning-streak';
import { CARD_MATCHUP_DESC, CARD_NAMES } from './constants';
import { WinningStreakCard } from './WinningStreakCard';

export function CardModal({
  card,
  onClose,
  onSubmit,
  submitting,
}: {
  card: WSCardType;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const info = CARD_MATCHUP_DESC[card];

  return (
    <div
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        {/* 카드 미리보기 */}
        <div className="mb-5 flex items-center gap-4">
          <WinningStreakCard card={card} />
          <div className="grid min-w-0 flex-1 grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm lg:text-base">
            <span className="font-semibold whitespace-nowrap text-emerald-600">이김</span>
            <span className="min-w-0 text-gray-700">{info.beats}</span>
            <span className="font-semibold whitespace-nowrap text-red-500">짐</span>
            <span className="min-w-0 text-gray-700">{info.losesTo}</span>
            {info.special && (
              <>
                <span className="border-t border-gray-100 pt-1.5 text-xs whitespace-nowrap text-gray-400">
                  특이
                </span>
                <span className="min-w-0 border-t border-gray-100 pt-1.5 text-xs text-gray-400">
                  {info.special}
                </span>
              </>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50 lg:text-base"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50 lg:text-base"
          >
            {CARD_NAMES[card]} 제출
          </button>
        </div>
      </div>
    </div>
  );
}
