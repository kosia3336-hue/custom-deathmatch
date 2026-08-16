import type { CSSProperties } from 'react';

/**
 * 잿불·재 날림 연출.
 *
 * 값은 모두 고정 상수라 서버/클라이언트 렌더 결과가 같다(하이드레이션 불일치 없음).
 * 움직임은 전부 CSS 애니메이션이라 JS 런타임 비용이 없고,
 * prefers-reduced-motion 에서는 globals.css 가 애니메이션을 끈다.
 */

interface Particle {
  /** 가로 위치(%) */
  x: number;
  /** 입자 크기(px) */
  size: number;
  /** 한 주기 길이(s) */
  duration: number;
  /** 시작 지연(s) */
  delay: number;
  /** 상승하며 옆으로 흐르는 거리(px) */
  drift: number;
  /** 상승 거리(px) */
  rise: number;
  opacity: number;
  /** true 면 빛나지 않는 재 */
  ash?: boolean;
}

const PARTICLES: Particle[] = [
  { x: 4, size: 3, duration: 11, delay: 0, drift: 34, rise: -430, opacity: 0.9 },
  { x: 9, size: 2, duration: 14, delay: 2.6, drift: -22, rise: -500, opacity: 0.55, ash: true },
  { x: 14, size: 4, duration: 9.5, delay: 1.2, drift: 46, rise: -390, opacity: 0.85 },
  { x: 19, size: 2, duration: 13, delay: 4.1, drift: 18, rise: -470, opacity: 0.5, ash: true },
  { x: 24, size: 3, duration: 10.5, delay: 0.6, drift: -30, rise: -440, opacity: 0.8 },
  { x: 29, size: 5, duration: 8.5, delay: 3.4, drift: 26, rise: -360, opacity: 0.95 },
  { x: 34, size: 2, duration: 15, delay: 1.9, drift: -40, rise: -520, opacity: 0.45, ash: true },
  { x: 38, size: 3, duration: 12, delay: 5.2, drift: 32, rise: -450, opacity: 0.85 },
  { x: 43, size: 2, duration: 10, delay: 0.3, drift: -18, rise: -410, opacity: 0.7 },
  { x: 47, size: 4, duration: 13.5, delay: 2.2, drift: 40, rise: -490, opacity: 0.9 },
  { x: 52, size: 2, duration: 11.5, delay: 6.1, drift: -26, rise: -430, opacity: 0.5, ash: true },
  { x: 56, size: 3, duration: 9, delay: 3.8, drift: 22, rise: -380, opacity: 0.85 },
  { x: 61, size: 5, duration: 12.5, delay: 1.5, drift: -34, rise: -470, opacity: 0.95 },
  { x: 65, size: 2, duration: 14.5, delay: 4.6, drift: 30, rise: -510, opacity: 0.45, ash: true },
  { x: 70, size: 3, duration: 10.2, delay: 0.9, drift: -20, rise: -420, opacity: 0.8 },
  { x: 74, size: 4, duration: 11.8, delay: 5.7, drift: 38, rise: -460, opacity: 0.9 },
  { x: 79, size: 2, duration: 13.2, delay: 2.9, drift: -28, rise: -480, opacity: 0.55, ash: true },
  { x: 83, size: 3, duration: 9.8, delay: 1.1, drift: 24, rise: -400, opacity: 0.85 },
  { x: 88, size: 2, duration: 12.8, delay: 4.3, drift: -36, rise: -500, opacity: 0.5, ash: true },
  { x: 92, size: 4, duration: 10.8, delay: 2.4, drift: 28, rise: -440, opacity: 0.9 },
  { x: 96, size: 3, duration: 14, delay: 6.5, drift: -24, rise: -520, opacity: 0.75 },
  { x: 12, size: 2, duration: 16, delay: 7.2, drift: 44, rise: -560, opacity: 0.4, ash: true },
  { x: 45, size: 3, duration: 15.5, delay: 8.1, drift: -42, rise: -540, opacity: 0.45, ash: true },
  { x: 68, size: 2, duration: 16.5, delay: 5.9, drift: 36, rise: -580, opacity: 0.4, ash: true },
];

/** 잿불 색 — 따뜻한 주황 계열로 남은 불씨 느낌 */
const EMBER_COLOR = 'rgba(255, 168, 84, 0.95)';

export default function EmberField() {
  return (
    <div className="guide-embers" aria-hidden>
      {PARTICLES.map((p, i) => (
        <span
          key={i}
          className={p.ash ? 'guide-ember guide-ember--ash' : 'guide-ember'}
          style={
            {
              left: `${p.x}%`,
              '--ember-size': `${p.size}px`,
              '--ember-duration': `${p.duration}s`,
              '--ember-delay': `${p.delay}s`,
              '--ember-drift': `${p.drift}px`,
              '--ember-rise': `${p.rise}px`,
              '--ember-opacity': p.opacity,
              '--ember-scale': 1,
              '--ember-blur': `${p.size * 2.5}px`,
              ...(p.ash ? {} : { '--ember-color': EMBER_COLOR }),
            } as CSSProperties
          }
        />
      ))}
    </div>
  );
}
