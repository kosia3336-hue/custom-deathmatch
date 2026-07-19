'use client';

import { useSkinFx } from '@/lib/skins/useSkinFx';

/** 필드 위를 떠다니는 젤리 발자국. 저사양이면 개수 절감, reduced-motion이면 CSS에서 정지 */
const PAWS = [
  { left: '8%',  top: '18%', delay: '0s'   },
  { left: '86%', top: '12%', delay: '2.2s' },
  { left: '16%', top: '72%', delay: '4.1s' },
  { left: '78%', top: '80%', delay: '6.3s' },
  { left: '50%', top: '40%', delay: '7.5s' },
];

export default function MeowFieldFx() {
  const { lowSpec } = useSkinFx();
  const paws = lowSpec ? PAWS.slice(0, 2) : PAWS;
  return (
    <div className="skin-meow-fx" aria-hidden>
      {paws.map((p, i) => (
        <span
          key={i}
          className="skin-meow-paw"
          style={{ left: p.left, top: p.top, animationDelay: p.delay }}
        >
          🐾
        </span>
      ))}
    </div>
  );
}
