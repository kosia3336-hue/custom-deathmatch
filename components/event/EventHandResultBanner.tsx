'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { IPEHandResult, IPEHandResultEntry, IPHand } from '@/shared/types';
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
  double: 'text-yellow-400 font-bold',
  straight: 'text-orange-400 font-bold',
  triple: 'text-red-400 font-bold',
};

const REVEAL_INTERVAL = 1100;
const FINAL_DISPLAY = 6000;

function cardBorderClass(hand: IPHand | null, isWinner: boolean): string {
  if (hand === 'triple') return 'border-red-400 bg-red-500/5 text-red-400 shadow-[0_0_14px_5px_rgba(239,68,68,0.5)]';
  if (hand === 'straight') return 'border-orange-400 bg-orange-500/5 text-orange-400 shadow-[0_0_10px_3px_rgba(249,115,22,0.4)]';
  if (hand === 'double') return 'border-yellow-400 bg-yellow-500/5 text-cdm-fg shadow-[0_0_6px_2px_rgba(234,179,8,0.35)]';
  if (isWinner) return 'border-cdm-primary bg-cdm-primary/10 text-cdm-primary shadow-[0_0_8px_2px_rgba(99,102,241,0.3)]';
  return 'border-cdm-border bg-cdm-bg text-cdm-fg';
}

function scaleKeyframes(hand: IPHand | null): number | number[] {
  if (hand === 'triple') return [1, 1.28, 0.9, 1.12, 1.0];
  if (hand === 'straight') return [1, 1.2, 0.93, 1.05, 1.0];
  if (hand === 'double') return [1, 1.12, 0.97, 1.0];
  return 1;
}

function RevealedCard({ entry }: { entry: IPEHandResultEntry }) {
  const scale = useRef(scaleKeyframes(entry.hand)).current;
  return (
    <motion.div
      initial={{ scale: 0.9 }}
      animate={{ scale }}
      transition={{ delay: 0.28, duration: 0.55, ease: [0.34, 1.56, 0.64, 1] }}
    >
      <motion.div
        initial={{ rotateY: 90, opacity: 0 }}
        animate={{ rotateY: 0, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 22 }}
        className={cn(
          'flex h-16 w-11 items-center justify-center rounded-lg border-2 font-extrabold',
          cardBorderClass(entry.hand, entry.isWinner),
          entry.card === 10 ? 'text-lg' : 'text-2xl',
        )}
      >
        {entry.card ?? '?'}
      </motion.div>
    </motion.div>
  );
}

function AlivePlayerCard({ entry, revealed }: { entry: IPEHandResultEntry; revealed: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1">
      <span className="max-w-14 truncate text-[10px] text-cdm-fg-muted">{entry.nickname}</span>

      <AnimatePresence mode="wait">
        {revealed ? (
          <RevealedCard key="revealed" entry={entry} />
        ) : (
          <motion.div
            key="hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, rotateY: 90 }}
            className="flex h-16 w-11 items-center justify-center rounded-lg border-2 border-cdm-border bg-cdm-bg-elev-1 text-2xl text-cdm-primary/50"
          />
        )}
      </AnimatePresence>

      {revealed && entry.hand && (
        <motion.span
          initial={{ x: 8, scale: 0.8, opacity: 0 }}
          animate={{ x: 0, scale: 1, opacity: 1 }}
          transition={{ delay: 0.35, type: 'spring', stiffness: 420, damping: 22 }}
          className={cn('text-[10px]', HAND_COLOR[entry.hand])}
        >
          {HAND_LABEL[entry.hand]}
        </motion.span>
      )}
    </div>
  );
}

function DeadPlayerCard({ entry }: { entry: IPEHandResultEntry }) {
  return (
    <div className="flex flex-col items-center gap-1 opacity-50">
      <span className="max-w-14 truncate text-[10px] text-cdm-fg-muted">{entry.nickname}</span>
      <div className="relative flex h-16 w-11 items-center justify-center rounded-lg border-2 border-cdm-accent/40 bg-cdm-accent/5 font-extrabold text-cdm-fg-muted">
        <span className={entry.card === 10 ? 'text-lg' : 'text-2xl'}>{entry.card ?? '?'}</span>
        <span className="absolute -top-1.5 -right-1.5 rounded bg-cdm-accent px-1 py-0.5 text-[8px] font-bold text-white">
          DIE
        </span>
      </div>
      {entry.hand && (
        <span className={cn('text-[10px]', HAND_COLOR[entry.hand])}>{HAND_LABEL[entry.hand]}</span>
      )}
    </div>
  );
}

