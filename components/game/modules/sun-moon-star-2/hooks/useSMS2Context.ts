'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import type {
  SMS2ChipBet,
  SMS2GameData,
  SMS2MarkId,
  SMS2PlayerPublic,
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
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { WIN_TYPE_LABELS } from '../constants';
import { useOpponentPowderNotes } from './useOpponentPowderNotes';

/** 해달별2의 파생값·입력·연출 상태. 동일 GameLayout을 PC/모바일에서 공유한다. */

export type SMS2ContextValue = ReturnType<typeof useSMS2Context>;

export function useSMS2Context({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
  gameKey = '',
  roomId = '',
}: GameModuleViewProps<SMS2GameData>) {
  const sendAction = useGameAction();
  const dalmaji = skin === 'dalmaji';

  const [pendingPowder, setPendingPowder] = useState<SMS2PowderSubmission>(zeroPowder());
  const [pendingBet, setPendingBet] = useState<SMS2ChipBet>(zeroBet());
  const [submitting, setSubmitting] = useState(false);
  const [prevKey, setPrevKey] = useState('');

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

  const powderNotes = useOpponentPowderNotes(
    gameData,
    opponent?.side ?? 'p2',
    `${gameKey || roomId}:${myId}`,
  );

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
      ? ((WIN_TYPE_LABELS as Record<string, string>)[gameData.winType] ?? '')
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
    sendAction({ type: 'submitPowder', powder: pendingPowder });
  }, [myPlayer, pendingPowder, submitting, gameData, sendAction]);

  const handleCancelPowder = useCallback(() => {
    if (!myPlayer?.submittedPowder) return;
    sendAction({ type: 'cancelPowder' });
    setSubmitting(false);
  }, [myPlayer, sendAction]);

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
    sendAction({ type: 'submitBet', bet: pendingBet });
  }, [myPlayer, pendingBet, submitting, gameData, opponent, sendAction]);

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

  const showTracker = !isSpectator && !!myPlayer && !!opponent;

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
    powderNotes,
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
