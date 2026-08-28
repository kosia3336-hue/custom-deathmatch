'use client';

import { useSkinFx } from '@/lib/skins/useSkinFx';

const GLINTS = [
  { left: '8%', top: '13%', delay: '0s' },
  { left: '38%', top: '7%', delay: '1.7s' },
  { left: '72%', top: '18%', delay: '3.1s' },
  { left: '91%', top: '9%', delay: '4.4s' },
] as const;

/** 심야금고 스킨의 저비용 황동 반짝임 레이어. */
export default function TreasuryFieldFx() {
  const { reducedMotion, particleScale } = useSkinFx();
  const count = reducedMotion ? 0 : Math.max(1, Math.round(GLINTS.length * particleScale));

  return (
    <div className="skin-treasury-fx" aria-hidden>
      {GLINTS.slice(0, count).map((glint, index) => (
        <span
          key={index}
          className="skin-treasury-glint"
          style={{ left: glint.left, top: glint.top, animationDelay: glint.delay }}
        />
      ))}
    </div>
  );
}
