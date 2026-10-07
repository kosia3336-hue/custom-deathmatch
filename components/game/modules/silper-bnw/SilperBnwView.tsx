'use client';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameHud } from '@/hooks/useGameHud';
import { seatStage, turnStage } from '@/lib/gameSeat';
import { type SkinTheme } from '@/lib/skins/registry';
import { josa } from '@/shared/lib/josa';
import type { SBNWGameData } from '@/shared/types/silper-bnw';
import { SBNW_TOTAL_ROUNDS } from '@/shared/types/silper-bnw';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BottomSheet } from './BottomSheet';
import { DigitHintPanel } from './DigitHintPanel';
import { WIN_TYPE_LABELS } from './presentation';
import { RevealPanel } from './RevealPanel';
import { SilperSidePanel } from './SilperSidePanel';
import MeowFieldFx from './skins/MeowFieldFx';
import TileInput from './TileInput';
import { WaitingCard } from './WaitingCard';

function SilperBnwView({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
}: {
  gameData?: SBNWGameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const isMeow = skin === 'meow';

  /* ── 상태 ── */
  const shownEndRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevRematchRef = useRef<number | null>(null);
  const prevWinTypeRef = useRef<string | null>(null);
  /** phase 변경 시 effect cleanup이 숨김 타이머를 지우지 않도록 ref로 관리 */
  const roundOverlayHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [roundOverlay, setRoundOverlay] = useState<{ round: number; firstNick: string } | null>(
    null,
  );
  const [rematchOverlay, setRematchOverlay] = useState<number | null>(null);
  const [winsixOverlay, setWinsixOverlay] = useState<{ winnerNick: string } | null>(null);
  const [revealStep, setRevealStep] = useState(0);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [mySlotLength, setMySlotLength] = useState(0);

  /* ── 언마운트 시 라운드 오버레이 타이머 정리 ── */
  /*
    상단 바에는 라운드·차례를 표시한다. 점수·기록·추리는 GameReferenceFrame이 배치한다.
  */
  const sbRound = gameData?.round ?? 0;
  const sbOppId =
    gameData && myId ? (Object.keys(gameData.players).find((id) => id !== myId) ?? null) : null;
  /* 자리와 단계를 같이 (lib/gameSeat.ts) */
  const sbIsFirst = gameData ? myId === gameData.firstPlayerId : false;
  const sbSeat = isSpectator ? null : sbIsFirst ? '선' : '후';
  const sbPhaseLabel = seatStage(
    sbSeat,
    gameData?.phase === 'firstSubmit' || gameData?.phase === 'secondSubmit'
      ? turnStage({
          finished: false,
          isSpectator,
          isMyTurn:
            (gameData.phase === 'firstSubmit' && sbIsFirst) ||
            (gameData.phase === 'secondSubmit' && !sbIsFirst),
          spectatorStage: gameData.phase === 'firstSubmit' ? '선 선택' : '후 선택',
        })
      : gameData?.phase === 'reveal'
        ? '타일 공개'
        : gameData?.phase === 'finished'
          ? '종료'
          : undefined,
  );
  useGameHud(
    gameData ? { round: `${sbRound} / ${SBNW_TOTAL_ROUNDS}R`, order: sbPhaseLabel } : null,
  );

  useEffect(() => {
    return () => {
      if (roundOverlayHideTimerRef.current) {
        clearTimeout(roundOverlayHideTimerRef.current);
        roundOverlayHideTimerRef.current = null;
      }
    };
  }, []);

  /* ── 라운드/재대결 전환 시 슬롯 길이 리셋 ── */
  useEffect(() => {
    setMySlotLength(0);
  }, [gameData?.round, gameData?.rematchIndex]);

  /* ── 승리 토스트 ── */
  useEffect(() => {
    if (!gameData?.winType) return;
    const key = gameData.winner ?? 'draw';
    if (shownEndRef.current === key) return;
    shownEndRef.current = key;

    if (gameData.winType === 'draw') {
      toast.info(gameData.finishReason ?? '무승부!', { duration: 5000 });
    } else if (gameData.winner) {
      const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
      const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
      const isMe = gameData.winner === myId;
      if (isMe) toast.success(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
      else toast.error(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
    }
  }, [gameData?.winner, gameData?.winType, myId, gameData?.players, gameData?.finishReason]);

  /* ── 6선승 오버레이 ── */
  useEffect(() => {
    if (!gameData?.winType || !gameData?.winner) return;
    if (prevWinTypeRef.current === gameData.winType) return;
    prevWinTypeRef.current = gameData.winType;
    if (gameData.winType === 'score') {
      const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
      setWinsixOverlay({ winnerNick });
      const t = setTimeout(() => setWinsixOverlay(null), 3000);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.winType, gameData?.winner]);

  /* ── 라운드 전환 오버레이 (숨김 타이머는 phase 변경으로 취소되지 않게 ref 사용) ── */
  useEffect(() => {
    if (!gameData) return;
    const prevRound = prevRoundRef.current;
    prevRoundRef.current = gameData.round;
    if (prevRound === null) return;
    if (gameData.round > prevRound && gameData.phase === 'firstSubmit') {
      const firstNick = gameData.players[gameData.firstPlayerId]?.nickname ?? '선플';
      setRoundOverlay({ round: gameData.round, firstNick });
      if (roundOverlayHideTimerRef.current) clearTimeout(roundOverlayHideTimerRef.current);
      roundOverlayHideTimerRef.current = setTimeout(() => {
        setRoundOverlay(null);
        roundOverlayHideTimerRef.current = null;
      }, 1600);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.round, gameData?.phase]);

  /* ── 재대결 오버레이 ── */
  useEffect(() => {
    if (!gameData) return;
    const prevRematch = prevRematchRef.current;
    prevRematchRef.current = gameData.rematchIndex;
    if (prevRematch !== null && gameData.rematchIndex > prevRematch) {
      setRematchOverlay(gameData.rematchIndex);
      const t = setTimeout(() => setRematchOverlay(null), 2400);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.rematchIndex]);

  /*
    ── Reveal 단계별 타이머 ──

    'reveal' 과 'finished' 를 한 덩어리로 본다. 승부가 나는 라운드에서 서버는
    applyReveal 안에서 phase='reveal' 을 보내고 곧바로 resolveGame 이 'finished'
    를 보낸다 — 같은 tick 이라 클라이언트에는 사실상 'finished' 하나만 도착한다.
    'reveal' 만 조건으로 두면 그 마지막 라운드는 타이머가 아예 안 걸려, 승부를
    가른 타일이 ??? 인 채로 게임이 끝난다.
  */
  useEffect(() => {
    const phase = gameData?.phase;
    if (phase === undefined) return;
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = phase;
    const revealing = phase === 'reveal' || phase === 'finished';
    const wasRevealing = prev === 'reveal' || prev === 'finished';
    if (revealing && !wasRevealing) {
      setRevealStep(0);
      const t1 = setTimeout(() => setRevealStep(1), 500);
      const t2 = setTimeout(() => setRevealStep(2), 1600);
      const t3 = setTimeout(() => setRevealStep(3), 2700);
      return () => {
        clearTimeout(t1);
        clearTimeout(t2);
        clearTimeout(t3);
      };
    }
  }, [gameData?.phase]);

  /* ── 내 차례 시 바텀시트 자동 열기 ── */
  useEffect(() => {
    if (!gameData || isSpectator) return;
    const isMyTurn =
      (gameData.phase === 'firstSubmit' && myId === gameData.firstPlayerId) ||
      (gameData.phase === 'secondSubmit' && myId !== gameData.firstPlayerId);
    const tid = setTimeout(() => setSheetOpen(isMyTurn), 0);
    return () => clearTimeout(tid);
  }, [gameData, myId, isSpectator]);

  /* ── 로딩 ── */
  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  /* ── 파생 값 ── */
  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];

  const isFirst = myId === gameData.firstPlayerId;
  const sp =
    gameData.players[Object.keys(gameData.players).find((id) => id !== gameData.firstPlayerId)!];
  const fp = gameData.players[gameData.firstPlayerId];

  const isMyTurn =
    !isSpectator &&
    ((gameData.phase === 'firstSubmit' && isFirst) ||
      (gameData.phase === 'secondSubmit' && !isFirst));

  const isReveal = gameData.phase === 'reveal' || gameData.phase === 'finished';
  const inPlay = gameData.phase === 'firstSubmit' || gameData.phase === 'secondSubmit';

  // prevPhaseRef는 effect 실행 후 갱신되므로, 새 reveal 첫 렌더 시점에는 아직 이전 phase 값.
  // revealStep이 이전 라운드의 3에서 리셋되기 전에 RevealPanel이 렌더되는 타이밍 버그 방지.
  const displayRevealStep =
    isReveal && (prevPhaseRef.current === 'reveal' || prevPhaseRef.current === 'finished')
      ? revealStep
      : 0;
  const firstDigits = gameData.firstHint?.digits ?? null;

  /* ── 내 자릿수 힌트 (선플 대기 중) ── */
  const myDigitsHint = isFirst && gameData.phase === 'firstSubmit' ? mySlotLength : null;

  /* ── 힌트 패널 key (변경 시 remount → 애니메이션 재생) ── */
  const hintKey =
    firstDigits != null
      ? `hint-${firstDigits}`
      : myDigitsHint != null
        ? `my-${myDigitsHint}`
        : 'empty';

  /* ── 제시 입력 영역 ── */
  const inputContent =
    isMyTurn && myPlayer?.tiles ? (
      <div className="space-y-3">
        {/* 후플: 모바일 힌트 (BottomSheet 안) */}
        {!isFirst && firstDigits != null && (
          <div className="lg:hidden">
            <DigitHintPanel
              firstNick={fp?.nickname ?? '선플'}
              firstDigits={firstDigits}
              myDigitsHint={null}
              isFirstSelf={false}
              meow={isMeow}
            />
          </div>
        )}
        <TileInput
          key={`${gameData.rematchIndex}-${gameData.round}-${isFirst ? 'first' : 'second'}`}
          myTiles={myPlayer.tiles}
          actionType={isFirst ? 'submitFirst' : 'submitSecond'}
          label={isFirst ? '타일을 제시하세요 (선플)' : '타일을 제시하세요 (후플)'}
          firstDigits={firstDigits}
          onSlotLengthChange={setMySlotLength}
          skin={skin}
        />
      </div>
    ) : null;

  /* ══════════ JSX ══════════ */
  return (
    <>
      <style>{`
        @keyframes sbnwPopIn {
          0%   { transform: scale(0.85); opacity: 0; }
          70%  { transform: scale(1.05); }
          100% { transform: scale(1.0);  opacity: 1; }
        }
        @keyframes slotPush {
          from { transform: translateY(-10px) scale(0.75); opacity: 0; }
          to   { transform: translateY(0)     scale(1);    opacity: 1; }
        }
        @keyframes digitHintIn {
          0%   { transform: scale(0.5) translateY(-8px); opacity: 0; box-shadow: 0 0 0 0 rgba(99,102,241,0); }
          60%  { transform: scale(1.05) translateY(0);   opacity: 1; box-shadow: 0 0 20px 4px rgba(99,102,241,0.4); }
          100% { transform: scale(1)   translateY(0);    opacity: 1; box-shadow: 0 0 0 0 rgba(99,102,241,0); }
        }
        .digit-hint-enter { animation: digitHintIn 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards; }
        @keyframes winsixIn {
          0%   { transform: scale(0.6); opacity: 0; }
          60%  { transform: scale(1.05); opacity: 1; }
          100% { transform: scale(1);   opacity: 1; }
        }
      `}</style>

      <GameReferenceFrame
        baseSkin={!isMeow}
        className={isMeow ? 'skin-meow-field' : undefined}
        reference={
          <SilperSidePanel
            gameData={gameData}
            myId={myId}
            opponentId={sbOppId}
            skin={skin}
            showTracker={!isSpectator}
          />
        }
        controls={
          !isSpectator && isMyTurn ? (
            <>
              {desktop && <div>{inputContent}</div>}
              {!desktop && (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className={
                    'w-full py-2 text-sm font-bold text-white lg:hidden ' +
                    (isMeow ? 'skin-meow-cta' : 'rounded-lg bg-indigo-600')
                  }
                >
                  타일 제시하기
                </button>
              )}
            </>
          ) : undefined
        }
      >
        <div className="flex h-full min-h-0 w-full max-w-lg flex-col justify-center gap-2 overflow-hidden">
          {isMeow && <MeowFieldFx />}
          {(gameData.phase === 'firstSubmit' || gameData.phase === 'secondSubmit') && (
            <DigitHintPanel
              key={hintKey}
              firstNick={fp?.nickname ?? '선플'}
              firstDigits={firstDigits}
              myDigitsHint={myDigitsHint}
              isFirstSelf={isFirst}
              meow={isMeow}
            />
          )}
          {isReveal && gameData.revealData ? (
            <RevealPanel
              revealData={gameData.revealData}
              players={gameData.players}
              myId={myId}
              firstPlayerId={gameData.firstPlayerId}
              step={displayRevealStep}
              meow={isMeow}
            />
          ) : isSpectator && inPlay ? (
            <WaitingCard text="플레이어들이 타일을 선택 중..." meow={isMeow} />
          ) : !isMyTurn && inPlay ? (
            <WaitingCard
              text={
                josa((gameData.phase === 'secondSubmit' ? sp : fp)?.nickname ?? '상대', '이/가') +
                ' 타일 선택 중...'
              }
              meow={isMeow}
            />
          ) : null}
        </div>
      </GameReferenceFrame>

      {/* ══ 모바일 바텀시트 ══ */}
      {!desktop && !isSpectator && (
        <>
          <BottomSheet open={sheetOpen && isMyTurn} onClose={() => setSheetOpen(false)}>
            {inputContent}
          </BottomSheet>
        </>
      )}

      {/* ══ 라운드 전환 오버레이 ══ */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          roundOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {roundOverlay && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-indigo-400/30 bg-indigo-900/90 px-10 py-6 text-center text-white shadow-2xl backdrop-blur-sm">
            <p className="text-2xl font-bold">라운드 {roundOverlay.round} 시작</p>
            <p className="text-sm text-indigo-300">{roundOverlay.firstNick} 선플</p>
          </div>
        )}
      </div>

      {/* ══ 재대결 오버레이 ══ */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-300 ${
          rematchOverlay != null ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {rematchOverlay != null && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-rose-400/50 bg-rose-900/95 px-12 py-8 text-center text-white shadow-2xl backdrop-blur-sm">
            <p className="text-3xl font-bold">재대결</p>
            <p className="text-lg font-medium text-rose-200">#{rematchOverlay}</p>
            <p className="text-sm text-rose-200">선후 교대 · 타일 리셋</p>
          </div>
        )}
      </div>

      {/* ══ 6선승 달성 오버레이 ══ */}
      <div
        className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-500 ${
          winsixOverlay ? 'opacity-100' : 'opacity-0'
        }`}
      >
        {winsixOverlay && (
          <div
            style={{ animation: 'winsixIn 500ms cubic-bezier(0.175,0.885,0.32,1.275) forwards' }}
            className="flex flex-col items-center gap-3 rounded-2xl border border-yellow-400/60 bg-indigo-900/95 px-12 py-8 text-center text-white shadow-2xl backdrop-blur-sm"
          >
            <p className="text-5xl"></p>
            <p className="text-3xl font-bold text-yellow-300">6점 달성!</p>
            <p className="text-lg font-medium text-indigo-200">{winsixOverlay.winnerNick} 승리</p>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(SilperBnwView);
