'use client';
import { SeedSeotdaCard } from '@/components/game/cards';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import GameLoading from '@/components/game/GameLoading';
import { GamePlayerScoreboard } from '@/components/game/GamePlayerScoreboard';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { usePokerAudio } from '@/hooks/useGameAudio';
import { useGameHud } from '@/hooks/useGameHud';
import { playChipsSfx } from '@/lib/audio/chips';
import type { SkinTheme } from '@/lib/skins/registry';
import type { SeedSeotdaGameData } from '@/shared/types/seed-seotda';
import { memo, useEffect, useMemo, useRef } from 'react';
import { BettingArea } from './BettingArea';
import { PlayerPanel } from './PlayerPanel';
import { PHASE_LABEL } from './presentation';
import RecordPanel from './RecordPanel';
import { ResultOverlay } from './ResultOverlay';
import { SeedChoiceArea } from './SeedChoiceArea';
import { useSeedSeotdaMarks } from './useSeedSeotdaMarks';
import styles from './seed-choice.module.css';

function SeedSeotdaView({
  gameData,
  myId,
  roomId = '',
  gameKey = '',
}: {
  gameData?: SeedSeotdaGameData;
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
  const lastResult = useRef<number | null>(null);
  useEffect(() => {
    const round = gameData?.lastRoundResult?.round ?? 0;
    if (
      lastResult.current !== null &&
      round > lastResult.current &&
      gameData?.lastRoundResult?.winnerId
    )
      playChipsSfx();
    lastResult.current = round;
  }, [gameData?.lastRoundResult]);

  // 카운팅은 경기·덱 회차별로 유지하고, 새 덱에서는 초기화한다.
  const memoKey = `cdm-seed-seotda-memo:${roomId ?? ''}:${gameKey}:${gameData?.deckCycles ?? 1}`;
  const { seen, marks, toggleMark } = useSeedSeotdaMarks(memoKey, gameData);
  useGameHud(
    gameData
      ? {
          round: `${gameData.round}R · 팟 ${gameData.pot} · 덱 ${gameData.deckRemaining}`,
          order: `${gameData.phase === 'seed-choice' ? '(공동 차례) ' : gameData.phase === 'betting' ? (gameData.currentTurnId === myId ? '(내 차례) ' : '(상대 차례) ') : ''}${PHASE_LABEL[gameData.phase]}`,
        }
      : null,
  );

  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  const orderedPlayerIds = gameData.players[myId]
    ? [myId, ...playerIds.filter((id) => id !== myId)]
    : playerIds;
  const actionKey = `${gameData.round}-${gameData.phase}-${gameData.currentTurnId}-${gameData.bettingOpened}`;

  return (
    <GameReferenceFrame
      controls={
        <div className="flex flex-col gap-2">
          <SeedChoiceArea key={`seed-${actionKey}`} gameData={gameData} myId={myId} />
          <BettingArea key={`bet-${actionKey}`} gameData={gameData} myId={myId} />
        </div>
      }
      reference={
        <>
          <GameInfoPart title="플레이어 점수판" sizeToContent>
            <GamePlayerScoreboard
              myId={myId}
              entries={playerIds.map((id) => ({
                id,
                nickname: gameData.players[id].nickname,
                value: `${gameData.players[id].chips}칩`,
                detail: `베팅 ${gameData.players[id].roundBet}`,
                active: id === gameData.currentTurnId,
              }))}
            />
          </GameInfoPart>
          <RecordPanel
            data={gameData}
            myId={myId}
            seen={seen}
            marks={marks}
            onToggleMark={toggleMark}
          />
        </>
      }
    >
      <main className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-xl grid h-full w-full grid-cols-3 content-center items-center justify-center gap-1 overflow-hidden border p-1 sm:gap-3 sm:p-4 lg:grid-cols-1 lg:gap-1.5 lg:p-2">
        <div className="order-1 text-center">
          <p className="text-cdm-fg-subtle text-[11px] leading-3 font-bold tracking-[0.14em]">
            SEED
          </p>
          <SeedSeotdaCard card={gameData.seedCard} size="md" className={`mt-0.5 ${styles.seed}`} />
          <p className="text-cdm-fg mt-0.5 text-[11px] leading-3 font-black">공용 시드패</p>
        </div>
        <div className="contents">
          {orderedPlayerIds.map((playerId) => (
            <div
              key={playerId}
              className={playerId === myId ? 'order-0 lg:order-2' : 'order-2 lg:order-0'}
            >
              <PlayerPanel
                player={gameData.players[playerId]}
                playerId={playerId}
                gameData={gameData}
                myId={myId}
              />
            </div>
          ))}
        </div>
      </main>

      {/* 결과는 무대 위에 겹쳐 띄운다 — 새 줄로 만들면 그 순간 판이 밀린다. */}
      <ResultOverlay gameData={gameData} />
    </GameReferenceFrame>
  );
}

export default memo(SeedSeotdaView);
