import Link from 'next/link';
import { cn } from '@/lib/utils';
import { GAME_RULES, GAME_CATEGORIES, categoryHue } from '@/lib/gameRules';

/** 컬럼별 시작 오프셋(px) — 벽돌처럼 엇갈리고 삐죽삐죽한(마감 덜 된) 느낌 */
const COLUMN_OFFSET = [0, 28, 16, 36, 10, 30, 20];

/**
 * 게임 룰 목록 — 각 칸은 개별 룰 페이지(/rules/[gameId])로 이동하는 링크.
 * 모달이 아닌 실제 페이지 링크라 검색엔진이 룰 본문까지 수집할 수 있다.
 */
export default function RulesClient() {
  const lineClass = 'border-cdm-fg';
  const headingClass = 'text-cdm-fg';

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
        })
        /* 아직 게임이 없는 갈래(수리·관찰 등)는 머리글만 있는 빈 레일이 되어
           페이지가 미완성으로 보였다. 채워질 때 자동으로 다시 나타난다. */
        .filter(({ games }) => games.length > 0)
        .map(({ cat, catIdx, games }, ci, cols) => {
          const hue = categoryHue(cat);
          const isLast = ci === cols.length - 1;

          return (
            <div
              key={`${cat}-${ci}`}
              className={cn(
                'flex min-w-0 flex-1 flex-col',
                lineClass,
                'border-l-2',
                isLast && 'border-r-2',
              )}
            >
              {/* 맨 위 칸: 갈래 이름 (상단 선 없음) */}
              <div
                className={cn(
                  'px-1 py-2.5 text-center text-xs font-extrabold sm:text-sm',
                  headingClass,
                )}
              >
                {cat}
              </div>

              {/* 엇갈림 오프셋 */}
              <div style={{ marginTop: COLUMN_OFFSET[ci] ?? 0 }}>
                {games.map((g, j) => (
                  <Link
                    key={g.id}
                    href={`/rules/${g.id}`}
                    style={{ backgroundColor: `hsl(${hue} 58% ${87 - (j % 3) * 3}%)` }}
                    className={cn(
                      'flex min-h-[84px] w-full items-center justify-center overflow-hidden border-t-2 px-1 py-1.5 text-center text-[11px] font-bold leading-tight text-cdm-fg break-all transition-[filter] hover:brightness-95 active:brightness-90 sm:min-h-[104px] sm:px-1.5 sm:text-sm sm:break-keep',
                      lineClass,
                    )}
                  >
                    {g.name}
                  </Link>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
