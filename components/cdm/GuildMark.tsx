import { cn } from '@/lib/utils';

export interface GuildMarkInfo {
  /** 길드 마크 이미지 URL */
  url: string;
  /** 길드 이름 (툴팁·대체 텍스트) */
  name?: string | null;
}

interface GuildMarkProps {
  mark?: GuildMarkInfo | null;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
};

/**
 * 길드 마크 — 닉네임 옆에 칭호처럼 붙는 작은 이미지 배지.
 * next/image 대신 <img> 를 쓴다 (Supabase Storage 임의 호스트라 도메인 화이트리스트 불필요).
 */
export function GuildMark({ mark, size = 'md', className }: GuildMarkProps) {
  if (!mark?.url) return null;
  const label = mark.name ? `${mark.name} 길드` : '길드 마크';
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mark.url}
      alt={label}
      title={label}
      loading="lazy"
      className={cn(
        'inline-block shrink-0 rounded-[4px] object-cover align-[-2px]',
        'ring-1 ring-cdm-border',
        SIZE_CLASS[size],
        className,
      )}
    />
  );
}
