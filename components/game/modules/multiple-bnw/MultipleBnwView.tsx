'use client';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameHud } from '@/hooks/useGameHud';
import { usePresentationEffect } from '@/hooks/usePresentationEffect';
import { seatStage, turnStage } from '@/lib/gameSeat';
import type { SkinTheme } from '@/lib/skins/registry';
import { josa } from '@/shared/lib/josa';
import type { MBNWSuspectResult, MBNWTile, MultipleBnwGameData } from '@/shared/types/multiple-bnw';
import { MBNW_TILE_SET, MBNW_TOTAL_ROUNDS } from '@/shared/types/multiple-bnw';
import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ColorBadge } from './ColorBadge';
import { MultipleBnwSidePanel } from './MultipleBnwSidePanel';
import ResultPanel from './ResultPanel';
import SuspectPanel from './SuspectPanel';
import TileSelector from './TileSelector';
import { WaitingCard } from './WaitingCard';
import { WaitingDots } from './WaitingDots';
import { WIN_TYPE_LABELS } from './constants';
import { SuspectAnim } from './presentation';
import InkWashFieldFx from './skins/InkWashFieldFx';
import styles from './multiple-bnw.module.css';
import { cycleTileNote, type TileNotes } from './tileTracker';

function MultipleBnwView({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
}: {
  gameData?: MultipleBnwGameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const isInkWash = skin === 'ink-wash';

  // Opponent tile manual tracker (client-side only)
  const [opponentTileNotes, setOpponentTileNotes] = useState<TileNotes>({});
  const trackedOpponentUsed = useMemo(
    () => MBNW_TILE_SET.filter((tile) => opponentTileNotes[tile] === 'used'),
    [opponentTileNotes],
  );
  const handleTrackerToggle = (tile: MBNWTile) => {
    setOpponentTileNotes((previous) => cycleTileNote(previous, tile));
  };

  // Suspect animation overlay
  const [suspectAnim, setSuspectAnim] = useState<SuspectAnim | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevSuspectRef = useRef<MBNWSuspectResult | null>(null);

  // Color reveal animation states
  const [firstColorVisible, setFirstColorVisible] = useState(false);
  const [secondColorVisible, setSecondColorVisible] = useState(false);
  const prevFirstColor = useRef<string | null>(null);
  const prevSecondColor = useRef<string | null>(null);

  // Round transition overlay
  const [roundOverlay, setRoundOverlay] = useState<{ round: number; firstNick: string } | null>(
    null,
  );
  const prevRoundRef = useRef<number | null>(null);
  const prevFirstIdRef = useRef<string | null>(null);

  // Winner/draw toast
  const shownWinnerRef = useRef<string | null>(null);

  /* 자리와 단계를 같이 — '선 플레이어 타일 선택' 만으로는 내 차례인지 모른다 (lib/gameSeat.ts) */
  const mbnwIsFirst = gameData ? myId === gameData.firstPlayerId : false;
  const mbnwSeat = isSpectator ? null : mbnwIsFirst ? '선' : '후';
  const mbnwFirstTurn = gameData?.phase === 'tileSubmit' || gameData?.phase === 'suspectFirst';
  const mbnwSecondTurn = gameData?.phase === 'tileRespond' || gameData?.phase === 'suspectSecond';
  const mbnwStep =
    gameData?.phase === 'tileSubmit' || gameData?.phase === 'tileRespond' ? '타일' : '배수의심';
  const phaseLabel = seatStage(
    mbnwSeat,
    mbnwFirstTurn || mbnwSecondTurn
      ? turnStage({
          finished: false,
          isSpectator,
          isMyTurn: (mbnwFirstTurn && mbnwIsFirst) || (mbnwSecondTurn && !mbnwIsFirst),
          spectatorStage: `${mbnwFirstTurn ? '선' : '후'} ${mbnwStep}`,
        })
      : gameData?.phase === 'result'
        ? '라운드 결과'
        : gameData?.phase === 'finished'
          ? '종료'
          : undefined,
  );

  useGameHud(
    gameData ? { round: `${gameData.round} / ${MBNW_TOTAL_ROUNDS}R`, order: phaseLabel } : null,
  );

  useEffect(() => {
    if (!gameData?.winType) return;
    const key = gameData.winner ?? 'draw';
    if (shownWinnerRef.current === key) return;
    shownWinnerRef.current = key;

    if (gameData.winType === 'draw') {
      toast.info('무승부!', { duration: 5000 });
    } else if (gameData.winner) {
      const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
      const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
      const isMe = gameData.winner === myId;
      if (isMe) toast.success(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
      else toast.error(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
    }
  }, [gameData?.winner, gameData?.winType, myId, gameData?.players]);

  // Color reveal animations
  usePresentationEffect(() => {
    if (!gameData?.colorReveal) return;
    const fc = gameData.colorReveal.firstPlayerColor;
    const sc = gameData.colorReveal.secondPlayerColor;

    if (fc && fc !== prevFirstColor.current) {
      prevFirstColor.current = fc;
      setFirstColorVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setFirstColorVisible(true));
      });
    }
    if (sc && sc !== prevSecondColor.current) {
      prevSecondColor.current = sc;
      setSecondColorVisible(false);
      requestAnimationFrame(() => {
        requestAnimationFrame(() => setSecondColorVisible(true));
      });
    }
  }, [gameData?.colorReveal]);

  // Reset color visibility when colorReveal is cleared (new round)
  usePresentationEffect(() => {
    if (!gameData?.colorReveal) {
      setFirstColorVisible(false);
      setSecondColorVisible(false);
      prevFirstColor.current = null;
      prevSecondColor.current = null;
    }
  }, [gameData?.colorReveal]);

  // Suspect result animation
  usePresentationEffect(() => {
    if (!gameData) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = gameData.phase;
    prevSuspectRef.current = gameData.suspectResult ?? null;

    if (!prev) return;

    if (prev === 'suspectFirst' && gameData.suspectResult?.firstSuspected === true) {
      const success = gameData.suspectResult.firstSuccess === true;
      setSuspectAnim({ player: 'first', success });
      const t = setTimeout(() => setSuspectAnim(null), success ? 1500 : 1200);
      return () => clearTimeout(t);
    }

    if (prev === 'suspectSecond' && gameData.suspectResult?.secondSuspected === true) {
      const success = gameData.suspectResult.secondSuccess === true;
      setSuspectAnim({ player: 'second', success });
      const t = setTimeout(() => setSuspectAnim(null), success ? 1500 : 1200);
      return () => clearTimeout(t);
    }
  }, [gameData?.phase, gameData?.suspectResult]);

  // Round transition overlay
  usePresentationEffect(() => {
    if (!gameData) return;
    const prevRound = prevRoundRef.current;
    prevRoundRef.current = gameData.round;
    prevFirstIdRef.current = gameData.firstPlayerId;

    if (prevRound === null) return;

    if (gameData.round > prevRound) {
      const firstNick = gameData.players[gameData.firstPlayerId]?.nickname ?? '선플';
      setRoundOverlay({ round: gameData.round, firstNick });
      const t = setTimeout(() => setRoundOverlay(null), 1600);
      return () => clearTimeout(t);
    }
  }, [gameData?.round]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];

  const isFirst = myPlayer?.isFirst ?? false;
  const fp = playerEntries.find(([, p]) => p.isFirst)?.[1];
  const sp = playerEntries.find(([, p]) => !p.isFirst)?.[1];

  const opponentCurrentColor =
    gameData.phase === 'suspectFirst' || gameData.phase === 'suspectSecond'
      ? ((isFirst
          ? gameData.colorReveal?.secondPlayerColor
          : gameData.colorReveal?.firstPlayerColor) ?? null)
      : null;

  const showTracker =
    !isSpectator &&
    ['tileSubmit', 'tileRespond', 'suspectFirst', 'suspectSecond'].includes(gameData.phase);

  return (
    <>
      <GameReferenceFrame
        className={isInkWash ? 'skin-ink-wash-field' : undefined}
        historyAboveStage
        reference={
          <MultipleBnwSidePanel
            gameData={gameData}
            myId={myId}
            showTracker={showTracker}
            opponentTileNotes={opponentTileNotes}
            onTrackerToggle={handleTrackerToggle}
            opponentCurrentColor={opponentCurrentColor}
            inkWash={isInkWash}
          />
        }
      >
        <div
          data-choosing-tile={gameData.phase === 'tileSubmit' || gameData.phase === 'tileRespond'}
          className={`${styles.stage} mbnw-stage flex h-full w-full max-w-lg flex-col justify-center overflow-hidden`}
        >
          {isInkWash && <InkWashFieldFx />}
          <div className="mbnw-stage-content w-full max-w-lg space-y-3">
            {/* Color reveal badges */}
            {gameData.colorReveal && (
              <div className="mbnw-panel mbnw-color-reveal flex items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-3">
                {/* First player color */}
                {gameData.colorReveal.firstPlayerColor && (
                  <div
                    className={`flex flex-col items-center gap-1 transition-all duration-350 ${
                      firstColorVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                    }`}
                  >
                    <span className="text-[11px] text-gray-400">선플</span>
                    <ColorBadge
                      color={gameData.colorReveal.firstPlayerColor}
                      pulse={firstColorVisible}
                    />
                  </div>
                )}

                {gameData.colorReveal.firstPlayerColor &&
                  gameData.colorReveal.secondPlayerColor && (
                    <span className="text-gray-300">vs</span>
                  )}

                {/* Second player color */}
                {gameData.colorReveal.secondPlayerColor && (
                  <div
                    className={`flex flex-col items-center gap-1 transition-all duration-350 ${
                      secondColorVisible ? 'scale-100 opacity-100' : 'scale-75 opacity-0'
                    }`}
                  >
                    <span className="text-[11px] text-gray-400">후플</span>
                    <ColorBadge
                      color={gameData.colorReveal.secondPlayerColor}
                      pulse={secondColorVisible}
                    />
                  </div>
                )}

                {/* Waiting for second if only first revealed */}
                {gameData.colorReveal.firstPlayerColor &&
                  !gameData.colorReveal.secondPlayerColor && <WaitingDots />}
              </div>
            )}

            {/* Spectator overlay */}
            {isSpectator &&
              ['tileSubmit', 'tileRespond', 'suspectFirst', 'suspectSecond'].includes(
                gameData.phase,
              ) && (
                <div className="mbnw-panel mbnw-waiting-card flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-6 text-sm text-gray-400">
                  <WaitingDots />
                  <span className="ml-1">플레이어들이 선택 중...</span>
                </div>
              )}

            {/* tileSubmit: first player selects tile */}
            {!isSpectator && gameData.phase === 'tileSubmit' && (
              <>
                {isFirst && myPlayer ? (
                  <TileSelector
                    remainingTiles={myPlayer.remainingTiles as MBNWTile[]}
                    actionType="submitTile"
                  />
                ) : (
                  <WaitingCard
                    text={`${josa(fp?.nickname ?? '선플', '이/가')} 타일을 선택 중...`}
                  />
                )}
              </>
            )}

            {/* tileRespond: second player selects tile */}
            {!isSpectator && gameData.phase === 'tileRespond' && (
              <>
                {!isFirst && myPlayer ? (
                  <TileSelector
                    remainingTiles={myPlayer.remainingTiles as MBNWTile[]}
                    actionType="respondTile"
                    firstColor={gameData.colorReveal?.firstPlayerColor}
                  />
                ) : (
                  <WaitingCard text={`${josa(sp?.nickname ?? '후플', '이/가')} 응답 중...`} />
                )}
              </>
            )}

            {/* suspectFirst: first player decides */}
            {!isSpectator && gameData.phase === 'suspectFirst' && (
              <>
                {isFirst && myPlayer ? (
                  <SuspectPanel
                    actionType="suspectFirst"
                    myTile={gameData.myTile}
                    opponentColor={gameData.colorReveal?.secondPlayerColor ?? null}
                    trackedUsedTiles={trackedOpponentUsed}
                  />
                ) : (
                  <WaitingCard
                    text={`${josa(fp?.nickname ?? '선플', '이/가')} 배수의심 여부를 결정 중...`}
                  />
                )}
              </>
            )}

            {/* suspectSecond: second player decides */}
            {!isSpectator && gameData.phase === 'suspectSecond' && (
              <>
                {!isFirst && myPlayer ? (
                  <SuspectPanel
                    actionType="suspectSecond"
                    myTile={gameData.myTile}
                    opponentColor={gameData.colorReveal?.firstPlayerColor ?? null}
                    trackedUsedTiles={trackedOpponentUsed}
                    firstSuspectFailed={
                      gameData.suspectResult?.firstSuspected === true &&
                      gameData.suspectResult?.firstSuccess === false
                    }
                  />
                ) : (
                  <WaitingCard
                    text={`${josa(sp?.nickname ?? '후플', '이/가')} 배수의심 여부를 결정 중...`}
                    extra={
                      gameData.suspectResult?.firstSuspected === true &&
                      gameData.suspectResult?.firstSuccess === false
                        ? '선플 배수의심 실패'
                        : undefined
                    }
                  />
                )}
              </>
            )}

            {/* result / finished */}
            {(gameData.phase === 'result' || gameData.phase === 'finished') &&
              gameData.resultData && (
                <ResultPanel
                  resultData={gameData.resultData}
                  players={gameData.players}
                  round={gameData.round}
                  winner={gameData.winner}
                  winType={gameData.winType}
                  myId={myId}
                />
              )}
          </div>
        </div>
      </GameReferenceFrame>

      {/* Suspect animation overlay */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          suspectAnim ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {suspectAnim && (
          <div
            className={`mbnw-suspect-overlay ${isInkWash ? 'mbnw-suspect-overlay--ink-wash' : ''} flex flex-col items-center gap-3 rounded-2xl px-10 py-6 text-center shadow-2xl transition-transform duration-300 ${
              suspectAnim ? 'scale-100' : 'scale-75'
            } ${
              suspectAnim.success
                ? 'border border-violet-400/30 bg-violet-900/95 text-white'
                : 'border border-red-400/30 bg-red-900/95 text-white'
            }`}
          >
            <p className="text-xl font-bold">
              {suspectAnim.success ? '배수의심 성공!' : '배수의심 실패!'}
            </p>
            <p className="text-sm opacity-75">
              {suspectAnim.success
                ? `${suspectAnim.player === 'first' ? '선플' : '후플'} +1점`
                : `${suspectAnim.player === 'first' ? '후플' : '선플'} 보너스 +1점`}
            </p>
          </div>
        )}
      </div>

      {/* Round transition overlay */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          roundOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {roundOverlay && (
          <div
            className={`mbnw-round-overlay flex flex-col items-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-900/90 px-10 py-6 text-center text-white shadow-2xl backdrop-blur-sm ${isInkWash ? 'mbnw-round-overlay--ink-wash' : ''}`}
          >
            <p className="text-2xl font-bold">라운드 {roundOverlay.round} 시작</p>
            <p className="text-sm text-indigo-300">{roundOverlay.firstNick} 선플</p>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(MultipleBnwView);
