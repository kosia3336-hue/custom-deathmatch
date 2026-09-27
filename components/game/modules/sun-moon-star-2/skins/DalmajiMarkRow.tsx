'use client';

import { MARK_IDS, MARK_PRIORITY } from '@/shared/types/sun-moon-star-2';
import type { SMS2MarkId, SMS2PowderSubmission } from '@/shared/types/sun-moon-star-2';
import { CelestialGlyph } from './CelestialGlyph';

interface Props {
  myContribution: SMS2PowderSubmission | null;
  pendingPowder: SMS2PowderSubmission | null;
  litMark: SMS2MarkId | null;
  dimUnlit: boolean;
  size?: 'sm' | 'md';
}

export default function DalmajiMarkRow({
  myContribution,
  pendingPowder,
  litMark,
  dimUnlit,
  size = 'sm',
}: Props) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {MARK_IDS.map((mark) => (
        <DalmajiMarkCard
          key={mark}
          mark={mark}
          size={size}
          myContribution={myContribution?.[mark] ?? 0}
          pendingPowder={pendingPowder?.[mark] ?? 0}
          lit={litMark === mark}
          dim={dimUnlit && litMark !== null && litMark !== mark}
        />
      ))}
    </div>
  );
}

function DalmajiMarkCard({
  mark,
  size,
  myContribution,
  pendingPowder,
  lit,
  dim,
}: {
  mark: SMS2MarkId;
  size: 'sm' | 'md';
  myContribution: number;
  pendingPowder: number;
  lit: boolean;
  dim: boolean;
}) {
  const total = myContribution + pendingPowder;
  const labels = { sun: '해', moon: '달', star: '별' } as const;

  return (
    <div
      className={[
        'skin-dalmaji-mark',
        `skin-dalmaji-mark--${mark}`,
        lit ? 'skin-dalmaji-mark--lit' : '',
        dim ? 'skin-dalmaji-mark--dim' : '',
        size === 'md' ? 'skin-dalmaji-mark--md' : 'skin-dalmaji-mark--sm',
      ].join(' ')}
      aria-label={`${labels[mark]}, 우선순위 ${MARK_PRIORITY[mark]}, 내 누적 ${total}g`}
    >
      {lit && (
        <span className="skin-dalmaji-mark-halo" aria-hidden>
          <span className="skin-dalmaji-mark-halo-bloom" />
          <span className="skin-dalmaji-mark-halo-ring" />
        </span>
      )}
      <span className="skin-dalmaji-mark-priority">#{MARK_PRIORITY[mark]}</span>
      {lit && <span className="skin-dalmaji-mark-lit-tag">점등</span>}
      <div className={`skin-dalmaji-mark-glyph ${size === 'md' ? 'h-16 w-16' : 'h-12 w-12'}`}>
        <CelestialGlyph mark={mark} />
      </div>
      <span className="skin-dalmaji-mark-label">{labels[mark]}</span>
      {total > 0 && (
        <span className="skin-dalmaji-mark-chip">
          내 {total}g
          {pendingPowder > 0 && <span className="opacity-70"> (+{pendingPowder})</span>}
        </span>
      )}
    </div>
  );
}
