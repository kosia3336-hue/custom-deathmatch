'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { NumberFourGameData } from '@/shared/types/number4';
import { INITIAL_WHITE, INITIAL_BLACK } from '@/shared/types/number4';
import { getSkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import SubmitSelector from './SubmitSelector';
import RevealPanel from './RevealPanel';
import InfoPanel from './InfoPanel';
import TileTracker from './TileTracker';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import { WIN_TYPE_LABELS } from './constants';
import { GameFrame } from '@/components/game/GameFrame';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { seatStage, turnStage, submitStage } from '@/lib/gameSeat';

export default function NumberFourGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as NumberFourGameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();
  const { setHud } = useRoomLayout();
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.NUMBER_FOUR);
  const isDuality = skin === 'duality';

  const shownWinnerRef = useRef<string | null>(null);

  // 타일 추리 상태 - 라운드가 바뀌어도 유지되도록 부모에서 관리
  const [trackerWhite, setTrackerWhite] = useState(INITIAL_WHITE);
  const [trackerBlack, setTrackerBlack] = useState(INITIAL_BLACK);
  // 관전자용: 플레이어별 상태
  const [spectatorTrackers, setSpectatorTrackers] = useState<Record<string, { white: number; black: number }>>({});

  /* 동시 제출 판 — '내 차례' 대신 냈는지를 알린다 (lib/gameSeat.ts) */
  const phaseLabel = gameData?.phase === 'submit'
    ? submitStage({
        finished: false,
        isSpectator,
        submitted: (myId ? gameData.players[myId]?.submitted : false) ?? false,
        pending: '숫자·색 제출',
      })
    : gameData?.phase === 'reveal'
      ? '제출 공개'
      : gameData?.phase === 'finished'
        ? '종료'
        : undefined;

  const handleAdjust = useCallback((color: 'white' | 'black', delta: number) => {
    if (color === 'white') {
      setTrackerWhite((v) => Math.min(INITIAL_WHITE, Math.max(0, v + delta)));
    } else {
      setTrackerBlack((v) => Math.min(INITIAL_BLACK, Math.max(0, v + delta)));
    }
  }, []);

  const handleSpectatorAdjust = useCallback((playerId: string, color: 'white' | 'black', delta: number) => {
    setSpectatorTrackers((prev) => {
      const cur = prev[playerId] ?? { white: INITIAL_WHITE, black: INITIAL_BLACK };
      return {
        ...prev,
        [playerId]: {
          white: color === 'white' ? Math.min(INITIAL_WHITE, Math.max(0, cur.white + delta)) : cur.white,
          black: color === 'black' ? Math.min(INITIAL_BLACK, Math.max(0, cur.black + delta)) : cur.black,
        },
      };
    });
  }, []);

  useEffect(() => {
    if (!gameData) return;
    const tracker = isSpectator ? (
      <div className="flex flex-col gap-2">
        {Object.entries(gameData.players).map(([id, player]) => {
          const state = spectatorTrackers[id] ?? { white: INITIAL_WHITE, black: INITIAL_BLACK };
          return (
            <TileTracker
              key={id}
              playerNickname={player.nickname}
              white={state.white}
              black={state.black}
              onAdjust={(color, delta) => handleSpectatorAdjust(id, color, delta)}
              skin={skin}
            />
          );
        })}
      </div>
    ) : (
      <TileTracker white={trackerWhite} black={trackerBlack} onAdjust={handleAdjust} skin={skin} />
    );
    setHud({
      round: `${gameData.round} / 6R`,
      order: phaseLabel,
      memo: (
        <NumberFourSidePanel
          gameData={gameData}
          myId={myId}
          tracker={gameData.phase === 'submit' ? tracker : null}
        />
      ),
    });
    return () => setHud(null);
  }, [gameData, handleAdjust, handleSpectatorAdjust, isSpectator, myId, phaseLabel, setHud, skin, spectatorTrackers, trackerBlack, trackerWhite]);

  useEffect(() => {
    /* 무승부는 승자가 없다 — 끝났는지는 winType 으로 보고, 알림은 따로 띄운다 */
    if (!gameData?.winType) return;
    const shownKey = gameData.winner ?? 'draw';
    if (shownWinnerRef.current === shownKey) return;
    shownWinnerRef.current = shownKey;

    const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
    if (!gameData.winner) {
      toast.info('무승부!', { duration: 5000 });
      return;
    }

    const winnerEntry = Object.entries(gameData.players).find(([id]) => id === gameData.winner || id.replace('_p2', '') === gameData.winner);
    const winnerNick = winnerEntry?.[1].nickname ?? '???';
    const isMe = gameData.winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) toast.success(message, { duration: 5000 });
    else toast.error(message, { duration: 5000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  // 솔로 모드에서 player2는 myId + '_p2' 키를 가지므로 currentSide 기준으로 선택
  const myPlayer = (() => {
    if (gameData.currentSide === 'player2') {
      const p2 = playerEntries.find(([id]) => id === myId + '_p2')?.[1];
      if (p2) return p2;
    }
    return playerEntries.find(([id]) => id === myId)?.[1];
  })();

  const isSubmitPhase = gameData.phase === 'submit';
  const canAct = !isSpectator && isSubmitPhase;
  const opponent = playerEntries.find(([id]) => id !== myId && id !== myId + '_p2')?.[1];

  const trackerPanel = isSpectator ? (
    <div className="flex flex-col gap-2">
      {playerEntries.map(([id, p]) => {
        const tracker = spectatorTrackers[id] ?? { white: INITIAL_WHITE, black: INITIAL_BLACK };
        return (
          <TileTracker
            key={id}
            playerNickname={p.nickname}
            white={tracker.white}
            black={tracker.black}
            onAdjust={(color, delta) => handleSpectatorAdjust(id, color, delta)}
            skin={skin}
          />
        );
      })}
    </div>
  ) : (
    <TileTracker white={trackerWhite} black={trackerBlack} onAdjust={handleAdjust} skin={skin} />
  );

  const waitingPanel =
    isSubmitPhase && (isSpectator || myPlayer?.submitted) && !gameData.currentSide ? (
      isDuality ? (
        <div className="skin-duality-field skin-duality-waiting">
          <div className="skin-duality-fx" aria-hidden>
            <div className="skin-duality-split-line" />
            <div className="skin-duality-frost-glow" />
            <div className="skin-duality-ember-glow" />
          </div>
          <div className="relative z-10 flex flex-col items-center gap-3">
            <div className="flex items-center gap-2">
              <div
                className="skin-duality-tile skin-duality-tile--frost skin-duality-tile--sm"
                style={{ animationDelay: '0s' }}
              />
              <div
                className="skin-duality-tile skin-duality-tile--obsidian skin-duality-tile--sm"
                style={{ animationDelay: '0.3s' }}
              />
            </div>
            <div className="skin-duality-waiting-dots" aria-hidden>
              <div className="skin-duality-waiting-dot" />
              <div className="skin-duality-waiting-dot" />
              <div className="skin-duality-waiting-dot" />
            </div>
            <p className="text-sm" style={{ color: 'var(--dl-ink-dim)' }}>
              <span className="font-medium" style={{ color: 'var(--dl-frost)' }}>
                {opponentDisplayName(opponent?.nickname, isSpectator)}
              </span>{' '}
              선택 중...
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-8">
          <div className="animate-pulse text-gray-400">● ● ●</div>
          <p className="text-sm text-gray-500">
            <span className="animate-pulse">{opponentDisplayName(opponent?.nickname, isSpectator)}</span> 선택 중...
          </p>
        </div>
      )
    ) : null;

  return (
    <>
      <GameFrame
        aside={
          <NumberFourSidePanel gameData={gameData} myId={myId} tracker={isSubmitPhase ? trackerPanel : null} />
        }
      >
        <div className="flex h-full w-full max-w-lg flex-col items-center justify-center gap-3 overflow-hidden">
          {isSubmitPhase && canAct && myPlayer && !myPlayer.submitted && (
            <SubmitSelector
              player={myPlayer}
              currentSide={gameData.currentSide}
              isSpectator={isSpectator}
              skin={skin}
            />
          )}
          {waitingPanel}
          {(gameData.phase === 'reveal' || gameData.phase === 'finished') && gameData.revealData && (
            <RevealPanel
              revealData={gameData.revealData}
              players={gameData.players}
              round={gameData.round}
              winType={gameData.winType}
              tiebreakerReason={gameData.tiebreakerReason}
              skin={skin}
            />
          )}
        </div>
      </GameFrame>

    </>
  );
}

function NumberFourSidePanel({ gameData, myId, tracker }: {
  gameData: NumberFourGameData;
  myId: string;
  tracker: React.ReactNode;
}) {
  return (
    <GameInfoStack>
      {tracker && <GameInfoPart>{tracker}</GameInfoPart>}
      <GameInfoPart>
        <InfoPanel
          players={gameData.players}
          roundHistory={gameData.roundHistory}
          myId={myId}
        />
      </GameInfoPart>
    </GameInfoStack>
  );
}
