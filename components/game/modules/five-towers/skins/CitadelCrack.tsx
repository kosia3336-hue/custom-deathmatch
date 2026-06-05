'use client';

import type { FTTower } from '@/shared/types/five-towers';

// viewBox "0 0 55 45" 기준 균열 경로 — 탑마다 각도/분기 다르게
const CRACKS: Record<FTTower, { main: string; branch: string }> = {
  A: {
    main:   'M 5 8 L 10 15 L 7 22 L 14 18 L 19 26 L 16 33 L 22 30 L 26 38',
    branch: 'M 19 26 L 26 29 L 23 36',
  },
  B: {
    main:   'M 8 5 L 14 12 L 10 20 L 17 16 L 14 25 L 21 22 L 18 32 L 24 29',
    branch: 'M 10 20 L 6 26 L 9 33',
  },
  C: {
    main:   'M 4 18 L 10 12 L 18 18 L 26 11 L 34 17 L 42 12 L 50 18',
    branch: 'M 34 17 L 37 26 L 33 33',
  },
  D: {
    main:   'M 19 3 L 23 10 L 18 18 L 24 15 L 20 24 L 26 21 L 22 31 L 27 28',
    branch: 'M 24 15 L 31 12 L 35 18',
  },
  E: {
    main:   'M 6 10 L 12 17 L 8 25 L 15 21 L 20 29 L 17 37 L 23 34 L 28 41',
    branch: 'M 15 21 L 21 17 L 26 22',
  },
};

export default function CitadelCrack({ id }: { id: FTTower }) {
  const { main, branch } = CRACKS[id];
  return (
    <svg
      className="skin-citadel-block-crack"
      viewBox="0 0 55 45"
      preserveAspectRatio="none"
      aria-hidden
    >
      {/* 균열 그림자 — 어두운 면 */}
      <path
        d={main}
        stroke="rgba(4,1,0,0.72)"
        strokeWidth="1.8"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* 균열 하이라이트 — 빛 받는 면 */}
      <path
        d={main}
        stroke="rgba(222,194,160,0.38)"
        strokeWidth="0.7"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
      {/* 분기 균열 */}
      <path
        d={branch}
        stroke="rgba(4,1,0,0.42)"
        strokeWidth="1.1"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
