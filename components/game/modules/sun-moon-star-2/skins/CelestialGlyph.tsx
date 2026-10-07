'use client';

import type { SMS2MarkId } from '@/shared/types/sun-moon-star-2';
import { useId } from 'react';

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 팔각성. 모듈 로드 1회 */
function starPoly(cx: number, cy: number, rOuter: number, rInner: number, points: number) {
  const parts: string[] = [];
  const n = points * 2;
  for (let i = 0; i < n; i += 1) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    const x = r2(cx + Math.cos(a) * r);
    const y = r2(cy + Math.sin(a) * r);
    parts.push(`${i === 0 ? 'M' : 'L'}${x} ${y}`);
  }
  return `${parts.join(' ')}Z`;
}

const STAR_OUTER = starPoly(32, 32, 26.5, 11.2, 8);
const STAR_MID = starPoly(32, 32, 17.5, 7.2, 8);
const STAR_CORE = starPoly(32, 32, 8.4, 3.4, 8);

const STAR_MOTES: readonly [number, number, number][] = [
  [10, 16, 1],
  [52, 14, 2],
  [50, 50, 3],
  [12, 48, 4],
];

const SUN_RAYS = [0, 45, 90, 135, 180, 225, 270, 315] as const;
const SUN_MINOR = [22.5, 67.5, 112.5, 157.5, 202.5, 247.5, 292.5, 337.5] as const;
const SUN_PROMINENCES: readonly [number, number, number][] = [
  [18, 4.2, 2.1],
  [62, 3.4, 1.6],
  [128, 4.8, 2.2],
  [214, 3.6, 1.7],
  [302, 4, 1.9],
];

const MOON_MARIA: readonly [number, number, number, number][] = [
  [24, 32, 9.6, 7.4],
  [30, 24, 6.2, 4.8],
  [40, 28, 5.1, 4],
  [44, 34, 5.6, 4.2],
  [48, 30, 3.4, 3],
  [34, 42, 5.4, 4],
  [42, 42, 4, 3],
];

const MOON_CRATERS: readonly [number, number, number][] = [
  [42, 46, 2.4],
  [24, 30, 2.1],
  [20, 28, 1.4],
  [38, 26, 1.7],
  [48, 24, 1.2],
  [50, 34, 1.5],
  [28, 18, 1.3],
  [18, 38, 1.1],
  [42, 38, 1.2],
  [34, 16, 1],
];

const TYCHO = { cx: 42, cy: 46 } as const;
const TYCHO_RAYS: readonly [number, number][] = [
  [18, 22],
  [28, 12],
  [52, 18],
  [58, 32],
  [54, 56],
  [30, 58],
  [14, 48],
];

export function CelestialGlyph({ mark, className }: { mark: SMS2MarkId; className?: string }) {
  if (mark === 'sun') return <SunGlyph className={className} />;
  if (mark === 'moon') return <MoonGlyph className={className} />;
  return <StarGlyph className={className} />;
}

