'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TitleColor } from '@/lib/supabase/database.types';

export type TitleEffect = 'legend' | 'xuanwu' | 'baekho' | 'jujak' | 'eternal' | 'issen' | 'seongha' | 'sakura' | 'frost' | 'lightning' | 'wave' | 'dojang' | 'bokjumeoni' | 'hanji' | 'daltokki' | 'nakyeop' | 'fullmoon';

const EFFECT_CLASS: Record<TitleEffect, string> = {
  legend: 'title-legend',
  xuanwu: 'title-xuanwu',
  baekho: 'title-baekho',
  jujak: 'title-jujak',
  eternal: 'title-eternal',
  issen: 'title-issen',
  seongha: 'title-seongha',
  sakura: 'title-sakura',
  frost: 'title-frost',
  lightning: 'title-lightning',
  wave: 'title-wave',
  dojang: 'title-dojang',
  bokjumeoni: 'title-bokjumeoni',
  hanji: 'title-hanji',
  daltokki: 'title-daltokki',
  nakyeop: 'title-nakyeop',
  fullmoon: 'title-fullmoon',
};

interface TitleBadgeProps {
  name: string;
  color: TitleColor;
  effect?: TitleEffect | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'px-[7px] py-[1px] text-[11px]',
  md: 'px-[9px] py-[2px] text-xs',
  lg: 'px-[11px] py-1 text-sm',
};

/**
 * 칭호 뱃지. 아웃라인(테두리+글자 동색, 배경 투명) 스타일.
 * effect 지정 시 해당 테마 shimmer 애니메이션 적용.
 *
 * docs/v2/15_common_ui.md §15.9.2
 */
export function TitleBadge({ name, color, effect, size = 'md', className }: TitleBadgeProps) {
  if (effect === 'dojang') {
    return <TitleDojangMark name={name} size={size} className={className} />;
  }
  if (effect === 'bokjumeoni') {
    return <TitleBokjumeoniMark name={name} size={size} className={className} />;
  }
  if (effect === 'hanji') {
    return <TitleHanjiMark name={name} size={size} className={className} />;
  }
  if (effect === 'daltokki') {
    return <TitleDaltokkiMark name={name} size={size} className={className} />;
  }
  if (effect === 'fullmoon') {
    return <TitleFullmoonMark name={name} size={size} className={className} />;
  }
  if (effect === 'nakyeop') {
    return <TitleNakyeopMark name={name} size={size} className={className} />;
  }

  const effectClass = effect ? EFFECT_CLASS[effect] : null;
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
        SIZE_CLASS[size],
        effectClass,
        className,
      )}
      style={effectClass ? undefined : {
        borderColor: `var(--title-${color})`,
        color: `var(--title-${color})`,
      }}
    >
      {effect === 'issen' ? (
        <>
          <span className="title-issen-label" data-text={name}>
            {name}
          </span>
          <span className="title-issen-slash" aria-hidden>
            <span className="title-issen-blade" />
          </span>
        </>
      ) : effect === 'seongha' ? (
        <>
          <span className="title-seongha-label">{name}</span>
          <span className="title-seongha-sparks" aria-hidden>
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
            <span className="title-seongha-spark" />
          </span>
        </>
      ) : effect === 'sakura' ? (
        <>
          <span className="title-sakura-label">{name}</span>
          <span className="title-sakura-petals" aria-hidden>
            {Array.from({ length: 12 }, (_, i) => (
              <span key={i} className="title-sakura-petal" />
            ))}
          </span>
        </>
      ) : effect === 'frost' ? (
        <>
          <span className="title-frost-label">{name}</span>
          <span className="title-frost-crystals" aria-hidden>
            {Array.from({ length: 7 }, (_, i) => (
              <span key={`c${i}`} className="title-frost-crystal" />
            ))}
            {Array.from({ length: 5 }, (_, i) => (
              <span key={`s${i}`} className="title-frost-shard" />
            ))}
          </span>
        </>
      ) : effect === 'lightning' ? (
        <>
          <span className="title-lightning-label">{name}</span>
          <span className="title-lightning-fx" aria-hidden>
            <span className="title-lightning-bolt" />
            <span className="title-lightning-bang" />
            <span className="title-lightning-bang" />
            <span className="title-lightning-bang" />
            <span className="title-lightning-fork title-lightning-fork-l" />
            <span className="title-lightning-fork title-lightning-fork-r" />
          </span>
        </>
      ) : effect === 'wave' ? (
        <TitleWaveMark name={name} />
      ) : effect === 'jujak' ? (
        <TitleJujakMark name={name} />
      ) : (
        name
      )}
    </span>
  );
}

function TitleJujakMark({ name }: { name: string }) {
  return (
    <>
      <span className="title-jujak-label" data-text={name}>{name}</span>
      <span className="title-jujak-fx" aria-hidden>
        <span className="title-jujak-feather" />
        <span className="title-jujak-impact" />
        <TitleJujakFireCanvas />
      </span>
    </>
  );
}

const JUJAK_FIRE_ATLAS = '/effects/titles/jujak/fire-atlas.webp';
const JUJAK_FIRE_CYCLE_MS = 8_400;
const JUJAK_FIRE_FRAME_SIZE = 128;
const JUJAK_FIRE_FRAME_COUNT = 25;
const JUJAK_FIRE_COLUMNS = 5;
const JUJAK_FIRE_FRAME_INTERVAL_MS = 1000 / 30;

let sharedJujakFireAtlas: HTMLImageElement | null = null;

function getJujakFireAtlas() {
  if (!sharedJujakFireAtlas) {
    sharedJujakFireAtlas = new Image();
    sharedJujakFireAtlas.src = JUJAK_FIRE_ATLAS;
  }
  return sharedJujakFireAtlas;
}

