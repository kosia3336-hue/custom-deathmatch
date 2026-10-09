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

  /*
    베팅판을 접을 수 있게 한다.

    예전에는 내 베팅 차례가 되면 시트가 화면을 덮은 채 닫을 방법이 없었다.
    그런데 얼마를 걸지는 판을 보고 정하는 것이다 — 상대 단계, 표식, 빛가루
    상황. 그걸 가린 채로 걸라고 하면 감으로 거는 수밖에 없다. 실제로 '베팅창이
    안 닫혀서 상대 상황을 모르고 베팅했다' 는 신고가 들어왔다.

    접으면 판이 그대로 보이고, 아래 띠를 누르면 다시 펼친다. 차례나 라운드가
    바뀌면 다시 펼친 상태로 돌아간다 — 접어 둔 것을 잊고 넘어가지 않도록.
  */
  const betKey = `${gameData?.round}-${gameData?.phase}`;
  const [collapse, setCollapse] = useState({ key: betKey, on: false });
  // 차례·라운드가 바뀌면 접힘을 푼다 (렌더 중 상태 조정 — React 권장 패턴)
  if (collapse.key !== betKey) setCollapse({ key: betKey, on: false });
  const betCollapsed = collapse.key === betKey && collapse.on;
  const setBetCollapsed = (on: boolean) => setCollapse({ key: betKey, on });
  const showBetSheet = betTurn && !betCollapsed;

  if (!gameData || !firstSide || !firstPlayer || !secondPlayer) return null;

  const Marks = dalmaji ? DalmajiMarkRow : MarkRow;
  const Powder = dalmaji ? DalmajiPowderPanel : PowderInput;
  const powderInput =
    !isSpectator && myPlayer && ctx.isPowder ? (
      <Powder
        powderRemain={gameData.selfPrivate?.powderRemain ?? 0}
        value={ctx.pendingPowder}
        submitted={mySubmittedPowder}
        opponentSubmitted={opponent?.submittedPowder ?? false}
        submitting={submitting}
        onChange={ctx.setPendingPowder}
        onSubmit={ctx.handleSubmitPowder}
        onCancel={ctx.handleCancelPowder}
        onReset={ctx.resetPowder}
      />
    ) : undefined;

  return (
    <>
      <GameReferenceFrame
        autoAboveStage
        reference={<SunMoonStarReference ctx={ctx} />}
        controls={powderInput && <div className={styles.powder}>{powderInput}</div>}
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

      {/* ── 베팅 bottom-sheet ── */}
      {!desktop && showBetSheet && myPlayer && (
        <>
          {/* dim overlay — 누르면 접어서 판을 볼 수 있다 */}
          <div
            className="fixed inset-0 z-(--cdm-z-overlay) bg-black/30"
            onClick={() => setBetCollapsed(true)}
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
              onClick={() => setBetCollapsed(true)}
              aria-label="베팅판 접고 판 보기"
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
              {dalmaji ? (
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

      {/* 접어 둔 동안 — 판을 가리지 않는 한 줄. 누르면 다시 펼친다. */}
      {!desktop && betTurn && betCollapsed && (
        <button
          type="button"
          onClick={() => setBetCollapsed(false)}
          className="bg-cdm-primary fixed inset-x-0 bottom-0 z-(--cdm-z-modal) px-4 py-3 text-sm font-bold text-white shadow-2xl"
          style={{ paddingBottom: 'calc(0.75rem + var(--cdm-safe-bottom, 0px))' }}
        >
          베팅하기 ↑
        </button>
      )}
    </>
  );
}
