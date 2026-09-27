'use client';

import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import { CelestialGlyph } from './CelestialGlyph';

const LABELS: Record<SMS2MarkId, string> = { sun: '해', moon: '달', star: '별' };

export default function DalmajiLitReveal({
  mark,
  compact = false,
}: {
  mark: SMS2MarkId;
  compact?: boolean;
}) {
  if (compact) {
    return (
      <div className={`skin-dalmaji-lit-banner skin-dalmaji-reveal--${mark}`}>
        <span className="h-9 w-9 shrink-0">
          <CelestialGlyph mark={mark} />
        </span>
        <span className="skin-dalmaji-reveal-label">{LABELS[mark]} 점등</span>
      </div>
    );
  }

  return (
    <div className={`skin-dalmaji-reveal skin-dalmaji-reveal--${mark}`}>
      <span className="skin-dalmaji-reveal-halo" aria-hidden>
        <span className="skin-dalmaji-reveal-halo-bloom" />
        <span className="skin-dalmaji-reveal-halo-ring" />
        <span className="skin-dalmaji-reveal-halo-ring skin-dalmaji-reveal-halo-ring-outer" />
      </span>
      <div className="skin-dalmaji-reveal-glyph">
        <CelestialGlyph mark={mark} />
      </div>
      <p className="skin-dalmaji-reveal-label">{LABELS[mark]} 점등</p>
    </div>
  );
}
