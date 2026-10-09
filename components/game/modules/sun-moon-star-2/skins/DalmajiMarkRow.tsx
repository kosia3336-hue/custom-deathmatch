'use client';

import type { SMS2MarkId, SMS2PowderSubmission } from '@/shared/types/sun-moon-star-2';
import { MARK_IDS, MARK_PRIORITY } from '@/shared/types/sun-moon-star-2';
import { CelestialGlyph } from './CelestialGlyph';

interface Props {
  myContribution: SMS2PowderSubmission | null;
  pendingPowder: SMS2PowderSubmission | null;
  /** 이번 라운드 분배량 — 누적 기여와 별도로 표시 */
  roundPowder: SMS2PowderSubmission | null;
  litMark: SMS2MarkId | null;
  dimUnlit: boolean;
  size?: 'sm' | 'md';
}

export default function DalmajiMarkRow({
  myContribution,
  pendingPowder,
  roundPowder,
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
          roundPowder={roundPowder?.[mark] ?? null}
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
  roundPowder,
  lit,
  dim,
}: {
  mark: SMS2MarkId;
  size: 'sm' | 'md';
  myContribution: number;
  pendingPowder: number;
  roundPowder: number | null;
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
      aria-label={`${labels[mark]}, 우선순위 ${MARK_PRIORITY[mark]}, 내 누적 ${total}g${roundPowder !== null ? `, 이번 ${roundPowder}g` : ''}`}
    >
      <span className="skin-dalmaji-mark-priority">#{MARK_PRIORITY[mark]}</span>
      {lit && <span className="skin-dalmaji-mark-lit-tag">점등</span>}
      <div className={`skin-dalmaji-mark-glyph ${size === 'md' ? 'h-16 w-16' : 'h-12 w-12'}`}>
        {lit && (
          <span className="skin-dalmaji-mark-halo" aria-hidden>
            <span className="skin-dalmaji-mark-halo-bloom" />
            <span className="skin-dalmaji-mark-halo-ring" />
          </span>
        )}
        <CelestialGlyph mark={mark} />
      </div>
      <span className="skin-dalmaji-mark-label">{labels[mark]}</span>
      {(total > 0 || roundPowder !== null) && (
        <span className="skin-dalmaji-mark-chip flex flex-col items-center">
          <span>내 누적 {total}g</span>
          {roundPowder !== null && <span className="opacity-75">이번 {roundPowder}g</span>}
        </span>
      )}
    </div>
  );
}
