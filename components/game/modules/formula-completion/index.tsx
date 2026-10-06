'use client';

import GameLoading from '@/components/game/GameLoading';

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
import { GameFrame } from '@/components/game/GameFrame';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameScoreLine } from '@/components/game/GameScoreLine';

export default function FormulaCompletionGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as unknown as FormulaCompletionGameData | undefined;
  const myId = useMySocketId();
  const { setHud } = useRoomLayout();

  useEffect(() => {
    if (!gameData) return;
    const phase = gameData.phase === 'playing' ? '수식 입력' : gameData.phase === 'finished' ? '종료' : '라운드 결과';
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order: phase,
      memo: <FormulaInfo gameData={gameData} myId={myId} />,
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
    <GameFrame
      /* 점수는 늘 보이게 (components/game/GameScoreLine.tsx) */
      info={
        <GameScoreLine
          unit="점"
          entries={Object.entries(gameData.players).map(([playerId, player]) => ({
            label: playerId === myId ? '나' : player.nickname,
            isMe: playerId === myId,
            value: gameData.scores[playerId] ?? 0,
          }))}
        />
      }
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
      aside={<FormulaInfo gameData={gameData} myId={myId} />}
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

function FormulaInfo({ gameData, myId }: { gameData: FormulaCompletionGameData; myId: string }) {
  return (
    <GameInfoStack>
      <GameInfoPart title="점수">
        <ScoreBoard gameData={gameData} myId={myId} className="border-0 bg-transparent p-0" />
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        <RoundHistory gameData={gameData} className="flex-wrap justify-start" />
      </GameInfoPart>
    </GameInfoStack>
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