interface JujakPathPoint {
  x: number;
  y: number;
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function smoothstep(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

function hashUnit(value: number) {
  const raw = Math.sin(value * 12.9898) * 43_758.5453;
  return raw - Math.floor(raw);
}

/** Top-centre to bottom-centre along one half of a rounded pill. */
function pointOnJujakHalf(
  progress: number,
  side: -1 | 1,
  x: number,
  y: number,
  width: number,
  height: number,
): JujakPathPoint {
  const radius = height / 2;
  const straightX = Math.max(0, width / 2 - radius);
  const straightY = Math.max(0, height - radius * 2);
  const arc = Math.PI * radius / 2;
  const total = straightX * 2 + straightY + arc * 2;
  let distance = clamp01(progress) * total;
  const centreX = x + width / 2;

  if (distance <= straightX) {
    return { x: centreX + side * distance, y };
  }
  distance -= straightX;

  if (distance <= arc) {
    const angleProgress = distance / arc;
    const angle = side === 1
      ? -Math.PI / 2 + angleProgress * Math.PI / 2
      : -Math.PI / 2 - angleProgress * Math.PI / 2;
    const cornerX = centreX + side * straightX;
    return {
      x: cornerX + Math.cos(angle) * radius,
      y: y + radius + Math.sin(angle) * radius,
    };
  }
  distance -= arc;

  if (distance <= straightY) {
    return {
      x: centreX + side * (straightX + radius),
      y: y + radius + distance,
    };
  }
  distance -= straightY;

  if (distance <= arc) {
    const angleProgress = distance / arc;
    const angle = side === 1
      ? angleProgress * Math.PI / 2
      : Math.PI - angleProgress * Math.PI / 2;
    const cornerX = centreX + side * straightX;
    return {
      x: cornerX + Math.cos(angle) * radius,
      y: y + height - radius + Math.sin(angle) * radius,
    };
  }
  distance -= arc;

  return {
    x: centreX + side * Math.max(0, straightX - distance),
    y: y + height,
  };
}

function drawJujakPathGlow(
  context: CanvasRenderingContext2D,
  side: -1 | 1,
  spread: number,
  alpha: number,
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const segments = Math.max(2, Math.ceil(46 * spread));
  context.beginPath();
  for (let index = 0; index <= segments; index += 1) {
    const point = pointOnJujakHalf((index / segments) * spread, side, x, y, width, height);
    if (index === 0) context.moveTo(point.x, point.y);
    else context.lineTo(point.x, point.y);
  }
  context.globalAlpha = alpha;
  context.strokeStyle = '#ff9d32';
  context.lineWidth = 1.25;
  context.shadowColor = '#ef3f18';
  context.shadowBlur = 5;
  context.stroke();
}

function TitleJujakFireCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext('2d');
    if (!context) return;

    const atlas = getJujakFireAtlas();
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const startedAt = performance.now();
    let animationFrame = 0;
    let lastPaintAt = 0;
    let disposed = false;
    let isVisible = true;
    let cssWidth = canvas.clientWidth;
    let cssHeight = canvas.clientHeight;

    const syncCanvasSize = (width: number, height: number) => {
      cssWidth = width;
      cssHeight = height;
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const targetWidth = Math.max(1, Math.round(cssWidth * pixelRatio));
      const targetHeight = Math.max(1, Math.round(cssHeight * pixelRatio));

      if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
        canvas.width = targetWidth;
        canvas.height = targetHeight;
      }
    };

    syncCanvasSize(cssWidth, cssHeight);

    const scheduleRender = () => {
      if (!disposed && isVisible && !reducedMotion.matches && animationFrame === 0) {
        animationFrame = window.requestAnimationFrame(render);
      }
    };

    const render = (now: number) => {
      animationFrame = 0;
      if (disposed || !isVisible || reducedMotion.matches) return;
      if (now - lastPaintAt < JUJAK_FIRE_FRAME_INTERVAL_MS) {
        scheduleRender();
        return;
      }
      lastPaintAt = now;

      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
      context.clearRect(0, 0, cssWidth, cssHeight);

      if (atlas.complete && atlas.naturalWidth > 0 && cssWidth > 0 && cssHeight > 0) {
        const cycle = ((now - startedAt) % JUJAK_FIRE_CYCLE_MS) / JUJAK_FIRE_CYCLE_MS;
        const spread = smoothstep((cycle - 0.21) / 0.22);
        const fadeIn = smoothstep((cycle - 0.2) / 0.05);
        const fadeOut = 1 - smoothstep((cycle - 0.94) / 0.05);
        const globalAlpha = fadeIn * fadeOut;

        if (globalAlpha > 0.001 && spread > 0.001) {
          // `.title-jujak-fx` extends 17px above/sideways and 21px below the badge.
          const badgeX = 17;
          const badgeY = 17;
          const badgeWidth = Math.max(1, cssWidth - 34);
          const badgeHeight = Math.max(1, cssHeight - 38);

          context.save();
          context.globalCompositeOperation = 'lighter';
          drawJujakPathGlow(context, -1, spread, globalAlpha * 0.72, badgeX, badgeY, badgeWidth, badgeHeight);
          drawJujakPathGlow(context, 1, spread, globalAlpha * 0.72, badgeX, badgeY, badgeWidth, badgeHeight);
          context.shadowBlur = 0;

          const halfPathLength = badgeWidth / 2 + badgeHeight * 1.55;
          const emitterCount = Math.max(5, Math.ceil(halfPathLength / 12));
          const animationFrameIndex = Math.floor(now / JUJAK_FIRE_FRAME_INTERVAL_MS);

          for (const side of [-1, 1] as const) {
            for (let index = 0; index <= emitterCount; index += 1) {
              if (side === 1 && index === 0) continue;
              const seed = index + (side === 1 ? 31 : 7);
              if (index > 0 && index < emitterCount && hashUnit(seed + 151) < 0.14) continue;
              const basePathProgress = index / emitterCount;
              const progressJitter = (hashUnit(seed + 167) - 0.5) * (0.68 / emitterCount);
              const pathProgress = index === 0 || index === emitterCount
                ? basePathProgress
                : clamp01(basePathProgress + progressJitter);
              if (pathProgress > spread) continue;

              const ignitionCycle = 0.21 + pathProgress * 0.22;
              const localAge = cycle - ignitionCycle;
              const localAlpha = smoothstep(localAge / 0.055);
              const scale = 0.7 + hashUnit(seed) * 0.42;
              const flameWidth = Math.max(16, badgeHeight * 0.8) * scale;
              const flameHeight = flameWidth * (1.26 + hashUnit(seed + 19) * 0.18);
              const point = pointOnJujakHalf(pathProgress, side, badgeX, badgeY, badgeWidth, badgeHeight);
              const frame = (animationFrameIndex + Math.floor(hashUnit(seed + 43) * JUJAK_FIRE_FRAME_COUNT)) % JUJAK_FIRE_FRAME_COUNT;
              const sourceX = (frame % JUJAK_FIRE_COLUMNS) * JUJAK_FIRE_FRAME_SIZE;
              const sourceY = Math.floor(frame / JUJAK_FIRE_COLUMNS) * JUJAK_FIRE_FRAME_SIZE;
              const driftX = (hashUnit(seed + 73) - 0.5) * 2.2;
              const lift = 2 + hashUnit(seed + 97) * 2.5;

              context.globalAlpha = globalAlpha * localAlpha * (0.38 + hashUnit(seed + 11) * 0.2);
              context.drawImage(
                atlas,
                sourceX,
                sourceY,
                JUJAK_FIRE_FRAME_SIZE,
                JUJAK_FIRE_FRAME_SIZE,
                point.x - flameWidth / 2 + driftX,
                point.y - flameHeight + lift,
                flameWidth,
                flameHeight,
              );
            }
          }
          context.restore();
        }
      }

      scheduleRender();
    };

