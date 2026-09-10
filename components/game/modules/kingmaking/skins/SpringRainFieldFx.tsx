'use client';

import type { CSSProperties } from 'react';
import { useSkinFx } from '@/lib/skins/useSkinFx';

const DROPS = [
  { left: '7%', delay: '0s', duration: '2.8s' },
  { left: '18%', delay: '1.1s', duration: '3.4s' },
  { left: '31%', delay: '0.4s', duration: '3.1s' },
  { left: '47%', delay: '1.8s', duration: '3.6s' },
  { left: '62%', delay: '0.7s', duration: '2.9s' },
  { left: '74%', delay: '2.2s', duration: '3.3s' },
  { left: '86%', delay: '1.4s', duration: '3s' },
  { left: '95%', delay: '0.2s', duration: '3.5s' },
] as const;

/** 봄비 스킨의 저비용 빗방울. 착수 물결은 각 칸에서 별도로 재생한다. */
export default function SpringRainFieldFx() {
  const { reducedMotion, particleScale } = useSkinFx();
  const count = reducedMotion ? 0 : Math.round(DROPS.length * particleScale);

  return (
    <div className="skin-spring-rain-fx" aria-hidden>
      {DROPS.slice(0, count).map((drop, index) => (
        <span
          key={index}
          className="skin-spring-rain-drop"
          style={{
            left: drop.left,
            animationDelay: drop.delay,
            animationDuration: drop.duration,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}
