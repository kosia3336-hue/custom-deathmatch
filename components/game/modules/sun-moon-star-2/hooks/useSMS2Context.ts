'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import type {
  SMS2ChipBet,
  SMS2GameData,
  SMS2MarkId,
  SMS2PlayerPublic,
  SMS2PowderStage,
  SMS2PowderSubmission,
  SMS2Side,
} from '@/shared/types/sun-moon-star-2';
import {
  firstMaxBet,
  secondMinBet,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
} from '@/shared/types/sun-moon-star-2';
import { getSkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import { WIN_TYPE_LABELS } from '../constants';
import {
  type OpponentPowderEstimate,
  zeroOpponentEstimate,
} from '../types';

/* ════════════════════════════════════════════════════════════
 * useSMS2Context
 *   해달별 II 의 모든 공통 상태·액션·파생값을 한 객체로 모아 반환.
 *   MobileLayout / DesktopLayout 가 이 객체 하나만 받아 사용한다.
 *
 *   ⚠️ 자동 스크롤용 ref / useEffect 는 MobileLayout 내부에서 직접 사용.
 *      (두 레이아웃이 동시에 마운트되어도 ref 충돌이 없도록)
 * ════════════════════════════════════════════════════════════ */

export type SMS2ContextValue = ReturnType<typeof useSMS2Context>;

export function useSMS2Context() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as SMS2GameData | undefined;
  const dalmaji = getSkinTheme(gameState?.activeSkin, GAME_IDS.SUN_MOON_STAR_2) === 'dalmaji';
  const myId = useMySocketId();
  useTurnTimer();

  const [pendingPowder, setPendingPowder] = useState<SMS2PowderSubmission>(zeroPowder());
  const [pendingBet, setPendingBet] = useState<SMS2ChipBet>(zeroBet());
  const [submitting, setSubmitting] = useState(false);
  const [prevKey, setPrevKey] = useState('');

  const [opponentEstimate, setOpponentEstimate] = useState<OpponentPowderEstimate | null>(
    null,
  );
  const prevOpponentStageRef = useRef<SMS2PowderStage | null>(null);

  const shownWinnerRef = useRef<string | null>(null);

  const myPlayer = useMemo<SMS2PlayerPublic | null>(() => {
    if (!gameData || !myId) return null;
    if (gameData.players.p1.id === myId) return gameData.players.p1;
    if (gameData.players.p2.id === myId) return gameData.players.p2;
    return null;
  }, [gameData, myId]);

  const opponent = useMemo<SMS2PlayerPublic | null>(() => {
    if (!gameData || !myId) return gameData?.players.p2 ?? null;
    return gameData.players.p1.id === myId ? gameData.players.p2 : gameData.players.p1;
  }, [gameData, myId]);

  const mySide: SMS2Side | null = myPlayer?.side ?? null;

  /* 라운드/페이즈 전환 시 로컬 입력 리셋 */
  if (gameData) {
    const key = `${gameData.suddenDeath ? 'sd' : 'r'}-${gameData.round}-${gameData.phase}`;
    if (prevKey !== key) {
      setPrevKey(key);
      if (gameData.phase === 'powder') {
        setPendingPowder(zeroPowder());
        setSubmitting(false);
      } else if (gameData.phase === 'betFirst' || gameData.phase === 'betSecond') {
        setPendingBet(zeroBet());
        setSubmitting(false);
      }
    }
  }

  /* 상대 stage 변화 → 추리 자동 리셋 */
  useEffect(() => {
    if (!opponent) return;
    const prev = prevOpponentStageRef.current;
    const now = opponent.powderStage;
    if (prev === null) {
      prevOpponentStageRef.current = now;
      setOpponentEstimate(zeroOpponentEstimate(now, now));
      return;
    }
    if (prev !== now) {
      setOpponentEstimate(zeroOpponentEstimate(prev, now));
      prevOpponentStageRef.current = now;
    }
  }, [opponent]);

  /* 게임 종료 토스트 */
  useEffect(() => {
    if (!gameData || gameData.phase !== 'finished') return;
    if (gameData.finalWinner === null) return;
    const key = `${gameData.finalWinner}-${gameData.winType}`;
    if (shownWinnerRef.current === key) return;
    shownWinnerRef.current = key;
    if (gameData.finalWinner === 'draw') {
      toast.info('무승부입니다!', { duration: 5000 });
      return;
    }
    const winner = gameData.players[gameData.finalWinner];
    const isMe = winner.id === myId;
    const reason = gameData.winType
      ? (WIN_TYPE_LABELS as Record<string, string>)[gameData.winType] ?? ''
      : '';
    if (isMe) toast.success(`${winner.nickname} 승리! (${reason})`, { duration: 5000 });
    else toast.error(`${winner.nickname} 승리! (${reason})`, { duration: 5000 });
  }, [gameData, myId]);

  /* 액션 핸들러 */
  const handleSubmitPowder = useCallback(() => {
    if (!myPlayer || submitting) return;
    const total = sumPowder(pendingPowder);
    const remain = gameData?.selfPrivate?.powderRemain ?? 0;
    if (total > remain) {
      toast.error(`빛가루가 부족합니다. (보유 ${remain}g)`);
      return;
    }
    setSubmitting(true);
    getSocket().emit('game:action', { type: 'submitPowder', powder: pendingPowder });
  }, [myPlayer, pendingPowder, submitting, gameData]);

  const handleCancelPowder = useCallback(() => {
    if (!myPlayer?.submittedPowder) return;
    getSocket().emit('game:action', { type: 'cancelPowder' });
    setSubmitting(false);
  }, [myPlayer]);

  const handleSubmitBet = useCallback(() => {
    if (!myPlayer || submitting || !gameData) return;
    const total = sumBet(pendingBet);
    if (total > myPlayer.chips) {
      toast.error(`보유 칩을 초과했습니다. (보유 ${myPlayer.chips}개)`);
      return;
    }
    if (gameData.phase === 'betFirst') {
      const max = firstMaxBet(opponent?.chips ?? 0);
      if (total > max) {
        toast.error(`선 베팅 한도 초과 (최대 ${max}개)`);
        return;
      }
    } else if (gameData.phase === 'betSecond') {
      const firstTotal = sumBet(opponent?.publicBet ?? zeroBet());
      const min = secondMinBet(firstTotal);
      if (total < min) {
        toast.error(`후 베팅은 최소 ${min}개 (선 ${firstTotal}×2)`);
        return;
      }
    }
    setSubmitting(true);
    getSocket().emit('game:action', { type: 'submitBet', bet: pendingBet });
  }, [myPlayer, pendingBet, submitting, gameData, opponent]);

  const resetPowder = useCallback(() => setPendingPowder(zeroPowder()), []);
  const resetBet = useCallback(() => setPendingBet(zeroBet()), []);

  /* 파생 상태 — gameData 가 null 이면 모두 안전한 기본값 */
  const phase = gameData?.phase ?? null;
  const isPowder = phase === 'powder';
  const isBetFirst = phase === 'betFirst';
  const isBetSecond = phase === 'betSecond';
  const isBet = isBetFirst || isBetSecond;
  const isResolve = phase === 'resolve';
  const isRoundEnd = phase === 'roundEnd';
  const isFinished = phase === 'finished';

  const firstSide: SMS2Side | null = gameData?.firstPlayerSide ?? null;
  const secondSide: SMS2Side | null = firstSide ? (firstSide === 'p1' ? 'p2' : 'p1') : null;
  const firstPlayer = gameData && firstSide ? gameData.players[firstSide] : null;
  const secondPlayer = gameData && secondSide ? gameData.players[secondSide] : null;

  const isFirstSide = !!firstSide && mySide === firstSide;
  const myTurnInBet = (isBetFirst && isFirstSide) || (isBetSecond && !isFirstSide);
  const mySubmittedPowder = myPlayer?.submittedPowder ?? false;
  const myBetConfirmed = myPlayer?.betConfirmed ?? false;
  const isMyInputTurn =
    !isSpectator &&
    !!myPlayer &&
    ((isPowder && !mySubmittedPowder) || (isBet && myTurnInBet && !myBetConfirmed));

  const myIsFirstFlag = !!firstSide && mySide === firstSide;
  const stepperActiveTurn =
    (isPowder && !mySubmittedPowder) ||
    (isBetFirst && myIsFirstFlag && !myBetConfirmed) ||
    (isBetSecond && !myIsFirstFlag && !myBetConfirmed);

  /* 점등 표식 */
  const litMark: SMS2MarkId | null =
    gameData?.roundResult?.litMark ??
    gameData?.resolveSteps?.find((s) => s.type === 'litDecision')?.litMark ??
    null;

  const revealedBetFirst: SMS2ChipBet | null = firstPlayer?.publicBet ?? null;

  const markRowPendingPowder: SMS2PowderSubmission | null =
    isPowder && myPlayer && !mySubmittedPowder ? pendingPowder : null;

  const showTracker =
    !isSpectator && (isPowder || isBet) && !!opponentEstimate;

  return {
    /* raw */
    gameData,
    isSpectator,
    myId,
    myPlayer,
    opponent,
    mySide,
    firstSide,
    secondSide,
    firstPlayer,
    secondPlayer,

    /* phase flags */
    phase,
    isPowder,
    isBetFirst,
    isBetSecond,
    isBet,
    isResolve,
    isRoundEnd,
    isFinished,

    /* turn flags */
    isFirstSide,
    myIsFirstFlag,
    myTurnInBet,
    mySubmittedPowder,
    myBetConfirmed,
    isMyInputTurn,
    stepperActiveTurn,

    /* input state */
    pendingPowder,
    pendingBet,
    submitting,
    setPendingPowder,
    setPendingBet,
    resetPowder,
    resetBet,

    /* opponent tracker */
    opponentEstimate,
    setOpponentEstimate,
    showTracker,

    /* derived display */
    dalmaji,
    litMark,
    revealedBetFirst,
    markRowPendingPowder,

    /* actions */
    handleSubmitPowder,
    handleCancelPowder,
    handleSubmitBet,
  } as const;
}
