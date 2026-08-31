'use client';

import { useEffect, useId, useRef } from 'react';
import { cn } from '@/lib/utils';
import type { TitleColor } from '@/lib/supabase/database.types';

export type TitleEffect = 'legend' | 'xuanwu' | 'baekho' | 'jujak' | 'eternal' | 'issen' | 'seongha' | 'sakura' | 'frost' | 'lightning' | 'wave' | 'dojang';

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
        const spread = smoothstep((cycle - 0.23) / 0.31);
        const fadeIn = smoothstep((cycle - 0.22) / 0.06);
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

              const ignitionCycle = 0.23 + pathProgress * 0.31;
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
