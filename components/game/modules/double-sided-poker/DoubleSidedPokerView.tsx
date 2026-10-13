'use client';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import GameLoading from '@/components/game/GameLoading';
import { GamePlayerScoreboard } from '@/components/game/GamePlayerScoreboard';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { usePokerAudio } from '@/hooks/useGameAudio';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { PokerTableInfo } from '@/components/game/poker/PokerTableInfo';
import { useGameHud } from '@/hooks/useGameHud';
import { playChipsSfx } from '@/lib/audio/chips';
import type { SkinTheme } from '@/lib/skins/registry';
import type { DoubleSidedPokerGameData } from '@/shared/types/double-sided-poker';
import { memo, useEffect, useMemo } from 'react';
import { BettingArea } from './BettingArea';
import { PlayerPanel } from './PlayerPanel';
import { ResultOverlay } from './ResultOverlay';
import { RoundHistory } from './RoundHistory';
import styles from './double-sided-poker.module.css';

function DoubleSidedPokerView({
  gameData,
  myId,
}: {
  gameData?: DoubleSidedPokerGameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const { setHeaderBelow } = useRoomLayout();
  const playerIds = useMemo(() => (gameData ? Object.keys(gameData.players) : []), [gameData]);

  usePokerAudio(
    gameData
      ? {
          round: gameData.round,
          phase: gameData.phase,
          pot:
            gameData.phase === 'round-result'
              ? (gameData.lastRoundResult?.potAmount ?? gameData.pot)
              : gameData.pot,
          turnId: gameData.currentTurnId,
          myId,
          isPlayer: Boolean(gameData.players[myId]),
        }
      : null,
  );

  /* 라운드가 끝나 칩이 넘어갈 때 한 번. 라운드 번호로 묶어 결과 화면이 다시 그려져도 겹치지 않는다. */
  const roundEnded = gameData?.phase === 'round-result';
  const roundNumber = gameData?.round;
  useEffect(() => {
    if (roundEnded) playChipsSfx();
  }, [roundEnded, roundNumber]);

  useGameHud(
    gameData
      ? {
          round: `${gameData.round}R`,
          order:
            gameData.phase === 'betting'
              ? `${gameData.currentTurnId === myId ? '(내 차례)' : '(상대 차례)'} ${gameData.doubleBettorId ? '양면베팅 응답' : '베팅'}`
              : gameData.phase === 'round-result'
                ? '라운드 결과'
                : '게임 종료',
        }
      : null,
  );
  const pot = gameData?.pot;
  const deckRemaining = gameData?.deckRemaining;
  const deckCycle = gameData?.deckCycles;
  const ante = gameData?.ante;
  useEffect(() => {
    setHeaderBelow(
      pot != null && deckRemaining != null && deckCycle != null && ante != null ? (
        <PokerTableInfo pot={pot} deckRemaining={deckRemaining} deckCycle={deckCycle} ante={ante} />
      ) : null,
    );
    return () => setHeaderBelow(null);
  }, [setHeaderBelow, pot, deckRemaining, deckCycle, ante]);

  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  // 상대가 위, 내가 아래. 관전자는 원래 순서를 그대로 쓴다.
  const seatOrder = gameData.players[myId]
    ? [...playerIds.filter((id) => id !== myId), myId]
    : playerIds;
  const actionKey = [
    gameData.round,
    gameData.phase,
    gameData.currentTurnId,
    gameData.bettingOpened,
    gameData.currentStake,
  ].join('-');

  return (
    <GameReferenceFrame
      className={styles.frame}
      reference={
        <>
          <GameInfoPart title="플레이어 점수판" className={styles.score} sizeToContent>
            <GamePlayerScoreboard
              myId={myId}
              entries={playerIds.map((id) => ({
                id,
                nickname: gameData.players[id].nickname,
                value: `${gameData.players[id].chips}칩`,
                detail: `베팅 ${gameData.players[id].frontBet + gameData.players[id].backBet}`,
                active: id === gameData.currentTurnId,
              }))}
            />
          </GameInfoPart>
          <GameInfoPart title="라운드 기록">
            <RoundHistory
              rounds={
                gameData.rounds ?? (gameData.lastRoundResult ? [gameData.lastRoundResult] : [])
              }
              players={gameData.players}
              myId={myId}
            />
          </GameInfoPart>
        </>
      }
      controls={
        <div className="flex flex-col gap-1.5">
          <BettingArea key={actionKey} gameData={gameData} myId={myId} />
        </div>
      }
    >
      {/*
        상대가 위, 내가 아래. 각 플레이어의 카드와 면별 베팅 금액을 한 묶음으로 둔다.
      */}
      <main
        data-game-intrinsic-stage
        className={`mx-auto flex w-full max-w-xl min-w-0 flex-col justify-center ${styles.stage}`}
      >
        {seatOrder.map((playerId) => (
          <PlayerPanel
            key={playerId}
            player={gameData.players[playerId]}
            playerId={playerId}
            gameData={gameData}
            myId={myId}
            mirrored={playerId !== myId}
          />
        ))}
      </main>

      {/* 결과는 무대 위에 겹쳐 띄운다 — 새 줄로 만들면 그 순간 판이 밀린다. */}
      <ResultOverlay gameData={gameData} />
    </GameReferenceFrame>
  );
}

export default memo(DoubleSidedPokerView);
