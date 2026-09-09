'use client';

import { useState } from 'react';
import { Card } from '@/components/cdm/Card';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import FormulaPad from './FormulaPad';
import RoundHistory from './RoundHistory';
import RoundReveal from './RoundReveal';
import ScoreBoard from './ScoreBoard';
import { GameFrame } from '@/components/game/GameFrame';

export default function FormulaCompletionGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as unknown as FormulaCompletionGameData | undefined;
  const myId = useMySocketId();

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cdm-fg-muted">게임을 불러오는 중...</p>
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);

  return (
    <GameFrame
      info={<ScoreBoard gameData={gameData} myId={myId} />}
      controls={
        gameData.phase === 'playing' ? (
          isPlayer ? (
            <PlayingRound
              key={`${gameData.round}-${gameData.roundStartedAt}`}
              numbers={gameData.numbers}
            />
          ) : (
            <Card className="text-center text-xs text-cdm-fg-muted">
              {gameData.isSolo
                ? '솔로 플레이를 관전하고 있습니다.'
                : '관전 중 — 먼저 수식을 외치는 플레이어가 라운드를 결정합니다.'}
            </Card>
          )
        ) : null
      }
      aside={<RoundHistory gameData={gameData} />}
    >
      <div className="flex h-full w-full flex-col items-center justify-center gap-3 overflow-hidden">
        <Card className="w-full text-center">
          <p className="text-cdm-fg-subtle text-xs font-semibold tracking-[0.18em]">TARGET</p>
          <p className="text-cdm-primary mt-1 text-5xl font-black tabular-nums sm:text-6xl">
            {gameData.target}
          </p>
          <div
            className="mt-3 flex flex-wrap justify-center gap-2"
            aria-label={`${gameData.numberCount}개의 제시 숫자`}
          >
            {gameData.numbers.map((number, index) => (
              <span
                key={`${number}-${index}`}
                className="rounded-cdm-md border-cdm-border-strong bg-cdm-bg-elev-1 text-cdm-fg flex h-12 w-12 items-center justify-center border-2 text-xl font-extrabold"
              >
                {number}
              </span>
            ))}
          </div>
        </Card>

        {gameData.phase !== 'playing' && (
          <div className="w-full">
            <RoundReveal gameData={gameData} myId={myId} />
          </div>
        )}

        {gameData.phase === 'finished' && (
          <p className="text-cdm-fg-muted text-center text-xs">최종 결과를 집계하고 있습니다...</p>
        )}
      </div>
    </GameFrame>
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
