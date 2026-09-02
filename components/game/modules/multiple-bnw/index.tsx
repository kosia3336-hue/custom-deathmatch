'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { MultipleBnwGameData, MBNWTile, MBNWSuspectResult } from '@/shared/types/multiple-bnw';
import { MBNW_TOTAL_ROUNDS } from '@/shared/types/multiple-bnw';
import TileSelector from './TileSelector';
import SuspectPanel from './SuspectPanel';
import ResultPanel from './ResultPanel';
import InfoPanel from './InfoPanel';
import OpponentTileTracker from './OpponentTileTracker';
import { WIN_TYPE_LABELS } from './constants';
import Modal from '@/components/ui/Modal';
import { GameFrame } from '@/components/game/GameFrame';

interface SuspectAnim {
  player: 'first' | 'second';
  success: boolean;
}

export default function MultipleBnwGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as MultipleBnwGameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();

  // Opponent tile manual tracker (client-side only)
  const [trackedOpponentUsed, setTrackedOpponentUsed] = useState<MBNWTile[]>([]);
  const [trackerOpen, setTrackerOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const handleTrackerToggle = (tile: MBNWTile) => {
    setTrackedOpponentUsed(prev =>
      prev.includes(tile) ? prev.filter(t => t !== tile) : [...prev, tile],
    );
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
  const [roundOverlay, setRoundOverlay] = useState<{ round: number; firstNick: string } | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const prevFirstIdRef = useRef<string | null>(null);

  // Winner/draw toast
  const shownWinnerRef = useRef<string | null>(null);

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
  useEffect(() => {
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
  useEffect(() => {
    if (!gameData?.colorReveal) {
      setFirstColorVisible(false);
      setSecondColorVisible(false);
      prevFirstColor.current = null;
      prevSecondColor.current = null;
    }
  }, [gameData?.colorReveal]);

  // Suspect result animation
  useEffect(() => {
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
  useEffect(() => {
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
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];
  const opponent = playerEntries.find(([id]) => id !== myId)?.[1];

  const isFirst = myPlayer?.isFirst ?? false;
  const fp = playerEntries.find(([, p]) => p.isFirst)?.[1];
  const sp = playerEntries.find(([, p]) => !p.isFirst)?.[1];

  const opponentId = playerEntries.find(([id]) => id !== myId)?.[0];
  const opponentCurrentColor = gameData.phase === 'suspectFirst' || gameData.phase === 'suspectSecond'
    ? (isFirst ? gameData.colorReveal?.secondPlayerColor : gameData.colorReveal?.firstPlayerColor) ?? null
    : null;

  const showTracker = !isSpectator && ['tileSubmit', 'tileRespond', 'suspectFirst', 'suspectSecond'].includes(gameData.phase);

  return (
    <>
      <GameFrame
        info={<div className="flex w-full flex-col gap-1">
            {/* Mobile: compact score bar */}
            <div className="flex w-full justify-between gap-2">
              {playerEntries.map(([id, p]) => {
                const isMe = id === myId;
                return (
                  <div
                    key={id}
                    className={`flex flex-1 items-center justify-between rounded-lg border px-3 py-1.5 text-xs ${
                      isMe ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
                    }`}
                  >
                    <span className={`truncate font-medium ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
                      {isMe ? '나' : p.nickname}
                    </span>
                    <span className="ml-1 shrink-0 tabular-nums font-bold text-gray-700">
                      {p.score}점
                    </span>
                  </div>
                );
              })}
            </div>

            {/* Round header */}
            <div className="text-center text-xl font-bold text-gray-800 sm:text-2xl">
              라운드 {gameData.round} / {MBNW_TOTAL_ROUNDS}
              {fp && (
                <span className="ml-2 text-sm font-normal text-amber-600">
                  {fp.nickname} 선플
                </span>
              )}
            </div>

            {/* Status message */}
            <div className="text-center text-sm text-gray-500">
              {gameState?.message}
            </div>
        </div>}
        controls={
          /*
            타일 선택 패널이 이 게임의 본체라 무대에 두고, 아래에는 참고용
            도구만 단추로 남긴다. 추리판·기록을 모두 아래에 깔면 640px 화면에서
            무대가 눌려 선택 패널이 잘린다.
          */
          <div className="flex gap-1.5">
            {showTracker && (
              <button
                type="button"
                onClick={() => setTrackerOpen(true)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-600 lg:hidden"
              >
                상대 타일 추리
              </button>
            )}
            {gameData.roundHistory.length > 0 && (
              <button
                type="button"
                onClick={() => setHistoryOpen(true)}
                className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-xs font-bold text-gray-600 lg:hidden"
              >
                라운드 기록 ({gameData.roundHistory.length})
              </button>
            )}
          </div>
        }
        aside={
          <div className="flex h-full flex-col gap-3 border-l border-gray-200 p-4">
            {showTracker && (
              <OpponentTileTracker
                markedTiles={trackedOpponentUsed}
                onToggle={handleTrackerToggle}
                opponentCurrentColor={opponentCurrentColor}
              />
            )}
            <InfoPanel
              round={gameData.round}
              players={gameData.players}
              roundHistory={gameData.roundHistory}
              myId={myId}
            />
          </div>
        }
      >
        <div className="flex h-full w-full max-w-lg flex-col justify-center overflow-hidden">
            <div className="w-full max-w-lg space-y-3">

              {/* Color reveal badges */}
              {gameData.colorReveal && (
                <div className="flex items-center justify-center gap-4 rounded-xl border border-gray-200 bg-white p-3">
                  {/* First player color */}
                  {gameData.colorReveal.firstPlayerColor && (
                    <div className={`flex flex-col items-center gap-1 transition-all duration-350 ${
                      firstColorVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}>
                      <span className="text-[10px] text-gray-400">선플</span>
                      <ColorBadge color={gameData.colorReveal.firstPlayerColor} pulse={firstColorVisible} />
                    </div>
                  )}

                  {gameData.colorReveal.firstPlayerColor && gameData.colorReveal.secondPlayerColor && (
                    <span className="text-gray-300">vs</span>
                  )}

                  {/* Second player color */}
                  {gameData.colorReveal.secondPlayerColor && (
                    <div className={`flex flex-col items-center gap-1 transition-all duration-350 ${
                      secondColorVisible ? 'opacity-100 scale-100' : 'opacity-0 scale-75'
                    }`}>
                      <span className="text-[10px] text-gray-400">후플</span>
                      <ColorBadge color={gameData.colorReveal.secondPlayerColor} pulse={secondColorVisible} />
                    </div>
                  )}

                  {/* Waiting for second if only first revealed */}
                  {gameData.colorReveal.firstPlayerColor && !gameData.colorReveal.secondPlayerColor && (
                    <WaitingDots />
                  )}
                </div>
              )}

              {/* Spectator overlay */}
              {isSpectator && ['tileSubmit', 'tileRespond', 'suspectFirst', 'suspectSecond'].includes(gameData.phase) && (
                <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-6 text-sm text-gray-400">
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
                    <WaitingCard text={`${fp?.nickname ?? '선플'}이 타일을 선택 중...`} />
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
                    <WaitingCard text={`${sp?.nickname ?? '후플'}이 응답 중...`} />
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
                    <WaitingCard text={`${fp?.nickname ?? '선플'}이 배수의심 여부를 결정 중...`} />
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
                      text={`${sp?.nickname ?? '후플'}이 배수의심 여부를 결정 중...`}
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
              {(gameData.phase === 'result' || gameData.phase === 'finished') && gameData.resultData && (
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
      </GameFrame>

      <Modal open={trackerOpen} onClose={() => setTrackerOpen(false)} title="상대 타일 추리">
        {/* Opponent tile tracker */}
        {showTracker && (
          <OpponentTileTracker
            markedTiles={trackedOpponentUsed}
            onToggle={handleTrackerToggle}
            opponentCurrentColor={opponentCurrentColor}
          />
        )}      </Modal>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="라운드 기록">
        <MobileRoundHistory
          history={gameData.roundHistory}
          players={gameData.players}
          myId={myId}
        />
      </Modal>

      {/* Suspect animation overlay */}
      <div className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
        suspectAnim ? 'opacity-100' : 'opacity-0'
      }`}>
        {suspectAnim && (
          <div className={`flex flex-col items-center gap-3 rounded-2xl px-10 py-6 text-center shadow-2xl transition-transform duration-300 ${
            suspectAnim ? 'scale-100' : 'scale-75'
          } ${
            suspectAnim.success
              ? 'bg-violet-900/95 text-white border border-violet-400/30'
              : 'bg-red-900/95 text-white border border-red-400/30'
          }`}>
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
      <div className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
        roundOverlay ? 'opacity-100' : 'opacity-0'
      }`}>
        {roundOverlay && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-900/90 px-10 py-6 text-center text-white shadow-2xl backdrop-blur-sm">
            <p className="text-2xl font-bold">라운드 {roundOverlay.round} 시작</p>
            <p className="text-sm text-indigo-300">{roundOverlay.firstNick} 선플</p>
          </div>
        )}
      </div>
    </>
  );
}

function ColorBadge({ color, pulse }: { color: 'white' | 'black'; pulse?: boolean }) {
  return (
    <span className={`inline-flex h-10 items-center rounded-lg px-4 text-base font-semibold transition-all duration-200 ${
      pulse ? 'ring-2 ring-offset-1 ring-current' : ''
    } ${
      color === 'black'
        ? 'bg-slate-800 text-slate-100 ring-slate-500'
        : 'border border-gray-300 bg-white text-slate-700 ring-gray-400'
    }`}>
      {color === 'black' ? '흑색' : '백색'}
    </span>
  );
}

function WaitingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </span>
  );
}

function WaitingCard({ text, extra }: { text: string; extra?: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-8">
      <WaitingDots />
      <p className="text-sm text-gray-500">{text}</p>
      {extra && (
        <p className="rounded bg-red-50 px-2 py-1 text-xs text-red-600">{extra}</p>
      )}
    </div>
  );
}

function MobileRoundHistory({ history, players, myId }: {
  history: MultipleBnwGameData['roundHistory'];
  players: MultipleBnwGameData['players'];
  myId: string;
}) {
  return (
    <div className="space-y-1 text-xs">
      {history.map(r => {
        const entries = Object.entries(r.players);
        return (
          <div key={r.round} className="flex gap-2">
            <span className="font-medium text-gray-500">R{r.round}</span>
            {entries.map(([pid, pr]) => (
              <span key={pid} className="flex items-center gap-1">
                <span className={`rounded px-1 text-[10px] font-bold ${
                  pr.color === 'black' ? 'bg-slate-800 text-slate-100' : 'border border-gray-200 bg-white text-slate-700'
                }`}>
                  {pr.color === 'black' ? '흑' : '백'}
                </span>
                <span className="text-gray-500">{pid === myId ? '나' : (players[pid]?.nickname ?? '')}</span>
                {' '}
                <span className={pr.bonusPoint + pr.normalPoint > 0 ? 'text-blue-600' : 'text-gray-400'}>
                  +{pr.bonusPoint + pr.normalPoint}
                </span>
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}
