'use client';

import { useId } from 'react';
import { useSkinFx } from '@/lib/skins/useSkinFx';
import type { DalmajiSky } from './dalmajiSky';

type Star = readonly [number, number, number, number];

function makeStarfield(count: number, seed: number): Star[] {
  let s = seed;
  const next = () => {
    s = (s * 16807) % 2147483647;
    return (s % 10000) / 10000;
  };
  const out: Star[] = [];
  for (let i = 0; i < count; i += 1) {
    const x = Math.round((2 + next() * 396) * 10) / 10;
    const y = Math.round((4 + next() * 165) * 10) / 10;
    const bright = next() > 0.78;
    const r = bright ? 2.1 + next() * 1.8 : 1.2 + next() * 1.1;
    const o = bright ? 0.88 + next() * 0.12 : 0.5 + next() * 0.4;
    out.push([x, y, Math.round(r * 100) / 100, Math.round(o * 100) / 100]);
  }
  return out;
}

const STARFIELD: readonly Star[] = makeStarfield(140, 7919);

/** 북두 — 별층 viewBox 400×240 기준, 화면 위쪽에 고정 */
const BEIDOU: readonly [number, number][] = [
  [174, 30],
  [183, 34],
  [191, 33],
  [199, 38],
  [207, 28],
  [215, 18],
  [224, 14],
];

const SPARK_STARS: readonly [number, number][] = [
  [48, 22],
  [96, 48],
  [132, 16],
  [268, 24],
  [312, 52],
  [348, 18],
];

function r2(n: number) {
  return Math.round(n * 100) / 100;
}

/** 모듈 로드 시 1회. 렌더에서 sin/cos 안 씀 */
function scallop(cx: number, cy: number, rx: number, ry: number, lobes: number, bulge = 1.16) {
  let d = '';
  for (let i = 0; i < lobes; i += 1) {
    const a0 = -Math.PI / 2 + (i / lobes) * Math.PI * 2;
    const a1 = -Math.PI / 2 + ((i + 1) / lobes) * Math.PI * 2;
    const am = (a0 + a1) / 2;
    const x0 = r2(cx + Math.cos(a0) * rx);
    const y0 = r2(cy + Math.sin(a0) * ry);
    const xm = r2(cx + Math.cos(am) * rx * bulge);
    const ym = r2(cy + Math.sin(am) * ry * bulge);
    const x1 = r2(cx + Math.cos(a1) * rx);
    const y1 = r2(cy + Math.sin(a1) * ry);
    d += i === 0 ? `M${x0} ${y0}` : '';
    d += `Q${xm} ${ym} ${x1} ${y1}`;
  }
  return `${d}Z`;
}

const CANOPY_LO = scallop(0, -62, 40, 23, 11, 1.17);
const CANOPY_MID = scallop(1, -98, 30, 17, 10, 1.15);
const CANOPY_HI = scallop(0, -128, 20, 13, 8, 1.14);
const CANOPY_L = scallop(-34, -84, 18, 13, 8, 1.15);
const CANOPY_R = scallop(32, -92, 16, 12, 7, 1.14);

const GIWA: readonly string[] = [
  'M168 352 Q276 324 384 352',
  'M176 346 Q276 318 384 346',
  'M184 340 Q276 314 376 340',
  'M192 334 Q276 310 368 334',
  'M198 328 Q276 306 360 328',
  'M206 322 Q276 302 354 322',
  'M214 316 Q276 298 348 316',
  'M224 310 Q276 294 338 310',
];

function Peak({
  d,
  folds,
  variant,
  uid,
}: {
  d: string;
  folds: readonly string[];
  variant: 1 | 2 | 3;
  uid: string;
}) {
  return (
    <g>
      <path d={d} fill={`url(#${uid}-peak-${variant})`} />
      <path d={d} className="dj-peak-outline" />
      {folds.map((fd) => (
        <path key={fd} className="dj-peak-fold" d={fd} />
      ))}
    </g>
  );
}

