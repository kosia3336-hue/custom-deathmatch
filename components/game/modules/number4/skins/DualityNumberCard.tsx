'use client';

import type { CSSProperties } from 'react';

interface DualityNumberCardProps {
  number: number;
  reward: number;
  condition: string;
  isSelected: boolean;
  onClick: () => void;
}

const ENERGY: Record<number, { color: string; soft: string; glow: string; tint: string }> = {
  0: { color: '#a855f7', soft: 'rgba(168,85,247,0.28)',  glow: 'rgba(168,85,247,0.5)',  tint: 'rgba(168,85,247,0.12)' },
  1: { color: '#22d3ee', soft: 'rgba(34,211,238,0.28)',  glow: 'rgba(34,211,238,0.5)',  tint: 'rgba(34,211,238,0.10)' },
  2: { color: '#60a5fa', soft: 'rgba(96,165,250,0.28)',  glow: 'rgba(96,165,250,0.5)',  tint: 'rgba(96,165,250,0.10)' },
  3: { color: '#fb923c', soft: 'rgba(251,146,60,0.28)',  glow: 'rgba(251,146,60,0.5)',  tint: 'rgba(251,146,60,0.10)' },
  4: { color: '#ef4444', soft: 'rgba(239,68,68,0.28)',   glow: 'rgba(239,68,68,0.5)',   tint: 'rgba(239,68,68,0.10)'  },
};

export default function DualityNumberCard({
  number,
  reward,
  condition,
  isSelected,
  onClick,
}: DualityNumberCardProps) {
  const e = ENERGY[number] ?? ENERGY[0];

  const cardStyle: CSSProperties = isSelected
    ? {
        border: `2px solid ${e.color}`,
        boxShadow: `0 0 0 3px ${e.soft}, 0 0 20px ${e.glow}`,
        background: `linear-gradient(160deg, ${e.tint} 0%, rgba(9,14,28,0.97) 100%)`,
      }
    : {
        border: `1px solid rgba(255,255,255,0.09)`,
      };

  return (
    <button
      onClick={onClick}
      className={`skin-duality-number-card flex flex-col items-center gap-0.5 p-2 transition-all ${
        number === 0 ? 'skin-duality-number-0-pulse' : ''
      }`}
      style={cardStyle}
    >
      <span
        className="text-xl font-bold leading-tight"
        style={{ color: e.color, textShadow: `0 0 10px ${e.color}, 0 0 22px ${e.soft}` }}
      >
        {number}
      </span>
      <span className="text-xs font-bold" style={{ color: e.color }}>
        +{reward}
      </span>
      <span
        className="text-center leading-tight"
        style={{ fontSize: '0.6rem', color: 'rgba(170,190,220,0.75)', whiteSpace: 'pre-line' }}
      >
        {condition}
      </span>
    </button>
  );
}
