'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { GuildMark, type GuildMarkInfo } from '@/components/cdm/GuildMark';
import { cn } from '@/lib/utils';
import type { GuildSummary } from '@/lib/guild/types';
import { GuildInfoModal } from './GuildInfoModal';

export function OpenGuildInfoMark({
  mark,
  size = 'xl',
  className,
}: {
  mark?: GuildMarkInfo | null;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
}) {
  const [guild, setGuild] = useState<GuildSummary | null>(null);
  const [canApply, setCanApply] = useState(false);
  const [busy, setBusy] = useState(false);

  if (!mark?.url) return null;

  const open = async () => {
    if (!mark.guildId || busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/guild2/summary?id=${encodeURIComponent(mark.guildId)}`);
      const json = (await res.json()) as {
        guild?: GuildSummary;
        canApply?: boolean;
        error?: string;
      };
      if (!res.ok || !json.guild) {
        toast.error(json.error ?? '길드 정보를 불러오지 못했습니다.');
        return;
      }
      setCanApply(json.canApply === true);
      setGuild(json.guild);
    } catch {
      toast.error('길드 정보를 불러오지 못했습니다.');
    } finally {
      setBusy(false);
    }
  };

  const markEl = <GuildMark mark={mark} size={size} className={className} />;
  if (!mark.guildId) return markEl;

  return (
    <>
      <button
        type="button"
        onClick={() => void open()}
        disabled={busy}
        aria-label={`${mark.name ?? ''} 길드 정보`.trim()}
        className={cn(
          'inline-flex shrink-0 cursor-pointer rounded-cdm-sm bg-transparent p-0',
          'focus:outline-none focus-visible:[box-shadow:var(--cdm-ring-primary)]',
          'disabled:cursor-wait',
        )}
      >
        {markEl}
      </button>
      {guild ? (
        <GuildInfoModal
          guild={guild}
          busy={busy}
          canApply={canApply}
          onClose={() => setGuild(null)}
          onJoin={async () => {
            setBusy(true);
            try {
              const res = await fetch('/api/guild2', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'join', guildId: guild.id }),
              });
              const json = (await res.json()) as { error?: string };
              if (!res.ok) {
                toast.error(json.error ?? '신청에 실패했습니다.');
                return;
              }
              toast.success('가입 신청을 보냈어요.');
              setCanApply(false);
            } catch {
              toast.error('신청에 실패했습니다.');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : null}
    </>
  );
}