function MinhwaPine({ x, ground, h, flip = false }: { x: number; ground: number; h: number; flip?: boolean }) {
  const s = h / 180;
  return (
    <g className="dj-pine" transform={`translate(${x} ${ground}) scale(${flip ? -s : s} ${s})`}>
      <path d="M-16 6 C-28 2 -22 -12 -6 -16 L12 -16 C24 -8 26 8 10 10 C2 16 -10 16 -16 6 Z" />
      <path d="M-5.5 2 C-8 -48 -2 -96 -5 -138 L6.5 -138 C8.5 -96 7.5 -48 6 2 Z" />
      <g className="dj-bark" fill="none">
        <path d="M-2 -24 C0 -22 2 -26 3 -24" />
        <path d="M-3 -48 C0 -46 2 -50 3.5 -47" />
        <path d="M-2 -72 C0 -70 2 -74 3 -71" />
        <path d="M-3 -98 C0 -96 1.5 -100 3 -97" />
        <path d="M-1 -118 C1 -116 2 -120 3 -117" />
      </g>
      <path d="M-4 -78 C-22 -82 -40 -76 -54 -90" fill="none" stroke="currentColor" strokeWidth="2.4" />
      <path d="M4 -96 C20 -100 36 -94 48 -108" fill="none" stroke="currentColor" strokeWidth="2.1" />
      <path d={CANOPY_LO} />
      <path d={CANOPY_L} />
      <path d={CANOPY_R} />
      <path d={CANOPY_MID} />
      <path d={CANOPY_HI} />
    </g>
  );
}

function Cheongsacho({ cx, cy }: { cx: number; cy: number }) {
  return (
    <g transform={`translate(${cx} ${cy})`}>
      <path className="dj-cheongsacho" d="M0 -14 L12 -8 L12 10 L0 16 L-12 10 L-12 -8 Z" />
      <path d="M0 -8 L7 -4 L7 6 L0 10 L-7 6 L-7 -4 Z" fill="none" stroke="#f0d078" strokeWidth="0.9" />
      <path d="M-12 -2 H12 M-12 4 H12" fill="none" stroke="#f6e7b0" strokeWidth="0.55" opacity="0.7" />
      <path d="M0 16 L0 28" fill="none" stroke="#c9a24a" strokeWidth="1.1" />
      <path d="M-5 20 Q-8 30 -12 34" fill="none" stroke="#c44a32" strokeWidth="1.05" />
      <path d="M5 20 Q8 30 12 34" fill="none" stroke="#2a6a7a" strokeWidth="1.05" />
      <circle cx="-12" cy="34" r="1.6" fill="#c44a32" />
      <circle cx="0" cy="28" r="1.5" fill="#e8c56a" />
      <circle cx="12" cy="34" r="1.6" fill="#2a6a7a" />
    </g>
  );
}

