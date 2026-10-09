'use client';

import Image from 'next/image';
import type { DisplayRankTier } from '@/shared/types/rank';

const TIERS: { id: DisplayRankTier; label: string }[] = [
  { id: 'bronze', label: '브론즈' },
  { id: 'silver', label: '실버' },
  { id: 'gold', label: '골드' },
  { id: 'diamond', label: '다이아' },
  { id: 'challenger', label: '챌린저' },
];

/** 소개 랭크 — 낮은 티어부터 조금씩 커진다. */
export default function IntroRankPanel() {
  return (
    <ol className="intro-tier-row">
      {TIERS.map((tier, i) => (
        <li key={tier.id} className={`intro-tier intro-tier--${i}`}>
          <Image
            src={`/rank/tier-${tier.id}.webp`}
            alt=""
            width={128}
            height={128}
            className="intro-tier-img"
          />
          <span className="intro-tier-label">{tier.label}</span>
        </li>
      ))}
    </ol>
  );
}
