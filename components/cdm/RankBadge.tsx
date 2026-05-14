'use client';

import Image from 'next/image';
import { cn } from '@/lib/utils';
import type { DisplayRankTier } from '@/shared/types/rank';

const ICON_PX = { sm: 16, md: 20, lg: 28, xl: 56 } as const;

const TIER_LABEL: Record<DisplayRankTier, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

const TIER_COLOR: Record<DisplayRankTier, string> = {
  unranked: 'text-neutral-500',
  bronze: 'text-amber-700 dark:text-amber-500',
  silver: 'text-slate-500 dark:text-slate-400',
  gold: 'text-yellow-600 dark:text-yellow-500',
  diamond: 'text-cyan-600 dark:text-cyan-400',
  challenger: 'text-purple-600 dark:text-purple-400',
};

function iconPath(tier: DisplayRankTier): string {
  return `/rank/tier-${tier}.png`;
}

export interface RankBadgeProps {
  tier: DisplayRankTier;
  rp?: number;
  size?: keyof typeof ICON_PX;
  showRp?: boolean;
  showLabel?: boolean;
  className?: string;
}

export function RankBadge({
  tier,
  rp,
  size = 'md',
  showRp = false,
  showLabel = true,
  className,
}: RankBadgeProps) {
  const px = ICON_PX[size];
  return (
    <span className={cn('inline-flex items-center gap-1', TIER_COLOR[tier], className)}>
      <Image
        src={iconPath(tier)}
        alt=""
        width={px}
        height={px}
        className="shrink-0"
      />
      {showLabel && <span className="font-semibold leading-none">{TIER_LABEL[tier]}</span>}
      {showRp && rp !== undefined && (
        <span className="font-medium text-cdm-fg-muted">{rp} RP</span>
      )}
    </span>
  );
}
