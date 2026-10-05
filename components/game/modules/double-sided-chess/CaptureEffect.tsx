'use client';

import { useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PieceType, Owner } from '@/shared/types/double-sided-chess';
import type { SkinTheme } from '@/lib/skins/registry';
import { getPieceLabel, OWNER_COLOR } from './constants';
import { cn } from '@/lib/utils';
import { playSlashSound } from '@/lib/audio/synth/capture';

/* 정오각형: first = 꼭짓점 위, second = 꼭짓점 아래 */
const CLIP_FIRST  = 'polygon(50% 0%, 100% 38%, 82% 100%, 18% 100%, 0% 38%)';
const CLIP_SECOND = 'polygon(50% 100%, 100% 62%, 82% 0%, 18% 0%, 0% 62%)';

interface Props {
  piece: PieceType;
  owner: Owner;
  isPromoted: boolean;
  skin?: SkinTheme | null;
  reducedMotion?: boolean;
  onComplete: () => void;
}

export default function CaptureEffect({
  piece,
  owner,
  isPromoted,
  skin,
  reducedMotion = false,
  onComplete,
}: Props) {
  const label      = getPieceLabel(piece, isPromoted);
  const colors     = OWNER_COLOR[owner];
  const clip       = owner === 'first' ? CLIP_FIRST : CLIP_SECOND;
  const isImperial = skin === 'imperial';

  const pieceClasses = cn(
    'flex h-full w-full items-center justify-center font-bold text-sm select-none',
    isImperial
      ? cn(
          'skin-imperial-piece',
          owner === 'first' ? 'skin-imperial-piece-first' : 'skin-imperial-piece-second',
          isPromoted && piece !== 'king' && 'skin-imperial-piece-promoted',
        )
      : cn(colors.bg, colors.text),
  );

  /* 마운트 시 1회 재생 */
  useEffect(() => {
    if (!reducedMotion) playSlashSound();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const dur   = reducedMotion ? 0.01 : 0.34;
  const delay = reducedMotion ? 0    : 0.03;

  /* 조각을 위/아래 반으로 잘라 각각 날리는 대신,
     두 개의 반-불투명 복사본이 반대 방향으로 날아가도록 한다.
     clip-path 이중 적용(외부 slash + 내부 pentagon) 문제를 피한다.  */

  const sharedStyle = { clipPath: clip };

  return (
    <div className="absolute inset-[7%] pointer-events-none" style={{ zIndex: 10 }}>

      {/* 순간 플래시 */}
      <motion.div
        className="absolute inset-0 rounded-sm"
        initial={{ opacity: isImperial ? 0.8 : 0.55 }}
        animate={{ opacity: 0 }}
        transition={{ duration: 0.14 }}
        style={{
          background: isImperial
            ? 'radial-gradient(circle, rgba(255,220,100,0.95) 0%, transparent 70%)'
            : 'radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)',
        }}
      />

      {/* 상단 조각 — 우상향 */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'inset(0 0 50% 0)' }}
        initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
        animate={{ y: -26, x: 10, rotate: -16, opacity: 0 }}
        transition={{ duration: dur, ease: 'easeOut', delay }}
      >
        <div
          className={pieceClasses}
          style={{ ...sharedStyle, position: 'absolute', inset: 0 }}
        />
      </motion.div>

      {/* 하단 조각 — 좌하향 */}
      <motion.div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: 'inset(50% 0 0 0)' }}
        initial={{ y: 0, x: 0, rotate: 0, opacity: 1 }}
        animate={{ y: 26, x: -10, rotate: 16, opacity: 0 }}
        transition={{ duration: dur, ease: 'easeOut', delay }}
        onAnimationComplete={onComplete}
      >
        <div
          className={pieceClasses}
          style={{ ...sharedStyle, position: 'absolute', inset: 0 }}
        />
      </motion.div>

    </div>
  );
}
