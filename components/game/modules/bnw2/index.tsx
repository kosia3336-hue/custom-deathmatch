'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { toast } from 'sonner';
import type { BNW2GameData, BNW2RevealData, BNW2PlayerInfo } from '@/shared/types/bnw2';
import { getSkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import PointTrack from './PointTrack';
import PointInput from './PointInput';
import ShowdownPointTrack from './skins/ShowdownPointTrack';
import ShowdownPointInput from './skins/ShowdownPointInput';
import ShowdownColorBanner from './skins/ShowdownColorBanner';
import ShowdownRevealPanel from './skins/ShowdownRevealPanel';
import { playShowdownSubmitSfx } from './skins/showdownSfx';
import { GameFrame } from '@/components/game/GameFrame';
import Modal from '@/components/ui/Modal';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '10점 달성',
  exhaustion: '포인트 소진',
  draw: '무승부',
  timeout: '시간 초과',
  leave: '기권',
};

function WaitingDots() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:0ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:150ms]" />
      <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-gray-400 [animation-delay:300ms]" />
    </span>
  );
}

function WaitingCard({ text }: { text: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 p-6">
      <WaitingDots />
      <p className="text-sm text-gray-500">{text}</p>
    </div>
  );
}

function ColorBadge({ color, visible }: { color: 'black' | 'white'; visible: boolean }) {
  return (
    <span
      className={`inline-flex h-10 items-center rounded-lg px-5 text-base font-bold transition-all duration-500 ${
        visible ? 'scale-100 opacity-100' : 'scale-50 opacity-0'
      } ${
        color === 'black'
          ? 'bg-slate-800 text-slate-100'
          : 'border border-gray-300 bg-white text-slate-800'
      }`}
      style={{ animation: visible ? 'bnw2PopIn 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards' : 'none' }}
    >
      {color === 'black' ? '■ 흑' : '□ 백'}
    </span>
  );
}

function ColorRevealBanner({ color, firstNick, stageBefore, stageAfter }: {
  color: 'black' | 'white';
  firstNick: string;
  stageBefore?: number | null;
  stageAfter?: number | null;
}) {
  const stagesConsumed = (stageBefore != null && stageAfter != null) ? stageBefore - Math.max(stageAfter, 1) : null;
  return (
    <div
      className="flex items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-3"
      style={{
        animation: 'bnw2ColorReveal 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards',
        animationDelay: '200ms',
        opacity: 0,
      }}
    >
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-gray-500">{firstNick}의 색</span>
        {stageBefore != null && stageAfter != null && (
          <span className="text-xs font-medium text-indigo-500">
            {stagesConsumed != null && stagesConsumed > 0
              ? `불이 ${stagesConsumed}칸 꺼집니다.`
              : '불이 꺼지지 않습니다.'}
          </span>
        )}
      </div>
      <ColorBadge color={color} visible />
    </div>
  );
}