    const resizeObserver = typeof ResizeObserver === 'undefined'
      ? null
      : new ResizeObserver(([entry]) => {
          if (entry) syncCanvasSize(entry.contentRect.width, entry.contentRect.height);
        });
    resizeObserver?.observe(canvas);

    const intersectionObserver = typeof IntersectionObserver === 'undefined'
      ? null
      : new IntersectionObserver(([entry]) => {
          if (!entry) return;
          isVisible = entry.isIntersecting;
          if (!isVisible && animationFrame) {
            window.cancelAnimationFrame(animationFrame);
            animationFrame = 0;
          } else if (isVisible) {
            scheduleRender();
          }
        });
    intersectionObserver?.observe(canvas);

    const handleMotionPreference = () => {
      if (reducedMotion.matches) {
        if (animationFrame) window.cancelAnimationFrame(animationFrame);
        animationFrame = 0;
        const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
        context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        context.clearRect(0, 0, cssWidth, cssHeight);
      } else {
        lastPaintAt = 0;
        scheduleRender();
      }
    };
    reducedMotion.addEventListener('change', handleMotionPreference);
    scheduleRender();

    return () => {
      disposed = true;
      if (animationFrame) window.cancelAnimationFrame(animationFrame);
      resizeObserver?.disconnect();
      intersectionObserver?.disconnect();
      reducedMotion.removeEventListener('change', handleMotionPreference);
    };
  }, []);

  return <canvas ref={canvasRef} className="title-jujak-fire-canvas" />;
}