function SunGlyph({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className ?? 'skin-dalmaji-glyph'}>
      <defs>
        <radialGradient id={`${uid}-corona`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 236, 170, 0.55)" />
          <stop offset="42%" stopColor="rgba(255, 176, 48, 0.22)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${uid}-disc`} cx="32%" cy="26%" r="74%">
          <stop offset="0%" stopColor="#fffef2" />
          <stop offset="18%" stopColor="#ffe9a4" />
          <stop offset="46%" stopColor="#ffc24a" />
          <stop offset="78%" stopColor="#e08a14" />
          <stop offset="100%" stopColor="#b85a08" />
        </radialGradient>
        <radialGradient id={`${uid}-limb`} cx="78%" cy="78%" r="58%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="55%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(120, 40, 0, 0.38)" />
        </radialGradient>
        <radialGradient id={`${uid}-spec`} cx="30%" cy="24%" r="40%">
          <stop offset="0%" stopColor="rgba(255, 252, 240, 0.9)" />
          <stop offset="40%" stopColor="rgba(255, 220, 120, 0.28)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <linearGradient id={`${uid}-ray`} x1="0" y1="1" x2="0" y2="0">
          <stop offset="0%" stopColor="rgba(255, 170, 40, 0)" />
          <stop offset="38%" stopColor="rgba(255, 196, 64, 0.7)" />
          <stop offset="100%" stopColor="rgba(255, 248, 220, 0.95)" />
        </linearGradient>
        <filter id={`${uid}-gran`} x="-12%" y="-12%" width="124%" height="124%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.55"
            numOctaves="3"
            seed="6"
            result="n"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.9  0 0 0 0 0.45  0 0 0 0 0.08  0 0 0 0.22 0"
          />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <circle cx="32" cy="32" r="13.4" />
        </clipPath>
      </defs>
      <circle className="dj-glyph-sun-corona" cx="32" cy="32" r="31" fill={`url(#${uid}-corona)`} />
      <g className="dj-glyph-sun-rays">
        {SUN_RAYS.map((deg) => (
          <ellipse
            key={deg}
            cx="32"
            cy="10.4"
            rx="1.55"
            ry="9.4"
            fill={`url(#${uid}-ray)`}
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
        {SUN_MINOR.map((deg) => (
          <ellipse
            key={deg}
            cx="32"
            cy="15.2"
            rx="0.85"
            ry="5.2"
            fill="rgba(255, 232, 150, 0.5)"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
        {SUN_PROMINENCES.map(([deg, ry, rx]) => (
          <ellipse
            key={deg}
            cx="32"
            cy="16.6"
            rx={rx}
            ry={ry}
            fill="rgba(255, 120, 40, 0.55)"
            transform={`rotate(${deg} 32 32)`}
          />
        ))}
      </g>
      <g clipPath={`url(#${uid}-clip)`}>
        <circle cx="32" cy="32" r="13.4" fill={`url(#${uid}-disc)`} />
        <rect
          width="64"
          height="64"
          filter={`url(#${uid}-gran)`}
          opacity="0.42"
          style={{ mixBlendMode: 'multiply' }}
        />
        <circle cx="32" cy="32" r="13.4" fill={`url(#${uid}-limb)`} />
        <circle cx="32" cy="32" r="13.4" fill={`url(#${uid}-spec)`} />
      </g>
      <circle
        cx="32"
        cy="32"
        r="13"
        fill="none"
        stroke="rgba(255, 246, 200, 0.7)"
        strokeWidth="0.7"
      />
    </svg>
  );
}

function MoonGlyph({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className ?? 'skin-dalmaji-glyph'}>
      <defs>
        <radialGradient id={`${uid}-atm`} cx="50%" cy="50%" r="50%">
          <stop offset="68%" stopColor="transparent" />
          <stop offset="84%" stopColor="rgba(255, 236, 180, 0.42)" />
          <stop offset="100%" stopColor="rgba(255, 210, 90, 0)" />
        </radialGradient>
        <radialGradient id={`${uid}-body`} cx="30%" cy="24%" r="76%">
          <stop offset="0%" stopColor="#fffef8" />
          <stop offset="16%" stopColor="#fff3d4" />
          <stop offset="42%" stopColor="#f0d078" />
          <stop offset="78%" stopColor="#d4a038" />
          <stop offset="100%" stopColor="#b88420" />
        </radialGradient>
        <radialGradient id={`${uid}-limb`} cx="86%" cy="78%" r="58%">
          <stop offset="0%" stopColor="transparent" />
          <stop offset="58%" stopColor="transparent" />
          <stop offset="100%" stopColor="rgba(110, 62, 16, 0.28)" />
        </radialGradient>
        <radialGradient id={`${uid}-spec`} cx="28%" cy="22%" r="40%">
          <stop offset="0%" stopColor="rgba(255, 252, 244, 0.88)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${uid}-bowl`} cx="32%" cy="28%" r="70%">
          <stop offset="0%" stopColor="#8a6428" />
          <stop offset="55%" stopColor="#d2ae62" />
          <stop offset="100%" stopColor="#f4deaa" />
        </radialGradient>
        <filter id={`${uid}-mottle`} x="-10%" y="-10%" width="120%" height="120%">
          <feTurbulence
            type="fractalNoise"
            baseFrequency="0.085"
            numOctaves="3"
            seed="11"
            result="t"
          />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.55  0 0 0 0 0.48  0 0 0 0 0.28  0 0 0 0.38 0"
          />
        </filter>
        <clipPath id={`${uid}-clip`}>
          <circle cx="32" cy="32" r="14" />
        </clipPath>
      </defs>
      <circle className="dj-glyph-moon-halo" cx="32" cy="32" r="22" fill={`url(#${uid}-atm)`} />
      <circle
        className="dj-glyph-moon-ring"
        cx="32"
        cy="32"
        r="17"
        fill="none"
        stroke="rgba(255, 236, 180, 0.7)"
        strokeWidth="1.4"
      />
      <circle
        className="dj-glyph-moon-ripple"
        cx="32"
        cy="32"
        r="16"
        fill="none"
        stroke="rgba(255, 244, 200, 0.85)"
        strokeWidth="1.3"
      />
      <g className="dj-glyph-moon-body">
        <g clipPath={`url(#${uid}-clip)`}>
          <circle cx="32" cy="32" r="14" fill={`url(#${uid}-body)`} />
          <rect
            width="64"
            height="64"
            filter={`url(#${uid}-mottle)`}
            opacity="0.22"
            style={{ mixBlendMode: 'multiply' }}
          />
          <g opacity="0.28" style={{ mixBlendMode: 'multiply' }}>
            {MOON_MARIA.map(([cx, cy, rx, ry]) => (
              <ellipse key={`${cx}-${cy}`} cx={cx} cy={cy} rx={rx} ry={ry} fill="#6e6450" />
            ))}
          </g>
          <g opacity="0.22" style={{ mixBlendMode: 'screen' }}>
            {TYCHO_RAYS.map(([x2, y2]) => (
              <line
                key={`${x2}-${y2}`}
                x1={TYCHO.cx}
                y1={TYCHO.cy}
                x2={x2}
                y2={y2}
                stroke="rgba(255, 248, 220, 0.95)"
                strokeWidth="0.45"
              />
            ))}
          </g>
          {MOON_CRATERS.map(([cx, cy, r]) => (
            <g key={`${cx}-${cy}`}>
              <circle cx={cx} cy={cy} r={r} fill={`url(#${uid}-bowl)`} opacity="0.7" />
              <circle
                cx={cx - r * 0.28}
                cy={cy - r * 0.28}
                r={r * 0.4}
                fill="rgba(255, 248, 220, 0.4)"
              />
            </g>
          ))}
          <circle cx="32" cy="32" r="14" fill={`url(#${uid}-limb)`} />
          <circle cx="32" cy="32" r="14" fill={`url(#${uid}-spec)`} />
        </g>
        <circle
          cx="32"
          cy="32"
          r="13.4"
          fill="none"
          stroke="rgba(255, 248, 220, 0.72)"
          strokeWidth="0.8"
        />
      </g>
    </svg>
  );
}

function StarGlyph({ className }: { className?: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 64 64" aria-hidden className={className ?? 'skin-dalmaji-glyph'}>
      <defs>
        <radialGradient id={`${uid}-glow`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255, 244, 210, 0.95)" />
          <stop offset="32%" stopColor="rgba(255, 210, 110, 0.32)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <radialGradient id={`${uid}-gold`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fffef4" />
          <stop offset="28%" stopColor="#ffe08a" />
          <stop offset="68%" stopColor="#e0b03a" />
          <stop offset="100%" stopColor="#9a6a10" />
        </radialGradient>
        <radialGradient id={`${uid}-core`} cx="38%" cy="34%" r="62%">
          <stop offset="0%" stopColor="#fffef8" />
          <stop offset="55%" stopColor="#ffe9b0" />
          <stop offset="100%" stopColor="#e8c56a" />
        </radialGradient>
      </defs>
      <circle className="dj-glyph-star-glow" cx="32" cy="32" r="30" fill={`url(#${uid}-glow)`} />
      <g className="dj-glyph-star-body">
        <path
          d={STAR_OUTER}
          fill={`url(#${uid}-gold)`}
          stroke="rgba(255, 248, 220, 0.75)"
          strokeWidth="0.7"
        />
        <path d={STAR_MID} fill="#fff6d8" opacity="0.55" />
        <path d={STAR_CORE} fill={`url(#${uid}-core)`} />
        <circle cx="32" cy="32" r="2.1" fill="#fffef8" />
      </g>
      {STAR_MOTES.map(([x, y, i]) => (
        <path
          key={`${x}-${y}`}
          className={`dj-glyph-star-mote dj-glyph-star-mote-${i}`}
          d={`M${x} ${y - 3.2} L${x + 0.9} ${y - 0.7} L${x + 3.2} ${y} L${x + 0.9} ${y + 0.7} L${x} ${y + 3.2} L${x - 0.9} ${y + 0.7} L${x - 3.2} ${y} L${x - 0.9} ${y - 0.7} Z`}
          fill="#fff8e0"
        />
      ))}
    </svg>
  );
}
