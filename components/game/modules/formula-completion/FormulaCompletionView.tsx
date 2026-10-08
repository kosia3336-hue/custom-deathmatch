'use client';
import { memo } from 'react';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameAction } from '@/components/game/GameActionContext';

import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useState } from 'react';
import { Card } from '@/components/cdm/Card';
import type { FormulaCompletionGameData } from '@/shared/types/formula-completion';
import FormulaPad from './FormulaPad';
import RoundHistory from './RoundHistory';
import RoundReveal from './RoundReveal';
import ScoreBoard from './ScoreBoard';
import styles from './formula-completion.module.css';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';

function FormulaCompletionView({
  gameData,
  myId,
}: GameModuleViewProps<FormulaCompletionGameData> & { isSolo?: boolean }) {
  const { setHud } = useRoomLayout();

  useEffect(() => {
    if (!gameData) return;
    const phase =
      gameData.phase === 'playing'
        ? gameData.isSolo
          ? '수식 입력'
          : '(공동 차례) 수식 입력'
        : gameData.phase === 'finished'
          ? '종료'
          : '라운드 결과';
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order: phase,
    });
    return () => setHud(null);
  }, [gameData, myId, setHud]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);

  return (
    <GameReferenceFrame
      /* 점수는 늘 보이게 (components/game/GameScoreLine.tsx) */

      reference={<FormulaInfo gameData={gameData} myId={myId} />}
    >
      <div
        data-game-intrinsic-stage
        className="flex w-full flex-col items-center justify-center gap-3 px-2 py-4 sm:px-4 sm:py-6"
      >
        <Card className={styles.board}>
          <div className="mb-4 text-center">
            <p className="text-cdm-fg-subtle text-xs font-semibold tracking-[0.18em]">TARGET</p>
            <p className="text-cdm-primary mt-1 text-5xl font-black tabular-nums sm:text-6xl">
              {gameData.target}
            </p>
          </div>
          {gameData.phase === 'playing' && isPlayer ? (
            <PlayingRound
              key={`${gameData.round}-${gameData.roundStartedAt}`}
              numbers={gameData.numbers}
            />
          ) : (
            <>
              <div className={styles.tileRow} aria-label={`${gameData.numberCount}개의 제시 숫자`}>
                {gameData.numbers.map((number, index) => (
                  <span key={`${number}-${index}`} className={styles.tile}>
                    {number}
                  </span>
                ))}
              </div>
              {gameData.phase === 'playing' && (
                <p className="text-cdm-fg-muted mt-4 text-center text-xs">
                  {gameData.isSolo
                    ? '솔로 플레이를 관전하고 있습니다.'
                    : '관전 중 — 먼저 수식을 외치는 플레이어가 라운드를 결정합니다.'}
                </p>
              )}
            </>
          )}
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
    </GameReferenceFrame>
  );
}

function FormulaInfo({ gameData, myId }: { gameData: FormulaCompletionGameData; myId: string }) {
  return (
    <GameInfoStack>
      <GameInfoPart title="점수" sizeToContent>
        <ScoreBoard gameData={gameData} myId={myId} className="border-0 bg-transparent p-0" />
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        <RoundHistory gameData={gameData} className="flex-wrap justify-start" />
      </GameInfoPart>
    </GameInfoStack>
  );
}

function PlayingRound({ numbers }: { numbers: number[] }) {
  const sendAction = useGameAction();
  const [expression, setExpression] = useState('');

  const submit = () => {
    const value = expression.trim();
    if (!value) return;
    sendAction({ type: 'submit', expression: value });
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

export default memo(FormulaCompletionView);