export default function DalmajiFieldFx({ sky }: { sky: DalmajiSky }) {
  const uid = useId().replace(/:/g, '');
  const { lowSpec } = useSkinFx();

  return (
    <div className="skin-dalmaji-fx" data-sky={sky} aria-hidden>
      <div className="skin-dalmaji-wash skin-dalmaji-wash--dawn" />
      <div className="skin-dalmaji-wash skin-dalmaji-wash--morning" />
      <div className="skin-dalmaji-wash skin-dalmaji-wash--night" />

      <svg className="skin-dalmaji-starfield" viewBox="0 0 400 240" preserveAspectRatio="xMidYMin slice" aria-hidden>
        {STARFIELD.map(([x, y, r, o]) => (
          <g key={`${x}-${y}-${r}`}>
            {r > 1.6 ? <circle cx={x} cy={y} r={r * 3.2} fill="#fff6d8" opacity="0.22" /> : null}
            <circle cx={x} cy={y} r={r} fill="#fff8e8" opacity={o} />
          </g>
        ))}
        {BEIDOU.map(([x, y], i) => (
          <g key={`bd-${i}`}>
            <circle cx={x} cy={y} r={i === 3 ? 2.8 : 1.8} fill="#fff6d8" />
            <path
              d={`M${x} ${y - 6} L${x + 0.8} ${y - 1.5} L${x + 5.6} ${y - 1.2} L${x + 1.5} ${y + 0.9} L${x + 2.6} ${y + 5.4} L${x} ${y + 2.2} L${x - 2.6} ${y + 5.4} L${x - 1.5} ${y + 0.9} L${x - 5.6} ${y - 1.2} L${x - 0.8} ${y - 1.5} Z`}
              fill="#fff8e0"
              opacity="0.55"
            />
          </g>
        ))}
        <polyline
          points={BEIDOU.map(([x, y]) => `${x},${y}`).join(' ')}
          fill="none"
          stroke="rgba(255, 236, 190, 0.55)"
          strokeWidth="0.9"
        />
        {SPARK_STARS.map(([x, y], i) => (
          <path
            key={`sp-${x}-${y}`}
            className={`skin-dalmaji-spark skin-dalmaji-spark-${(i % 4) + 1}`}
            d={`M${x} ${y - 4.2} L${x + 0.9} ${y - 0.9} L${x + 4} ${y} L${x + 0.9} ${y + 0.9} L${x} ${y + 4.2} L${x - 0.9} ${y + 0.9} L${x - 4} ${y} L${x - 0.9} ${y - 0.9} Z`}
            fill="#fff8e0"
          />
        ))}
      </svg>

      <svg className="skin-dalmaji-sky" viewBox="0 0 960 540" preserveAspectRatio="xMidYMax slice">
        <defs>
          <radialGradient id={`${uid}-moon-atm`} cx="50%" cy="50%" r="50%">
            <stop offset="70%" stopColor="transparent" />
            <stop offset="86%" stopColor="rgba(255, 228, 160, 0.48)" />
            <stop offset="100%" stopColor="rgba(255, 186, 70, 0)" />
          </radialGradient>
          <radialGradient id={`${uid}-moon-body`} cx="30%" cy="24%" r="76%">
            <stop offset="0%" stopColor="#fffef8" />
            <stop offset="16%" stopColor="#fff6e0" />
            <stop offset="38%" stopColor="#ffe9b8" />
            <stop offset="62%" stopColor="#f0d078" />
            <stop offset="100%" stopColor="#d4a038" />
          </radialGradient>
          <radialGradient id={`${uid}-moon-limb`} cx="84%" cy="76%" r="58%">
            <stop offset="40%" stopColor="transparent" />
            <stop offset="100%" stopColor="rgba(110, 62, 16, 0.28)" />
          </radialGradient>
          <radialGradient id={`${uid}-moon-spec`} cx="28%" cy="22%" r="40%">
            <stop offset="0%" stopColor="rgba(255, 252, 244, 0.88)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id={`${uid}-sun-body`} cx="32%" cy="28%" r="72%">
            <stop offset="0%" stopColor="#fff0c8" />
            <stop offset="28%" stopColor="#ff6a2a" />
            <stop offset="70%" stopColor="#d02418" />
            <stop offset="100%" stopColor="#9a140c" />
          </radialGradient>
          <radialGradient id={`${uid}-lantern`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(255, 210, 90, 0.9)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <linearGradient id={`${uid}-peak-1`} x1="0.18" y1="0" x2="0.55" y2="1">
            <stop offset="0%" stopColor="var(--dj-peak-hi)" />
            <stop offset="42%" stopColor="var(--dj-peak-a)" />
            <stop offset="100%" stopColor="var(--dj-peak-c)" />
          </linearGradient>
          <linearGradient id={`${uid}-peak-2`} x1="0.2" y1="0" x2="0.5" y2="1">
            <stop offset="0%" stopColor="var(--dj-peak-hi)" />
            <stop offset="38%" stopColor="var(--dj-peak-b)" />
            <stop offset="100%" stopColor="var(--dj-peak-c)" />
          </linearGradient>
          <linearGradient id={`${uid}-peak-3`} x1="0.22" y1="0" x2="0.48" y2="1">
            <stop offset="0%" stopColor="var(--dj-peak-hi)" />
            <stop offset="32%" stopColor="var(--dj-peak-b)" />
            <stop offset="100%" stopColor="var(--dj-peak-c)" />
          </linearGradient>
          <linearGradient id={`${uid}-water`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--dj-water)" />
            <stop offset="100%" stopColor="var(--dj-water-2)" />
          </linearGradient>
          <linearGradient id={`${uid}-fall`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="rgba(180, 220, 224, 0.12)" />
            <stop offset="45%" stopColor="rgba(244, 252, 252, 0.95)" />
            <stop offset="100%" stopColor="rgba(180, 220, 224, 0.18)" />
          </linearGradient>
          <linearGradient id={`${uid}-reflect`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(255, 236, 180, 0.38)" />
            <stop offset="100%" stopColor="transparent" />
          </linearGradient>
          <pattern id={`${uid}-wave`} width="40" height="16" patternUnits="userSpaceOnUse">
            <path
              d="M0 9 C7 3 13 3 20 9 C27 15 33 15 40 9"
              fill="none"
              stroke="var(--dj-foam)"
              strokeWidth="1.15"
              opacity="0.55"
            />
            <path
              d="M0 13 C7 8 13 8 20 13 C27 18 33 15 40 13"
              fill="none"
              stroke="var(--dj-foam)"
              strokeWidth="0.75"
              opacity="0.32"
            />
          </pattern>
          <filter id={`${uid}-mottle`} x="-12%" y="-12%" width="124%" height="124%">
            <feTurbulence type="fractalNoise" baseFrequency="0.034" numOctaves="4" seed="11" result="t" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.55  0 0 0 0 0.48  0 0 0 0 0.28  0 0 0 0.4 0" />
          </filter>
          <filter id={`${uid}-hanji`} x="-10%" y="-20%" width="120%" height="140%">
            <feTurbulence type="fractalNoise" baseFrequency="0.62" numOctaves="2" seed="4" result="n" />
            <feColorMatrix type="matrix" values="0 0 0 0 0.78  0 0 0 0 0.7  0 0 0 0 0.48  0 0 0 0.16 0" />
          </filter>
          <clipPath id={`${uid}-moon-clip`}>
            <circle cx="780" cy="102" r="70" />
          </clipPath>
          <clipPath id={`${uid}-water-clip`}>
            <rect x="0" y="418" width="960" height="122" />
          </clipPath>
        </defs>

        <g className="skin-dalmaji-orb skin-dalmaji-orb--sun">
          <circle cx="148" cy="100" r="52" fill="none" stroke="rgba(255, 210, 140, 0.28)" strokeWidth="8" />
          <circle cx="148" cy="100" r="44" fill={`url(#${uid}-sun-body)`} />
          <circle cx="148" cy="100" r="42.4" fill="none" stroke="rgba(255, 230, 170, 0.75)" strokeWidth="1.8" />
          <circle cx="148" cy="100" r="38" fill="none" stroke="rgba(255, 180, 90, 0.35)" strokeWidth="1" />
          <circle cx="136" cy="88" r="9" fill="rgba(255, 244, 210, 0.5)" />
        </g>

        <g className="skin-dalmaji-orb skin-dalmaji-orb--moon">
          <circle cx="780" cy="102" r="108" fill={`url(#${uid}-moon-atm)`} />
          <circle cx="780" cy="102" r="86" fill="none" stroke="rgba(255, 230, 170, 0.18)" strokeWidth="10" />
          <g clipPath={`url(#${uid}-moon-clip)`}>
            <circle cx="780" cy="102" r="70" fill={`url(#${uid}-moon-body)`} />
            {!lowSpec && (
              <rect
                x="710"
                y="32"
                width="140"
                height="140"
                filter={`url(#${uid}-mottle)`}
                opacity="0.22"
                style={{ mixBlendMode: 'multiply' }}
              />
            )}
            <g opacity="0.26" style={{ mixBlendMode: 'multiply' }}>
              <ellipse cx="754" cy="96" rx="28" ry="20" fill="#6e6450" />
              <ellipse cx="770" cy="80" rx="16" ry="12" fill="#5c5848" />
              <ellipse cx="798" cy="92" rx="15" ry="11" fill="#6a6050" />
              <ellipse cx="806" cy="112" rx="15" ry="11" fill="#625848" />
            </g>
            <circle cx="810" cy="126" r="5.2" fill="#8a6428" opacity="0.45" />
            <circle cx="752" cy="118" r="4.2" fill="#8a6428" opacity="0.4" />
            <circle cx="780" cy="102" r="70" fill={`url(#${uid}-moon-limb)`} />
            <circle cx="780" cy="102" r="70" fill={`url(#${uid}-moon-spec)`} />
          </g>
          <circle cx="780" cy="102" r="68.6" fill="none" stroke="rgba(255, 248, 220, 0.7)" strokeWidth="1.7" />
        </g>

        <g className="skin-dalmaji-clouds">
          <path
            className="dj-ruyi"
            d="M58 142 C40 142 32 156 42 166 C24 166 20 184 44 188 C34 204 62 216 86 200 C108 216 138 200 128 180 C148 174 148 156 128 152 C134 134 104 128 86 138 C78 128 66 132 58 142 Z"
          />
          <path
            className="dj-ruyi"
            d="M854 124 C834 126 828 140 838 148 C822 150 820 166 838 168 C834 184 856 190 874 178 C894 188 916 174 906 160 C920 154 918 138 900 136 C902 122 880 118 866 128 C860 118 856 118 854 124 Z"
          />
        </g>

        <Peak
          uid={uid}
          variant={1}
          d="M12 422 C36 360 70 300 118 258 C148 238 168 228 186 222 C210 248 236 318 258 422 Z"
          folds={[
            'M186 222 C168 280 148 340 122 400',
            'M170 250 C154 310 138 360 118 408',
            'M152 290 C140 340 128 380 112 416',
          ]}
        />
        <Peak
          uid={uid}
          variant={1}
          d="M702 422 C726 330 768 268 816 220 C836 228 860 244 892 268 C926 308 948 366 956 422 Z"
          folds={[
            'M816 220 C800 280 780 340 756 400',
            'M836 248 C822 310 806 360 788 410',
            'M860 286 C848 340 836 380 822 416',
          ]}
        />
        <Peak
          uid={uid}
          variant={2}
          d="M132 422 C188 310 246 214 318 158 C348 148 368 166 392 198 C430 260 458 340 478 422 Z"
          folds={[
            'M318 158 C292 230 268 310 248 390',
            'M300 188 C276 260 256 330 238 400',
            'M278 230 C260 300 244 360 228 412',
            'M348 200 C338 270 352 340 368 400',
          ]}
        />
        <Peak
          uid={uid}
          variant={2}
          d="M482 422 C502 340 530 260 568 198 C592 166 612 148 644 158 C716 214 772 310 828 422 Z"
          folds={[
            'M644 158 C670 230 694 310 714 390',
            'M660 188 C684 260 704 330 722 400',
            'M682 230 C698 300 714 360 730 412',
            'M612 200 C622 270 608 340 592 400',
          ]}
        />
        <Peak
          uid={uid}
          variant={3}
          d="M286 422 C348 300 404 176 480 92 C498 108 518 150 544 210 C580 290 616 360 674 422 Z"
          folds={[
            'M480 92 C452 170 428 250 408 330',
            'M468 122 C442 200 418 280 398 360',
            'M452 160 C428 240 408 310 390 390',
            'M436 200 C416 270 400 340 384 408',
            'M508 140 C478 220 458 300 442 370',
          ]}
        />

        <path className="dj-fall" d="M468 148 C474 240 466 330 470 424 L488 424 C484 330 492 240 486 148 Z" fill={`url(#${uid}-fall)`} />
        <path className="dj-fall-edge" d="M472 150 C476 240 470 330 474 422" />
        <path className="dj-fall-edge" d="M482 150 C480 240 484 330 482 422" />

        <g className="dj-rock">
          <path d="M10 410 C4 372 22 338 58 334 C78 308 118 318 132 348 C158 358 168 392 148 412 C122 436 70 438 38 428 C22 424 14 418 10 410 Z" />
          <path d="M28 392 C22 372 40 352 62 356 C74 348 96 358 98 374 C108 382 98 400 78 406 C52 416 34 406 28 392 Z" opacity="0.35" />
          <path className="dj-rock-hole" d="M72 360 C66 352 78 346 86 354 C92 362 82 370 72 360 Z" />
          <path className="dj-rock-hole" d="M108 378 C104 372 114 368 118 376 C120 384 112 386 108 378 Z" />
          <path d="M800 408 C792 368 818 334 856 330 C878 304 922 316 936 348 C960 360 962 398 940 414 C910 438 860 438 828 426 C808 420 802 414 800 408 Z" />
          <path d="M824 388 C818 368 838 350 860 354 C872 346 894 356 896 372 C906 380 896 396 876 402 C850 412 830 402 824 388 Z" opacity="0.35" />
          <path className="dj-rock-hole" d="M868 356 C862 348 876 342 884 352 C890 360 878 368 868 356 Z" />
        </g>

        <g className="dj-pine">
          <MinhwaPine x={78} ground={338} h={178} />
          <MinhwaPine x={142} ground={350} h={124} flip />
          <MinhwaPine x={214} ground={408} h={46} />
          <MinhwaPine x={884} ground={334} h={168} flip />
          <MinhwaPine x={824} ground={346} h={118} />
          <MinhwaPine x={748} ground={408} h={42} flip />
        </g>

        <g className="dj-pavilion">
          <path className="dj-podium" d="M176 396 L376 396 L362 414 L190 414 Z" />
          <path className="dj-podium-side" d="M190 414 L362 414 L356 424 L196 424 Z" />
          <ellipse className="dj-juchu" cx="204" cy="396" rx="8" ry="3.2" />
          <ellipse className="dj-juchu" cx="248" cy="396" rx="8" ry="3.2" />
          <ellipse className="dj-juchu" cx="292" cy="396" rx="8" ry="3.2" />
          <ellipse className="dj-juchu" cx="336" cy="396" rx="8" ry="3.2" />
          <rect className="dj-column" x="201" y="338" width="6.5" height="58" />
          <rect className="dj-column" x="245" y="338" width="6.5" height="58" />
          <rect className="dj-column" x="289" y="338" width="6.5" height="58" />
          <rect className="dj-column" x="333" y="338" width="6.5" height="58" />
          <g className="dj-gongpo">
            {[200, 244, 288, 332].map((x, i) => (
              <g key={x}>
                <rect className={i % 2 ? 'dj-gongpo-nok' : 'dj-gongpo-cheong'} x={x - 2} y="332" width="11" height="5" />
                <rect className="dj-gongpo-gold" x={x} y="328" width="7" height="4" />
                <rect className={i % 2 ? 'dj-gongpo-cheong' : 'dj-gongpo-nok'} x={x - 1} y="324" width="9" height="4" />
              </g>
            ))}
          </g>
          <rect className="dj-beam" x="188" y="368" width="164" height="5" />
          {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((i) => (
            <rect
              key={i}
              x={190 + i * 13.4}
              y="369"
              width="12"
              height="3"
              className={i % 2 ? 'dj-gongpo-nok' : 'dj-gongpo-cheong'}
            />
          ))}
          <path d="M198 372 H354" fill="none" stroke="#c9a24a" strokeWidth="1.2" />
          <path d="M208 372 V390 M252 372 V390 M296 372 V390 M340 372 V390" fill="none" stroke="#c9a24a" strokeWidth="1.15" />
          <ellipse className="dj-lantern-glow" cx="276" cy="352" rx="32" ry="16" style={{ fill: `url(#${uid}-lantern)` }} />
          <Cheongsacho cx={276} cy={352} />
          <path
            className="dj-chima"
            d="M152 350 C196 338 236 318 276 304 C316 318 356 338 400 350 C414 346 416 336 402 332 L348 340 L276 314 L204 340 L150 332 C138 336 140 346 152 350 Z"
          />
          <path
            className="dj-giwa"
            d="M188 342 C226 328 250 312 276 300 C302 312 326 328 364 342 C376 338 376 330 366 328 L318 334 L276 312 L234 334 L186 328 C176 330 176 338 188 342 Z"
          />
          {GIWA.map((d) => (
            <path key={d} className="dj-giwa-line" d={d} />
          ))}
          <path className="dj-chima-curl" d="M152 350 C140 346 132 338 138 328 C148 332 156 340 164 344" />
          <path className="dj-chima-curl" d="M400 350 C412 346 420 338 414 328 C404 332 396 340 388 344" />
          <path d="M276 300 L276 286" fill="none" stroke="#e8c56a" strokeWidth="2.6" />
          <circle cx="276" cy="282" r="4.2" fill="#e8c56a" />
          <circle cx="276" cy="282" r="2.1" fill="#fff4d4" />
        </g>

        <g clipPath={`url(#${uid}-water-clip)`}>
          <rect x="0" y="418" width="960" height="122" fill={`url(#${uid}-water)`} />
          <rect x="0" y="418" width="960" height="122" fill={`url(#${uid}-wave)`} />
          <path
            className="dj-foam-crest"
            d="M0 422 C40 412 80 428 120 418 C160 408 200 424 240 416 C280 408 320 424 360 414 C400 406 440 422 480 414 C520 406 560 422 600 414 C640 406 680 422 720 414 C760 406 800 422 840 414 C880 408 920 418 960 416"
          />
          <ellipse className="dj-splash" cx="478" cy="424" rx="28" ry="8" />
          <ellipse className="dj-moon-reflect" cx="780" cy="470" rx="36" ry="48" fill={`url(#${uid}-reflect)`} />
        </g>

        {!lowSpec && (
          <rect
            x="0"
            y="200"
            width="960"
            height="340"
            filter={`url(#${uid}-hanji)`}
            opacity="0.18"
            style={{ mixBlendMode: 'overlay' }}
          />
        )}
      </svg>

      <span className="skin-dalmaji-frame" />
    </div>
  );
}
