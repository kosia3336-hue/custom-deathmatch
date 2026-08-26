import Link from 'next/link';
import { GuildMark } from '@/components/cdm/GuildMark';
import type { AdminMemberGuild } from './fetchMemberGuilds';

export function AdminGuildLabel({ guild }: { guild: AdminMemberGuild | null }) {
  if (!guild) {
    return <span className="text-cdm-fg-subtle">—</span>;
  }
  const inner = (
    <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
      {guild.markUrl ? (
        <GuildMark mark={{ url: guild.markUrl, name: guild.name }} size="sm" />
      ) : null}
      <span className="truncate text-cdm-fg">{guild.name}</span>
    </span>
  );
  if (!guild.id) return inner;
  return (
    <Link
      href={`/admin/guilds/${guild.id}`}
      onClick={(e) => e.stopPropagation()}
      className="hover:underline"
    >
      {inner}
    </Link>
  );
}
