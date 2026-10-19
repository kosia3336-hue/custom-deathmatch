'use client';

import { memo, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/cdm/Button';
import { Card } from '@/components/cdm/Card';
import { useGameAction } from '@/components/game/GameActionContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { GameScoreLine } from '@/components/game/GameScoreLine';
import GameLoading from '@/components/game/GameLoading';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';
import { buildFarewellExpression } from '@/shared/logic/farewell-formula';
import type { FarewellFormulaGameData } from '@/shared/types/farewell-formula';
import { cn } from '@/lib/utils';
import styles from './farewell-formula.module.css';

function FarewellFormulaView({ gameData, myId }: GameModuleViewProps<FarewellFormulaGameData>) {
  const { setHud } = useRoomLayout();

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${gameData.totalRounds}R`,
      order:
        gameData.phase === 'playing'
          ? gameData.isSolo
            ? '수식 완성'
            : '(공동 차례) 먼저 완성하기'
          : gameData.phase === 'reveal'
            ? '라운드 결과'
            : '종료',
    });
    return () => setHud(null);
  }, [gameData, setHud]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  return (
    <GameReferenceFrame reference={<FarewellInfo gameData={gameData} myId={myId} />}>
      <div
        data-game-intrinsic-stage
        className="flex w-full flex-col items-center justify-center gap-3 px-2 py-3 sm:px-4 sm:py-5"
      >
        <Card className={styles.board}>
          {gameData.phase === 'playing' && isPlayer ? (
            <PlayingFormula
              key={`${gameData.round}-${gameData.roundStartedAt}`}
              gameData={gameData}
            />
          ) : (
            <>
              <GoodbyeCounter target={gameData.goodbyeCount} />
              <StaticFormula gameData={gameData} />
            </>
          )}

          {gameData.phase === 'reveal' && gameData.lastResult && (
            <div className={styles.reveal}>
              <p className="text-sm font-bold">
                {gameData.lastResult.outcome === 'correct'
                  ? `${gameData.players[gameData.lastResult.scorerId ?? '']?.nickname ?? '플레이어'} 정답 · +1점`
                  : gameData.lastResult.outcome === 'wrong'
                    ? gameData.lastResult.scorerId
                      ? `${gameData.players[gameData.lastResult.callerId ?? '']?.nickname ?? '플레이어'} 오답 · ${gameData.players[gameData.lastResult.scorerId]?.nickname ?? '상대'} +1점`
                      : '오답 · 득점 없음'
                    : '제한시간 종료'}
              </p>
              <p className="mt-1 font-mono text-base font-black break-all">
                {gameData.lastResult.correctedExpression}
              </p>
              {gameData.lastResult.outcome === 'wrong' && (
                <p className="text-cdm-fg-muted mt-1 font-mono text-xs break-all">
                  정답 예시 {gameData.lastResult.answerExpression}
                </p>
              )}
            </div>
          )}

          {gameData.phase === 'finished' && (
            <p className="text-cdm-fg-muted text-center text-xs">
              최종 결과를 집계하고 있습니다...
            </p>
          )}
        </Card>
      </div>
    </GameReferenceFrame>
  );
}

function PlayingFormula({ gameData }: { gameData: FarewellFormulaGameData }) {
  const sendAction = useGameAction();
  const [removed, setRemoved] = useState<Set<number>>(() => new Set());
  const expression = useMemo(
    () => buildFarewellExpression(gameData.tokens, removed),
    [gameData.tokens, removed],
  );

  const toggle = (unitId: number) => {
    setRemoved((current) => {
      const next = new Set(current);
      if (next.has(unitId)) next.delete(unitId);
      else next.add(unitId);
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <GoodbyeCounter target={gameData.goodbyeCount} />
      <FormulaTokens gameData={gameData} removed={removed} onToggle={toggle} />
      <div className={styles.preview} aria-live="polite">
        <span className="text-cdm-fg-subtle text-[10px] font-bold tracking-wide">완성 수식</span>
        <span className="min-h-7 font-mono text-lg font-black break-all">{expression || '—'}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:justify-end">
        <Button
          variant="tertiary"
          size="sm"
          fullWidth
          disabled={removed.size === 0}
          onClick={() => setRemoved(new Set())}
        >
          선택 초기화
        </Button>
        <Button
          size="sm"
          fullWidth
          disabled={removed.size !== gameData.goodbyeCount || !expression}
          onClick={() =>
            sendAction({ type: 'submit', removedUnitIds: [...removed].sort((a, b) => a - b) })
          }
        >
          정답 제출
        </Button>
      </div>
      {gameData.myFeedback && (
        <p key={gameData.myFeedback.attemptedAt} className={styles.feedback} role="status">
          {gameData.myFeedback.message}
        </p>
      )}
    </div>
  );
}

function GoodbyeCounter({ target }: { target: number }) {
  return (
    <header className="text-center">
      <p className="text-cdm-fg-subtle text-[11px] font-bold tracking-[0.14em]">이별 횟수</p>
      <p className="text-cdm-primary mt-1 text-2xl font-black tabular-nums">
        {target}
        <span className="ml-1 text-sm">회</span>
      </p>
    </header>
  );
}

function StaticFormula({ gameData }: { gameData: FarewellFormulaGameData }) {
  const removed = new Set(
    gameData.phase === 'reveal' ? (gameData.lastResult?.removedUnitIds ?? []) : [],
  );
  return <FormulaTokens gameData={gameData} removed={removed} />;
}

function FormulaTokens({
  gameData,
  removed,
  onToggle,
}: {
  gameData: FarewellFormulaGameData;
  removed: Set<number>;
  onToggle?: (unitId: number) => void;
}) {
  const pairedUnits = useMemo(() => {
    const counts = new Map<number, number>();
    gameData.tokens.forEach((token) =>
      counts.set(token.unitId, (counts.get(token.unitId) ?? 0) + 1),
    );
    return counts;
  }, [gameData.tokens]);

  return (
    <div className={styles.formula} aria-label={`문제 수식 ${gameData.source}`}>
      {gameData.tokens.map((token) => {
        const selected = removed.has(token.unitId);
        const label = `${token.text}${selected ? ' 삭제 취소' : ' 삭제'}${(pairedUnits.get(token.unitId) ?? 0) > 1 ? ', 짝 괄호 포함' : ''}`;
        return onToggle ? (
          <button
            key={token.index}
            type="button"
            className={cn(styles.token, selected && styles.removed)}
            aria-pressed={selected}
            aria-label={label}
            onClick={() => onToggle(token.unitId)}
          >
            {token.text}
          </button>
        ) : (
          <span key={token.index} className={cn(styles.token, selected && styles.removed)}>
            {token.text}
          </span>
        );
      })}
    </div>
  );
}

function FarewellInfo({ gameData, myId }: { gameData: FarewellFormulaGameData; myId: string }) {
  const entries = Object.entries(gameData.players).map(([playerId, player]) => ({
    label: playerId === myId ? '나' : player.nickname,
    value: gameData.scores[playerId] ?? 0,
    isMe: playerId === myId,
  }));
  return (
    <GameInfoStack>
      <GameInfoPart title="점수" sizeToContent>
        <GameScoreLine entries={entries} unit="점" />
      </GameInfoPart>
      <GameInfoPart title="라운드 기록" preferredBodyHeight={220}>
        {gameData.history.length === 0 ? (
          <p className="text-cdm-fg-muted text-xs">아직 완료된 라운드가 없습니다.</p>
        ) : (
          <ol className="flex flex-col gap-2">
            {gameData.history.map((round) => (
              <li key={round.round} className="text-xs">
                <span className="text-cdm-fg-subtle mr-2 font-bold">{round.round}R</span>
                <span className="text-cdm-fg font-mono font-bold break-all">
                  {round.answerExpression}
                </span>
              </li>
            ))}
          </ol>
        )}
      </GameInfoPart>
    </GameInfoStack>
  );
}

export default memo(FarewellFormulaView);
