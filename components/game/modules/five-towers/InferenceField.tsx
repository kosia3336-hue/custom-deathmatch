'use client';

import type { SkinTheme } from '@/lib/skins/registry';
import { FT_HALF_MILESTONE, FT_TOWER_MAX_HEIGHT, FT_TOWERS } from '@/shared/types';
import type { FTTower, FTTowerPublicInfo } from '@/shared/types/five-towers';
import { useCallback, useEffect, useState } from 'react';
import CitadelFieldShell from './skins/CitadelFieldShell';
import CitadelTower from './skins/CitadelTower';
import { cycleTowerNote, parseTowerNote, type TowerNote } from '@/lib/fiveTowersNotes';

const TOWER_COLORS: Record<FTTower, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
  B: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
  C: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700' },
  D: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-700' },
  E: { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700' },
};

const EMPTY_COUNTS: Record<FTTower, TowerNote> = Object.fromEntries(
  FT_TOWERS.map((id) => [id, parseTowerNote(0)]),
) as Record<FTTower, TowerNote>;

interface InferenceFieldProps {
  towers: Record<FTTower, FTTowerPublicInfo>;
  gameKey: string;
  skin?: SkinTheme | null;
}

function loadCounts(key: string): Record<FTTower, TowerNote> {
  if (typeof window === 'undefined') return { ...EMPTY_COUNTS };
  try {
    const raw = sessionStorage.getItem(`ft.inference-counts.${key}`);
    if (!raw) return { ...EMPTY_COUNTS };
    const parsed = JSON.parse(raw);
    return Object.fromEntries(FT_TOWERS.map((id) => [id, parseTowerNote(parsed?.[id])])) as Record<
      FTTower,
      TowerNote
    >;
  } catch {
    return { ...EMPTY_COUNTS };
  }
}

function saveCounts(key: string, c: Record<FTTower, TowerNote>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`ft.inference-counts.${key}`, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export default function InferenceField({ towers, gameKey, skin }: InferenceFieldProps) {
  const [counts, setCounts] = useState<Record<FTTower, TowerNote>>(() => loadCounts(gameKey));

  // 게임이 바뀌면 해당 게임의 저장값으로 교체 (새 게임 시 0으로 초기화)
  useEffect(() => {
    setCounts(loadCounts(gameKey));
  }, [gameKey]);

  useEffect(() => {
    saveCounts(gameKey, counts);
  }, [gameKey, counts]);

  const setCell = useCallback((tower: FTTower, level: number) => {
    setCounts((prev) => {
      return { ...prev, [tower]: cycleTowerNote(prev[tower], level) };
    });
  }, []);

  const resetTower = useCallback((tower: FTTower) => {
    setCounts((prev) => ({ ...prev, [tower]: parseTowerNote(0) }));
  }, []);

  if (skin === 'citadel') {
    return (
      <CitadelFieldShell>
        <div className="skin-citadel-towers grid grid-cols-5 gap-2 sm:gap-3">
          {FT_TOWERS.map((id) => (
            <CitadelTower
              key={id}
              id={id}
              tower={towers[id]}
              userCount={counts[id].height}
              gray={counts[id].tone === 'gray'}
              gameKey={gameKey}
              onSetCell={setCell}
              onResetTower={resetTower}
            />
          ))}
        </div>
      </CitadelFieldShell>
    );
  }

  return (
    <div className="grid h-full min-h-0 grid-cols-5 gap-2 sm:gap-3">
      {FT_TOWERS.map((id) => {
        const tower = towers[id];
        const colors = TOWER_COLORS[id];
        const userCount = counts[id].height;
        const gray = counts[id].tone === 'gray';
        const isCompleted = tower.completed;

        return (
          <div
            key={id}
            className={`flex min-h-0 flex-col items-stretch overflow-hidden rounded-lg border-2 ${
              isCompleted ? 'border-yellow-400 bg-yellow-50' : colors.border
            } ${isCompleted ? 'opacity-90' : 'bg-white'}`}
          >
            {/* 헤더 */}
            <button
              type="button"
              onContextMenu={(e) => {
                e.preventDefault();
                resetTower(id);
              }}
              onDoubleClick={() => resetTower(id)}
              disabled={isCompleted}
              className={`flex shrink-0 items-center justify-center gap-2 px-1 py-1 ${
                isCompleted ? 'bg-yellow-200 text-yellow-800' : `${colors.bg} ${colors.text}`
              } ${isCompleted ? 'cursor-default' : 'hover:brightness-95'}`}
              title={isCompleted ? '완성된 탑' : '더블클릭/우클릭으로 카운트 초기화'}
            >
              <span className="text-base font-bold sm:text-lg">{id}</span>
              {/* 아직 안 센 탑에 0 을 적지 않는다 (CitadelTower 주석 참고) */}
              <span className="text-xl font-black tabular-nums sm:text-2xl">
                {isCompleted ? '완성' : userCount > 0 ? userCount : '\u00A0'}
              </span>
            </button>

            {/* 셀 */}
            <div className="flex min-h-0 flex-1 flex-col">
              {Array.from({ length: 10 }, (_, i) => 10 - i).map((level) => {
                const isFilled = userCount >= level;
                const isHalf = level === FT_HALF_MILESTONE;
                const halfReached = tower.milestonesReached.half;

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCell(id, level)}
                    aria-label={`${id}탑 ${level}칸`}
                    data-note-tone={isFilled ? counts[id].tone : 'empty'}
                    disabled={isCompleted}
                    className={`relative flex min-h-0 flex-1 items-center justify-end border-t px-1.5 text-[11px] leading-3 font-medium transition-all sm:text-xs ${
                      isCompleted
                        ? 'cursor-default bg-yellow-100 text-yellow-700'
                        : isFilled
                          ? gray
                            ? 'bg-gray-200 text-gray-600 hover:brightness-95'
                            : `${colors.bg} ${colors.text} hover:brightness-95`
                          : 'bg-white text-gray-300 hover:bg-gray-50'
                    } ${
                      isHalf
                        ? halfReached
                          ? 'border-t-yellow-500'
                          : 'border-dashed border-t-gray-400'
                        : 'border-gray-100'
                    }`}
                  >
                    <span className="tabular-nums">{level}</span>
                    {isHalf && halfReached && (
                      <span className="absolute top-1/2 left-1 -translate-y-1/2 text-[11px] font-bold text-yellow-700">
                        6+
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { FT_TOWER_MAX_HEIGHT, TOWER_COLORS };
