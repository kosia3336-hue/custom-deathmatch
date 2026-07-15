import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Props {
  /** px 단위 정사각형 크기 (기본 16) */
  size?: number;
  className?: string;
}

/** CDP 잔액 표시용 아이콘. */
export function CdpIcon({ size = 16, className }: Props) {
  return (
    <Image
      src="/brand/cdp.webp"
      alt=""
      aria-hidden
      width={size}
      height={size}
      className={cn('inline-block shrink-0 align-[-2px]', className)}
    />
  );
}
