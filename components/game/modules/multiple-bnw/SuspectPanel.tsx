'use client';

import { getSocket } from '@/lib/socket';
import type { MBNWTile, MBNWTileColor } from '@/shared/types/multiple-bnw';
import { MBNW_TILE_SET, MBNW_TILE_COLOR } from '@/shared/types/multiple-bnw';

interface SuspectPanelProps {
  actionType: 'suspectFirst' | 'suspectSecond';
  myTile: number | null;
  opponentColor: MBNWTileColor | null;
  /** 클라이언트 수동 추리로 표시된 상대 사용 타일 */
  trackedUsedTiles: MBNWTile[];
  firstSuspectFailed?: boolean;
}

export default function SuspectPanel({
  actionType,
  myTile,
  opponentColor,
  trackedUsedTiles,
  firstSuspectFailed,
}: SuspectPanelProps) {

  const handleSuspect = (suspect: boolean) => {
    getSocket().emit('game:action', { type: actionType, suspect });
  };

  const estimatedRemaining = MBNW_TILE_SET.filter(t => !trackedUsedTiles.includes(t));

  const colorTiles = opponentColor
    ? estimatedRemaining.filter(t => MBNW_TILE_COLOR[t] === opponentColor)
    : [];

  const multipleTiles = myTile
    ? colorTiles.filter(t => t % myTile === 0 && t !== myTile)
    : [];

  const canSucceed = multipleTiles.length > 0;

  return (
    <div className="mbnw-panel mbnw-suspect-panel flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
      {firstSuspectFailed && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-medium text-red-600">
          선플 배수의심 실패 — 보너스 +1점 획득
        </div>
      )}

      <p className="mbnw-panel-title text-sm font-semibold text-amber-800">배수 가능 분석</p>

      <div className="flex items-center gap-4 text-sm">
        {myTile != null && (
          <span className="text-gray-700">
            내 타일: <strong className={`mbnw-inline-tile mbnw-inline-tile--${MBNW_TILE_COLOR[myTile as MBNWTile]} rounded px-1.5 py-0.5 text-xs ${
              MBNW_TILE_COLOR[myTile as MBNWTile] === 'black'
                ? 'bg-slate-800 text-slate-100'
                : 'border border-gray-300 bg-white text-slate-700'
            }`}>{myTile}</strong>
          </span>
        )}
        {opponentColor && (
          <span className="text-gray-700">
            상대 타일: <strong className={`mbnw-inline-tile mbnw-inline-tile--${opponentColor} rounded px-1.5 py-0.5 text-xs ${
              opponentColor === 'black'
                ? 'bg-slate-800 text-slate-100'
                : 'border border-gray-300 bg-white text-slate-700'
            }`}>{opponentColor === 'black' ? '흑색' : '백색'}</strong>
          </span>
        )}
      </div>

      {opponentColor && (
        <div>
          <p className="mb-1 text-xs text-gray-500">
            상대 추정 잔여 {opponentColor === 'black' ? '흑색' : '백색'} 타일:
          </p>
          <div className="flex flex-wrap gap-1.5">
            {colorTiles.map(t => {
              const isMultiple = multipleTiles.includes(t);
              return (
                <span
                  key={t}
                  className={`mbnw-estimated-tile ${isMultiple ? 'mbnw-estimated-tile--multiple' : ''} inline-flex items-center gap-0.5 rounded px-2 py-1 text-xs font-medium ${
                    isMultiple
                      ? 'border border-amber-500 bg-amber-100 text-amber-800'
                      : 'border border-gray-200 bg-white text-gray-500'
                  }`}
                >
                  {t}
                  {isMultiple && myTile && <span className="ml-0.5 text-[10px]">×{t / myTile}</span>}
                </span>
              );
            })}
            {colorTiles.length === 0 && (
              <span className="text-xs text-gray-400">없음 (모두 사용됨으로 추리)</span>
            )}
          </div>
        </div>
      )}

      <div className={`rounded-lg px-3 py-2 text-xs font-medium ${
        canSucceed
          ? 'bg-green-50 text-green-700'
          : 'bg-red-50 text-red-700'
      }`}>
        {canSucceed
          ? `배수의심 가능 (${multipleTiles.join(', ')}일 경우 성공)`
          : '배수의심 성공 불가 (추리 기준)'}
      </div>

      <div className="flex gap-3">
        <button
          onClick={() => handleSuspect(true)}
        className="mbnw-suspect-action flex-1 rounded-lg bg-amber-500 px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-amber-600 active:scale-95"
        >
          배수의심!
        </button>
        <button
          onClick={() => handleSuspect(false)}
          className="mbnw-pass-action flex-1 rounded-lg border border-gray-300 bg-gray-100 px-4 py-2.5 text-sm font-medium text-gray-700 transition-colors hover:bg-gray-200 active:scale-95"
        >
          패스
        </button>
      </div>
    </div>
  );
}
