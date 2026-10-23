'use client';

import { useEffect, useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { useGameAction } from '@/components/game/GameActionContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { GameScoreLine } from '@/components/game/GameScoreLine';
import GameLoading from '@/components/game/GameLoading';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import { areLoopCheckNeighbors } from '@/shared/logic/loop-check';
import {
  LOOP_CHECK_COLORS,
  type LoopCheckGameData,
  type LoopCheckColorMode,
} from '@/shared/types/loop-check';
import LoopCheckBoard from './LoopCheckBoard';
import styles from './loop-check.module.css';

export default function LoopCheckView({ gameData, myId }: GameModuleViewProps<LoopCheckGameData>) {
  const { setHud } = useRoomLayout();
  const [localMode, setLocalMode] = useState<LoopCheckColorMode | null>(null);
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${gameData.bestOf}R`,
      order:
        gameData.phase === 'playing'
          ? '경로 탐색'
          : gameData.phase === 'reveal'
            ? '라운드 결과'
            : '게임 종료',
    });
    return () => setHud(null);
  }, [gameData, setHud]);
  if (!gameData) return <GameLoading />;
  const mode = localMode ?? gameData.colorMode;
  return (
    <GameReferenceFrame
      reference={
        <GameInfoStack>
          <GameInfoPart title="점수" sizeToContent>
            <GameScoreLine
              entries={Object.entries(gameData.players).map(([id, player]) => ({
                label: id === myId ? '나' : player.nickname,
                value: gameData.scores[id] ?? 0,
                isMe: id === myId,
              }))}
              unit="점"
            />
          </GameInfoPart>
          <GameInfoPart title="라운드 기록" preferredBodyHeight={220}>
            <ol className="space-y-2 text-xs">
              {gameData.history.map((result, index) => (
                <li key={index}>
                  {result.round}R ·{' '}
                  {result.winnerId
                    ? `${gameData.players[result.winnerId]?.nickname ?? '플레이어'} +1점`
                    : '시간 종료'}
                </li>
              ))}
            </ol>
          </GameInfoPart>
        </GameInfoStack>
      }
    >
      <div
        className="flex w-full flex-col items-center justify-center px-2 py-3"
        data-game-intrinsic-stage
      >
        <div className={styles.stage}>
          <div className="mb-2 flex items-center justify-between gap-3 text-xs">
            <span className="text-cdm-fg-muted font-bold">
              {gameData.bestOf}전 {gameData.winScore}선승
            </span>
            <button
              type="button"
              aria-pressed={mode === 'colorblind'}
              onClick={() => setLocalMode(mode === 'colorblind' ? 'standard' : 'colorblind')}
              className="border-cdm-border text-cdm-fg rounded-lg border px-2 py-1.5 font-bold"
            >
              색약 모드 {mode === 'colorblind' ? '켜짐' : '꺼짐'}
            </button>
          </div>
          <PathRound key={gameData.roundId} gameData={gameData} myId={myId} mode={mode} />
        </div>
      </div>
    </GameReferenceFrame>
  );
}

function PathRound({
  gameData,
  myId,
  mode,
}: {
  gameData: LoopCheckGameData;
  myId: string;
  mode: LoopCheckColorMode;
}) {
  const [path, setPath] = useState<number[]>([]);
  const send = useGameAction();
  const active = gameData.phase === 'playing' && Boolean(gameData.players[myId]);
  const visiblePath = gameData.phase === 'playing' ? path : (gameData.lastResult?.path ?? []);
  const select = (cell: number) =>
    setPath((current) => {
      const previous = current.indexOf(cell);
      if (previous >= 0) return current.slice(0, previous + 1);
      if (
        current.length >= 10 ||
        (current.length > 0 && !areLoopCheckNeighbors(current[current.length - 1]!, cell))
      )
        return current;
      return [...current, cell];
    });
  const result = gameData.lastResult;
  return (
    <>
      <LoopCheckBoard
        board={gameData.board}
        path={visiblePath}
        colorMode={mode}
        onSelect={active ? select : undefined}
      />
      <div className="mt-3 flex justify-center gap-1" aria-label="선택한 색 순서">
        {Array.from({ length: 10 }, (_, index) => {
          const colorId = gameData.board.cells[visiblePath[index] ?? -1];
          const color = colorId == null ? null : LOOP_CHECK_COLORS[colorId];
          return (
            <span
              key={index}
              className={`border-cdm-border flex h-6 min-w-0 flex-1 items-center justify-center rounded border ${index === 5 ? 'ml-2' : ''}`}
              style={
                color
                  ? { backgroundColor: mode === 'colorblind' ? color.accessibleHex : color.hex }
                  : undefined
              }
              aria-label={color?.name ?? '미선택'}
            >
              {color && mode === 'colorblind' && (
                <span className="rounded-full bg-white px-0.5 text-xs leading-none text-black">
                  {color.symbol}
                </span>
              )}
            </span>
          );
        })}
      </div>
      {active && (
        <div className="mt-3 grid grid-cols-[1fr_1fr_1.4fr] gap-2">
          <Button
            size="sm"
            className="min-w-0 px-1 text-xs"
            variant="tertiary"
            disabled={!path.length}
            onClick={() => setPath((current) => current.slice(0, -1))}
          >
            한 칸 취소
          </Button>
          <Button
            size="sm"
            className="min-w-0 px-1 text-xs"
            variant="tertiary"
            disabled={!path.length}
            onClick={() => setPath([])}
          >
            초기화
          </Button>
          <Button
            size="sm"
            className="min-w-0 px-1 text-xs"
            disabled={path.length !== 10}
            onClick={() => send({ type: 'submit', roundId: gameData.roundId, path })}
          >
            정답 제출
          </Button>
        </div>
      )}
      {gameData.myFeedback && active && (
        <p
          key={gameData.myFeedback.attemptedAt}
          role="status"
          className="text-cdm-accent mt-2 text-center text-xs"
        >
          {gameData.myFeedback.message}
        </p>
      )}
      {result && (
        <p role="status" className="text-cdm-primary mt-3 text-center text-sm font-bold">
          {result.winnerId
            ? `${gameData.players[result.winnerId]?.nickname ?? '플레이어'} +1점`
            : gameData.isSolo
              ? '시간 종료'
              : '시간 종료 · 재출제'}
        </p>
      )}
      {gameData.phase === 'finished' && (
        <p className="text-cdm-fg-muted mt-2 text-center text-xs">게임 종료</p>
      )}
    </>
  );
}
