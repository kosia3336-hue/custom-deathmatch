'use client';

import { useState } from 'react';
import { cn } from '@/lib/utils';
import { GAME_RULES, GAME_CATEGORIES } from '@/lib/gameRules';
import { GameRulesModal } from '@/components/game/GameRulesModal';

/** 컬럼별 시작 오프셋(px) — 벽돌처럼 엇갈리고 삐죽삐죽한(마감 덜 된) 느낌 */
const COLUMN_OFFSET = [0, 28, 16, 36, 10, 30, 20];

export default function RulesClient() {
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <>
      {/* 갈래 세로 컬럼 — items-stretch 로 모든 레일이 표 끝(맨 아래)까지 내려옴.
          심리 게임이 많아 두 칸으로 분할 */}
      <div className="flex items-stretch">
        {GAME_CATEGORIES.flatMap((cat, catIdx) => {
          const all = GAME_RULES.filter((g) => g.category === cat);
          if (cat === '심리' && all.length > 4) {
            const half = Math.ceil(all.length / 2);
            return [
              { cat, catIdx, games: all.slice(0, half) },
              { cat, catIdx, games: all.slice(half) },
            ];
          }
          return [{ cat, catIdx, games: all }];
        }).map(({ cat, catIdx, games }, ci, cols) => {
          const hue = Math.round((catIdx / GAME_CATEGORIES.length) * 300);
          const isLast = ci === cols.length - 1;

          return (
            <div
              key={`${cat}-${ci}`}
              className={cn(
                'flex min-w-0 flex-1 flex-col border-cdm-fg',
                'border-l-2',
                isLast && 'border-r-2',
              )}
            >
              {/* 맨 위 칸: 갈래 이름 (상단 선 없음) */}
              <div className="px-1 py-2.5 text-center text-xs font-extrabold text-cdm-fg sm:text-sm">
                {cat}
              </div>

              {/* 엇갈림 오프셋 */}
              <div style={{ marginTop: COLUMN_OFFSET[ci] ?? 0 }}>
                {games.map((g, j) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setOpenId(g.id)}
                    style={{ backgroundColor: `hsl(${hue} 58% ${87 - (j % 3) * 3}%)` }}
                    className="flex min-h-[84px] w-full items-center justify-center overflow-hidden border-t-2 border-cdm-fg px-1 py-1.5 text-center text-[11px] font-bold leading-tight text-cdm-fg break-all transition-[filter] hover:brightness-95 active:brightness-90 sm:min-h-[104px] sm:px-1.5 sm:text-sm sm:break-keep"
                  >
                    {g.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <GameRulesModal
        gameId={openId}
        open={openId !== null}
        onClose={() => setOpenId(null)}
      />
    </>
  );
}