/** 상대 잔여 포인트 개인 추리 트래커 (클라이언트 전용 메모) */
function OpponentPointTracker({
  opponentStage,
  estimate,
  setEstimate,
}: {
  opponentStage: number;
  estimate: number;
  setEstimate: React.Dispatch<React.SetStateAction<number>>;
}) {
  const lo = opponentStage === 0 ? 0 : (opponentStage - 1) * 20 + 1;
  const hi = opponentStage * 20;

  const clamp = (v: number) => Math.min(hi, Math.max(lo, v));

  return (
    <div className="flex flex-col gap-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs font-semibold text-gray-500">상대 잔여 추리</p>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setEstimate(v => clamp(v - 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >
          −
        </button>
        <span className="flex-1 text-center text-xl font-bold text-gray-800 tabular-nums">
          {estimate}p
        </span>
        <button
          onClick={() => setEstimate(v => clamp(v + 1))}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-gray-300 bg-white text-lg font-bold text-gray-600 hover:bg-gray-50 active:bg-gray-100"
        >
          +
        </button>
      </div>
    </div>
  );
}

function RevealPanel({
  revealData,
  players,
  myId,
  firstPlayerId,
  step,
}: {
  revealData: BNW2RevealData;
  players: Record<string, BNW2PlayerInfo>;
  myId: string;
  firstPlayerId: string;
  step: number;
}) {
  const entries = Object.entries(revealData.players);
  const winnerId = revealData.winnerId;
  const firstEntry = entries.find(([id]) => id === firstPlayerId);
  const secondEntry = entries.find(([id]) => id !== firstPlayerId);
  const ordered = [firstEntry, secondEntry].filter(Boolean) as [string, typeof revealData.players[string]][];

  return (
    <div className="space-y-3 rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-center text-sm font-semibold text-gray-700">라운드 결과</p>

      <div className="grid grid-cols-2 gap-3">
        {ordered.map(([pid, pd], idx) => {
          const pInfo = players[pid];
          const isMe = pid === myId;
          const isFirst = pid === firstPlayerId;
          const isWinner = pid === winnerId;
          const colorVisible = idx === 0 ? step >= 1 : step >= 2;
          const winnerVisible = step >= 3;
          const scoreVisible = step >= 4;

          return (
            <div
              key={pid}
              className={`rounded-xl border p-3 text-center transition-all duration-300 ${
                winnerVisible && isWinner
                  ? 'border-emerald-300 bg-emerald-50 shadow-[0_0_8px_rgba(52,211,153,0.2)]'
                  : winnerVisible && winnerId !== null
                  ? 'border-gray-200 bg-gray-50 opacity-60'
                  : winnerId === null && winnerVisible
                  ? 'border-amber-300 bg-amber-50'
                  : 'border-gray-200 bg-gray-50'
              }`}
            >
              <p className="truncate text-xs font-medium text-gray-500">
                {isMe ? '나' : (pInfo?.nickname ?? pid)}
              </p>
              <div className="my-2 flex justify-center">
                <ColorBadge color={pd.color} visible={colorVisible} />
              </div>
              {colorVisible && (
                <p className="text-xs font-medium text-indigo-500">
                  {pd.stageBefore - Math.max(pd.stageAfter, 1) > 0
                    ? `불이 ${pd.stageBefore - Math.max(pd.stageAfter, 1)}칸 꺼집니다.`
                    : '불이 꺼지지 않습니다.'}
                </p>
              )}
              {winnerVisible && pd.scoreChange > 0 && (
                <p className={`text-xs font-semibold text-emerald-600 ${scoreVisible ? 'animate-[floatUp_500ms_ease-out_forwards]' : ''}`}>
                  +{pd.scoreChange}점
                </p>
              )}
              {winnerVisible && (
                <p className="text-xs text-gray-400">
                  {pd.scoreBefore} → {pd.scoreAfter}점
                </p>
              )}
            </div>
          );
        })}
      </div>

      {step >= 3 && winnerId === null && (
        <p className="text-center text-sm font-semibold text-amber-500">무승부</p>
      )}
    </div>
  );
}

function RoundHistoryTable({
  history,
  players,
  myId,
}: {
  history: BNW2GameData['roundHistory'];
  players: BNW2GameData['players'];
  myId: string;
}) {
  if (history.length === 0) return null;
  return (
    <div className="space-y-0.5 text-xs">
      {history.map(r => {
        const entries = Object.entries(r.players);
        return (
          <div key={r.round} className="flex items-center gap-2 py-0.5">
            <span className="w-6 shrink-0 font-medium text-gray-400">R{r.round}</span>
            {entries.map(([pid, pd]) => {
              const isWinner = r.winnerId === pid;
              const isFirst = pid === r.firstPlayerId;
              return (
                <span key={pid} className="flex items-center gap-1 min-w-0">
                  <span
                    className={`shrink-0 rounded px-1 text-[10px] font-bold ${
                      pd.color === 'black'
                        ? 'bg-slate-800 text-slate-100'
                        : 'border border-gray-200 bg-white text-slate-700'
                    }`}
                  >
                    {pd.color === 'black' ? '흑' : '백'}
                  </span>
                  <span className="text-gray-500">{pid === myId ? '나' : (players[pid]?.nickname ?? '')}</span>
                  {isWinner && <span className="text-amber-500">+1</span>}
                </span>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/** 모바일 바텀시트 */
function BottomSheet({
  open,
  onClose,
  children,
}: {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-(--cdm-z-overlay) bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-(--cdm-z-modal) flex max-h-[80vh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        {/* drag handle */}
        <div className="flex shrink-0 justify-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
        </div>
        {/* 내용 (스크롤 가능) */}
        <div
          className="overflow-y-auto px-4 py-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

export default function BNW2Game() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as BNW2GameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();

  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.BNW2);
  const isShowdown = skin === 'showdown';

  const shownEndRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevPhaseSfxRef = useRef<string | null>(null);
  const [roundOverlay, setRoundOverlay] = useState<{ round: number; firstNick: string } | null>(null);
  const [revealStep, setRevealStep] = useState(0);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [opponentEstimate, setOpponentEstimate] = useState<number>(200);

  // Winner/draw toast
  useEffect(() => {
    if (!gameData?.winType) return;
    const key = gameData.winner ?? 'draw';
    if (shownEndRef.current === key) return;
    shownEndRef.current = key;

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

  // Round transition overlay
  useEffect(() => {
    if (!gameData) return;
    const prevRound = prevRoundRef.current;
    prevRoundRef.current = gameData.round;
    if (prevRound === null) return;
    if (gameData.round > prevRound) {
      const firstNick = gameData.players[gameData.firstPlayerId]?.nickname ?? '선플';
      const show = setTimeout(() => {
        setRoundOverlay({ round: gameData.round, firstNick });
      }, 0);
      const hide = setTimeout(() => setRoundOverlay(null), 1600);
      return () => {
        clearTimeout(show);
        clearTimeout(hide);
      };
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.round]);

  // Sequential reveal animation
  useEffect(() => {
    const phase = gameData?.phase;
    if (phase === undefined) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    if (phase === 'reveal' && prev !== 'reveal') {
      const t0 = setTimeout(() => setRevealStep(0), 0);
      const t1 = setTimeout(() => setRevealStep(1), 800);
      const t2 = setTimeout(() => setRevealStep(2), 2000);
      const t3 = setTimeout(() => setRevealStep(3), 3200);
      const t4 = setTimeout(() => setRevealStep(4), 4000);
      return () => {
        clearTimeout(t0);
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
        clearTimeout(t4);
      };
    }
  }, [gameData?.phase]);

  // 서부 스킨: 누군가 포인트를 제시(발사)해 페이즈가 넘어가면 총성 재생.
  // 내 발사는 ShowdownPointInput이 즉시 재생하므로, 여기선 상대/관전자 케이스만 울린다.
  useEffect(() => {
    if (!isShowdown) return;
    const phase = gameData?.phase;
    if (!phase) return;
    const prev = prevPhaseSfxRef.current;
    prevPhaseSfxRef.current = phase;
    if (prev === null) return;
    const firstShot = prev === 'firstSubmit' && phase === 'secondSubmit';
    const secondShot = prev === 'secondSubmit' && phase === 'reveal';
    if (!firstShot && !secondShot) return;
    const iAmFirst = !!gameData && myId === gameData.firstPlayerId;
    const iShot = !isSpectator && ((firstShot && iAmFirst) || (secondShot && !iAmFirst));
    if (iShot) return;
    playShowdownSubmitSfx();
  }, [gameData?.phase, isShowdown, isSpectator, myId, gameData?.firstPlayerId]);

  // 상대 stage 변경 시 추리 estimate를 구간 상한으로 리셋
  const opponentStageForEffect = (() => {
    if (!gameData) return null;
    const playerEntries = Object.entries(gameData.players);
    const oppEntry = playerEntries.find(([id]) => id !== myId);
    return oppEntry?.[1]?.stage ?? null;
  })();
  useEffect(() => {
    if (opponentStageForEffect === null) return;
    setOpponentEstimate(opponentStageForEffect * 20);
  }, [opponentStageForEffect]);

  // 내 차례가 되면 바텀시트 자동 열기 (모바일)
  useEffect(() => {
    if (!gameData || isSpectator) return;
    const isMyTurn =
      (gameData.phase === 'firstSubmit' && myId === gameData.firstPlayerId) ||
      (gameData.phase === 'secondSubmit' && myId !== gameData.firstPlayerId);
    const tid = setTimeout(() => setSheetOpen(isMyTurn), 0);
    return () => clearTimeout(tid);
  }, [gameData, myId, isSpectator]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];
  const opponentEntry = playerEntries.find(([id]) => id !== myId);
  const opponentPlayer = opponentEntry?.[1];

  const isFirst = myId === gameData.firstPlayerId;
  const fp = gameData.players[gameData.firstPlayerId];
  const secondId = playerEntries.find(([id]) => id !== gameData.firstPlayerId)?.[0];
  const sp = secondId ? gameData.players[secondId] : undefined;

  const leftPlayer = !isSpectator && myPlayer ? myPlayer : playerEntries[0]?.[1];
  const rightPlayer = !isSpectator && opponentPlayer ? opponentPlayer : playerEntries[1]?.[1];
  const leftLabel = !isSpectator ? '나' : (playerEntries[0]?.[1]?.nickname ?? '');
  const rightLabel = !isSpectator ? (opponentPlayer?.nickname ?? '상대') : (playerEntries[1]?.[1]?.nickname ?? '');

  const isMyTurn =
    !isSpectator &&
    ((gameData.phase === 'firstSubmit' && isFirst) ||
     (gameData.phase === 'secondSubmit' && !isFirst));
  const isReveal = gameData.phase === 'reveal' || gameData.phase === 'finished';
  const inPlay = gameData.phase === 'firstSubmit' || gameData.phase === 'secondSubmit';

  // firstSubmit·secondSubmit 동안 비관전자에게 상대 잔여 추리 트래커 표시 (상대 단계는 항상 공개)
  const showTracker = !isSpectator && inPlay;

  // 서부 스킨 컴포넌트는 기본 컴포넌트와 props가 동일하므로 그대로 스왑한다.
  const TrackCmp = isShowdown ? ShowdownPointTrack : PointTrack;
  const InputCmp = isShowdown ? ShowdownPointInput : PointInput;
  const ColorBannerCmp = isShowdown ? ShowdownColorBanner : ColorRevealBanner;
  const RevealPanelCmp = isShowdown ? ShowdownRevealPanel : RevealPanel;

  const inputContent = isMyTurn ? (
    <div className="space-y-3">
      {/* 모바일 바텀시트 내 색 공개 배너 (후플 차례에만) */}
      {!isFirst && gameData.firstPlayerColor && (
        <div className="lg:hidden">
          <ColorBannerCmp
            color={gameData.firstPlayerColor}
            firstNick={fp?.nickname ?? '선플'}
            stageBefore={gameData.prevFirstStage}
            stageAfter={fp?.stage}
          />
        </div>
      )}
      {/* 모바일 바텀시트 내 추리 트래커 */}
      {showTracker && opponentPlayer && (
        <div className="lg:hidden">
          <OpponentPointTracker
            opponentStage={opponentPlayer.stage}
            estimate={opponentEstimate}
            setEstimate={setOpponentEstimate}
          />
        </div>
      )}
      <InputCmp
        remaining={myPlayer?.remainingPoints ?? 0}
        actionType={isFirst ? 'submitFirst' : 'submitSecond'}
        label={isFirst ? '포인트를 제시하세요 (선플)' : '포인트를 제시하세요 (후플)'}
      />
    </div>
  ) : null;

  return (
    <>
      <style>{`
        @keyframes bnw2PopIn {
          0%   { transform: scale(0.5); opacity: 0; }
          70%  { transform: scale(1.1); }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes bnw2ColorReveal {
          0%   { transform: scale(0.85) translateY(-4px); opacity: 0; }
          70%  { transform: scale(1.03) translateY(0); }
          100% { transform: scale(1.0); opacity: 1; }
        }
        @keyframes floatUp {
          0%   { transform: translateY(0); opacity: 1; }
          60%  { transform: translateY(-24px); opacity: 1; }
          100% { transform: translateY(-32px); opacity: 0; }
        }
        @keyframes slideDown {
          from { transform: translateY(-6px); opacity: 0; }
          to   { transform: translateY(0); opacity: 1; }
        }
      `}</style>

      <GameFrame
        className={isShowdown ? 'skin-showdown-stage-content' : undefined}
        info={<div className="flex w-full flex-col gap-1">
            {/* Mobile score bar */}
            <div className="flex w-full max-w-sm justify-between gap-2 lg:hidden">
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
                    <span className="ml-1 shrink-0 font-bold tabular-nums">{p.score}점</span>
                  </div>
                );
              })}
            </div>

            {/* Round header */}
            <div className="text-center">
              <div className="text-xl font-bold text-gray-800">라운드 {gameData.round}</div>
              {fp && (
                <div className="mt-0.5 text-sm text-amber-600">
                  {fp.nickname} 선플
                </div>
              )}
            </div>

            {/* Status message */}
            <div className="text-center text-sm text-gray-500">{gameState?.message}</div>        </div>}
        controls={
          <div className="flex gap-1.5">
            {!isSpectator && isMyTurn && (
              <button
                onClick={() => setSheetOpen(true)}
                className={
                  isShowdown
                    ? 'skin-showdown-mobile-cta flex-1'
                    : 'flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg'
                }
              >
                포인트 제시하기 →
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
            <div className="space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">점수</p>
              {playerEntries.map(([id, p]) => (
                <div
                  key={id}
                  className={`flex items-center justify-between rounded-lg border px-3 py-2 text-sm ${
                    id === myId ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-white'
                  }`}
                >
                  <span className="min-w-0 truncate font-medium">
                    {id === myId ? '나' : p.nickname}
                    {id === gameData.firstPlayerId && (
                      <span className="ml-1 text-xs text-amber-500">선플</span>
                    )}
                  </span>
                  <span className="ml-2 shrink-0 font-bold tabular-nums">{p.score}점</span>
                </div>
              ))}
            </div>

            {gameData.roundHistory.length > 0 && (
              <div className="flex flex-1 flex-col overflow-hidden">
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-400">
                  라운드 기록
                </p>
                <div className="flex-1 overflow-y-auto">
                  <RoundHistoryTable
                    history={gameData.roundHistory}
                    players={gameData.players}
                    myId={myId}
                  />
                </div>
              </div>
            )}
          </div>
        }
      >
        <div className="flex h-full w-full max-w-sm flex-col items-center justify-center gap-2 overflow-hidden">
            {/* Center track */}
            <div className="w-full max-w-sm">
              {leftPlayer && rightPlayer && (
                <TrackCmp
                  leftPlayer={leftPlayer}
                  rightPlayer={rightPlayer}
                  leftLabel={leftLabel}
                  rightLabel={rightLabel}
                />
              )}
            </div>

            {/* 선플 색 공개 배너 */}
            {gameData.phase === 'secondSubmit' && gameData.firstPlayerColor && (
              <div className="w-full max-w-sm">
                <ColorBannerCmp
                  color={gameData.firstPlayerColor}
                  firstNick={fp?.nickname ?? '선플'}
                  stageBefore={gameData.prevFirstStage}
                  stageAfter={fp?.stage}
                />
              </div>
            )}

            {/* 상대 잔여 추리 트래커: 내 차례가 아닐 때만 모바일 메인에 표시 (내 차례는 바텀시트) */}
            {showTracker && opponentPlayer && !isMyTurn && (
              <div className="w-full max-w-sm lg:hidden">
                <OpponentPointTracker
                  opponentStage={opponentPlayer.stage}
                  estimate={opponentEstimate}
                  setEstimate={setOpponentEstimate}
                />
              </div>
            )}

            {/* 상대 잔여 추리 트래커: 데스크탑은 트랙 아래 독립 카드 */}
            {showTracker && opponentPlayer && (
              <div className="hidden w-full max-w-sm lg:block">
                <OpponentPointTracker
                  opponentStage={opponentPlayer.stage}
                  estimate={opponentEstimate}
                  setEstimate={setOpponentEstimate}
                />
              </div>
            )}

            {/* Desktop phase UI */}
            <div className="hidden w-full max-w-sm lg:block">
              {isSpectator && inPlay ? (
                <WaitingCard text="플레이어들이 포인트를 제시 중..." />
              ) : isReveal && gameData.revealData ? (
                <RevealPanelCmp
                  revealData={gameData.revealData}
                  players={gameData.players}
                  myId={myId}
                  firstPlayerId={gameData.firstPlayerId}
                  step={revealStep}
                />
              ) : isMyTurn ? (
                inputContent
              ) : inPlay ? (
                <WaitingCard
                  text={
                    gameData.phase === 'firstSubmit'
                      ? `${fp?.nickname ?? '선플'}이 포인트를 제시 중...`
                      : `${sp?.nickname ?? '후플'}이 포인트를 제시 중...`
                  }
                />
              ) : null}
            </div>

            {/* Mobile reveal panel */}
            {isReveal && gameData.revealData && (
              <div className="w-full max-w-sm lg:hidden">
                <RevealPanelCmp
                  revealData={gameData.revealData}
                  players={gameData.players}
                  myId={myId}
                  firstPlayerId={gameData.firstPlayerId}
                  step={revealStep}
                />
              </div>
            )}

            {/* Mobile waiting card (상대 차례) */}
            {!isMyTurn && !isReveal && inPlay && !isSpectator && (
              <div className="w-full max-w-sm lg:hidden">
                <WaitingCard
                  text={
                    gameData.phase === 'firstSubmit'
                      ? `${fp?.nickname ?? '선플'}이 포인트를 제시 중...`
                      : `${sp?.nickname ?? '후플'}이 포인트를 제시 중...`
                  }
                />
              </div>
            )}

            {/* Mobile spectator waiting */}
            {isSpectator && inPlay && (
              <div className="w-full max-w-sm lg:hidden">
                <WaitingCard text="플레이어들이 포인트를 제시 중..." />
              </div>
            )}
        </div>
      </GameFrame>

      <Modal open={historyOpen} onClose={() => setHistoryOpen(false)} title="라운드 기록">
        <RoundHistoryTable
          history={gameData.roundHistory}
          players={gameData.players}
          myId={myId}
        />
      </Modal>

      {/* ── Mobile bottom sheet (내 차례) ── */}
      {!isSpectator && (
        <>
          {/* 제시 단추는 조작 칸으로 옮겼다. 화면에 떠 있으면 방 바닥글을 가린다. */}
          <BottomSheet open={sheetOpen && isMyTurn} onClose={() => setSheetOpen(false)}>
            {inputContent}
          </BottomSheet>
        </>
      )}

      {/* ── Round transition overlay ── */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          roundOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {roundOverlay && (
          <div
            className={`flex flex-col items-center gap-2 rounded-2xl border px-10 py-6 text-center text-white shadow-2xl backdrop-blur-sm ${
              isShowdown ? 'border-amber-400/30 bg-amber-950/90' : 'border-indigo-400/30 bg-indigo-900/90'
            }`}
          >
            <p className="text-2xl font-bold">라운드 {roundOverlay.round} 시작</p>
            <p className={`text-sm ${isShowdown ? 'text-amber-300' : 'text-indigo-300'}`}>{roundOverlay.firstNick} 선플</p>
          </div>
        )}
      </div>
    </>
  );
}
