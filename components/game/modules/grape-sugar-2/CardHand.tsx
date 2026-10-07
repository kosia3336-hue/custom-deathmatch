'use client';
import styles from './layout.module.css';
import { playCandyCardSfx } from '@/lib/audio/skins/candy';
import type { GS2CardId } from '@/shared/types/grape-sugar-2';
import { CARD_IDS } from '@/shared/types/grape-sugar-2';
import { CARD_HINTS, CARD_NAMES, CARD_STYLES } from './constants';

export function CardHand({
  hand,
  onSelectCard,
  canAct,
  submitted,
  candy,
  belt,
}: {
  hand: GS2CardId[];
  onSelectCard: (c: GS2CardId) => void;
  canAct: boolean;
  submitted: boolean;
  candy?: boolean;
  /** 캔디 벨트 모드 — 프로스트 패널 대신 배경 컨베이어 벨트에 얹힌 연보라 반투명 바 */
  belt?: boolean;
}) {
  return (
    <div
      className={`relative z-10 p-2.5 lg:p-3 ${
        belt
          ? 'skin-candy-belt-panel'
          : candy
            ? 'skin-candy-panel'
            : 'rounded-xl border border-gray-200 bg-white'
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className={`text-xs font-medium ${candy ? 'skin-candy-heading' : 'text-gray-500'}`}>
          {submitted ? '제출 완료' : '카드를 눌러 제출'}
        </span>
        <span className={`text-[11px] ${candy ? 'skin-candy-subtext' : 'text-gray-400'}`}>
          잔여 {hand.length}장
        </span>
      </div>
      <div className="grid grid-cols-5 gap-1.5 lg:gap-2">
        {CARD_IDS.map((c) => {
          const has = hand.includes(c);
          const style = CARD_STYLES[c];
          if (!has) {
            return (
              <div
                key={c}
                data-grape-card
                className={
                  candy
                    ? `skin-candy-card skin-candy-card--${c} skin-candy-card--spent flex w-full min-w-0 flex-col items-center justify-center`
                    : `${styles.card} flex w-full flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-gray-50 opacity-30`
                }
              >
                <span
                  className={candy ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-base text-gray-300'}
                >
                  {style.icon}
                </span>
              </div>
            );
          }
          return (
            <button
              key={c}
              data-grape-card
              type="button"
              onClick={() => {
                if (!canAct) return;
                if (candy) playCandyCardSfx();
                onSelectCard(c);
              }}
              disabled={!canAct}
              title={CARD_HINTS[c]}
              className={
                candy
                  ? `skin-candy-card skin-candy-card--${c} skin-candy-card-btn flex w-full min-w-0 flex-col items-center justify-center select-none ${canAct ? 'cursor-pointer' : 'cursor-not-allowed opacity-60'}`
                  : `${styles.card} flex w-full flex-col items-center justify-center rounded-lg border-2 transition-all select-none ${
                      canAct
                        ? 'cursor-pointer shadow-sm hover:-translate-y-1 hover:scale-105 hover:shadow-md active:scale-95'
                        : 'cursor-not-allowed opacity-60'
                    } ${style.bg} ${style.text} ${style.border}`
              }
            >
              <span
                className={
                  candy ? 'text-2xl sm:text-3xl lg:text-4xl' : 'text-lg sm:text-xl lg:text-2xl'
                }
              >
                {style.icon}
              </span>
              <span
                className={`mt-0.5 px-0.5 text-center leading-tight font-bold ${candy ? 'text-[11px] sm:text-xs lg:text-sm' : 'text-[11px] sm:text-[11px] lg:text-xs'}`}
              >
                {CARD_NAMES[c]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
