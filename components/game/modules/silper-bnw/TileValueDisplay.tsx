'use client';
import type { SBNWTile } from '@/shared/types/silper-bnw';
import { TILE_COLORS } from './TileInput';

export function TileValueDisplay({
  tiles,
  valueStr,
  digits,
  visible,
  masked,
  meow,
}: {
  tiles: SBNWTile[];
  valueStr: string;
  digits: number;
  visible: boolean;
  /** 서버가 상대 타일을 숨긴 경우 (tilesUsed:[]) */
  masked: boolean;
  meow?: boolean;
}) {
  if (!visible) return <div className="py-4 text-xl text-gray-300">? ? ?</div>;

  // 상대 카드: 타일/값 숨김, 자릿수만 표시
  if (masked) {
    return (
      <div className="space-y-1 py-2 text-center">
        <div className="flex justify-center gap-0.5">
          {Array.from({ length: digits }).map((_, i) => (
            <span
              key={i}
              style={{
                animation: `slotPush 300ms cubic-bezier(0.175,0.885,0.32,1.275) ${i * 80}ms both`,
              }}
              className={
                meow
                  ? 'skin-meow-tile skin-meow-tile--0 flex h-8 w-8 items-center justify-center text-sm font-bold'
                  : 'flex h-8 w-8 items-center justify-center rounded-lg border-2 border-gray-300 bg-gray-100 text-sm font-bold text-gray-400'
              }
            >
              ?
            </span>
          ))}
        </div>
        <p className="text-[11px] text-gray-400">({digits}자리)</p>
      </div>
    );
  }

  return (
    <div className="space-y-1 text-center">
      <div className="flex flex-wrap justify-center gap-0.5">
        {tiles.map((t, i) => {
          const c = TILE_COLORS[t];
          return (
            <span
              key={i}
              style={{
                animation: `slotPush 300ms cubic-bezier(0.175,0.885,0.32,1.275) ${i * 80}ms both`,
              }}
              className={
                meow
                  ? `skin-meow-tile-sprite skin-meow-tile-sprite--${t} inline-block h-9 shrink-0`
                  : `flex h-8 w-8 items-center justify-center rounded-lg border-2 text-sm font-bold ${c.bg} ${c.border} ${c.text}`
              }
            >
              {/* 냥냥: 숫자는 스프라이트에 포함 */}
              {!meow && t}
            </span>
          );
        })}
      </div>
      <p className="text-sm font-bold text-gray-800 tabular-nums">= {valueStr}</p>
      <p className="text-[11px] text-gray-400">({tiles.length}자리)</p>
    </div>
  );
}
