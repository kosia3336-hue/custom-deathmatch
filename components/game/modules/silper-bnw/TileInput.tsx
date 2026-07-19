'use client';

import { useEffect, useRef, useState } from 'react';
import { getSocket } from '@/lib/socket';
import { sfxMeow, playMeowTileSfx } from '@/lib/sfx';
import type { SBNWTile } from '@/shared/types/silper-bnw';

import type { SkinTheme } from '@/lib/skins/registry';

interface Props {
  myTiles: Record<SBNWTile, number>;
  actionType: 'submitFirst' | 'submitSecond';
  label: string;
  firstDigits: number | null;
  onSlotLengthChange?: (n: number) => void;
  skin?: SkinTheme | null;
}

const TILE_VALUES: SBNWTile[] = [0, 1, 2, 3, 4];

export const TILE_COLORS: Record<SBNWTile, { bg: string; border: string; text: string }> = {
  0: { bg: 'bg-slate-100', border: 'border-slate-300', text: 'text-slate-700' },
  1: { bg: 'bg-sky-50',    border: 'border-sky-300',   text: 'text-sky-800'   },
  2: { bg: 'bg-teal-50',   border: 'border-teal-300',  text: 'text-teal-800'  },
  3: { bg: 'bg-orange-50', border: 'border-orange-300', text: 'text-orange-800' },
  4: { bg: 'bg-rose-50',   border: 'border-rose-400',  text: 'text-rose-800'  },
};

type SlotItem = { tile: SBNWTile; id: number };
let _uid = 0;
const nextId = () => ++_uid;

