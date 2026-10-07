'use client';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import GameLoading from '@/components/game/GameLoading';
import { GamePlayerScoreboard } from '@/components/game/GamePlayerScoreboard';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { usePokerAudio } from '@/hooks/useGameAudio';
import { useGameHud } from '@/hooks/useGameHud';
import { playChipsSfx } from '@/lib/audio/chips';
import type { SkinTheme } from '@/lib/skins/registry';
import type { DoubleSidedPokerGameData } from '@/shared/types/double-sided-poker';
import { memo, useEffect, useMemo } from 'react';
import { BettingArea } from './BettingArea';
import { PlayerPanel } from './PlayerPanel';
import { ResultOverlay } from './ResultOverlay';
import { RoundHistory } from './RoundHistory';

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
          round: `${gameData.round}R · 팟 ${gameData.pot} · 덱 ${gameData.deckRemaining}`,
          order:
            gameData.phase === 'betting'
              ? `${gameData.currentTurnId === myId ? '(내 차례)' : '(상대 차례)'} ${gameData.doubleBettorId ? '양면베팅 응답' : '베팅'}`
              : gameData.phase === 'round-result'
                ? '라운드 결과'
                : '게임 종료',
        }
      : null,
  );
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
      reference={
        <>
          <GameInfoPart title="플레이어 점수판" sizeToContent>
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
        상대가 위, 내가 아래. 두 사람의 베팅판이 화면 가운데에서 맞닿도록
        상대 자리는 180도 돌린 모양으로 둔다.
      */}
      <main className="mx-auto flex h-full w-full max-w-xl min-w-0 flex-col justify-center gap-1.5 overflow-hidden">
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
