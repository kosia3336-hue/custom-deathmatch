'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import type { BankBet, BankGameData, BankPlayerInfo, BankSide } from '@/shared/types/bank-game';
import {
  BANK_DENOMINATIONS,
  sumBetAmount,
  sumBetCount,
  validateBet,
  zeroBet,
} from '@/shared/types/bank-game';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { WIN_TYPE_LABELS } from '../constants';
import { useBankInventoryNotes } from './useBankInventoryNotes';
import { needsBankZeroBetConfirmation } from '@/lib/bankGameUi';

export type BankContextValue = ReturnType<typeof useBankContext>;

export function useBankContext({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
  gameKey = '',
}: GameModuleViewProps<BankGameData>) {
  const sendAction = useGameAction();
  const isTreasury = skin === 'treasury';

  const [pendingBet, setPendingBet] = useState<BankBet>(zeroBet());
  const [submitting, setSubmitting] = useState(false);
  const [prevKey, setPrevKey] = useState('');
  const [zeroBetRequestKey, setZeroBetRequestKey] = useState<string | null>(null);
  const shownWinnerRef = useRef<string | null>(null);

  const myPlayer = useMemo<BankPlayerInfo | null>(() => {
    if (!gameData || !myId) return null;
    if (gameData.players.p1.id === myId) return gameData.players.p1;
    if (gameData.players.p2.id === myId) return gameData.players.p2;
    return null;
  }, [gameData, myId]);

  const opponent = useMemo<BankPlayerInfo | null>(() => {
    if (!gameData) return null;
    if (!myId) return gameData.players.p2;
    return gameData.players.p1.id === myId ? gameData.players.p2 : gameData.players.p1;
  }, [gameData, myId]);

  const inventoryNotes = useBankInventoryNotes(
    gameData?.round ?? 1,
    `${gameKey}:${myId ?? ''}:${opponent?.id ?? ''}`,
  );

  const mySide: BankSide | null = myPlayer?.side ?? null;
  const firstSide: BankSide | null = gameData?.firstSide ?? null;
  const secondSide: BankSide | null = firstSide ? (firstSide === 'p1' ? 'p2' : 'p1') : null;
  const firstPlayer = gameData && firstSide ? gameData.players[firstSide] : null;
  const secondPlayer = gameData && secondSide ? gameData.players[secondSide] : null;

  /* 라운드/페이즈 전환 시 입력 리셋 */
  if (gameData) {
    const key = `r${gameData.round}-${gameData.phase}`;
    if (prevKey !== key) {
      setPrevKey(key);
      setZeroBetRequestKey(null);
      if (gameData.phase === 'firstSubmit' || gameData.phase === 'secondSubmit') {
        setPendingBet(zeroBet());
        setSubmitting(false);
      }
    }
  }

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

  const phase = gameData?.phase ?? null;
  const isFirstSubmit = phase === 'firstSubmit';
  const isFirstReveal = phase === 'firstReveal';
  const isSecondSubmit = phase === 'secondSubmit';
  const isReveal = phase === 'reveal';
  const isRoundEnd = phase === 'roundEnd';
  const isFinished = phase === 'finished';
  const isInputPhase = isFirstSubmit || isSecondSubmit;

  const myIsFirst = !!firstSide && mySide === firstSide;
  const myTurnInput =
    !isSpectator &&
    !!myPlayer &&
    ((isFirstSubmit && myIsFirst) || (isSecondSubmit && !myIsFirst)) &&
    !myPlayer.betConfirmed;

  /* 스테퍼/오버레이용 — 활성 페이즈에서 본인이 행동해야 하는지 */
  const stepperActiveTurn =
    !isSpectator &&
    !!myPlayer &&
    ((isFirstSubmit && myIsFirst) || (isSecondSubmit && !myIsFirst)) &&
    !myPlayer.betConfirmed;

  /* 모바일 자동 스크롤 트리거 — 본인 입력턴 진입 또는 reveal */
  const isMyInputTurn = myTurnInput;

  /* 상대 인벤토리 추리 패널 노출 조건 */
  const showOpponentTracker = !isSpectator && !isFinished;

  /* 액션 */
  const actionKey = gameData ? `r${gameData.round}-${gameData.phase}` : null;
  const submitBet = useCallback(
    (confirmedZero: boolean) => {
      if (!myTurnInput || !myPlayer?.inventory || submitting || !gameData) return;
      const v = validateBet(pendingBet, myPlayer.inventory);
      if (!v.ok) {
        toast.error(v.reason);
        return;
      }
      if (
        confirmedZero &&
        (zeroBetRequestKey !== actionKey ||
          !needsBankZeroBetConfirmation(gameData.phase, pendingBet))
      )
        return;
      if (!confirmedZero && needsBankZeroBetConfirmation(gameData.phase, pendingBet)) {
        setZeroBetRequestKey(actionKey);
        return;
      }
      setZeroBetRequestKey(null);
      setSubmitting(true);
      sendAction({ type: 'submitBet', bet: pendingBet });
    },
    [
      myTurnInput,
      myPlayer,
      submitting,
      gameData,
      pendingBet,
      sendAction,
      zeroBetRequestKey,
      actionKey,
    ],
  );
  const handleSubmitBet = useCallback(() => submitBet(false), [submitBet]);
  const handleConfirmZeroBet = useCallback(() => submitBet(true), [submitBet]);
  const handleCancelZeroBet = useCallback(() => setZeroBetRequestKey(null), []);
  const zeroBetConfirmationOpen =
    zeroBetRequestKey !== null &&
    zeroBetRequestKey === actionKey &&
    myTurnInput &&
    !!gameData &&
    needsBankZeroBetConfirmation(gameData.phase, pendingBet);

  const handleResetBet = useCallback(() => {
    setPendingBet(zeroBet());
  }, []);

  const handleNextRoundReady = useCallback(() => {
    sendAction({ type: 'nextRoundReady' });
  }, [sendAction]);

  const handleSkipReveal = useCallback(() => {
    sendAction({ type: 'skipReveal' });
  }, [sendAction]);

  const pendingTotal = useMemo(() => sumBetAmount(pendingBet), [pendingBet]);
  const pendingCount = useMemo(() => sumBetCount(pendingBet), [pendingBet]);

  /* 디버그/표시 — 빈 인벤토리 폴백 */
  const myInventory = myPlayer?.inventory ?? null;
  const myInventoryAmount = myPlayer?.inventoryAmount ?? null;
  const myConfirmed = myPlayer?.betConfirmed ?? false;
  const opponentConfirmed = opponent?.betConfirmed ?? false;

  const isMyInventoryEmpty = !!myPlayer && (myPlayer.inventoryCount ?? 0) === 0;

  return {
    /* raw */
    gameData,
    skin,
    isTreasury,
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
    isFirstSubmit,
    isFirstReveal,
    isSecondSubmit,
    isReveal,
    isRoundEnd,
    isFinished,
    isInputPhase,

    /* turn flags */
    myIsFirst,
    myTurnInput,
    myConfirmed,
    opponentConfirmed,
    isMyInventoryEmpty,
    stepperActiveTurn,
    isMyInputTurn,

    /* 상대 추리 표시 여부 */
    showOpponentTracker,
    inventoryNotes,

    /* input */
    pendingBet,
    setPendingBet,
    pendingTotal,
    pendingCount,
    submitting,
    handleSubmitBet,
    zeroBetConfirmationOpen,
    handleConfirmZeroBet,
    handleCancelZeroBet,
    handleResetBet,
    handleNextRoundReady,
    handleSkipReveal,

    /* derived */
    myInventory,
    myInventoryAmount,

    /* helpers */
    denoms: BANK_DENOMINATIONS,
  } as const;
}
