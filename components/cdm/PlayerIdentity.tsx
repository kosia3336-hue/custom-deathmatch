import { cn } from '@/lib/utils';
import type { TitleColor, TurnPosition } from '@/lib/supabase/database.types';
import { TitleBadge } from './TitleBadge';
import { TurnBadge } from './TurnBadge';
import { HostMark, SpectatorMark, MeLabel, ReconnectingMark } from './Marks';

export interface DisplayedTitle {
  id: string;
  name: string;
  color: TitleColor;
}

interface PlayerIdentityProps {
  nickname: string;
  title?: DisplayedTitle | null;
  turn?: TurnPosition | null;
  isHost?: boolean;
  isSpectator?: boolean;
  isMe?: boolean;
  reconnectingSeconds?: number | null;
  /** 칭호를 닉네임 앞 같은 줄에 둘지 (기본 inline), 위에 한 줄로 띄울지 (stacked) */
  layout?: 'inline' | 'stacked';
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const NAME_SIZE = {
  sm: 'text-sm',
  md: 'text-[15px]',
  lg: 'text-base',
};

const TITLE_SIZE = {
  sm: 'sm',
  md: 'sm',
  lg: 'md',
} as const;

/**
 * 닉네임 + 칭호 + 선/후공 + 마크 통합 컴포넌트.
 * Avatar 는 사용하지 않는다 (4번 / 15번 문서).
 */
export function PlayerIdentity({
  nickname,
  title,
  turn,
  isHost,
  isSpectator,
  isMe,
  reconnectingSeconds,
  layout = 'inline',
  size = 'md',
  className,
}: PlayerIdentityProps) {
  const titleEl = title ? (
    <TitleBadge name={title.name} color={title.color} size={TITLE_SIZE[size]} />
  ) : null;

  const turnEl = turn ? <TurnBadge turn={turn} size="sm" /> : null;

  const nameRow = (
    <span className={cn('inline-flex items-center gap-1.5', NAME_SIZE[size])}>
      {isSpectator && <SpectatorMark />}
      <span className="font-semibold text-cdm-fg">{nickname}</span>
      {isHost && <HostMark />}
      {isMe && <MeLabel />}
      {turnEl}
      {typeof reconnectingSeconds === 'number' && (
        <ReconnectingMark seconds={reconnectingSeconds} />
      )}
    </span>
  );

  if (layout === 'inline') {
    return (
      <span className={cn('inline-flex items-center gap-1.5', className)}>
        {titleEl}
        {nameRow}
      </span>
    );
  }

  return (
    <span className={cn('inline-flex flex-col items-start gap-0.5', className)}>
      {titleEl}
      {nameRow}
    </span>
  );
}
