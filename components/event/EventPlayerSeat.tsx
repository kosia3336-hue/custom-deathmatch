'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import type { IPEPlayerInfo, IPEBettingActionRecord } from '@/shared/types';
import { sfxDeal, sfxMyTurn, sfxCall, sfxRaise } from '@/lib/audio/synth/indian-holdem-event';

interface Props {
  seatIdx: number;
  seat: IPEPlayerInfo | null;
  isMe: boolean;
  isCurrentTurn: boolean;
  isFirstActor: boolean;
  showChipHint?: boolean;
  desktop?: boolean;
  bettingActions?: IPEBettingActionRecord[];
}

export default function EventPlayerSeat({
  seatIdx,
  seat,
  isMe,
  isCurrentTurn,
  isFirstActor,
  showChipHint = false,
  desktop = false,
  bettingActions,
}: Props) {
  // 카드가 새로 나타날 때(null→숫자) 딜 SFX
  const prevCardRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (seat?.card !== undefined && seat.card !== null && prevCardRef.current === null) {
      sfxDeal();
    }
    prevCardRef.current = seat?.card ?? null;
  }, [seat?.card]);

  // 내 차례가 됐을 때 알림 SFX (isMe 한정)
  const prevTurnRef = useRef(false);
  useEffect(() => {
    if (isMe && isCurrentTurn && !prevTurnRef.current) {
      sfxMyTurn();
    }
    prevTurnRef.current = isCurrentTurn;
  }, [isMe, isCurrentTurn]);

  // roundBet 증가 시 플로팅 텍스트 + SFX
  const [floatKey, setFloatKey] = useState(0);
  const [floatDelta, setFloatDelta] = useState(0);
  const prevRoundBetRef = useRef<number>(0);
  useEffect(() => {
    const cur = seat?.roundBet ?? 0;
    const prev = prevRoundBetRef.current;
    if (cur > prev && cur > 0) {
      const delta = cur - prev;
      setFloatDelta(delta);
      setFloatKey((k) => k + 1);
      if (prev === 0) sfxCall();
      else sfxRaise();
    }
    prevRoundBetRef.current = cur;
  }, [seat?.roundBet]);

  // 체크 액션 감지 → "체크" 플로팅 텍스트
  const [checkKey, setCheckKey] = useState(0);
  const prevActionsLenRef = useRef(0);
  useEffect(() => {
    const actions = bettingActions ?? [];
    if (actions.length > prevActionsLenRef.current) {
      const latest = actions[actions.length - 1];
      if (latest?.seatIdx === seatIdx && latest.action === 'check') {
        setCheckKey((k) => k + 1);
      }
    }
    prevActionsLenRef.current = actions.length;
  }, [bettingActions, seatIdx]);

  if (!seat) {
    return (
      <button
        type="button"
        onClick={() => {
          if (showChipHint) {
            toast.error('이벤트 칩이 부족합니다. 상점에서 칩을 구매해주세요.');
          }
        }}
        className={cn(
          'flex w-full flex-col items-center justify-center gap-1 rounded-cdm-md border border-dashed border-cdm-border bg-cdm-bg/40 text-cdm-fg-muted transition-colors',
          showChipHint && 'hover:border-cdm-primary/40 hover:bg-cdm-primary/5',
          desktop ? 'py-10 text-sm' : 'py-4 text-xs',
        )}
      >
        <div className={cn('font-bold', desktop ? 'text-base' : 'text-sm')}>
          좌석 {seatIdx + 1}
        </div>
        <div>빈자리</div>
      </button>
    );
  }

  const isDead = !seat.isAlive;
  const showCard = seat.card !== null;

  return (
    <div
      className={cn(
        'relative flex flex-col items-center gap-2 rounded-cdm-md border bg-cdm-bg transition-all',
        desktop ? 'p-4' : 'p-2 sm:p-3',
        isCurrentTurn
          ? 'border-cdm-primary ring-2 ring-cdm-primary/30'
          : isFirstActor
            ? 'border-cdm-highlight/70'
            : 'border-cdm-border',
        isDead && 'opacity-50',
        isMe && 'bg-cdm-primary/5',
      )}
    >
      {/* 좌석 번호 / 마이 마커 */}
      <div
        className={cn(
          'flex w-full items-center justify-between text-cdm-fg-muted',
          desktop ? 'text-xs' : 'text-[10px]',
        )}
      >
        <span>좌석 {seatIdx + 1}</span>
        {isMe && <span className="font-bold text-cdm-primary">YOU</span>}
        {isFirstActor && !isMe && <span className="text-cdm-highlight">선</span>}
      </div>

      {/* 베팅 플로팅 텍스트 */}
      <AnimatePresence>
        {floatKey > 0 && (
          <motion.div
            key={floatKey}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -32, opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="pointer-events-none absolute top-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-cdm-highlight/90 px-2 py-0.5 text-[10px] font-bold text-black"
          >
            +{floatDelta}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 체크 플로팅 텍스트 */}
      <AnimatePresence>
        {checkKey > 0 && (
          <motion.div
            key={`check-${checkKey}`}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -32, opacity: 0, scale: 1.1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="pointer-events-none absolute top-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-cdm-fg-muted/80 px-2 py-0.5 text-[10px] font-bold text-white"
          >
            체크
          </motion.div>
        )}
      </AnimatePresence>

      {/* 카드 */}
      <div
        className={cn(
          'flex items-center justify-center rounded-md border-2 border-cdm-border bg-cdm-bg-elev-1 font-bold',
          desktop ? 'h-28 w-20' : 'h-14 w-10 sm:h-20 sm:w-14',
        )}
      >
        <AnimatePresence mode="wait">
          {isDead ? (
            <motion.span
              key="dead"
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-cdm-fg-muted line-through"
            >
              {seat.hasDied ? '×' : '-'}
            </motion.span>
          ) : showCard ? (
            <motion.span
              key={`card-${seat.card}`}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className={cn(
                desktop ? 'text-4xl' : 'text-2xl sm:text-3xl',
                seat.card === 10 && (desktop ? 'text-2xl' : 'text-base sm:text-2xl'),
              )}
            >
              {seat.card}
            </motion.span>
          ) : (
            <motion.span
              key="hidden"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-cdm-primary/80"
            />
          )}
        </AnimatePresence>
      </div>

      {/* 닉네임 + 칩 */}
      <div
        className={cn(
          'flex w-full flex-col items-center gap-0.5',
          desktop ? 'text-sm' : 'text-xs sm:text-sm',
        )}
      >
        <span className="max-w-full truncate font-semibold text-cdm-fg">{seat.nickname}</span>
        <span className="tabular-nums text-cdm-fg-muted">{seat.chips}</span>
      </div>

      {/* 라운드 베팅 */}
      <AnimatePresence>
        {seat.roundBet > 0 && (
          <motion.div
            key="roundBet"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className={cn(
              'rounded-full bg-cdm-highlight/20 font-bold text-cdm-highlight',
              desktop ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]',
            )}
          >
            베팅 {seat.roundBet}
          </motion.div>
        )}
      </AnimatePresence>

      {/* 턴 진행 중 */}
      <AnimatePresence>
        {isCurrentTurn && !isDead && (
          <motion.div
            key="turn"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            className={cn(
              'animate-pulse rounded-full bg-cdm-primary/20 font-bold text-cdm-primary',
              desktop ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]',
            )}
          >
            베팅 중
          </motion.div>
        )}
      </AnimatePresence>

      {/* 다이 표시 */}
      <AnimatePresence>
        {seat.hasDied && (
          <motion.div
            key="die"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 500, damping: 20 }}
            className={cn(
              'absolute top-1 right-1 rounded bg-cdm-accent/20 font-bold text-cdm-accent',
              desktop ? 'px-2 py-1 text-xs' : 'px-1.5 py-0.5 text-[10px]',
            )}
          >
            DIE
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
