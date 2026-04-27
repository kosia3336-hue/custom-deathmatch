'use client';

import type { BankPlayerInfo, BankSide } from '@/shared/types/bank-game';
import { formatKRW } from './constants';

/* ════════════════════════════════════════════════════════════
 * OpponentBox — 상대 정보 (사이드바 / details)
 *   · 잔여 장수 공개, 잔여 금액·인벤토리 구성 비공개 (자물쇠)
 *   · 이번 라운드 제출 장수 공개 (firstReveal 이후)
 * ════════════════════════════════════════════════════════════ */

interface Props {
  opponent: BankPlayerInfo;
  firstSide: BankSide | null;
  /** 이번 라운드 상대의 공개 장수 노출 여부 */
  showBetCount: boolean;
}

export default function OpponentBox({ opponent, firstSide, showBetCount }: Props) {
  const isFirst = !!firstSide && opponent.side === firstSide;
  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">상대</p>
      <div className="space-y-1.5 rounded-xl border-2 border-amber-200 bg-amber-50 p-3">
        <div className="flex items-center justify-between gap-2">
          <span className="min-w-0 truncate text-sm font-semibold text-amber-700">
            {opponent.nickname}
            {isFirst && <span className="ml-1 text-amber-500">👑선</span>}
          </span>
          <span className="text-2xl font-extrabold tabular-nums text-amber-700">
            {opponent.score}점
          </span>
        </div>
        <div className="flex items-center justify-between border-t border-white/60 pt-1.5 text-[11px]">
          <span className="text-gray-500">잔여</span>
          <span className="text-right">
            <span className="block font-bold tabular-nums text-gray-700">
              💼 {opponent.inventoryCount}장
            </span>
            <span className="block text-[10px] tabular-nums text-gray-400">
              {opponent.inventoryAmount != null
                ? `${formatKRW(opponent.inventoryAmount)}원`
                : '🔒 비공개'}
            </span>
          </span>
        </div>
        {showBetCount && opponent.publicBetCount != null && (
          <div className="flex items-center justify-between border-t border-white/60 pt-1.5 text-[11px]">
            <span className="text-gray-500">이번 라운드 제출</span>
            <span className="text-right">
              <span className="block font-bold tabular-nums text-amber-700">
                {opponent.publicBetCount}장
              </span>
              <span className="block text-[10px] text-gray-400">금액 🔒</span>
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
