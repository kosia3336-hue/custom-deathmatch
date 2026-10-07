'use client';

import { GameInfoPart } from '@/components/game/GameInfoPart';

import type { MultipleBnwGameData } from '@/shared/types/multiple-bnw';

interface InfoPanelProps {
  players: MultipleBnwGameData['players'];
  roundHistory: MultipleBnwGameData['roundHistory'];
  myId: string;
}

export default function InfoPanel({ players, roundHistory, myId }: InfoPanelProps) {
  const pEntries = Object.entries(players).sort(
    ([a], [b]) => Number(b === myId) - Number(a === myId),
  );

  return (
    <div className="mbnw-info-panel flex flex-col gap-4">
      <GameInfoPart title="점수" sizeToContent>
        <div className="grid grid-cols-2 gap-2">
          {pEntries.map(([id, p]) => (
            <div
              key={id}
              className={`mbnw-score-row ${id === myId ? 'mbnw-score-row--me' : ''} flex items-center justify-between rounded-lg border px-3 py-1.5 ${
                id === myId
                  ? 'border-cdm-primary/30 bg-cdm-primary-soft'
                  : 'border-cdm-border bg-cdm-bg'
              }`}
            >
              <span
                title={id === myId ? '나' : p.nickname}
                className={`min-w-0 flex-1 truncate text-sm font-medium ${id === myId ? 'text-cdm-primary' : 'text-cdm-fg'}`}
              >
                {id === myId ? '나' : p.nickname}
                {p.isFirst && <span className="ml-1 text-[11px] text-amber-500">선</span>}
              </span>
              <span className="text-cdm-fg shrink-0 font-bold whitespace-nowrap tabular-nums">
                {p.score}점
              </span>
            </div>
          ))}
        </div>
      </GameInfoPart>

      <GameInfoPart title="라운드 기록">
        {roundHistory.length === 0 && <p className="text-xs">아직 기록이 없습니다.</p>}
        <div className="space-y-1 text-xs">
          {[...roundHistory].reverse().map((r) => {
            const entries = Object.entries(r.players).sort(
              ([a], [b]) => Number(b === myId) - Number(a === myId),
            );
            return (
              <div
                key={r.round}
                className="mbnw-history-row border-cdm-border bg-cdm-bg-elev-1 rounded-md border px-2 py-1"
              >
                <div className="text-cdm-fg-muted flex items-center gap-1 font-medium">
                  R{r.round}
                </div>
                {entries.map(([pid, pr]) => (
                  <div
                    key={pid}
                    className="text-cdm-fg-muted ml-2 flex flex-wrap items-center gap-x-1 gap-y-0.5"
                  >
                    <span
                      className={`mbnw-history-color mbnw-history-color--${pr.color} rounded px-1 text-[11px] font-bold ${
                        pr.color === 'black'
                          ? 'bg-slate-800 text-slate-100'
                          : 'border border-gray-200 bg-white text-slate-700'
                      }`}
                    >
                      {pr.color === 'black' ? '흑' : '백'}
                    </span>
                    <span
                      className="text-cdm-fg-muted max-w-20 truncate text-[11px]"
                      title={players[pid]?.nickname}
                    >
                      {pid === myId ? '나' : (players[pid]?.nickname ?? pid)}
                    </span>
                    {pr.suspected && (
                      <span className={pr.suspectSuccess ? 'text-green-600' : 'text-red-500'}>
                        {pr.suspectSuccess === true
                          ? '의심 성공'
                          : pr.suspectSuccess === false
                            ? '의심 실패'
                            : '판정 대기'}
                      </span>
                    )}
                    <span
                      title={`의심 실패 보너스 ${pr.bonusPoint}점 + 승리 ${pr.normalPoint}점`}
                      className={`ml-auto shrink-0 font-semibold ${
                        pr.bonusPoint + pr.normalPoint > 0 ? 'text-blue-600' : 'text-cdm-fg-subtle'
                      }`}
                    >
                      획득 +{pr.bonusPoint + pr.normalPoint}점
                    </span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </GameInfoPart>
    </div>
  );
}
