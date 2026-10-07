'use client';
import { playCandyButtonSfx, playCandyMinusSfx } from '@/lib/audio/skins/candy';

export function SugarBar({
  sugarRemain,
  pendingSugar,
  setPendingSugar,
  canAct,
  submitted,
  oppSubmitted,
  onCancelSubmit,
  candy,
}: {
  sugarRemain: number;
  pendingSugar: number;
  setPendingSugar: (n: number) => void;
  canAct: boolean;
  submitted: boolean;
  oppSubmitted: boolean;
  onCancelSubmit: () => void;
  candy?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(sugarRemain, Math.floor(n)));
  const adjust = (d: number) => setPendingSugar(clamp(pendingSugar + d));
  const handleInput = (v: string) => {
    if (v === '') {
      setPendingSugar(0);
      return;
    }
    const n = Number(v.replace(/[^\d]/g, ''));
    if (Number.isFinite(n)) setPendingSugar(clamp(n));
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
        <span className="flex-1 text-sm font-bold text-emerald-700">
          제출 완료 — 상대 대기 중...
        </span>
        {!oppSubmitted && (
          <button
            type="button"
            onClick={onCancelSubmit}
            className="shrink-0 rounded border border-emerald-400 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            취소
          </button>
        )}
      </div>
    );
  }

  if (candy) {
    // -5/-1 은 잼병 닫는 소리, +1/+5 는 잼병 여는 '뽁'
    const adjustSfx = (d: number) => {
      (d < 0 ? playCandyMinusSfx : playCandyButtonSfx)();
      adjust(d);
    };
    // 시안 스프라이트 버튼: 라벨은 이미지에 포함 (sr-only로 접근성 유지)
    return (
      <div className="skin-candy-panel relative z-10 flex flex-col gap-1.5 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="skin-candy-heading text-xs font-medium">제출 설탕</span>
          <span className="skin-candy-subtext text-xs">보유 {sugarRemain}</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => adjustSfx(-5)}
            disabled={!canAct}
            className="skin-candy-btn skin-candy-btn--m5 h-9"
          >
            <span className="sr-only">-5</span>
          </button>
          <button
            type="button"
            onClick={() => adjustSfx(-1)}
            disabled={!canAct}
            className="skin-candy-btn skin-candy-btn--m1 h-9"
          >
            <span className="sr-only">-1</span>
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={pendingSugar}
            onChange={(e) => handleInput(e.target.value)}
            disabled={!canAct}
            className="skin-candy-input h-9 w-16 px-1 text-sm"
          />
          <button
            type="button"
            onClick={() => adjustSfx(1)}
            disabled={!canAct}
            className="skin-candy-btn skin-candy-btn--p1 h-9"
          >
            <span className="sr-only">+1</span>
          </button>
          <button
            type="button"
            onClick={() => adjustSfx(5)}
            disabled={!canAct}
            className="skin-candy-btn skin-candy-btn--p5 h-9"
          >
            <span className="sr-only">+5</span>
          </button>
          <button
            type="button"
            onClick={() => {
              playCandyButtonSfx();
              setPendingSugar(sugarRemain);
            }}
            disabled={!canAct}
            className="skin-candy-btn skin-candy-btn--max h-9"
          >
            <span className="sr-only">MAX</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
      {/* 레이블 + 보유량 */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-gray-500">제출 설탕</span>
        <span className="text-xs text-gray-400">보유 {sugarRemain}</span>
      </div>
      {/* 버튼 + 입력 한 줄 */}
      <div className="flex items-center justify-center gap-1">
        {([-5, -1] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => adjust(d)}
            disabled={!canAct}
            className="h-8 w-9 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            {d}
          </button>
        ))}
        <input
          type="text"
          inputMode="numeric"
          value={pendingSugar}
          onChange={(e) => handleInput(e.target.value)}
          disabled={!canAct}
          className="h-8 w-14 rounded border-2 border-amber-300 bg-amber-50 px-1 text-center text-sm font-bold text-amber-900 disabled:opacity-50"
        />
        {([1, 5] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => adjust(d)}
            disabled={!canAct}
            className="h-8 w-9 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40"
          >
            +{d}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setPendingSugar(sugarRemain)}
          disabled={!canAct}
          className="h-8 rounded border border-gray-300 px-2 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40"
        >
          MAX
        </button>
      </div>
    </div>
  );
}
