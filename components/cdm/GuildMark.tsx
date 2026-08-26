import Image from 'next/image';
import { cn } from '@/lib/utils';

export interface GuildMarkInfo {
  /** 길드 마크 이미지 URL */
  url: string;
  /** 길드 이름 (툴팁·대체 텍스트) */
  name?: string | null;
  /** 있으면 랭킹 등에서 눌러 길드 정보를 연다 */
  guildId?: string | null;
}

interface GuildMarkProps {
  mark?: GuildMarkInfo | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}

const SIZE_CLASS = {
  sm: 'h-4 w-4',
  md: 'h-[18px] w-[18px]',
  lg: 'h-5 w-5',
  /** 랭킹 유저 행 — 닉+전적 두 줄 높이에 맞춤 */
  xl: 'h-10 w-10',
} as const;

const SIZE_PX = {
  sm: 16,
  md: 18,
  lg: 20,
  xl: 40,
} as const;

function isCatalogLogo(url: string): boolean {
  return url.startsWith('/guild/logos/') || url.startsWith('/dev/guild/logos/');
}

/**
 * 길드 마크 — 닉네임 옆에 칭호처럼 붙는 작은 이미지 배지.
 * 카탈로그(`/guild/logos/`)는 next/image 로 리사이즈. 스토리지 등 외부 URL은 `<img>`.
 * 랭킹 xl 은 첫 화면에 바로 받고, 작은 뱃지만 lazy.
 */
export function GuildMark({ mark, size = 'md', className }: GuildMarkProps) {
  if (!mark?.url) return null;
  const label = mark.name ? `${mark.name} 길드` : '길드 마크';
  const eager = size === 'xl';
  const px = SIZE_PX[size];
  const frame = cn(
    size === 'xl'
      ? 'inline-block shrink-0 rounded-cdm-sm object-cover'
      : 'inline-block shrink-0 rounded-[4px] object-cover align-[-2px]',
    'bg-cdm-bg-elev-2 ring-1 ring-cdm-border',
    SIZE_CLASS[size],
    className,
  );

  if (isCatalogLogo(mark.url)) {
    const catalogSrc = mark.url.split('?')[0] || mark.url;
    return (
      <Image
        src={catalogSrc}
        alt={label}
        title={label}
        width={px}
        height={px}
        loading={eager ? 'eager' : 'lazy'}
        className={frame}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={mark.url}
      alt={label}
      title={label}
      width={px}
      height={px}
      loading={eager ? 'eager' : 'lazy'}
      className={frame}
    />
  );
}
