'use client';

import type { MultipleBnwGameData, MBNWTile } from '@/shared/types/multiple-bnw';
import { MBNW_TILE_COLOR } from '@/shared/types/multiple-bnw';

interface InfoPanelProps {
  players: MultipleBnwGameData['players'];
  roundHistory: MultipleBnwGameData['roundHistory'];
  myId: string;
}

export default function InfoPanel({ players, roundHistory, myId }: InfoPanelProps) {
  const pEntries = Object.entries(players);
  const me = players[myId];

  return (
    <div className="flex flex-col gap-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">점수</p>
        <div className="space-y-2">
          {pEntries.map(([id, p]) => (
            <div
              key={id}
              className={`flex items-center justify-between rounded-lg border px-3 py-1.5 ${
                id === myId ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`text-sm font-medium ${id === myId ? 'text-indigo-700' : 'text-gray-700'}`}>
                {id === myId ? '나' : p.nickname}
                {p.isFirst && <span className="ml-1 text-[10px] text-amber-500">선</span>}
              </span>
              <span className="font-bold tabular-nums text-gray-800">
                {p.score}점
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* 내 잔여 타일 (본인만 표시) */}
      {me && me.remainingTiles.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-gray-400">내 잔여 타일</p>
          <div className="flex flex-wrap gap-1">
            {[...me.remainingTiles].sort((a, b) => a - b).map(t => {
              const color = MBNW_TILE_COLOR[t as MBNWTile];
              return (
                <span
                  key={t}
                  className={`inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${
                    color === 'black'
                      ? 'bg-slate-800 text-slate-100'
                      : 'border border-gray-300 bg-white text-slate-700'
                  }`}
                >
                  {t}
                </span>
              );
            })}
          </div>
        </div>
      )}

      {roundHistory.length > 0 && (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">라운드 기록</p>
          <div className="space-y-1 text-xs">
            {roundHistory.map(r => {
              const entries = Object.entries(r.players);
              return (
                <div key={r.round} className="rounded-md border border-gray-100 bg-gray-50 px-2 py-1">
                  <div className="flex items-center gap-1 font-medium text-gray-500">
                    R{r.round}
                  </div>
                  {entries.map(([pid, pr]) => (
                    <div key={pid} className="ml-2 flex items-center gap-1 text-gray-600">
                      <span className={`rounded px-1 text-[10px] font-bold ${
                        pr.color === 'black'
                          ? 'bg-slate-800 text-slate-100'
                          : 'border border-gray-200 bg-white text-slate-700'
                      }`}>
                        {pr.color === 'black' ? '흑' : '백'}
                      </span>
                      <span className="text-[10px] text-gray-500">
                        {pid === myId ? '나' : (players[pid]?.nickname ?? pid)}
                      </span>
                      {pr.suspected && (
                        <span className={pr.suspectSuccess ? 'text-green-600' : 'text-red-500'}>
                          의심
                        </span>
                      )}
                      <span className={pr.bonusPoint + pr.normalPoint > 0 ? 'text-blue-600' : 'text-gray-400'}>
                        +{pr.bonusPoint + pr.normalPoint}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
