'use client';
import { useId } from 'react';
import { cn } from '@/lib/utils';
import { ESKIMO_BEAR } from '@/shared/types/eskimo';
import styles from './eskimo-piece.module.css';

type TokenTone = 'primary' | 'highlight' | 'bear';

/** 판과 범례에 함께 쓰는 아이스크림 말. SVG라 작은 칸에서도 윤곽이 선명하다. */
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
          <stop stopColor="#ffffff" />
          <stop offset="1" stopColor="#e4eef6" />
        </linearGradient>
      </defs>
      <ellipse cx="50" cy="97" rx="38" ry="6.5" className={styles.shadow} />
      {tone === 'bear' ? (
        <>
          {/* 북극곰은 얼음 접시 위에 앉힌다 */}
          <ellipse cx="50" cy="86" rx="42" ry="12" fill="var(--token-edge)" />
          <ellipse cx="50" cy="83" rx="40" ry="10" fill={`url(#${rim})`} />
        </>
      ) : (
        <>
          {/* 아이스크림 한 스쿱 — 둥근 윗면 + 물결 모양 아랫단 */}
          <path
            d="M9 60 C9 32 27 15 50 15 C73 15 91 32 91 60 C91 64 89 67 86 68 C84 76 77 71 73 75 C70 82 62 77 57 80 C52 86 45 81 41 79 C35 83 29 75 25 77 C18 79 12 71 13 67 C10 65 9 63 9 60Z"
            fill={`url(#${rim})`}
            transform="translate(0 4)"
          />
          <path
            d="M9 60 C9 32 27 15 50 15 C73 15 91 32 91 60 C91 64 89 67 86 68 C84 76 77 71 73 75 C70 82 62 77 57 80 C52 86 45 81 41 79 C35 83 29 75 25 77 C18 79 12 71 13 67 C10 65 9 63 9 60Z"
            fill={`url(#${face})`}
            stroke="var(--token-edge)"
            strokeWidth="1.6"
          />
          {/* 떠낸 결 */}
          <path
            d="M18 58 C26 52 34 61 42 55 C50 49 58 60 66 54 C74 48 80 57 84 54"
            fill="none"
            stroke="var(--token-engraving)"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
          <path
            d="M24 32 C30 24 40 20 50 20"
            fill="none"
            stroke="#fff"
            strokeWidth="4"
            opacity="0.7"
            strokeLinecap="round"
          />
        </>
      )}
      {tone === 'bear' ? (
        <g stroke="#b7c8d6" strokeWidth="1.3">
          <circle cx="28" cy="33" r="12" fill={`url(#${fur})`} />
          <circle cx="72" cy="33" r="12" fill={`url(#${fur})`} />
          <circle cx="28" cy="33" r="6" fill="#f9c3d8" stroke="none" />
          <circle cx="72" cy="33" r="6" fill="#f9c3d8" stroke="none" />
          <path
            d="M20 52 C20 31 32 24 50 24 C68 24 80 31 80 52 C80 72 67 82 50 82 C33 82 20 72 20 52Z"
            fill="#c9d8e4"
            stroke="none"
            transform="translate(0 3)"
          />
          <path
            d="M20 52 C20 31 32 24 50 24 C68 24 80 31 80 52 C80 72 67 82 50 82 C33 82 20 72 20 52Z"
            fill={`url(#${fur})`}
          />
          <ellipse cx="50" cy="63" rx="19" ry="14" fill="#ffffff" stroke="none" />
          <g fill="#3b2418" stroke="none">
            <circle cx="36" cy="51" r="3" />
            <circle cx="64" cy="51" r="3" />
            <path d="M43 59 Q50 56 57 59 Q58 66 50 68 Q42 66 43 59Z" />
          </g>
          <path
            d="M50 68 V72 M50 72 Q46 76 42 72 M50 72 Q54 76 58 72"
            fill="none"
            stroke="#7a5a4a"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M32 36 Q40 29 50 30"
            fill="none"
            stroke="#ffffff"
            strokeWidth="3"
            strokeLinecap="round"
          />
        </g>
      ) : (
        <g fill="var(--token-symbol)">
          {/* 딸기 과육 / 초코칩 */}
          <rect x="30" y="36" width="7" height="5" rx="1.6" transform="rotate(-20 33 38)" />
          <rect x="55" y="30" width="7" height="5" rx="1.6" transform="rotate(25 58 32)" />
          <rect x="68" y="44" width="6" height="5" rx="1.6" transform="rotate(-35 71 46)" />
          <rect x="42" y="47" width="6" height="5" rx="1.6" transform="rotate(40 45 49)" />
          <rect x="24" y="52" width="6" height="4" rx="1.6" transform="rotate(10 27 54)" />
          <rect x="57" y="64" width="6" height="4" rx="1.6" transform="rotate(-15 60 66)" />
          <rect x="36" y="66" width="5" height="4" rx="1.6" transform="rotate(30 38 68)" />
        </g>
      )}
    </svg>
  );
}

/** 선은 딸기 스쿱, 후는 민트초코 스쿱, 북극곰은 얼음 접시 위 곰 얼굴. */
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
