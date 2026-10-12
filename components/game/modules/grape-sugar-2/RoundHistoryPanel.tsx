'use client';
import type { GS2PlayerPublic, GS2RoundRecord, GS2Side } from '@/shared/types/grape-sugar-2';
import { CARD_NAMES, CARD_STYLES } from './constants';

export function RoundHistoryPanel({
  history,
  players,
  mySide,
  candy,
}: {
  history: GS2RoundRecord[];
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
  candy?: boolean;
}) {
  const orderedSides: GS2Side[] = mySide === 'p2' ? ['p2', 'p1'] : ['p1', 'p2'];

  return (
    <div
      data-panel-inset
      className={candy ? 'skin-candy-board' : 'rounded-xl border border-gray-200 bg-white'}
    >
      <div data-panel-inset className="space-y-1.5 border-t border-gray-100 p-2">
        {history.length === 0 ? (
          <p className="py-6 text-center text-xs text-gray-400">아직 기록이 없습니다</p>
        ) : (
          [...history].reverse().map((r, idx) => {
            const key = `${r.extension}-${r.round}-${idx}`;
            return (
              <div key={key} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-xs font-bold text-gray-600">
                    {r.extension > 0 && (
                      <span className="mr-1 rounded bg-purple-200 px-1 text-[11px] font-bold text-purple-800">
                        연장{r.extension}
                      </span>
                    )}
                    R{r.round}
                  </span>
                  <span className="text-[11px] text-gray-400">
                    {r.winner === 'tie' ? '무승부' : `${players[r.winner].nickname} 승`}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {orderedSides.map((side) => {
                    const a = r.actions[side];
                    const style = CARD_STYLES[a.card];
                    const isWin = r.winner === side;
                    return (
                      <div
                        key={side}
                        className={`rounded p-1 text-[11px] ${
                          isWin
                            ? 'border border-emerald-200 bg-emerald-50'
                            : 'border border-gray-200 bg-white'
                        }`}
                      >
                        <div className="flex items-center gap-1">
                          <span
                            className={`inline-flex h-4 items-center justify-center rounded px-1 text-[11px] font-bold ${style.bg} ${style.text}`}
                          >
                            {style.icon}
                          </span>
                          <span className="truncate text-gray-700">{CARD_NAMES[a.card]}</span>
                        </div>
                        <div className="mt-0.5 flex items-center gap-1 text-gray-500">
                          <span>
                            {a.sugar}→{r.finalRoundSugar[side]}
                          </span>
                          <span
                            className={`ml-auto font-bold ${r.scoreDelta[side] > 0 ? 'text-emerald-600' : r.scoreDelta[side] < 0 ? 'text-red-500' : ''}`}
                          >
                            {r.scoreDelta[side] > 0 ? `+${r.scoreDelta[side]}` : r.scoreDelta[side]}
                            점
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