function TitleWaveMark({ name }: { name: string }) {
  const uid = useId().replace(/:/g, '');
  return (
    <>
      <span className="title-wave-label">{name}</span>
      <span className="title-wave-fx" aria-hidden>
        <svg className="title-wave-sea" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path
            className="title-wave-fill-deep"
            d="M0 24V14Q25 7 50 14T100 14T150 14T200 14V24Z"
          />
          <path
            className="title-wave-fill-mid"
            d="M0 24V11Q25 3.5 50 11T100 11T150 11T200 11V24Z"
          />
          <path
            className="title-wave-glint"
            d="M0 11Q25 3.5 50 11T100 11T150 11T200 11"
          />
        </svg>
        <svg className="title-wave-sea title-wave-sea-2" viewBox="0 0 200 24" preserveAspectRatio="none">
          <path
            className="title-wave-fill-light"
            d="M0 24V16Q20 10.5 40 16T80 16T120 16T160 16T200 16V24Z"
          />
        </svg>
        <span className="title-wave-breaker">
          <svg viewBox="0 0 110 24" preserveAspectRatio="none">
            <defs>
              <linearGradient id={`${uid}-body`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ffffff" />
                <stop offset="14%" stopColor="#d8f6fc" />
                <stop offset="36%" stopColor="#3ec4d6" />
                <stop offset="68%" stopColor="#147a98" />
                <stop offset="100%" stopColor="#0a3e58" />
              </linearGradient>
            </defs>
            <path
              fill={`url(#${uid}-body)`}
              d="M0 24L0 14.6C16 14.6 26 12.4 38 13.2C52 14.1 62 8.8 74 6C82 4.2 90 2.1 96 2.3C101 2.5 104.2 4.8 103.6 8.1C103 11.2 98 11.6 93 12.3C88 13 85 13.4 83 15C92 14.1 100 16.6 106 20.6C108 22.1 109.4 23.2 111 24Z"
            />
            <path
              className="title-wave-break-face"
              d="M93 12.3C100 14.2 106 18.2 111 24H99C97.5 19.2 95 15.2 89.5 13.6Z"
            />
            <path
              className="title-wave-break-foam"
              d="M70 7C80 3.8 90 1.8 96 2.4C100.2 2.8 103.2 5.2 102.2 7.6C98 6 90 6.1 81.5 7.6C75.5 8.4 72 8.1 70 7Z"
            />
            <path className="title-wave-break-foam" d="M74 4.3L76.3.1 79 4.6Z" />
            <path className="title-wave-break-foam" d="M81.2 3.2L83.6-.5 86.4 3.7Z" />
            <path className="title-wave-break-foam" d="M88.2 2.5L90.8-.3 93.4 3.2Z" />
            <path className="title-wave-break-foam" d="M95 2.7L97.2.3 99 3.5Z" />
          </svg>
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
          <span className="title-wave-spray" />
        </span>
      </span>
    </>
  );
}

function TitleDojangMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-dojang-wrap', className)}>
      <span className="title-dojang-stamp" aria-hidden>
        <svg viewBox="0 0 80 24" preserveAspectRatio="none">
          <rect x="34" y="0" width="12" height="4" rx="1" fill="#3a2416" />
          <rect x="31" y="3" width="18" height="3" rx="1" fill="#5a3824" />
          <rect x="1" y="5" width="78" height="15" rx="2.5" fill="#6b4028" />
          <rect x="4" y="7" width="72" height="11" rx="1.5" fill="#8b5a38" />
          <rect x="8" y="8.5" width="64" height="8" fill="none" stroke="#f0d4b0" strokeWidth="1.3" />
          <rect x="1" y="19" width="78" height="5" rx="1" fill="#b01820" />
        </svg>
      </span>
      <span
        className={cn(
          'title-dojang inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-dojang-label">{name}</span>
      </span>
    </span>
  );
}

const BOKJUMEONI_BURST: Array<{
  kind: 'coin' | 'wonbo' | 'pearl' | 'gem' | 'spark';
  dx: string;
  dy: string;
  rot: string;
  delay: string;
  metal?: 'gold' | 'silver';
  hue?: 'ruby' | 'jade' | 'sapphire';
}> = [
  { kind: 'coin', dx: '-44%', dy: '-28%', rot: '-48deg', delay: '0ms', metal: 'gold' },
  { kind: 'coin', dx: '40%', dy: '-32%', rot: '36deg', delay: '18ms', metal: 'gold' },
  { kind: 'coin', dx: '-36%', dy: '26%', rot: '22deg', delay: '36ms', metal: 'silver' },
  { kind: 'coin', dx: '46%', dy: '20%', rot: '-30deg', delay: '24ms', metal: 'gold' },
  { kind: 'wonbo', dx: '-6%', dy: '-36%', rot: '-12deg', delay: '8ms' },
  { kind: 'wonbo', dx: '16%', dy: '30%', rot: '16deg', delay: '42ms' },
  { kind: 'pearl', dx: '-24%', dy: '-6%', rot: '0deg', delay: '48ms' },
  { kind: 'pearl', dx: '26%', dy: '-16%', rot: '0deg', delay: '56ms' },
  { kind: 'gem', dx: '0%', dy: '-40%', rot: '-8deg', delay: '0ms', hue: 'ruby' },
  { kind: 'gem', dx: '-30%', dy: '8%', rot: '18deg', delay: '32ms', hue: 'jade' },
  { kind: 'gem', dx: '34%', dy: '4%', rot: '-14deg', delay: '40ms', hue: 'sapphire' },
  { kind: 'coin', dx: '4%', dy: '34%', rot: '8deg', delay: '64ms', metal: 'gold' },
  { kind: 'spark', dx: '-16%', dy: '-44%', rot: '20deg', delay: '0ms' },
  { kind: 'spark', dx: '22%', dy: '-38%', rot: '-18deg', delay: '12ms' },
  { kind: 'spark', dx: '-40%', dy: '4%', rot: '8deg', delay: '28ms' },
  { kind: 'spark', dx: '38%', dy: '12%', rot: '-12deg', delay: '20ms' },
];

function BokjumeoniYeopjeon({ r, metal }: { r: number; metal: 'gold' | 'silver' }) {
  const hole = r * 0.28;
  const gold = metal === 'gold';
  return (
    <g>
      <ellipse cx={0} cy={r * 0.18} rx={r} ry={r * 0.92} fill={gold ? '#6e480c' : '#4e5664'} />
      <circle cx={0} cy={0} r={r} fill={gold ? '#e8c34a' : '#e8ecf2'} stroke={gold ? '#9a6a12' : '#7a8494'} strokeWidth={r * 0.08} />
      <circle cx={0} cy={0} r={r * 0.76} fill="none" stroke={gold ? '#fbf0c4' : '#f7f8fb'} strokeWidth={r * 0.07} />
      <rect
        x={-hole}
        y={-hole}
        width={hole * 2}
        height={hole * 2}
        rx={r * 0.05}
        fill={gold ? '#7a4e0c' : '#5c6574'}
      />
      <ellipse cx={-r * 0.28} cy={-r * 0.32} rx={r * 0.32} ry={r * 0.16} fill="#fff8dc" opacity={gold ? 0.55 : 0.4} />
    </g>
  );
}

function BokjumeoniWonbo({ w }: { w: number }) {
  const h = w * 0.5;
  return (
    <g>
      <path
        d={`M0 ${h * 0.62}C${w * 0.1} ${h * 0.18} ${w * 0.26} 0 ${w * 0.36} ${h * 0.26}H${w * 0.64}C${w * 0.74} 0 ${w * 0.9} ${h * 0.18} ${w} ${h * 0.62}C${w * 0.9} ${h} ${w * 0.72} ${h * 1.04} ${w * 0.64} ${h * 0.8}H${w * 0.36}C${w * 0.28} ${h * 1.04} ${w * 0.1} ${h} 0 ${h * 0.62}Z`}
        fill="#8a5a10"
      />
      <path
        transform="translate(0 -0.7)"
        d={`M0.4 ${h * 0.56}C${w * 0.12} ${h * 0.14} ${w * 0.26} ${h * 0.04} ${w * 0.36} ${h * 0.24}H${w * 0.64}C${w * 0.74} ${h * 0.04} ${w * 0.88} ${h * 0.14} ${w - 0.4} ${h * 0.56}C${w * 0.86} ${h * 0.82} ${w * 0.7} ${h * 0.74} ${w * 0.64} ${h * 0.64}H${w * 0.36}C${w * 0.3} ${h * 0.74} ${w * 0.14} ${h * 0.82} 0.4 ${h * 0.56}Z`}
        fill="#f3d36a"
        stroke="#9a6a10"
        strokeWidth="0.5"
      />
      <path
        transform="translate(0 -0.7)"
        d={`M${w * 0.22} ${h * 0.3}C${w * 0.34} ${h * 0.14} ${w * 0.66} ${h * 0.14} ${w * 0.78} ${h * 0.3}`}
        fill="none"
        stroke="#fff4c4"
        strokeWidth="0.8"
        opacity="0.75"
      />
    </g>
  );
}

function BokjumeoniPearl({ r }: { r: number }) {
  return (
    <g>
      <circle cx={0} cy={r * 0.16} r={r} fill="#8a8068" />
      <circle cx={0} cy={0} r={r} fill="#f3ead0" stroke="#c2b48a" strokeWidth="0.4" />
      <ellipse cx={-r * 0.28} cy={-r * 0.3} rx={r * 0.32} ry={r * 0.2} fill="#fff" opacity="0.78" />
    </g>
  );
}

function BokjumeoniGem({ s, hue }: { s: number; hue: 'ruby' | 'jade' | 'sapphire' }) {
  const fill = hue === 'ruby' ? '#c81e3a' : hue === 'jade' ? '#1f8a62' : '#2f6fbf';
  const light = hue === 'ruby' ? '#f06a78' : hue === 'jade' ? '#6fd4a4' : '#7eb0ee';
  const dark = hue === 'ruby' ? '#7a1020' : hue === 'jade' ? '#0d4a34' : '#163a72';
  return (
    <g>
      <polygon points={`0,${-s} ${s * 0.86},${-s * 0.18} ${s * 0.54},${s * 0.82} ${-s * 0.54},${s * 0.82} ${-s * 0.86},${-s * 0.18}`} fill={dark} />
      <polygon points={`0,${-s * 0.92} ${s * 0.78},${-s * 0.16} 0,${s * 0.12} ${-s * 0.78},${-s * 0.16}`} fill={fill} />
      <polygon points={`0,${-s * 0.92} ${s * 0.78},${-s * 0.16} 0,${s * 0.08}`} fill={light} opacity="0.85" />
    </g>
  );
}

function BokjumeoniBurst() {
  return (
    <span className="title-bokjumeoni-burst" aria-hidden>
      {BOKJUMEONI_BURST.map((bit, i) => (
        <span
          key={i}
          className={`title-bokjumeoni-bit title-bokjumeoni-bit--${bit.kind}`}
          style={{
            ['--dx' as string]: bit.dx,
            ['--dy' as string]: bit.dy,
            ['--rot' as string]: bit.rot,
            animationDelay: bit.delay,
          }}
        >
          {bit.kind === 'coin' ? (
            <svg viewBox="-8 -8 16 16"><BokjumeoniYeopjeon r={7.2} metal={bit.metal ?? 'gold'} /></svg>
          ) : bit.kind === 'wonbo' ? (
            <svg viewBox="0 0 22 12"><BokjumeoniWonbo w={22} /></svg>
          ) : bit.kind === 'pearl' ? (
            <svg viewBox="-5 -5 10 10"><BokjumeoniPearl r={4.2} /></svg>
          ) : bit.kind === 'gem' ? (
            <svg viewBox="-6 -7 12 14"><BokjumeoniGem s={5} hue={bit.hue ?? 'ruby'} /></svg>
          ) : (
            <span className="title-bokjumeoni-spark-dot" />
          )}
        </span>
      ))}
    </span>
  );
}

function BokjumeoniPouch() {
  const uid = useId().replace(/:/g, '');
  const clip = `${uid}-body`;
  return (
    <span className="title-bokjumeoni-pouch" aria-hidden>
      <svg viewBox="0 0 200 36" preserveAspectRatio="none">
        <defs>
          <clipPath id={clip}>
            <path d="M18 10C22 4.6 40 3.2 68 4.6C90 5.6 110 5.6 132 4.6C160 3.2 178 4.6 182 10C186 16 188 23 186 29C183 34.4 150 35.6 100 35.6C50 35.6 14 34.4 12 29C10 23 14 16 18 10Z" />
          </clipPath>
        </defs>
        <path
          fill="#8a1522"
          d="M18 10C22 4.6 40 3.2 68 4.6C90 5.6 110 5.6 132 4.6C160 3.2 178 4.6 182 10C186 16 188 23 186 29C183 34.4 150 35.6 100 35.6C50 35.6 14 34.4 12 29C10 23 14 16 18 10Z"
        />
        <g clipPath={`url(#${clip})`}>
          <path fill="#c92a3c" d="M12 8H188V36H12Z" />
          <path fill="#a81d2e" d="M12 22H188V36H12Z" />
          <rect y="8.6" height="5.2" width="200" fill="#f0d24a" />
          <rect y="10.2" height="2.2" width="200" fill="#2a5faf" />
          <rect y="11.6" height="1.5" width="200" fill="#2e8a5a" />
          <path fill="rgba(255,232,180,0.18)" d="M20 12C40 16 70 8 100 14C130 8 160 18 182 12V8H20Z" />
          <g fill="none" stroke="#7a101c" strokeWidth="0.7" opacity="0.55">
            <path d="M40 13C38 20 36 28 38 35" />
            <path d="M62 13C61 21 60 28 62 35" />
            <path d="M86 13C85 21 84 29 86 35" />
            <path d="M114 13C113 21 114 29 116 35" />
            <path d="M138 13C139 21 140 29 138 35" />
            <path d="M162 13C164 21 166 28 162 35" />
          </g>
        </g>
        <path
          fill="none"
          stroke="#e8c547"
          strokeWidth="1.35"
          d="M22 11C48 8.4 80 9.2 100 9.2C120 9.2 152 8.4 178 11"
        />
        <path
          fill="none"
          stroke="#8a5a10"
          strokeWidth="0.45"
          d="M24 12.1C50 9.6 80 10.4 100 10.4C120 10.4 150 9.6 176 12.1"
        />
      </svg>
    </span>
  );
}

function BokjumeoniKnot() {
  return (
    <span className="title-bokjumeoni-knot" aria-hidden>
      <svg viewBox="0 0 36 16" fill="none">
        <ellipse cx="11" cy="7.2" rx="5.2" ry="3.4" fill="#e8c547" stroke="#8a5a10" strokeWidth="0.55" transform="rotate(-28 11 7.2)" />
        <ellipse cx="25" cy="7.2" rx="5.2" ry="3.4" fill="#e8c547" stroke="#8a5a10" strokeWidth="0.55" transform="rotate(28 25 7.2)" />
        <ellipse cx="18" cy="4.2" rx="4.6" ry="3.1" fill="#f4d76a" stroke="#8a5a10" strokeWidth="0.55" />
        <ellipse cx="18" cy="10.2" rx="4.2" ry="2.8" fill="#e0b83a" stroke="#8a5a10" strokeWidth="0.5" />
        <circle cx="18" cy="7.4" r="2.1" fill="#fbf0c4" stroke="#8a5a10" strokeWidth="0.5" />
        <path d="M15.4 10.6C14.2 13.4 12.4 15 10.6 15.2" stroke="#d4a017" strokeWidth="1.1" strokeLinecap="round" />
        <path d="M20.6 10.6C21.8 13.4 23.6 15 25.4 15.2" stroke="#d4a017" strokeWidth="1.1" strokeLinecap="round" />
        <circle cx="10.2" cy="15.1" r="1.05" fill="#e8c547" stroke="#8a5a10" strokeWidth="0.4" />
        <circle cx="25.8" cy="15.1" r="1.05" fill="#e8c547" stroke="#8a5a10" strokeWidth="0.4" />
      </svg>
    </span>
  );
}

function TitleBokjumeoniMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-bokjumeoni-wrap', className)}>
      <span
        className={cn(
          'title-bokjumeoni inline-flex items-center justify-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-bokjumeoni-flash" aria-hidden />
        <BokjumeoniBurst />
        <span className="title-bokjumeoni-label">{name}</span>
        <span className="title-bokjumeoni-bag">
          <span className="title-bokjumeoni-half title-bokjumeoni-half--left">
            <BokjumeoniPouch />
          </span>
          <span className="title-bokjumeoni-half title-bokjumeoni-half--right">
            <BokjumeoniPouch />
          </span>
          <BokjumeoniKnot />
        </span>
      </span>
    </span>
  );
}

function HanjiBrush() {
  const uid = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 36 96" fill="none">
      <defs>
        <linearGradient id={`${uid}-bamboo`} x1="13" y1="8" x2="23" y2="8">
          <stop offset="0" stopColor="#f0c878" />
          <stop offset="0.28" stopColor="#e0a848" />
          <stop offset="0.62" stopColor="#c47a28" />
          <stop offset="1" stopColor="#7a4010" />
        </linearGradient>
        <linearGradient id={`${uid}-hair`} x1="18" y1="46" x2="18" y2="94">
          <stop offset="0" stopColor="#4a2a18" />
          <stop offset="0.28" stopColor="#241610" />
          <stop offset="0.7" stopColor="#0c0c10" />
          <stop offset="1" stopColor="#050508" />
        </linearGradient>
      </defs>
      <ellipse cx="18" cy="3.4" rx="5.1" ry="2.3" fill="#e8b85a" />
      <ellipse cx="18" cy="2.6" rx="4.2" ry="1.5" fill="#f6d890" />
      <rect x="13" y="3.2" width="10" height="42" rx="5" fill={`url(#${uid}-bamboo)`} />
      <rect x="14.3" y="4.6" width="2.3" height="39" rx="1.1" fill="#f8e0a8" opacity="0.5" />
      <ellipse cx="18" cy="13" rx="5.15" ry="1.7" fill="#c48430" />
      <ellipse cx="18" cy="12.3" rx="5.15" ry="1.15" fill="none" stroke="#6a300c" strokeWidth="0.65" />
      <ellipse cx="18" cy="24.2" rx="5.15" ry="1.7" fill="#c48430" />
      <ellipse cx="18" cy="23.5" rx="5.15" ry="1.15" fill="none" stroke="#6a300c" strokeWidth="0.65" />
      <ellipse cx="18" cy="35.4" rx="5.15" ry="1.7" fill="#c48430" />
      <ellipse cx="18" cy="34.7" rx="5.15" ry="1.15" fill="none" stroke="#6a300c" strokeWidth="0.65" />
      <rect x="11.2" y="43.2" width="13.6" height="7.6" rx="1.6" fill="#5c2210" />
      <path d="M12.2 45.1h11.6M12.2 47.1h11.6M12.2 49.1h11.6" stroke="#d4b056" strokeWidth="0.55" />
      <ellipse cx="18" cy="43.3" rx="6.8" ry="1.6" fill="#4a180c" />
      <path
        fill={`url(#${uid}-hair)`}
        d="M13.2 50.4C11.4 55.5 9.8 61.5 10.4 67.2C11.2 74.4 14.6 82.2 18 94C21.4 82.2 24.8 74.4 25.6 67.2C26.2 61.5 24.6 55.5 21.8 50.4C20.6 48.2 19.2 47.2 18 47.2C16.8 47.2 15.4 48.2 13.2 50.4Z"
      />
      <path d="M13.6 53C12.4 60 13.2 68 16.4 80" stroke="#1a100c" strokeWidth="0.5" opacity="0.65" />
      <path d="M22.4 53C23.6 60 22.8 68 19.6 80" stroke="#1a100c" strokeWidth="0.5" opacity="0.65" />
      <path d="M16.4 52C15.6 62 16.4 74 18 90" stroke="#08080c" strokeWidth="0.45" opacity="0.55" />
      <path d="M15.6 51.5C14.6 58 15.2 66 17.2 76" stroke="#dcc8a0" strokeWidth="0.85" opacity="0.28" strokeLinecap="round" />
      <path d="M16.4 82C17.2 88 18 93.6 18 94C18 93.6 18.8 88 19.6 82Z" fill="#050508" />
    </svg>
  );
}

function TitleHanjiMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-hanji-wrap', className)}>
      <span
        className={cn(
          'title-hanji inline-flex items-center rounded-full font-normal leading-none whitespace-nowrap border-[1.5px]',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-hanji-stage">
          <span className="title-hanji-ink">
            <span className="title-hanji-bleed" aria-hidden>{name}</span>
            <span className="title-hanji-label">{name}</span>
          </span>
          <span className="title-hanji-spatter" aria-hidden>
            <span />
            <span />
            <span />
          </span>
          <span className="title-hanji-brush" aria-hidden>
            <span className="title-hanji-wet" />
            <HanjiBrush />
          </span>
        </span>
      </span>
    </span>
  );
}

const NAKYEOP_LEAVES: Array<{
  kind: 'maple' | 'ginkgo';
  left: string;
  delay: string;
  dur: string;
  sway: string;
  swayDelay: string;
  color: string;
}> = [
  { kind: 'maple', left: '7%', delay: '-0.6s', dur: '12s', sway: '1.9s', swayDelay: '-0.4s', color: '#c2410c' },
  { kind: 'ginkgo', left: '19%', delay: '-2.3s', dur: '13.4s', sway: '2.15s', swayDelay: '-0.9s', color: '#ca8a04' },
  { kind: 'maple', left: '31%', delay: '-3.4s', dur: '11.2s', sway: '1.75s', swayDelay: '-1.3s', color: '#b45309' },
  { kind: 'ginkgo', left: '44%', delay: '-6.1s', dur: '13.8s', sway: '2.2s', swayDelay: '-0.2s', color: '#eab308' },
  { kind: 'maple', left: '57%', delay: '-7.2s', dur: '12.6s', sway: '1.85s', swayDelay: '-1.1s', color: '#9a3412' },
  { kind: 'maple', left: '70%', delay: '-7.6s', dur: '10.8s', sway: '1.7s', swayDelay: '-0.7s', color: '#ea580c' },
  { kind: 'ginkgo', left: '83%', delay: '-10.4s', dur: '13s', sway: '2.05s', swayDelay: '-1.6s', color: '#a16207' },
  { kind: 'maple', left: '12%', delay: '-10.5s', dur: '11.4s', sway: '1.95s', swayDelay: '-0.5s', color: '#c05621' },
];

