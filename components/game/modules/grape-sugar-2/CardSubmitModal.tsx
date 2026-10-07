'use client';
import styles from './layout.module.css';
import { playCandyButtonSfx } from '@/lib/audio/skins/candy';
import type { GS2CardId } from '@/shared/types/grape-sugar-2';
import { CARD_HINTS, CARD_NAMES, CARD_STYLES } from './constants';
import { SugarBar } from './SugarBar';

export function CardSubmitModal({
  card,
  sugar,
  sugarRemain,
  onSugarChange,
  onClose,
  onConfirm,
  submitting,
  candy,
}: {
  card: GS2CardId;
  sugar: number;
  sugarRemain: number;
  onSugarChange: (n: number) => void;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  candy?: boolean;
}) {
  const style = CARD_STYLES[card];

  return (
    <div
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="카드 제출"
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
        className="max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl"
      >
        {/* 카드 + 효과 설명 */}
        <div className="mb-4 flex items-start gap-4">
          <div
            className={
              candy
                ? `skin-candy-card skin-candy-card--${card} flex w-20 shrink-0 flex-col items-center justify-center`
                : `${styles.card} flex w-20 shrink-0 flex-col items-center justify-center rounded-xl border-2 ${style.bg} ${style.text} ${style.border}`
            }
          >
            <span className="text-3xl">{style.icon}</span>
            <span className="mt-1 px-1 text-center text-xs font-bold">{CARD_NAMES[card]}</span>
          </div>
          <p className="min-w-0 flex-1 pt-1 text-sm leading-relaxed text-gray-600">
            {CARD_HINTS[card]}
          </p>
        </div>

        <div className="mb-3">
          <SugarBar
            sugarRemain={sugarRemain}
            pendingSugar={sugar}
            setPendingSugar={onSugarChange}
            canAct={!submitting}
            candy={candy}
          />
        </div>
        {/* 수정한 설탕과 카드를 함께 제출 */}
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
          <span className="text-sm text-amber-800">
            설탕 <strong>{sugar}개</strong> 함께 제출
          </span>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            취소
          </button>
          <button
            type="button"
            onClick={() => {
              if (candy) playCandyButtonSfx();
              onConfirm();
            }}
            disabled={submitting}
            className={
              candy
                ? 'skin-candy-submit flex-1 py-3 text-sm'
                : 'flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 disabled:opacity-50'
            }
          >
            {CARD_NAMES[card]} 제출
          </button>
        </div>
      </div>
    </div>
  );
}
