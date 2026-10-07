'use client';
import type {
  GS2PlayerPublic,
  GS2ResolveStep,
  GS2RoundRecord,
  GS2Side,
} from '@/shared/types/grape-sugar-2';
import { useEffect, useState } from 'react';
import { WIN_TYPE_LABELS } from './constants';
import { RESOLVE_STEP_INTERVAL_MS, REVEAL_INITIAL_DELAY_MS } from './presentation';
import { ResolutionPanel } from './ResolutionPanel';

export function CombatArea({
  phase,
  roundResult,
  resolveSteps,
  players,
  mySide,
  isFinished,
  finalWinner,
  winType,
  candy,
}: {
  phase: string;
  roundResult: GS2RoundRecord | null;
  resolveSteps: GS2ResolveStep[] | null;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
  isFinished: boolean;
  finalWinner: GS2Side | 'tie' | null;
  winType: string | null;
  candy?: boolean;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  // reveal steps를 state로 보존 — roundEnd에서 resolveSteps=null 이 와도 유지됨
  const [cachedSteps, setCachedSteps] = useState<GS2ResolveStep[]>([]);

  // 새 라운드의 steps가 도착하면 렌더 중에 즉시 idx를 0으로 리셋.
  // React는 렌더 중 setState를 감지하면 이 렌더를 버리고 새 state로 즉시 재렌더하므로
  // stepIdx가 이전 값인 중간 렌더가 사용자에게 보이지 않는다.
  if (resolveSteps && resolveSteps.length > 0 && resolveSteps !== cachedSteps) {
    setCachedSteps(resolveSteps);
    setStepIdx(0);
  }

  useEffect(() => {
    if (!cachedSteps.length) return;
    // stepIdx는 위의 렌더-타임 리셋으로 이미 0. 타이머만 설정.
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStepIdx(1), REVEAL_INITIAL_DELAY_MS));
    for (let i = 1; i < cachedSteps.length; i++) {
      timers.push(
        setTimeout(() => setStepIdx(i + 1), REVEAL_INITIAL_DELAY_MS + i * RESOLVE_STEP_INTERVAL_MS),
      );
    }
    return () => timers.forEach(clearTimeout);
  }, [cachedSteps]);

  if (isFinished) {
    return (
      <div
        className={`relative z-10 flex flex-col items-center justify-center py-6 ${
          candy
            ? 'skin-candy-panel'
            : 'rounded-xl border border-purple-300 bg-linear-to-br from-purple-100 to-fuchsia-100'
        }`}
      >
        <p
          className={`mt-2 text-xl font-bold lg:text-2xl ${candy ? 'skin-candy-heading' : 'text-purple-900'}`}
        >
          {finalWinner === 'tie'
            ? '무승부!'
            : finalWinner
              ? `${players[finalWinner].nickname} 승리!`
              : '게임 종료'}
        </p>
        {winType && (
          <p className="mt-0.5 text-sm text-purple-600">{WIN_TYPE_LABELS[winType] ?? winType}</p>
        )}
      </div>
    );
  }

  if ((phase === 'reveal' || phase === 'roundEnd') && cachedSteps.length > 0) {
    return (
      <ResolutionPanel
        steps={cachedSteps}
        cursor={stepIdx}
        players={players}
        mySide={mySide}
        roundResult={roundResult}
        showFinal={phase === 'roundEnd' || stepIdx >= cachedSteps.length}
        candy={candy}
      />
    );
  }

  return (
    <div
      className={`relative z-10 flex items-center justify-center py-4 ${
        candy ? 'skin-candy-panel' : 'rounded-xl border border-gray-200 bg-white'
      }`}
    >
      <span className={`text-sm ${candy ? 'skin-candy-subtext' : 'text-gray-400'}`}>
        대기 중...
      </span>
    </div>
  );
}