function compareDigitBadge(myDigits: number, firstDigits: number | null) {
  if (firstDigits == null || myDigits === 0) return null;
  if (myDigits < firstDigits)  return { text: '패배 확정', cls: 'text-rose-600 bg-rose-50 border-rose-200' };
  if (myDigits === firstDigits) return { text: '값 경쟁',   cls: 'text-amber-600 bg-amber-50 border-amber-200' };
  return                               { text: '자릿수 우위', cls: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
}

function tilesToDisplayValue(items: SlotItem[]): string {
  if (items.length === 0) return '';
  let v = 0n;
  for (const { tile } of items) v = v * 10n + BigInt(tile);
  return v.toString();
}

export default function TileInput({ myTiles, actionType, label, firstDigits, onSlotLengthChange, skin }: Props) {
  const isMeow = skin === 'meow';
  const [slot, setSlot] = useState<SlotItem[]>([]);
  const [error, setError] = useState<string | null>(null);

  const myTilesRef  = useRef(myTiles);
  const slotRef     = useRef(slot);
  const lpTimerRef  = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lpIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isLpRef     = useRef(false);

  myTilesRef.current = myTiles;
  slotRef.current    = slot;

  // 잔여 수량
  const used: Record<SBNWTile, number> = { 0: 0, 1: 0, 2: 0, 3: 0, 4: 0 };
  for (const { tile } of slot) used[tile] += 1;
  const remaining: Record<SBNWTile, number> = {
    0: (myTiles[0] ?? 0) - used[0],
    1: (myTiles[1] ?? 0) - used[1],
    2: (myTiles[2] ?? 0) - used[2],
    3: (myTiles[3] ?? 0) - used[3],
    4: (myTiles[4] ?? 0) - used[4],
  };
  const remainingRef = useRef(remaining);
  remainingRef.current = remaining;

  const leadingZeroError = slot.length >= 2 && slot[0].tile === 0;
  const isEmpty   = slot.length === 0;
  const canSubmit = !isEmpty && !leadingZeroError;

  // 부모에게 자릿수 알림
  useEffect(() => {
    onSlotLengthChange?.(slot.length);
  }, [slot.length, onSlotLengthChange]);

  // 타일 추가 (내부 공통)
  const addTile = (t: SBNWTile) => {
    setSlot((prev) => {
      const usedCount = prev.filter((x) => x.tile === t).length;
      if ((myTilesRef.current[t] ?? 0) - usedCount <= 0) return prev;
      return [...prev, { tile: t, id: nextId() }];
    });
    setError(null);
  };

  const handleRemoveAt = (id: number) => {
    setSlot((prev) => prev.filter((item) => item.id !== id));
    setError(null);
  };

  const handleClear = () => { setSlot([]); setError(null); };

  const handleSubmit = () => {
    const cur = slotRef.current;
    if (cur.length === 0) { setError('타일을 1개 이상 선택해 주세요.'); return; }
    if (cur.length >= 2 && cur[0].tile === 0) { setError('맨 앞 자리에 0을 둘 수 없습니다.'); return; }
    if (isMeow) sfxMeow();
    getSocket().emit('game:action', { type: actionType, tiles: cur.map((x) => x.tile) });
    setSlot([]);
  };

  // 키보드 단축키 (0~4, Backspace, Enter)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      if (['0', '1', '2', '3', '4'].includes(e.key)) {
        e.preventDefault();
        const t = parseInt(e.key) as SBNWTile;
        const cur = slotRef.current;
        const usedCount = cur.filter((x) => x.tile === t).length;
        if ((myTilesRef.current[t] ?? 0) - usedCount > 0) {
          if (isMeow) playMeowTileSfx(t);
          setSlot((prev) => [...prev, { tile: t, id: nextId() }]);
          setError(null);
        }
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        setSlot((prev) => prev.slice(0, -1));
        setError(null);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const cur = slotRef.current;
        if (cur.length === 0 || (cur.length >= 2 && cur[0].tile === 0)) return;
        if (isMeow) sfxMeow();
        getSocket().emit('game:action', { type: actionType, tiles: cur.map((x) => x.tile) });
        setSlot([]);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [actionType, isMeow]);

  // Long-press 정리
  const stopLongPress = () => {
    if (lpTimerRef.current)    { clearTimeout(lpTimerRef.current);    lpTimerRef.current    = null; }
    if (lpIntervalRef.current) { clearInterval(lpIntervalRef.current); lpIntervalRef.current = null; }
  };
  useEffect(() => () => stopLongPress(), []);

  // 타일 버튼 이벤트
  const handleTilePointerDown = (t: SBNWTile) => {
    if (remainingRef.current[t] <= 0) return;
    isLpRef.current = false;
    stopLongPress();
    lpTimerRef.current = setTimeout(() => {
      isLpRef.current = true;
      // 롱프레스는 연속 추가되므로 시작 시 한 번만 울린다
      if (isMeow) playMeowTileSfx(t);
      lpIntervalRef.current = setInterval(() => addTile(t), 150);
    }, 350);
  };

  const handleTileClick = (t: SBNWTile, e: React.MouseEvent) => {
    if (isLpRef.current) { isLpRef.current = false; return; } // long-press가 이미 추가함
    if (remainingRef.current[t] <= 0) return;
    if (isMeow) playMeowTileSfx(t); // shift 일괄 추가 시에도 한 번만
    if (e.shiftKey) {
      const rem = remainingRef.current[t];
      for (let i = 0; i < rem; i++) addTile(t);
    } else {
      addTile(t);
    }
  };

  const badge        = compareDigitBadge(slot.length, firstDigits);
  const displayValue = tilesToDisplayValue(slot);
  const isLongSlot   = slot.length >= 10;

  return (
    <>
      <style>{`
        @keyframes slotPush {
          from { transform: translateY(-10px) scale(0.75); opacity: 0; }
          to   { transform: translateY(0)     scale(1);    opacity: 1; }
        }
      `}</style>

      <div
        className={
          isMeow
            ? 'skin-meow-panel space-y-3 p-4'
            : 'space-y-3 rounded-xl border border-indigo-200 bg-indigo-50 p-4'
        }
      >
        <p
          className={`text-center text-sm font-semibold ${
            isMeow ? 'skin-meow-panel-title' : 'text-indigo-700'
          }`}
        >
          {isMeow ? `🐾 ${label} 🐾` : label}
        </p>

        {firstDigits != null && (
          <div
            className={`px-3 py-2 text-center ${
              isMeow
                ? 'skin-meow-slot rounded-lg'
                : 'rounded-lg border border-indigo-200 bg-white'
            }`}
          >
            <span className={`text-xs ${isMeow ? 'skin-meow-subtext' : 'text-gray-500'}`}>선플 자릿수</span>{' '}
            <span
              className={`text-base font-bold tabular-nums ${
                isMeow ? 'skin-meow-heading' : 'text-indigo-700'
              }`}
            >
              {firstDigits}자리
            </span>
          </div>
        )}

        {/* 타일 랙 */}
        <div className="grid grid-cols-5 gap-1.5">
          {TILE_VALUES.map((t) => {
            const rem      = remaining[t];
            const disabled = rem <= 0;
            const c        = TILE_COLORS[t];
            return (
              <button
                key={t}
                onClick={(e) => handleTileClick(t, e)}
                onPointerDown={() => handleTilePointerDown(t)}
                onPointerUp={stopLongPress}
                onPointerLeave={stopLongPress}
                disabled={disabled}
                aria-label={`${t} 타일, ${rem}개 남음`}
                aria-disabled={disabled}
                className={
                  isMeow
                    ? [
                        `skin-meow-tile-sprite skin-meow-tile-sprite--${t}`,
                        'skin-meow-tile-btn select-none',
                        disabled ? 'pointer-events-none' : '',
                      ].join(' ')
                    : [
                        'flex aspect-square flex-col items-center justify-center rounded-xl border-2',
                        'select-none text-center transition-all duration-150',
                        disabled
                          ? `bg-gray-100 ${c.border} opacity-40 grayscale pointer-events-none`
                          : `${c.bg} ${c.border} hover:-translate-y-0.5 hover:shadow-md active:scale-95`,
                        !disabled && t === 4 ? 'ring-1 ring-rose-200 ring-offset-1' : '',
                      ].join(' ')
                }
              >
                {isMeow ? (
                  /* 숫자는 스프라이트에 포함 — 잔여 수량만 오버레이 */
                  <span className="skin-meow-sprite-count tabular-nums">×{rem}</span>
                ) : (
                  <>
                    <span className={`text-xl font-bold ${disabled ? 'text-gray-400' : c.text}`}>{t}</span>
                    <span className={`text-[10px] tabular-nums ${disabled ? 'text-gray-400' : 'text-gray-500'}`}>
                      ×{rem}
                    </span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        {/* 제시 슬롯 */}
        <div
          className={
            isMeow
              ? `skin-meow-slot p-3 transition-colors duration-200 ${
                  leadingZeroError ? 'skin-meow-slot--error' : ''
                }`
              : `rounded-xl border-2 bg-white p-3 transition-colors duration-200 ${
                  leadingZeroError ? 'border-rose-400 bg-rose-50' : 'border-gray-200'
                }`
          }
          role="status"
          aria-live="polite"
          aria-label={slot.length > 0 ? `${displayValue}, ${slot.length}자리` : '슬롯 비어 있음'}
        >
          <div className="mb-1.5 flex items-center justify-between">
            <span className={`text-xs font-semibold ${isMeow ? 'skin-meow-heading' : 'text-gray-500'}`}>
              {isMeow ? '🐾 제시 슬롯' : '제시 슬롯'}
            </span>
            {slot.length > 0 && (
              <button onClick={handleClear} className="text-xs text-gray-400 hover:text-gray-600">
                전체 지우기
              </button>
            )}
          </div>

          {slot.length === 0 ? (
            isMeow ? (
              <div className="py-1">
                <div className="skin-meow-slot-ear-img" aria-hidden />
                <p className="skin-meow-slot-empty pb-1 text-center text-xs">타일을 선택해 주세요</p>
              </div>
            ) : (
              <p className="py-2 text-center text-xs text-gray-400">타일을 선택해 주세요</p>
            )
          ) : (
            <>
              <div className={`relative flex gap-1 py-1 ${isLongSlot ? 'overflow-x-auto pb-2' : 'flex-wrap'}`}>
                {slot.map((item) => {
                  const c = TILE_COLORS[item.tile];
                  return (
                    <button
                      key={item.id}
                      onClick={() => handleRemoveAt(item.id)}
                      style={isMeow ? undefined : { animation: 'slotPush 200ms cubic-bezier(0.175,0.885,0.32,1.275)' }}
                      className={
                        isMeow
                          ? [
                              `skin-meow-tile-sprite skin-meow-tile-sprite--${item.tile}`,
                              'skin-meow-pop h-11 shrink-0 hover:opacity-60 active:scale-90',
                            ].join(' ')
                          : [
                              'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border-2',
                              'text-base font-bold transition-all duration-100',
                              c.bg, c.border, c.text,
                              'hover:opacity-60 active:scale-90',
                            ].join(' ')
                      }
                      aria-label={`${item.tile} 타일 제거`}
                    >
                      {/* 냥냥: 숫자는 스프라이트에 포함 */}
                      {!isMeow && item.tile}
                    </button>
                  );
                })}
                {isLongSlot && (
                  <div className="pointer-events-none absolute right-0 top-0 h-full w-8 bg-linear-to-l from-white to-transparent" />
                )}
              </div>

              <div className="mt-1.5 flex items-center justify-between">
                <span className="text-xs text-gray-600">
                  = <span className="font-bold tabular-nums text-gray-800">{displayValue}</span>{' '}
                  <span className="text-gray-400">({slot.length}자리)</span>
                </span>
                {badge && (
                  <span
                    className={`rounded border px-1.5 py-0.5 text-[10px] font-semibold transition-all duration-200 ${badge.cls}`}
                  >
                    {badge.text}
                  </span>
                )}
              </div>
            </>
          )}

          {leadingZeroError && (
            <p className="mt-1 text-xs font-medium text-rose-600">맨 앞 자리에 0을 둘 수 없습니다.</p>
          )}
          {error && !leadingZeroError && (
            <p className="mt-1 text-xs font-medium text-rose-600">{error}</p>
          )}
        </div>

        {isMeow ? (
          /* 냥냥: 버튼 왼쪽 빈 공간에 앉아 있는 고양이 (텍스트는 중앙, 발바닥은 우측이라 좌측이 빈다) */
          <div className="relative">
            <div className="skin-meow-cat-img skin-meow-cat-img--left absolute bottom-1.5 left-4 z-10 h-11 w-11" aria-hidden />
            <button onClick={handleSubmit} disabled={!canSubmit} className="skin-meow-submit-sprite">
              <span className="sr-only">제시하기</span>
            </button>
          </div>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white transition hover:bg-indigo-700 active:bg-indigo-800 disabled:cursor-not-allowed disabled:bg-gray-300"
          >
            제시하기
          </button>
        )}
      </div>
    </>
  );
}