function NakyeopMaple() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden>
      <path
        fill="currentColor"
        d="M8 1.1 9.15 4.4l3.55-1.15-2.15 3.15 3.45 1.85-3.65.15 1.25 3.55L8 9.7 4.75 11.95l1.25-3.55-3.65-.15 3.45-1.85-2.15-3.15L6.85 4.4Z"
      />
      <path d="M8 7.4v7.2" stroke="#5a220c" strokeWidth="0.7" strokeLinecap="round" opacity="0.45" />
    </svg>
  );
}

function NakyeopGinkgo() {
  return (
    <svg viewBox="0 0 16 14" aria-hidden>
      <path
        fill="currentColor"
        d="M8 12.6C3.2 9.6 2.1 5.4 3.4 3.1 5.6.8 8 2.2 8 2.2S10.4.8 12.6 3.1C13.9 5.4 12.8 9.6 8 12.6Z"
      />
      <path d="M8 5.2v8" stroke="#6a4810" strokeWidth="0.65" strokeLinecap="round" opacity="0.4" />
    </svg>
  );
}

function TitleNakyeopMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-nakyeop-wrap', className)}>
      <span
        className={cn(
          'title-nakyeop inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-nakyeop-tray" aria-hidden>
          {NAKYEOP_LEAVES.map((leaf, i) => (
            <span
              key={i}
              className={`title-nakyeop-leaf title-nakyeop-leaf--${leaf.kind}`}
              style={{
                left: leaf.left,
                color: leaf.color,
                ['--nakyeop-dur' as string]: leaf.dur,
                ['--nakyeop-delay' as string]: leaf.delay,
                ['--nakyeop-sway' as string]: leaf.sway,
                ['--nakyeop-sway-delay' as string]: leaf.swayDelay,
              }}
            >
              {leaf.kind === 'maple' ? <NakyeopMaple /> : <NakyeopGinkgo />}
            </span>
          ))}
        </span>
        <span className="title-nakyeop-label">{name}</span>
      </span>
    </span>
  );
}

function TitleDaltokkiMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-daltokki-wrap', className)}>
      <span
        className={cn(
          'title-daltokki inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap border-[1.5px]',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-daltokki-craters" aria-hidden>
          <svg viewBox="0 0 80 24" preserveAspectRatio="none">
            <ellipse cx="12" cy="8" rx="5.2" ry="3.4" fill="#c9a050" opacity="0.28" />
            <ellipse cx="13" cy="7.2" rx="2.4" ry="1.4" fill="#f6e8b8" opacity="0.18" />
            <ellipse cx="36" cy="16" rx="7" ry="3.8" fill="#b89040" opacity="0.22" />
            <ellipse cx="58" cy="7" rx="4.4" ry="2.8" fill="#c9a050" opacity="0.24" />
            <ellipse cx="70" cy="15" rx="3.2" ry="2.1" fill="#b89040" opacity="0.2" />
          </svg>
        </span>
        <span className="title-daltokki-label">{name}</span>
        <span className="title-daltokki-rabbit" aria-hidden>
          <svg viewBox="0 0 24 36">
            <ellipse cx="6.2" cy="22.5" rx="2.3" ry="2.1" fill="#2a1814" />
            <ellipse cx="11.5" cy="24.5" rx="6.6" ry="8.2" fill="#2a1814" />
            <ellipse cx="13.8" cy="33.4" rx="4.2" ry="1.7" fill="#2a1814" />
            <ellipse cx="17.4" cy="28.6" rx="1.7" ry="3.1" transform="rotate(28 17.4 28.6)" fill="#2a1814" />
            <circle cx="15.2" cy="14.2" r="5.1" fill="#2a1814" />
            <ellipse cx="12.6" cy="5.2" rx="1.55" ry="6.4" transform="rotate(-14 12.6 5.2)" fill="#2a1814" />
            <ellipse cx="17" cy="4.6" rx="1.45" ry="6.6" transform="rotate(11 17 4.6)" fill="#2a1814" />
            <ellipse cx="17" cy="5.4" rx="0.5" ry="3.2" transform="rotate(11 17 5.4)" fill="#6a4030" />
            <circle cx="17.2" cy="13.2" r="0.85" fill="#f4e4c8" />
          </svg>
        </span>
      </span>
    </span>
  );
}

