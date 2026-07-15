import Image from 'next/image';
import { cn } from '@/lib/utils';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

/** 이미지 원본 비율(1024x156)에 맞춘 높이별 표시 폭 */
const SIZE: Record<'sm' | 'md' | 'lg', { h: number; w: number; className: string }> = {
  sm: { h: 24, w: 158, className: 'h-6' },
  md: { h: 32, w: 210, className: 'h-8' },
  lg: { h: 44, w: 289, className: 'h-11' },
};

/** Custom Deathmatch 워드마크 (이미지). */
export function Logo({ size = 'md', className }: LogoProps) {
  const s = SIZE[size];
  return (
    <Image
      src="/brand/logo-wordmark.webp"
      alt="Custom Deathmatch"
      width={s.w}
      height={s.h}
      className={cn('w-auto object-contain', s.className, className)}
    />
  );
}
