'use client';

import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import { useState } from 'react';
import BetInput from './BetInput';
import FirstBetRevealBanner from './FirstBetRevealBanner';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import MarkRow from './MarkRow';
import PhaseArea from './PhaseArea';
import PowderInput from './PowderInput';
import DalmajiBetPanel from './skins/DalmajiBetPanel';
import DalmajiMarkRow from './skins/DalmajiMarkRow';
import DalmajiPowderPanel from './skins/DalmajiPowderPanel';
import { SunMoonStarReference } from './SunMoonStarReference';
import styles from './game-layout.module.css';

/** 점수·기록·추리는 독립 창, 표식은 무대, 빛가루 입력은 하단. 모바일 베팅은 접을 수 있는 시트. */

interface Props {
  ctx: SMS2ContextValue;
}

export default function GameLayout({ ctx }: Props) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const {
    gameData,
    isSpectator,
    myPlayer,
    opponent,
    firstSide,
    firstPlayer,
    secondPlayer,
    isResolve,
    isRoundEnd,
    isBetFirst,
    isBetSecond,
    mySubmittedPowder,
    myTurnInBet,
    revealedBetFirst,
    markRowPendingPowder,
    markRowRoundPowder,
    litMark,
    dalmaji,
    pendingBet,
    setPendingBet,
    resetBet,
    handleSubmitBet,
    submitting,
  } = ctx;

  /* ── 베팅 bottom-sheet 표시 여부 ── */
  const betTurn =
    !isSpectator &&
    !!myPlayer &&
    (isBetFirst || isBetSecond) &&
    myTurnInBet &&
    !myPlayer.betConfirmed;

  /* ── 빛가루 분배 차례 (제출 뒤에도 취소하려고 다시 열 수 있다) ── */
  const powderTurn = !isSpectator && !!myPlayer && ctx.isPowder;
  const needsInput = betTurn || (powderTurn && !mySubmittedPowder);

  /*
    모바일에서는 빛가루 분배·베팅 입력판을 시트로 띄우고, 접을 수 있게 한다.

    예전에는 내 베팅 차례가 되면 시트가 화면을 덮은 채 닫을 방법이 없었다.
    그런데 얼마를 걸지는 판을 보고 정하는 것이다 — 상대 단계, 표식, 빛가루
    상황. 그걸 가린 채로 걸라고 하면 감으로 거는 수밖에 없다. 실제로 '베팅창이
    안 닫혀서 상대 상황을 모르고 베팅했다' 는 신고가 들어왔다.

    빛가루 분배판은 판 아래에 늘 펼쳐 두었는데, 세 줄 입력판이 화면 세로의
    3분의 1을 차지해 모바일에서 스크롤이 생겼다. 그래서 베팅과 같은 시트로 옮겼다.

    입력할 차례가 되면 시트가 펼쳐지고, 접으면 판이 그대로 보인다. 조작 칸의
    버튼을 누르면 다시 펼친다. 라운드·단계가 바뀌거나 빛가루를 제출하면 기본
    상태(입력할 게 있으면 펼침)로 돌아간다 — 접어 둔 것을 잊고 넘어가지 않도록.
  */
  const sheetKey = `${gameData?.round}-${gameData?.phase}-${mySubmittedPowder ? 'sent' : ''}`;
  const [sheet, setSheet] = useState({ key: sheetKey, open: needsInput });
  // 라운드·단계·제출이 바뀌면 기본 상태로 (렌더 중 상태 조정 — React 권장 패턴)
  if (sheet.key !== sheetKey) setSheet({ key: sheetKey, open: needsInput });
  const sheetOpen = sheet.key === sheetKey && sheet.open;
  const setSheetOpen = (open: boolean) => setSheet({ key: sheetKey, open });
  const showSheet = !desktop && sheetOpen && (betTurn || powderTurn);

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const Marks = dalmaji ? DalmajiMarkRow : MarkRow;
  const Powder = dalmaji ? DalmajiPowderPanel : PowderInput;
  const powderInput =
    !isSpectator && myPlayer && ctx.isPowder ? (
      <Powder
        powderRemain={gameData.selfPrivate?.powderRemain ?? 0}
        value={markRowRoundPowder ?? ctx.pendingPowder}
        submitted={mySubmittedPowder}
        opponentSubmitted={opponent?.submittedPowder ?? false}
        submitting={submitting}
        onChange={ctx.setPendingPowder}
        onSubmit={ctx.handleSubmitPowder}
        onCancel={ctx.handleCancelPowder}
        onReset={ctx.resetPowder}
      />
    ) : undefined;

  /*
    모바일 입력은 흑과백2처럼 조작 칸의 버튼으로 연다.

    예전에는 베팅판을 접으면 '베팅하기 ↑' 띠가 화면 맨 아래에 겹쳐 떴다. 흐름
    밖에 떠 있으니 그 아래 놓인 메모 열기 버튼을 가렸다. 버튼을 조작 칸에 두면
    판과 메모 사이에 제자리를 차지해 아무것도 가리지 않는다.
  */
  const openButton = (label: string, tone: 'bet' | 'powder' | 'quiet') => (
    <button
      type="button"
      onClick={() => setSheetOpen(true)}
      className={
        dalmaji
          ? `skin-dalmaji-btn ${tone === 'quiet' ? 'skin-dalmaji-btn--ghost' : 'skin-dalmaji-btn--gold'} w-full py-3`
          : tone === 'quiet'
            ? 'w-full rounded-xl border border-gray-300 bg-white py-3 text-sm font-semibold text-gray-600'
            : `w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg ${
                tone === 'bet' ? 'bg-amber-600 hover:bg-amber-700' : 'bg-indigo-600 hover:bg-indigo-700'
              }`
      }
    >
      {label}
    </button>
  );
  const mobileControls = desktop
    ? undefined
    : betTurn
      ? openButton(isBetFirst ? '선 베팅하기 →' : '후 베팅하기 →', 'bet')
      : powderTurn
        ? mySubmittedPowder
          ? openButton('제출한 분배 보기 · 취소', 'quiet')
          : openButton('빛가루 분배하기 →', 'powder')
        : undefined;

  return (
    <>
      <GameReferenceFrame
        autoAboveStage
        reference={<SunMoonStarReference ctx={ctx} />}
        controls={
          desktop ? powderInput && <div className={styles.powder}>{powderInput}</div> : mobileControls
        }
        className={`gap-1 p-1.5 py-0.5 sm:p-1.5 sm:py-0.5 ${styles.frame}`}
        /*
          칩과 단계는 늘 보이게 둔다. 칩을 걸어 겨루는 판이라 양쪽 칩 수는
          '가끔 확인하는 참고' 가 아니라 매 수마다 읽는 값이다. 메모 안으로
          넣었더니 버튼을 눌러야 상대 칩이 보인다는 신고가 들어왔다.
        */
      >
        <div data-game-intrinsic-stage className={styles.board}>
          <div className="w-full min-w-0">
            <Marks
              size={desktop ? 'md' : 'sm'}
              myContribution={gameData.selfPrivate?.myMarkContribution ?? null}
              pendingPowder={markRowPendingPowder}
              roundPowder={markRowRoundPowder}
              litMark={litMark}
              dimUnlit={isResolve || isRoundEnd}
            />
          </div>

          {isBetSecond && revealedBetFirst && (
            <FirstBetRevealBanner
              firstBet={revealedBetFirst}
              firstSide={firstSide}
              firstNick={firstPlayer.nickname}
              isMyTurn={!isSpectator && myTurnInBet}
            />
          )}

          {/* 입력 / 대기 / 정산 / 종료 — 자동 스크롤 타깃 */}
          <div className="w-full min-w-0">
            <PhaseArea ctx={ctx} hideBetInput={!desktop} />
          </div>
        </div>
      </GameReferenceFrame>

      {/* ── 입력 bottom-sheet (빛가루 분배 · 베팅) ── */}
      {showSheet && myPlayer && (
        <>
          {/* dim overlay — 누르면 접어서 판을 볼 수 있다 */}
          <div
            className="fixed inset-0 z-(--cdm-z-overlay) bg-black/30"
            onClick={() => setSheetOpen(false)}
          />
          {/* sheet */}
          <div
            className={`fixed inset-x-0 bottom-0 z-(--cdm-z-modal) rounded-t-2xl border-t shadow-2xl ${
              dalmaji ? 'border-white/10 bg-[#101824]' : 'border-gray-200 bg-white'
            }`}
            style={{ animation: 'sms2SlideUp 250ms ease-out forwards' }}
          >
            <button
              type="button"
              onClick={() => setSheetOpen(false)}
              aria-label="입력판 접고 판 보기"
              className="flex w-full flex-col items-center gap-1 pt-2 pb-1"
            >
              <span className="h-1 w-10 rounded-full bg-gray-300" />
              <span className="text-[11px] font-semibold text-gray-400">눌러서 접고 판 보기</span>
            </button>
            <div
              className="overflow-y-auto px-4"
              style={{
                maxHeight: '70dvh',
                paddingBottom: 'calc(1.5rem + var(--cdm-safe-bottom, 0px))',
              }}
            >
              {powderTurn ? (
                <div className={styles.powder}>{powderInput}</div>
              ) : dalmaji ? (
                <DalmajiBetPanel
                  turn={isBetFirst ? 'first' : 'second'}
                  myChips={myPlayer.chips}
                  opponentChips={opponent?.chips ?? 0}
                  value={pendingBet}
                  firstBet={isBetSecond ? (opponent?.publicBet ?? null) : null}
                  submitting={submitting}
                  disabled={myPlayer.betConfirmed || submitting}
                  onChange={setPendingBet}
                  onSubmit={handleSubmitBet}
                  onReset={resetBet}
                />
              ) : (
                <BetInput
                  turn={isBetFirst ? 'first' : 'second'}
                  myChips={myPlayer.chips}
                  opponentChips={opponent?.chips ?? 0}
                  value={pendingBet}
                  firstBet={isBetSecond ? (opponent?.publicBet ?? null) : null}
                  firstSide={firstSide!}
                  submitting={submitting}
                  disabled={myPlayer.betConfirmed || submitting}
                  onChange={setPendingBet}
                  onSubmit={handleSubmitBet}
                  onReset={resetBet}
                />
              )}
            </div>
          </div>
        </>
      )}

    </>
  );
}
