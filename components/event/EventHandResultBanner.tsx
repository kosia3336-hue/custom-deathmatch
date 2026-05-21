'use client';

import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { IPEHandResult, IPHand } from '@/shared/types';
import { sfxHandResult } from '@/lib/eventSfx';

interface Props {
  result: IPEHandResult;
  mySeatIdx: number | null;
}

const HAND_LABEL: Record<IPHand, string> = {
  noPair: 'No Pair',
  double: 'Double',
  straight: 'Straight',
  triple: 'Triple',
};

const HAND_COLOR: Record<IPHand, string> = {
  noPair: 'text-cdm-fg-muted',
  double: 'text-cdm-highlight font-bold',
  straight: 'text-orange-400 font-bold',
  triple: 'text-red-500 font-bold',
};

export default function EventHandResultBanner({ result, mySeatIdx }: Props) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // 마운트 직후 SFX 재생 (key로 매 핸드마다 새로 마운트됨)
    sfxHandResult(result, mySeatIdx);

    const id = setTimeout(() => setVisible(false), 4200);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const myEntry = mySeatIdx !== null
    ? result.entries.find((e) => e.seatIdx === mySeatIdx)
    : null;
  const myWin = !!myEntry?.isWinner;

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          className="absolute inset-0 z-10 flex items-center justify-center bg-cdm-bg/75 backdrop-blur-sm"
        >
          <motion.div
            key="card"
            initial={{ scale: 0.75, y: 24, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.9, y: -16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 380, damping: 28 }}
            className="flex max-w-sm w-full flex-col gap-3 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-2 p-5 shadow-xl sm:p-6"
          >
            {/* 타입 + 결과 */}
            <div className="text-center">
              <div className="text-xs uppercase tracking-widest text-cdm-fg-muted">
                {result.kind === 'showdown' && '쇼다운'}
                {result.kind === 'last-standing' && '라스트 스탠딩'}
                {result.kind === 'die-all' && '전원 다이'}
              </div>
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: [0.8, 1.12, 1] }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className={cn(
                  'mt-1 text-2xl font-bold sm:text-3xl',
                  myWin ? 'text-cdm-primary' : 'text-cdm-fg',
                )}
              >
                {result.winnerIds.length === 0
                  ? '무승부 → 다음 핸드 이월'
                  : myWin
                    ? '🏆 승리!'
                    : `${result.winnerIds.length}명 분할 승리`}
              </motion.div>
              {result.potDistributed > 0 && (
                <div className="mt-1 text-sm text-cdm-fg-muted">
                  팟 {result.potBefore}칩 분배
                  {result.carryover > 0 && ` · 이월 ${result.carryover}`}
                </div>
              )}
            </div>

            {/* 참가자 목록 */}
            <div className="flex flex-col gap-1.5">
              {result.entries.map((e, i) => (
                <motion.div
                  key={e.playerId}
                  initial={{ x: -16, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  transition={{ delay: 0.15 + i * 0.06 }}
                  className={cn(
                    'flex items-center justify-between rounded-cdm-md px-2.5 py-1.5 text-xs sm:text-sm',
                    e.isWinner
                      ? 'bg-cdm-primary/15 ring-1 ring-cdm-primary/40'
                      : e.isDie
                        ? 'bg-cdm-accent/10'
                        : 'bg-cdm-bg-elev-1',
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <span className="tabular-nums text-cdm-fg-muted">좌석 {e.seatIdx + 1}</span>
                    <span className="truncate font-semibold">{e.nickname}</span>
                    {e.card !== null && (
                      <span className="rounded bg-cdm-bg px-1.5 py-0.5 text-[10px] tabular-nums font-bold">
                        {e.card}
                      </span>
                    )}
                    {e.hand && (
                      <span className={cn('text-[10px]', HAND_COLOR[e.hand])}>
                        {HAND_LABEL[e.hand]}
                      </span>
                    )}
                    {e.isDie && (
                      <span className="rounded bg-cdm-accent/20 px-1 text-[10px] font-bold text-cdm-accent">
                        DIE
                      </span>
                    )}
                  </span>
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3 + i * 0.06, type: 'spring', stiffness: 400, damping: 20 }}
                    className={cn(
                      'tabular-nums font-bold ml-2 shrink-0',
                      e.chipDelta > 0 ? 'text-cdm-primary' : e.chipDelta < 0 ? 'text-cdm-accent' : 'text-cdm-fg-muted',
                    )}
                  >
                    {e.chipDelta > 0 ? `+${e.chipDelta}` : e.chipDelta}
                  </motion.span>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
