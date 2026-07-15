'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import type { RankGameEndedPayload, RankPlayerOutcome } from '@/shared/types/events';
import type { RankTier } from '@/shared/types/rank';
import { Card } from '@/components/cdm/Card';
import { RankBadge } from '@/components/cdm/RankBadge';
import { Button } from '@/components/cdm/Button';
import Modal from '@/components/ui/Modal';

const TIER_KO: Record<RankTier, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

function formatRpDelta(delta: number): string {
  if (delta === 0) return '±0';
  return delta > 0 ? `+${delta}` : `${delta}`;
}

function PromoteBurst() {
  const rays = [0, 45, 90, 135, 180, 225, 270, 315];
  return (
    <div className="pointer-events-none absolute inset-0 overflow-visible">
      {rays.map((deg) => {
        const rad = (deg * Math.PI) / 180;
        const dist = 72;
        return (
          <motion.span
            key={deg}
            className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cdm-highlight"
            initial={{ opacity: 0.95, scale: 0.3 }}
            animate={{
              x: Math.cos(rad) * dist,
              y: Math.sin(rad) * dist,
              opacity: 0,
              scale: 0.2,
            }}
            transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1], delay: 0.08 }}
          />
        );
      })}
    </div>
  );
}

function tierAfterForBadge(tierAfter: RankTier): RankTier {
  return tierAfter;
}

function TierOutcomeModal({
  outcome,
  rankEnded,
}: {
  outcome: RankPlayerOutcome;
  rankEnded?: RankGameEndedPayload | null;
}) {
  const [open, setOpen] = useState(false);
  const [variant, setVariant] = useState<'promote' | 'demote'>('promote');
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    if (outcome.demoted) {
      firedRef.current = true;
      setVariant('demote');
      setOpen(true);
      return;
    }
    if (outcome.promoted) {
      firedRef.current = true;
      setVariant('promote');
      setOpen(true);
    }
  }, [outcome]);

  const title =
    variant === 'demote'
      ? '강등'
      : outcome.placementJustFinished
        ? '배치 완료!'
        : '승급!';

  const emoji = variant === 'demote' ? '' : '';
  const isPromote = variant === 'promote';

  return (
    <Modal open={open} onClose={() => setOpen(false)} closable>
      <div
        className={`relative overflow-visible rounded-cdm-lg px-1 py-1 ${
          isPromote
            ? 'bg-[radial-gradient(ellipse_at_50%_0%,rgba(250,204,21,0.18),transparent_55%),radial-gradient(ellipse_at_80%_80%,rgba(34,197,94,0.12),transparent_50%)]'
            : 'bg-[radial-gradient(ellipse_at_50%_100%,rgba(244,63,94,0.14),transparent_55%)]'
        }`}
      >
        {open && isPromote ? <PromoteBurst /> : null}

        <motion.div
          className="relative space-y-4 text-center"
          variants={{
            hidden: { opacity: 0 },
            show: {
              opacity: 1,
              transition: { staggerChildren: isPromote ? 0.09 : 0.06, delayChildren: 0.04 },
            },
          }}
          initial="hidden"
          animate={open ? 'show' : 'hidden'}
        >
          <motion.div
            variants={
              isPromote
                ? {
                    hidden: { scale: 0, rotate: -18 },
                    show: {
                      scale: 1,
                      rotate: 0,
                      transition: { type: 'spring', stiffness: 420, damping: 14 },
                    },
                  }
                : {
                    hidden: { opacity: 0, y: -28 },
                    show: {
                      opacity: 1,
                      y: 0,
                      x: [0, -5, 5, -4, 4, 0],
                      transition: {
                        y: { type: 'spring', stiffness: 280, damping: 20 },
                        x: { duration: 0.5, ease: 'easeInOut' },
                        opacity: { duration: 0.2 },
                      },
                    },
                  }
            }
            className={`text-5xl ${isPromote ? 'drop-shadow-[0_0_12px_rgba(250,204,21,0.45)]' : ''}`}
          >
            {emoji}
          </motion.div>

          <motion.p
            variants={
              isPromote
                ? {
                    hidden: { opacity: 0, y: 14 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { type: 'spring', stiffness: 380, damping: 24 },
                    },
                  }
                : {
                    hidden: { opacity: 0, y: -10 },
                    show: {
                      opacity: 1,
                      y: 0,
                      transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] },
                    },
                  }
            }
            className={`text-lg font-bold ${
              isPromote ? 'text-cdm-fg' : 'text-rose-700 dark:text-rose-400'
            }`}
          >
            {title}
          </motion.p>

          <motion.div
            variants={
              isPromote
                ? {
                    hidden: { opacity: 0 },
                    show: {
                      opacity: 1,
                      transition: { staggerChildren: 0.1 },
                    },
                  }
                : {
                    hidden: { opacity: 0 },
                    show: { opacity: 1 },
                  }
            }
            className="flex flex-wrap items-center justify-center gap-3"
          >
            <motion.span
              variants={
                isPromote
                  ? {
                      hidden: { opacity: 0, x: -36 },
                      show: {
                        opacity: 1,
                        x: 0,
                        transition: { type: 'spring', stiffness: 320, damping: 22 },
                      },
                    }
                  : {
                      hidden: { opacity: 0, filter: 'blur(4px)' },
                      show: {
                        opacity: 1,
                        filter: 'blur(0px)',
                        transition: { duration: 0.4 },
                      },
                    }
              }
            >
              <RankBadge tier={outcome.tierBefore} size="lg" showRp={false} />
            </motion.span>

            <motion.span
              variants={
                isPromote
                  ? {
                      hidden: { opacity: 0, scale: 0.5 },
                      show: {
                        opacity: 1,
                        scale: 1,
                        transition: { type: 'spring', stiffness: 400, damping: 16, delay: 0.05 },
                      },
                    }
                  : { hidden: { opacity: 0 }, show: { opacity: 1 } }
              }
              className="font-semibold text-cdm-fg-muted"
            >
              →
            </motion.span>

            <motion.span
              variants={
                isPromote
                  ? {
                      hidden: { opacity: 0, x: 36 },
                      show: {
                        opacity: 1,
                        x: 0,
                        transition: { type: 'spring', stiffness: 320, damping: 22 },
                      },
                    }
                  : {
                      hidden: { opacity: 0, y: 16 },
                      show: {
                        opacity: 1,
                        y: 0,
                        transition: { type: 'spring', stiffness: 260, damping: 22 },
                      },
                    }
              }
              className={isPromote ? 'relative' : ''}
            >
              {isPromote ? (
                <motion.span
                  className="absolute -inset-1 -z-10 rounded-cdm-lg bg-cdm-highlight/25 blur-md"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.35, duration: 0.45 }}
                />
              ) : null}
              <RankBadge
                tier={tierAfterForBadge(outcome.tierAfter)}
                size="lg"
                rp={outcome.rpAfter}
                showRp
              />
            </motion.span>
          </motion.div>

          <motion.p
            variants={{
              hidden: { opacity: 0 },
              show: { opacity: 1, transition: { delay: isPromote ? 0.25 : 0.15 } },
            }}
            className="text-sm text-cdm-fg-muted"
          >
            {TIER_KO[outcome.tierAfter]}{' '}
            {outcome.rpAfter} RP
          </motion.p>

          <motion.div
            variants={{
              hidden: { opacity: 0, y: 10 },
              show: {
                opacity: 1,
                y: 0,
                transition: { delay: isPromote ? 0.35 : 0.2, type: 'spring', stiffness: 300, damping: 24 },
              },
            }}
          >
            <Button variant="primary" className="w-full" onClick={() => setOpen(false)}>
              확인
            </Button>
          </motion.div>
        </motion.div>
      </div>
    </Modal>
  );
}

