'use client';

import { GameInfoPart } from '@/components/game/GameInfoPart';

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
    <div className="mbnw-info-panel flex flex-col gap-4">
      <GameInfoPart title="점수" sizeToContent>
        <div className="space-y-2">
          {pEntries.map(([id, p]) => (
            <div
              key={id}
              className={`mbnw-score-row ${id === myId ? 'mbnw-score-row--me' : ''} flex items-center justify-between rounded-lg border px-3 py-1.5 ${
                id === myId ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
              }`}
            >
              <span className={`text-sm font-medium ${id === myId ? 'text-indigo-700' : 'text-gray-700'}`}
              >
                {id === myId ? '나' : p.nickname}
                {p.isFirst && <span className="ml-1 text-[11px] text-amber-500">선</span>}
              </span>
              <span className="font-bold text-gray-800 tabular-nums">{p.score}점</span>
            </div>
          ))}
        </div>
      </GameInfoPart>

      {/* 내 잔여 타일 (본인만 표시) */}
      {me && me.remainingTiles.length > 0 && (
        <GameInfoPart title="내 잔여 타일" sizeToContent>
          <div className="flex flex-wrap gap-1">
            {[...me.remainingTiles]
              .sort((a, b) => a - b)
              .map((t) => {
                const color = MBNW_TILE_COLOR[t as MBNWTile];
                return (
                  <span
                    key={t}
                    className={`mbnw-mini-tile mbnw-mini-tile--${color} inline-flex h-7 w-7 items-center justify-center rounded text-xs font-bold ${
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
        </GameInfoPart>
      )}

      {roundHistory.length > 0 && (
        <GameInfoPart title="라운드 기록">
          <div className="space-y-1 text-xs">
            {roundHistory.map((r) => {
              const entries = Object.entries(r.players);
              return (
                <div
                  key={r.round}
                  className="mbnw-history-row rounded-md border border-gray-100 bg-gray-50 px-2 py-1"
                >
                  <div className="flex items-center gap-1 font-medium text-gray-500">
                    R{r.round}
                  </div>
                  {entries.map(([pid, pr]) => (
                    <div key={pid} className="ml-2 flex items-center gap-1 text-gray-600">
                      <span
                        className={`mbnw-history-color mbnw-history-color--${pr.color} rounded px-1 text-[11px] font-bold ${
                        pr.color === 'black'
                          ? 'bg-slate-800 text-slate-100'
                          : 'border border-gray-200 bg-white text-slate-700'
                      }`}
                      >
                        {pr.color === 'black' ? '흑' : '백'}
                      </span>
                      <span className="text-[11px] text-gray-500">
                        {pid === myId ? '나' : (players[pid]?.nickname ?? pid)}
                      </span>
                      {pr.suspected && (
                        <span className={pr.suspectSuccess ? 'text-green-600' : 'text-red-500'}>
                          의심
                        </span>
                      )}
                      <span
                        className={
                          pr.bonusPoint + pr.normalPoint > 0 ? 'text-blue-600' : 'text-gray-400'
                        }
                      >
                        +{pr.bonusPoint + pr.normalPoint}
                      </span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </GameInfoPart>
      )}
    </div>
  );
}