function PungyoCrescent() {
  return (
    <svg viewBox="0 0 10 10" aria-hidden>
      <path fill="currentColor" d="M6.8 1.15a4.15 4.15 0 1 0 0 7.7 3.15 3.15 0 1 1 0-7.7z" />
    </svg>
  );
}

function PungyoSongpyeon() {
  return (
    <svg viewBox="0 0 12 10" aria-hidden>
      <path
        fill="currentColor"
        d="M1.1 7.4C1.3 3.2 4.1 1.15 6 1.15S10.7 3.2 10.9 7.4C8.4 6.15 3.6 6.15 1.1 7.4z"
      />
    </svg>
  );
}

function PungyoSweep({ flip }: { flip?: boolean }) {
  return (
    <svg viewBox="0 0 64 14" aria-hidden>
      <path
        d={flip ? 'M2 2 Q32 16 62 2' : 'M2 12 Q32 -2 62 12'}
        fill="none"
        stroke="#fffef8"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      <path
        d={flip ? 'M6 3.2 Q32 13 58 3.2' : 'M6 10.4 Q32 1.2 58 10.4'}
        fill="none"
        stroke="#ffd056"
        strokeWidth="1.2"
        strokeLinecap="round"
      />
    </svg>
  );
}

function PungyoOrnament() {
  return (
    <svg viewBox="0 0 36 18" aria-hidden>
      <path d="M4 16 C6 8 8 6 7 2" fill="none" stroke="#c4a04a" strokeWidth="0.8" />
      <path d="M8 16 C9 9 12 7 11 3" fill="none" stroke="#d4b45a" strokeWidth="0.8" />
      <ellipse cx="6.2" cy="6" rx="1.3" ry="2.1" fill="#e8c86a" transform="rotate(-20 6.2 6)" />
      <ellipse cx="10.2" cy="7" rx="1.2" ry="2" fill="#f0d48a" transform="rotate(12 10.2 7)" />
      <circle cx="20" cy="9" r="4.2" fill="#f08a28" />
      <path d="M18.2 5.2c.6-1.6 2.8-1.6 3.4 0" fill="none" stroke="#6a8a32" strokeWidth="0.9" />
      <path d="M28 13.2c0-3.4 2.2-5.2 3.6-5.2s3.6 1.8 3.6 5.2c-2-.9-5.2-.9-7.2 0z" fill="#f4a0b0" />
      <circle cx="16" cy="14.5" r="1.6" fill="#8fbe55" />
    </svg>
  );
}

const PUNGYO_BITS = [
  { kind: 'cake', left: '10%', delay: '-0.2s', dur: '2.8s', sway: '1.1s', swayDelay: '0s', color: '#f4a8b8' },
  { kind: 'moon', left: '24%', delay: '-1.4s', dur: '3.2s', sway: '0.95s', swayDelay: '-0.4s', color: '#ffe08a' },
  { kind: 'cake', left: '36%', delay: '-2.2s', dur: '2.6s', sway: '1.2s', swayDelay: '-0.2s', color: '#c5dd8a' },
  { kind: 'cake', left: '48%', delay: '-0.8s', dur: '3.4s', sway: '1.05s', swayDelay: '-0.6s', color: '#fff6dc' },
  { kind: 'moon', left: '60%', delay: '-2.6s', dur: '3s', sway: '0.9s', swayDelay: '-0.15s', color: '#f6c445' },
  { kind: 'cake', left: '72%', delay: '-1.8s', dur: '2.7s', sway: '1.15s', swayDelay: '-0.5s', color: '#f0c56a' },
  { kind: 'cake', left: '84%', delay: '-0.5s', dur: '3.1s', sway: '1s', swayDelay: '-0.3s', color: '#f3a0b4' },
  { kind: 'moon', left: '94%', delay: '-2s', dur: '2.9s', sway: '1.08s', swayDelay: '-0.7s', color: '#ffd56a' },
] as const;

function TitleFullmoonMark({
  name,
  size,
  className,
}: {
  name: string;
  size: 'sm' | 'md' | 'lg';
  className?: string;
}) {
  return (
    <span className={cn('title-fullmoon-wrap', className)}>
      <span className="title-fullmoon-moon" aria-hidden />
      <span
        className={cn(
          'title-fullmoon inline-flex items-center rounded-full font-semibold leading-none whitespace-nowrap',
          size === 'sm' && 'title-fullmoon-sm',
          SIZE_CLASS[size],
        )}
      >
        <span className="title-fullmoon-ornament title-fullmoon-ornament-l" aria-hidden>
          <PungyoOrnament />
        </span>
        <span className="title-fullmoon-ornament title-fullmoon-ornament-r" aria-hidden>
          <PungyoOrnament />
        </span>
        <span className="title-fullmoon-flash" aria-hidden />
        <span className="title-fullmoon-arc title-fullmoon-arc-a" aria-hidden>
          <PungyoSweep />
        </span>
        <span className="title-fullmoon-arc title-fullmoon-arc-b" aria-hidden>
          <PungyoSweep flip />
        </span>
        <span className="title-fullmoon-tray" aria-hidden>
          {PUNGYO_BITS.map((bit, i) => (
            <span
              key={i}
              className={`title-fullmoon-bit title-fullmoon-bit--${bit.kind}`}
              style={{
                left: bit.left,
                color: bit.color,
                ['--pungyo-delay' as string]: bit.delay,
                ['--pungyo-dur' as string]: bit.dur,
                ['--pungyo-sway' as string]: bit.sway,
                ['--pungyo-sway-delay' as string]: bit.swayDelay,
              }}
            >
              {bit.kind === 'moon' ? <PungyoCrescent /> : <PungyoSongpyeon />}
            </span>
          ))}
        </span>
        <span className="title-fullmoon-label">{name}</span>
      </span>
    </span>
  );
}