interface Props {
  outcome: RankPlayerOutcome;
  rankEnded?: RankGameEndedPayload | null;
}

/** 랭크 멀티 종료 시 본인 행만 표시 (관전자·비로그인 제외) */
export function RankResultSection({ outcome, rankEnded = null }: Props) {
  const tierChanged = outcome.tierBefore !== outcome.tierAfter;
  const tierAfterBadge = tierAfterForBadge(outcome.tierAfter);

  const showTierRp =
    outcome.placementMatch !== true || outcome.placementJustFinished === true;

  return (
    <>
      {(outcome.promoted || outcome.demoted) && (
        <TierOutcomeModal outcome={outcome} rankEnded={rankEnded} />
      )}
      <Card variant="highlight" accent="accent" className="mt-6">
        <h2 className="mb-3 text-sm font-semibold text-cdm-fg">랭크 결과</h2>

        <div className="flex flex-col gap-3 text-sm">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-cdm-fg-muted">티어</span>
            {tierChanged ? (
              <span className="flex flex-wrap items-center gap-2">
                <RankBadge tier={outcome.tierBefore} size="lg" showRp={false} />
                <span className="text-cdm-fg-muted">→</span>
                <RankBadge
                  tier={tierAfterBadge}
                  size="lg"
                  rp={showTierRp ? outcome.rpAfter : undefined}
                  showRp={showTierRp}
                />
              </span>
            ) : (
              <RankBadge
                tier={tierAfterBadge}
                size="lg"
                rp={showTierRp ? outcome.rpAfter : undefined}
                showRp={showTierRp}
              />
            )}
          </div>

          {outcome.tierAfter === 'challenger' ? (
            <p className="text-xs text-purple-600 dark:text-purple-400">
              챌린저 구간에 진입했습니다.
            </p>
          ) : null}

          <div>
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-cdm-fg-muted">RP</span>
              <span className="tabular-nums text-cdm-fg">
                {outcome.rpBefore}
                <span className="mx-1 text-cdm-fg-muted">→</span>
                {outcome.rpAfter}
              </span>
              <span
                className={
                  outcome.rpDelta > 0
                    ? 'tabular-nums font-medium text-emerald-600 dark:text-emerald-400'
                    : outcome.rpDelta < 0
                      ? 'tabular-nums font-medium text-rose-600 dark:text-rose-400'
                      : 'tabular-nums text-cdm-fg-muted'
                }
              >
                ({formatRpDelta(outcome.rpDelta)})
              </span>
            </div>
            {outcome.placementMatch === true && outcome.placementJustFinished !== true ? (
              <p className="mt-1 text-xs text-cdm-fg-muted">
                배치전 진행 중 — 5판 종료 후 시작 티어·RP가 확정됩니다.
              </p>
            ) : null}
          </div>
        </div>
      </Card>
    </>
  );
}