export default function EventHandResultBanner({ result, mySeatIdx }: Props) {
  const aliveEntries = result.entries.filter((e) => !e.isDie);
  const deadEntries = result.entries.filter((e) => e.isDie);
  const closeMs = aliveEntries.length * REVEAL_INTERVAL + FINAL_DISPLAY;

  const [visible, setVisible] = useState(true);
  const [revealCount, setRevealCount] = useState(0);
  const [showResult, setShowResult] = useState(false);
  const allRevealed = revealCount >= aliveEntries.length;

  useEffect(() => {
    sfxHandResult(result, mySeatIdx);
    const id = setTimeout(() => setVisible(false), closeMs);
    return () => clearTimeout(id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (revealCount >= aliveEntries.length) return;
    const id = setTimeout(() => setRevealCount((c) => c + 1), REVEAL_INTERVAL);
    return () => clearTimeout(id);
  }, [revealCount, aliveEntries.length]);

  useEffect(() => {
    if (revealCount < aliveEntries.length) return;
    const id = setTimeout(() => setShowResult(true), 900);
    return () => clearTimeout(id);
  }, [revealCount, aliveEntries.length]);

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
            className="flex max-w-sm w-full flex-col gap-4 rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-2 p-5 shadow-xl sm:p-6"
          >
            {/* 타입 라벨 */}
            <div className="text-center text-xs uppercase tracking-widest text-cdm-fg-muted">
              {result.kind === 'showdown' && '쇼다운'}
              {result.kind === 'last-standing' && '라스트 스탠딩'}
              {result.kind === 'die-all' && '전원 다이'}
            </div>

            {/* 카드 공개 섹션 */}
            <div className="flex flex-col gap-3">
              {/* 공유 카드 */}
              {result.communityCards && (
                <div className="flex items-center justify-center gap-2">
                  <span className="text-[10px] text-cdm-fg-muted">공유</span>
                  {result.communityCards.map((c, idx) => (
                    <motion.div
                      key={idx}
                      initial={{ rotateY: 90, opacity: 0 }}
                      animate={{ rotateY: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.08, type: 'spring', stiffness: 320, damping: 24 }}
                      className={cn(
                        'flex h-12 w-8 items-center justify-center rounded-md border-2 border-cdm-primary/50 bg-cdm-bg font-bold sm:h-14 sm:w-10',
                        c === 10 ? 'text-sm sm:text-base' : 'text-lg sm:text-xl',
                      )}
                    >
                      {c}
                    </motion.div>
                  ))}
                </div>
              )}

              {/* 플레이어 카드 */}
              <div className="flex flex-wrap justify-center gap-3">
                {/* 죽은 플레이어: 즉시 공개 */}
                {deadEntries.map((e) => (
                  <DeadPlayerCard key={e.playerId} entry={e} />
                ))}
                {/* 살아있는 플레이어: 순차 공개 (result.entries 좌석 순서 기준) */}
                {aliveEntries.map((e, i) => (
                  <AlivePlayerCard key={e.playerId} entry={e} revealed={i < revealCount} />
                ))}
              </div>
            </div>

            {/* 승패 결과 — 모두 공개 후 표시 */}
            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-center"
                >
                  <motion.div
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: [0.8, 1.1, 1], opacity: 1 }}
                    transition={{ duration: 0.4 }}
                    className={cn(
                      'text-2xl font-bold sm:text-3xl',
                      myWin ? 'text-cdm-primary' : 'text-cdm-fg',
                    )}
                  >
                    {result.winnerIds.length === 0
                      ? '무승부 → 다음 핸드 이월'
                      : myWin
                        ? '승리!'
                        : `${result.winnerIds.length}명 분할 승리`}
                  </motion.div>
                  {result.potDistributed > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.15 }}
                      className="mt-1 text-sm text-cdm-fg-muted"
                    >
                      팟 {result.potBefore}칩 분배
                      {result.carryover > 0 && ` · 이월 ${result.carryover}`}
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {/* 참가자 칩 델타 — 모두 공개 후 표시 */}
            <AnimatePresence>
              {showResult && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.3, delay: 0.1 }}
                  className="flex flex-col gap-1.5"
                >
                  {result.entries.map((e, i) => (
                    <motion.div
                      key={e.playerId}
                      initial={{ x: -16, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 + i * 0.06 }}
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
                        {e.hand && e.hand !== 'noPair' && (
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
                      <span
                        className={cn(
                          'tabular-nums font-bold ml-2 shrink-0',
                          e.chipDelta > 0
                            ? 'text-cdm-primary'
                            : e.chipDelta < 0
                              ? 'text-cdm-accent'
                              : 'text-cdm-fg-muted',
                        )}
                      >
                        {e.chipDelta > 0 ? `+${e.chipDelta}` : e.chipDelta}
                      </span>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
