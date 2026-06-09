'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { TitleBadge } from '@/components/cdm/TitleBadge';
import { Button } from '@/components/cdm/Button';
import { CDP_ICON, formatCdp } from '@/lib/cdp/format';
import { labelForConsumable } from '@/lib/cdp/types';
import { GRADE_LABEL } from '@/lib/gacha/constants';
import { getSkinMeta } from '@/lib/skins/registry';
import type { GachaDrawResult } from '@/lib/gacha/types';
import type { TitleColor } from '@/lib/supabase/database.types';
import GachaGradeBadge from './GachaGradeBadge';

interface Props {
  result: GachaDrawResult;
  reducedMotion: boolean;
  onConfirm: () => void;
  onDrawAgain: () => void;
}

export default function GachaReveal({ result, reducedMotion, onConfirm, onDrawAgain }: Props) {
  const [showResult, setShowResult] = useState(reducedMotion);

  const isFail = result.resolved.kind === 'nothing';

  useEffect(() => {
    if (reducedMotion) {
      setShowResult(true);
      return;
    }
    const t1 = setTimeout(() => setShowResult(true), 400);
    return () => {
      clearTimeout(t1);
    };
  }, [reducedMotion]);

  function renderPrize() {
    const r = result.resolved;
    if (r.kind === 'nothing') {
      return (
        <div className="flex flex-col items-center gap-2">
          <motion.span
            className="text-4xl"
            initial={{ y: 0 }}
            animate={{ y: 8 }}
            transition={{ duration: 0.5 }}
          >
            💨
          </motion.span>
          <p className="text-sm text-cdm-fg-muted">아쉽게도 꽝이에요</p>
        </div>
      );
    }
    if (r.kind === 'cdp') {
      return (
        <p className="text-2xl font-bold tabular-nums text-cdm-primary">
          {CDP_ICON} +{formatCdp(r.amount)}
        </p>
      );
    }
    if (r.kind === 'consumable') {
      return (
        <div className="flex flex-col items-center gap-1 text-center">
          <span className="text-3xl">🎟</span>
          <p className="font-semibold text-cdm-fg">{labelForConsumable(r.consumableKind)}</p>
          <p className="text-sm text-cdm-fg-muted">×{r.qty}</p>
        </div>
      );
    }
    if (r.kind === 'skin') {
      const meta = getSkinMeta(r.skinId);
      return (
        <div className="flex flex-col items-center gap-2 text-center">
          {meta?.swatch && (
            <span
              className="h-14 w-14 rounded-full border-2 border-cdm-border"
              style={{ background: meta.swatch }}
            />
          )}
          <p className="font-semibold text-cdm-fg">{r.name}</p>
          <p className="text-sm text-cdm-fg-muted">7일 이용권</p>
        </div>
      );
    }
    if (r.kind === 'title') {
      return (
        <TitleBadge
          name={r.name}
          color={r.color as TitleColor}
          effect={(r.effect as 'legend' | 'xuanwu' | null) ?? null}
          size="lg"
        />
      );
    }
    if (r.kind === 'legend') {
      return (
        <div className="flex flex-col items-center gap-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-500">
            레전드 칭호 획득!
          </p>
          <TitleBadge
            name={r.name}
            color={r.color as TitleColor}
            effect={(r.effect as 'legend' | 'xuanwu' | null) ?? 'xuanwu'}
            size="lg"
          />
        </div>
      );
    }
    return null;
  }

  return (
    <div className="flex min-h-[min(50dvh,320px)] flex-col items-center justify-center gap-5 py-4 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={reducedMotion ? { duration: 0.15 } : { type: 'spring', stiffness: 320, damping: 22 }}
        className="flex flex-col items-center gap-2"
      >
        <GachaGradeBadge grade={result.grade} size="lg" />
        <p className="text-lg font-bold text-cdm-fg">{GRADE_LABEL[result.grade]}</p>
      </motion.div>

      <AnimatePresence>
        {showResult && (
          <motion.div
            key="prize"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="w-full"
          >
            {renderPrize()}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
        {isFail ? (
          <>
            <Button fullWidth onClick={onDrawAgain}>
              다시 뽑기
            </Button>
            <Button fullWidth variant="secondary" onClick={onConfirm}>
              닫기
            </Button>
          </>
        ) : (
          <>
            <Button fullWidth onClick={onConfirm}>
              확인
            </Button>
            <Button fullWidth variant="secondary" onClick={onDrawAgain}>
              다시 뽑기
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
