'use client';

import { useCallback, useEffect, useState } from 'react';
import type { SkinTheme } from '@/lib/skins/registry';
import type { FTTower, FTTowerPublicInfo } from '@/shared/types/five-towers';
import { FT_TOWER_MAX_HEIGHT, FT_HALF_MILESTONE, FT_TOWERS } from '@/shared/types';
import CitadelFieldShell from './skins/CitadelFieldShell';
import CitadelTower from './skins/CitadelTower';

const TOWER_COLORS: Record<FTTower, { bg: string; border: string; text: string }> = {
  A: { bg: 'bg-rose-100', border: 'border-rose-300', text: 'text-rose-700' },
  B: { bg: 'bg-amber-100', border: 'border-amber-300', text: 'text-amber-700' },
  C: { bg: 'bg-emerald-100', border: 'border-emerald-300', text: 'text-emerald-700' },
  D: { bg: 'bg-sky-100', border: 'border-sky-300', text: 'text-sky-700' },
  E: { bg: 'bg-violet-100', border: 'border-violet-300', text: 'text-violet-700' },
};

const EMPTY_COUNTS: Record<FTTower, number> = { A: 0, B: 0, C: 0, D: 0, E: 0 };

interface InferenceFieldProps {
  towers: Record<FTTower, FTTowerPublicInfo>;
  gameKey: string;
  skin?: SkinTheme | null;
}

function loadCounts(key: string): Record<FTTower, number> {
  if (typeof window === 'undefined') return { ...EMPTY_COUNTS };
  try {
    const raw = sessionStorage.getItem(`ft.inference-counts.${key}`);
    if (!raw) return { ...EMPTY_COUNTS };
    return { ...EMPTY_COUNTS, ...JSON.parse(raw) };
  } catch {
    return { ...EMPTY_COUNTS };
  }
}

function saveCounts(key: string, c: Record<FTTower, number>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(`ft.inference-counts.${key}`, JSON.stringify(c));
  } catch {
    /* ignore */
  }
}

export default function InferenceField({ towers, gameKey, skin }: InferenceFieldProps) {
  const [counts, setCounts] = useState<Record<FTTower, number>>(() => loadCounts(gameKey));

  // 게임이 바뀌면 해당 게임의 저장값으로 교체 (새 게임 시 0으로 초기화)
  useEffect(() => {
    setCounts(loadCounts(gameKey));
  }, [gameKey]);

  useEffect(() => {
    saveCounts(gameKey, counts);
  }, [gameKey, counts]);

  const setCell = useCallback((tower: FTTower, level: number) => {
    setCounts((prev) => {
      const cur = prev[tower] ?? 0;
      // 채워진 최상단 셀을 다시 누르면 1 감소
      const next = cur === level ? Math.max(0, cur - 1) : level;
      return { ...prev, [tower]: Math.min(10, Math.max(0, next)) };
    });
  }, []);

  const resetTower = useCallback((tower: FTTower) => {
    setCounts((prev) => ({ ...prev, [tower]: 0 }));
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
              userCount={counts[id] ?? 0}
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
    <div className="grid grid-cols-5 gap-2 sm:gap-3">
      {FT_TOWERS.map((id) => {
        const tower = towers[id];
        const colors = TOWER_COLORS[id];
        const userCount = counts[id] ?? 0;
        const isCompleted = tower.completed;

        return (
          <div
            key={id}
            className={`flex flex-col items-stretch overflow-hidden rounded-lg border-2 ${
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
              className={`flex flex-col items-center justify-center px-1 py-1.5 ${
                isCompleted ? 'bg-yellow-200 text-yellow-800' : `${colors.bg} ${colors.text}`
              } ${isCompleted ? 'cursor-default' : 'hover:brightness-95'}`}
              title={isCompleted ? '완성된 탑' : '더블클릭/우클릭으로 카운트 초기화'}
            >
              <span className="text-base font-bold sm:text-lg">{id}</span>
              <span className="text-xl font-black tabular-nums sm:text-2xl">
                {isCompleted ? '완성' : userCount}
              </span>
            </button>

            {/* 셀 */}
            <div className="flex flex-col">
              {Array.from({ length: 10 }, (_, i) => 10 - i).map((level) => {
                const isFilled = userCount >= level;
                const isHalf = level === FT_HALF_MILESTONE;
                const halfReached = tower.milestonesReached.half;

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => setCell(id, level)}
                    disabled={isCompleted}
                    className={`relative flex h-6 items-center justify-end border-t px-1.5 text-[10px] font-medium transition-all sm:h-7 sm:text-xs ${
                      isCompleted
                        ? 'cursor-default bg-yellow-100 text-yellow-700'
                        : isFilled
                          ? `${colors.bg} ${colors.text} hover:brightness-95`
                          : 'bg-white text-gray-300 hover:bg-gray-50'
                    } ${
                      isHalf
                        ? halfReached
                          ? 'border-t-yellow-500'
                          : 'border-t-gray-400 border-dashed'
                        : 'border-gray-100'
                    }`}
                  >
                    <span className="tabular-nums">{level}</span>
                    {isHalf && halfReached && (
                      <span className="absolute left-1 top-1/2 -translate-y-1/2 text-[9px] font-bold text-yellow-700">
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

export { TOWER_COLORS, FT_TOWER_MAX_HEIGHT };
