'use client';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameHud } from '@/hooks/useGameHud';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import { playShowdownSubmitSfx } from '@/lib/audio/skins/showdown';
import type { SkinTheme } from '@/lib/skins/registry';
import { josa } from '@/shared/lib/josa';
import type { BNW2GameData } from '@/shared/types/bnw2';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BNW2SidePanel } from './BNW2SidePanel';
import { BottomSheet } from './BottomSheet';
import { ColorRevealBanner } from './ColorRevealBanner';
import PointInput from './PointInput';
import PointTrack from './PointTrack';
import { WIN_TYPE_LABELS } from './presentation';
import { RevealPanel } from './RevealPanel';
import ShowdownColorBanner from './skins/ShowdownColorBanner';
import ShowdownPointInput from './skins/ShowdownPointInput';
import ShowdownPointTrack from './skins/ShowdownPointTrack';
import ShowdownRevealPanel from './skins/ShowdownRevealPanel';
import { WaitingCard } from './WaitingCard';
import { useBNW2PointNotes } from './useBNW2PointNotes';

function BNW2View({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
  gameKey = '',
}: {
  gameData?: BNW2GameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const isShowdown = skin === 'showdown';

  const shownEndRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const prevPhaseRef = useRef<string | null>(null);
  const prevPhaseSfxRef = useRef<string | null>(null);
  const [roundOverlay, setRoundOverlay] = useState<{ round: number; firstNick: string } | null>(
    null,
  );
  const [revealStep, setRevealStep] = useState(0);

  /*
    상단 바 — 라운드·차례. 점수로 끝나는 게임이라 총 라운드가 없어 몇 번째인지만 센다.
    라운드 기록은 넓은 화면에서 aside 로 이미 펴져 있으므로 memo 는 좁은 화면 몫이다.
  */
  const [sheetOpen, setSheetOpen] = useState(false);
  const opponentId = Object.keys(gameData?.players ?? {}).find((id) => id !== myId) ?? '';
  const pointNotes = useBNW2PointNotes(gameData, opponentId, gameKey);

  // Winner/draw toast
  const bnwRound = gameData?.round ?? 0;

  /*
    상단 바 한 칸에 '내가 선인가 후인가' 와 '지금 무슨 단계인가' 를 같이 적는다.

    단계만 적었더니 '선 플레이어 포인트 제시' 가 떠도 그게 나인지 상대인지 알
    수가 없었다. 흑과백2 는 선의 색을 보고 후가 거는 게임이라, 내 자리를 모르면
    공개된 흑/백이 누구 것인지도 못 읽는다. 실제로 '선·후의 흑백을 못 본다' 는
    신고가 그것이었다. 자리는 늘 앞에 두고 단계는 짧게 줄인다 — 이 칸은 좁은
    화면에서 잘리는 자리다.
  */
  const bnwIsFirst = gameData ? myId === gameData.firstPlayerId : false;
  const bnwSeat = isSpectator ? null : bnwIsFirst ? '선' : '후';
  const bnwMyTurn =
    !isSpectator &&
    ((gameData?.phase === 'firstSubmit' && bnwIsFirst) ||
      (gameData?.phase === 'secondSubmit' && !bnwIsFirst));
  const bnwStage =
    gameData?.phase === 'reveal'
      ? '공개'
      : gameData?.phase === 'finished'
        ? '종료'
        : gameData?.phase === 'firstSubmit' || gameData?.phase === 'secondSubmit'
          ? isSpectator
            ? gameData.phase === 'firstSubmit'
              ? '선 제시'
              : '후 제시'
            : bnwMyTurn
              ? '내 차례'
              : '상대 차례'
          : undefined;
  const bnwPhaseLabel = bnwStage
    ? bnwSeat
      ? `${bnwSeat} · ${bnwStage}`
      : bnwStage
    : (bnwSeat ?? undefined);
  useGameHud(gameData ? { round: `${bnwRound}R`, order: bnwPhaseLabel } : null);

  useEffect(() => {
    if (!gameData?.winType) return;
    const key = gameData.winner ?? 'draw';
    if (shownEndRef.current === key) return;
    shownEndRef.current = key;

    /*
      승자를 먼저 본다. 완전 동점(규칙 K)은 1R 선공이 가져가므로 승자가 있는데,
      끝난 사유만 보고 '무승부' 라고 적어 실제 판정과 어긋났다. 옛 기록도
      winType 은 draw 지만 승자는 남아 있어 이렇게 두면 같이 바로잡힌다.
    */
    if (gameData.winner) {
      const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
      const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
      const isMe = gameData.winner === myId;
      if (isMe) toast.success(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
      else toast.error(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
    } else {
      toast.info('무승부!', { duration: 5000 });
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
    const iAmFirst = myId === gameData?.firstPlayerId;
    const iShot = !isSpectator && ((firstShot && iAmFirst) || (secondShot && !iAmFirst));
    if (iShot) return;
    playShowdownSubmitSfx();
  }, [gameData?.phase, isShowdown, isSpectator, myId, gameData?.firstPlayerId]);

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
        <GameLoading label="게임을 불러오는 중" />
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
  const rightLabel = !isSpectator
    ? opponentDisplayName(opponentPlayer?.nickname)
    : (playerEntries[1]?.[1]?.nickname ?? '');

  const isMyTurn =
    !isSpectator &&
    ((gameData.phase === 'firstSubmit' && isFirst) ||
      (gameData.phase === 'secondSubmit' && !isFirst));
  const isReveal = gameData.phase === 'reveal' || gameData.phase === 'finished';
  const inPlay = gameData.phase === 'firstSubmit' || gameData.phase === 'secondSubmit';

  // 공개·종료 단계에서도 지난 라운드 메모를 확인할 수 있다.
  const showTracker = !isSpectator && !!opponentPlayer;

  // 서부 스킨 컴포넌트는 기본 컴포넌트와 props가 동일하므로 그대로 스왑한다.
  const TrackCmp = isShowdown ? ShowdownPointTrack : PointTrack;
  const InputCmp = isShowdown ? ShowdownPointInput : PointInput;
  const ColorBannerCmp = isShowdown ? ShowdownColorBanner : ColorRevealBanner;
  const RevealPanelCmp = isShowdown ? ShowdownRevealPanel : RevealPanel;

  const inputContent = isMyTurn ? (
    <div className="mx-auto w-full max-w-sm space-y-3 text-center">
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

      <GameReferenceFrame
        /* 트랙이 세로로 길어 뼈대 여백까지 아껴야 한 화면에 들어간다. */
        className={`gap-1.5 p-1.5 ${isShowdown ? 'skin-showdown-stage-content' : ''}`}
        controls={
          /*
            누르는 것은 전부 여기. 넓은 화면의 제시판이 무대 안에 있던 탓에,
            트랙이 세로로 긴 PC 에서는 제시판이 무대 밖으로 밀려 잘렸다 —
            보라색 제시 버튼이 화면에 반쯤 걸치거나 아예 안 보여 누를 수
            없었다. 무대는 잘리는 자리이고 조작은 잘리면 안 되는 것이라,
            같은 칸에 둘 수 없다.
          */
          <>
            {/* 좁은 화면 — 조작은 바텀시트로 연다 */}
            {!desktop && (
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
              </div>
            )}

            {/* 넓은 화면 — 제시판을 그대로 조작 자리에 둔다 */}
            {desktop && (
              <div className="mx-auto w-full max-w-sm text-center">
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
                        ? `${josa(opponentDisplayName(fp?.nickname), '이/가')} 포인트를 제시 중...`
                        : `${josa(opponentDisplayName(sp?.nickname), '이/가')} 포인트를 제시 중...`
                    }
                  />
                ) : null}
              </div>
            )}
          </>
        }
        reference={
          <BNW2SidePanel
            gameData={gameData}
            myId={myId}
            showTracker={showTracker}
            notes={pointNotes}
          />
        }
      >
        <div className="flex h-full w-full max-w-sm flex-col items-center justify-center gap-1 overflow-hidden">
          {/*
              Center track — 남은 높이를 받아 그 안에서 줄어든다.
              서부 스킨도 이제 같은 규칙을 따른다(globals.css 의 track-shell 주석).
            */}
          <div className="flex min-h-0 w-full max-w-sm flex-1 flex-col">
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

          {/* Mobile reveal panel */}
          {!desktop && isReveal && gameData.revealData && (
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
          {!desktop && !isMyTurn && !isReveal && inPlay && !isSpectator && (
            <div className="w-full max-w-sm lg:hidden">
              <WaitingCard
                text={
                  gameData.phase === 'firstSubmit'
                    ? `${josa(opponentDisplayName(fp?.nickname), '이/가')} 포인트를 제시 중...`
                    : `${josa(opponentDisplayName(sp?.nickname), '이/가')} 포인트를 제시 중...`
                }
              />
            </div>
          )}

          {/* Mobile spectator waiting */}
          {!desktop && isSpectator && inPlay && (
            <div className="w-full max-w-sm lg:hidden">
              <WaitingCard text="플레이어들이 포인트를 제시 중..." />
            </div>
          )}
        </div>
      </GameReferenceFrame>

      {/* ── Mobile bottom sheet (내 차례) ── */}
      {!desktop && !isSpectator && (
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
              isShowdown
                ? 'border-amber-400/30 bg-amber-950/90'
                : 'border-indigo-400/30 bg-indigo-900/90'
            }`}
          >
            <p className="text-2xl font-bold">라운드 {roundOverlay.round} 시작</p>
            <p className={`text-sm ${isShowdown ? 'text-amber-300' : 'text-indigo-300'}`}>
              {roundOverlay.firstNick} 선플
            </p>
          </div>
        )}
      </div>
    </>
  );
}

export default memo(BNW2View);
