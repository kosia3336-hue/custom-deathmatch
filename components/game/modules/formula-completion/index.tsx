'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/cdm/Card';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import FormulaPad from './FormulaPad';
import RoundHistory from './RoundHistory';
import RoundReveal from './RoundReveal';
import ScoreBoard from './ScoreBoard';

export default function FormulaCompletionGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as unknown as FormulaCompletionGameData | undefined;
  const myId = useMySocketId();
  const [now, setNow] = useState(gameData?.roundStartedAt ?? 0);

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(interval);
  }, []);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cdm-fg-muted">게임을 불러오는 중...</p>
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const remainingSeconds = gameData.roundSeconds == null
    ? null
    : Math.max(
        0,
        Math.ceil((gameData.roundStartedAt + gameData.roundSeconds * 1000 - now) / 1000),
      );

  return (
    <div className="mx-auto flex w-full max-w-xl flex-col gap-4 p-3 sm:p-4">
      <ScoreBoard gameData={gameData} myId={myId} remainingSeconds={remainingSeconds} />
      <RoundHistory gameData={gameData} />

      <Card className="text-center">
        <p className="text-xs font-semibold tracking-[0.18em] text-cdm-fg-subtle">TARGET</p>
        <p className="mt-1 text-5xl font-black tabular-nums text-cdm-primary sm:text-6xl">
          {gameData.target}
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2" aria-label={`${gameData.numberCount}개의 제시 숫자`}>
          {gameData.numbers.map((number, index) => (
            <span
              key={`${number}-${index}`}
              className="flex h-12 w-12 items-center justify-center rounded-cdm-md border-2 border-cdm-border-strong bg-cdm-bg-elev-1 text-xl font-extrabold text-cdm-fg"
            >
              {number}
            </span>
          ))}
        </div>
        <p className="mt-3 text-xs text-cdm-fg-muted">
          모든 숫자를 한 번씩 · 사칙연산과 괄호 사용 가능
        </p>
      </Card>

      {gameData.phase === 'playing' ? (
        isPlayer ? (
          <PlayingRound
            key={`${gameData.round}-${gameData.roundStartedAt}`}
            numbers={gameData.numbers}
          />
        ) : (
          <Card className="text-center text-sm text-cdm-fg-muted">
            {gameData.isSolo
              ? '솔로 플레이를 관전하고 있습니다.'
              : '관전 중 — 먼저 수식을 외치는 플레이어가 라운드를 결정합니다.'}
          </Card>
        )
      ) : (
        <RoundReveal gameData={gameData} myId={myId} />
      )}

      {gameData.phase === 'finished' && (
        <p className="text-center text-xs text-cdm-fg-muted">최종 결과를 집계하고 있습니다...</p>
      )}
    </div>
  );
}

function PlayingRound({ numbers }: { numbers: number[] }) {
  const [expression, setExpression] = useState('');

  const submit = () => {
    const value = expression.trim();
    if (!value) return;
    getSocket().emit('game:action', { type: 'submit', expression: value });
  };

  return (
    <FormulaPad
      numbers={numbers}
      expression={expression}
      onExpressionChange={setExpression}
      onSubmit={submit}
    />
  );
}
