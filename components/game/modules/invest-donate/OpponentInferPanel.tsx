'use client';

import { useState, useEffect, useCallback } from 'react';
import type { IDCoinStock } from '@/shared/types/invest-donate';
import { ID_INITIAL_COIN_STOCK } from '@/shared/types/invest-donate';
import { COIN_DENOMINATIONS } from './constants';

type Stock = { coin50: number; coin10: number; coin1: number };

interface Props {
  opponentNickname: string;
  round: number;
  opponentCoinStock?: IDCoinStock;
}

export default function OpponentInferPanel({ opponentNickname, round, opponentCoinStock }: Props) {
  const maxStock: Stock = opponentCoinStock ?? ID_INITIAL_COIN_STOCK;

  const [stock, setStock] = useState<Stock>({ ...maxStock });

  // 라운드가 바뀌거나 실제 보유량이 바뀌면 추리판 초기화
  useEffect(() => {
    setStock({ ...maxStock });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [round, opponentCoinStock?.coin50, opponentCoinStock?.coin10, opponentCoinStock?.coin1]);

  const adjust = useCallback((key: keyof Stock, delta: number, max: number) => {
    setStock((prev) => {
      const next = Math.min(max, Math.max(0, prev[key] + delta));
      return { ...prev, [key]: next };
    });
  }, []);

  return (
    <div className="w-full rounded-xl border border-gray-200 bg-gray-50 p-3">
      <div className="mb-2 text-xs font-semibold tracking-wide text-gray-400">
        {opponentNickname} 코인 추리
      </div>
      <div className="flex flex-col gap-2">
        {COIN_DENOMINATIONS.map(({ key, label, color }) => {
          const max = maxStock[key];
          return (
            <div key={key} className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className={`inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-bold ${color}`}
                >
                  {label}
                </span>
                <span className="text-xs text-gray-500">{label}원</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => adjust(key, -1, max)}
                  disabled={stock[key] <= 0}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`${label}원 감소`}
                >
                  −
                </button>
                <span className="w-8 text-center text-sm font-semibold tabular-nums text-gray-700">
                  {stock[key]}
                </span>
                <button
                  onClick={() => adjust(key, 1, max)}
                  disabled={stock[key] >= max}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-gray-200 bg-white text-sm font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-30"
                  aria-label={`${label}원 증가`}
                >
                  +
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
