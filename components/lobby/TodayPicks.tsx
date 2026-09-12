'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { fetchGames } from '@/lib/api';
import { getGameRule } from '@/lib/gameRules';
import { filterUnreleased } from '@/lib/unreleasedGames';
import { GAME_IDS, type Game } from '@/shared/types';

const PICK_COUNT = 3;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** 이벤트판은 방을 직접 만들 수 없어 추천하지 않는다(방 만들기 목록과 같은 기준). */
const EXCLUDED = new Set<string>([GAME_IDS.INDIAN_POKER_EVENT, GAME_IDS.SUN_MOON_STAR_EVENT]);

/** 날짜(KST) 하나로 정해지는 난수 — 같은 날에는 누가 언제 열어도 같은 세 종목이 나온다. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pickTodayGames<T extends { id: string }>(games: T[], now: number, count = PICK_COUNT): T[] {
  const rand = mulberry32(Math.floor((now + KST_OFFSET_MS) / DAY_MS));
  const pool = [...games].sort((a, b) => a.id.localeCompare(b.id));
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, count);
}

function modesLabel(g: Game): string {
  return [g.supportsMulti && '멀티', g.supportsCom && 'COM', g.supportsSolo && '솔로']
    .filter(Boolean)
    .join(' · ');
}

/**
 * 모바일 홈 '오늘의 추천' (앱 재설계안 1b).
 *
 * 기획안의 '입문 · 3분 · 룰 4줄' 같은 난이도·소요 시간 데이터는 아직 없다.
 * 그래서 대표 이미지·갈래와, 실제로 고를 수 있는 플레이 모드만 보여 준다.
 * 누르면 그 게임의 룰 페이지로 간다.
 */
export default function TodayPicks({ isAdmin }: { isAdmin: boolean }) {
  const [picks, setPicks] = useState<Game[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchGames()
      .then((all) => {
        if (cancelled) return;
        const playable = filterUnreleased(all, isAdmin).filter(
          (g) => !EXCLUDED.has(g.id) && !getGameRule(g.id)?.hiddenInLadder,
        );
        setPicks(pickTodayGames(playable, Date.now()));
      })
      .catch(() => {
        if (!cancelled) setPicks([]);
      });
    return () => {
      cancelled = true;
    };
  }, [isAdmin]);

  // 목록을 못 불러오면 섹션을 통째로 뺀다
  if (picks?.length === 0) return null;

  return (
    <section aria-labelledby="today-picks-title" className="pt-4">
      <div className="flex items-baseline justify-between px-4 pb-2.5">
        <h2 id="today-picks-title" className="text-base font-extrabold tracking-tight text-cdm-fg">
          오늘의 추천
        </h2>
        <Link href="/rules" className="text-xs font-semibold text-cdm-primary">
          도감 전체 →
        </Link>
      </div>
      {/* 가로로만 넘긴다 — 문서는 가로로 밀리지 않는다 */}
      <ul className="flex snap-x gap-2.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
        {picks === null
          ? // 불러오는 동안 같은 크기의 빈 카드로 자리를 잡아 아래 목록이 튀지 않게 한다
            Array.from({ length: PICK_COUNT }, (_, i) => (
              <li
                key={i}
                aria-hidden
                className="w-37.5 flex-none overflow-hidden rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1"
              >
                <div className="aspect-[4/3] animate-pulse bg-cdm-bg-elev-2" />
                <div className="h-13" />
              </li>
            ))
          : picks.map((g) => {
              const category = getGameRule(g.id)?.category;
              return (
                <li key={g.id} className="w-37.5 flex-none snap-start">
                  <Link
                    href={`/rules/${g.id}`}
                    className="block overflow-hidden rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1"
                  >
                    <div
                      className="relative aspect-[4/3] bg-cdm-ink bg-cover bg-center"
                      style={{ backgroundImage: `url(/games/${g.id}.webp)` }}
                    >
                      {category && (
                        <span className="absolute top-1.5 left-1.5 rounded-cdm-sm bg-cdm-ink/75 px-1.5 py-0.5 text-[10px] font-bold text-white">
                          {category}
                        </span>
                      )}
                    </div>
                    <div className="px-2.5 pt-2 pb-2.5">
                      <p className="truncate text-sm font-bold text-cdm-fg">{g.name}</p>
                      <p className="mt-0.5 truncate text-[11px] text-cdm-fg-muted">{modesLabel(g)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
      </ul>
    </section>
  );
}
