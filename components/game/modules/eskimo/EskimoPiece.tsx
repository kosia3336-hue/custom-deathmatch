'use client';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { ESKIMO_BEAR } from '@/shared/types/eskimo';
import styles from './eskimo-piece.module.css';

type TokenTone = 'primary' | 'highlight' | 'bear';

/** 판과 범례에 함께 쓰는 토큰. SVG라 작은 칸에서도 윤곽이 선명하다. */
function TokenArtwork({ tone }: { tone: TokenTone }) {
  const id = useId();
  const face = `${id}-face`;
  const rim = `${id}-rim`;
  const fur = `${id}-fur`;
  return (
    <svg
      viewBox="0 0 100 108"
      className={styles.artwork}
      data-tone={tone}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <linearGradient id={face} x1="0" y1="0" x2="0.8" y2="1">
          <stop stopColor="var(--token-face-light)" />
          <stop offset="1" stopColor="var(--token-face)" />
        </linearGradient>
        <linearGradient id={rim} x1="0" y1="0" x2="0" y2="1">
          <stop stopColor="var(--token-edge)" />
          <stop offset="1" stopColor="var(--token-edge-dark)" />
        </linearGradient>
        <linearGradient id={fur} x1="0" y1="0" x2="0.6" y2="1">
          <stop stopColor="var(--cdm-bg)" />
          <stop offset="1" stopColor="var(--cdm-bg-elev-2)" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="96" rx="39" ry="7" className={styles.shadow} />
      <path
        d="M7 52 A43 43 0 0 1 93 52 V61 A43 43 0 0 1 7 61Z"
        fill={`url(#${rim})`}
        stroke="var(--token-edge-dark)"
        strokeWidth="1.5"
      />
      <circle
        cx="50"
        cy="52"
        r="43"
        fill={`url(#${face})`}
        stroke="var(--token-edge)"
        strokeWidth="1.5"
      />
      <circle
        cx="50"
        cy="52"
        r="37"
        fill="none"
        stroke="var(--token-engraving)"
        strokeWidth="1.3"
      />
      <path
        d="M20 30 A37 37 0 0 1 73 23"
        fill="none"
        stroke="var(--cdm-bg)"
        strokeWidth="2"
        opacity="0.45"
        strokeLinecap="round"
      />
      {tone === 'bear' ? (
        <g stroke="var(--cdm-border-strong)" strokeWidth="1.3">
          <circle cx="28" cy="33" r="12" fill={`url(#${fur})`} />
          <circle cx="72" cy="33" r="12" fill={`url(#${fur})`} />
          <circle cx="28" cy="33" r="6" fill="var(--cdm-bg-elev-3)" stroke="none" />
          <circle cx="72" cy="33" r="6" fill="var(--cdm-bg-elev-3)" stroke="none" />
          <path
            d="M20 52 C20 31 32 24 50 24 C68 24 80 31 80 52 C80 72 67 82 50 82 C33 82 20 72 20 52Z"
            fill="var(--cdm-border)"
            stroke="none"
            transform="translate(0 3)"
          />
          <path
            d="M20 52 C20 31 32 24 50 24 C68 24 80 31 80 52 C80 72 67 82 50 82 C33 82 20 72 20 52Z"
            fill={`url(#${fur})`}
          />
          <ellipse cx="50" cy="63" rx="19" ry="14" fill="var(--cdm-bg)" stroke="none" />
          <g fill="var(--cdm-fg)" stroke="none">
            <circle cx="36" cy="51" r="3" />
            <circle cx="64" cy="51" r="3" />
            <path d="M43 59 Q50 56 57 59 Q58 66 50 68 Q42 66 43 59Z" />
          </g>
          <path
            d="M50 68 V72 M50 72 Q46 76 42 72 M50 72 Q54 76 58 72"
            fill="none"
            stroke="var(--cdm-fg-muted)"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M32 36 Q40 29 50 30"
            fill="none"
            stroke="var(--cdm-bg)"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g
          fill="var(--token-symbol)"
          stroke="var(--token-symbol)"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M50 26 L56 46 L76 52 L56 58 L50 78 L44 58 L24 52 L44 46Z" strokeWidth="1.3" />
          <path
            d="M50 35 L53 49 L67 52 L53 55 L50 69 L47 55 L33 52 L47 49Z"
            fill="var(--token-face)"
            stroke="none"
          />
          <circle cx="50" cy="52" r="4" stroke="none" />
          <path
            d="M31 33 L35 37 M65 67 L69 71 M69 33 L65 37 M35 67 L31 71"
            fill="none"
            strokeWidth="2"
            opacity="0.65"
          />
          <circle cx="50" cy="18" r="1.5" stroke="none" />
          <circle cx="50" cy="86" r="1.5" stroke="none" />
        </g>
      )}
    </svg>
  );
}

/** 선·후는 색을 유지하고, 중립 북극곰은 흰 양각 토큰으로 구분한다. */
export function EskimoPiece({
  piece,
  firstPlayerId,
  ghost = false,
  className,
}: {
  piece: string;
  firstPlayerId: string;
  ghost?: boolean;
  className?: string;
}) {
  const tone = piece === ESKIMO_BEAR ? 'bear' : piece === firstPlayerId ? 'primary' : 'highlight';
  return (
    <span
      className={cn(
        'pointer-events-none absolute top-1/2 left-1/2 block h-[80%] w-[74%] -translate-x-1/2 -translate-y-1/2',
        ghost && 'opacity-50',
        className,
      )}
      aria-hidden
    >
      <TokenArtwork tone={tone} />
    </span>
  );
}

export function EskimoMarker({ tone }: { tone: TokenTone }) {
  return (
    <span className="block h-5 w-5 shrink-0" aria-hidden="true">
      <TokenArtwork tone={tone} />
    </span>
  );
}
