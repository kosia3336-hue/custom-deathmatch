import { useId } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** px 단위 정사각형 크기 (기본 20). CDP 아이콘보다 크게 쓴다. */
  size?: number;
  className?: string;
}

/** 송편 잔액·가격 표시용 아이콘. */
export function SongpyeonIcon({ size = 20, className }: Props) {
  const uid = useId().replace(/:/g, '');
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden
      className={cn('inline-block shrink-0', className)}
    >
      <defs>
        <linearGradient id={`${uid}-body`} x1="4" y1="2" x2="20" y2="22" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#fff7f2" />
          <stop offset="0.4" stopColor="#f6b7c6" />
          <stop offset="1" stopColor="#d45378" />
        </linearGradient>
      </defs>
      <path
        fill="#e8a0b0"
        d="M2.2 19.2c.6-9.2 4.4-14.4 9.8-14.4s9.2 5.2 9.8 14.4c-2.8-2.2-6.2-3.4-9.8-3.4s-7 1.2-9.8 3.4z"
        opacity="0.35"
      />
      <path
        fill={`url(#${uid}-body)`}
        d="M1.6 17.6C2.2 7.2 6.4 2.4 12 2.4s9.8 4.8 10.4 15.2C19.2 15 15.8 13.8 12 13.8S4.8 15 1.6 17.6z"
      />
      <path
        fill="#fff"
        opacity="0.55"
        d="M6.2 11.2c1.2-3.6 3.4-5.6 5.8-5.8 1.4 2 .4 5.2-1.4 7-1.6.5-3 .2-4.4-.2z"
      />
      <path
        d="M4.8 15.1c1.1-.5 2.2-.2 2.8.7M9.2 14.2c1.1-.55 2.3-.2 3 .75M13.4 14.15c1.1-.55 2.3-.2 3 .75M17.4 15c.9-.4 1.8-.15 2.4.5"
        fill="none"
        stroke="#a33d5c"
        strokeWidth="1.15"
        strokeLinecap="round"
      />
      <ellipse cx="11.2" cy="8.6" rx="0.85" ry="1.35" fill="#4a3424" transform="rotate(16 11.2 8.6)" />
      <ellipse cx="14.1" cy="10.1" rx="0.65" ry="1.05" fill="#3d2a1c" transform="rotate(-8 14.1 10.1)" />
    </svg>
  );
}
