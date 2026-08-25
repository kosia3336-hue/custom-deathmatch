'use client';

import { useEffect } from 'react';
import { getSocket } from '@/lib/socket';
import { ingestGuildScoutMail } from '@/lib/mailbox/ingest';
import type { GuildScoutInvitePayload } from '@/lib/guild-v4/scoutTypes';

function ingest(payload: GuildScoutInvitePayload) {
  if (!payload.inviteId || !payload.guildId) return;
  ingestGuildScoutMail(payload);
}

/** 스카우트 초대 → 우편함. 소켓 + 미접속분 GET. */
export function GuildScoutMailListener() {
  useEffect(() => {
    const socket = getSocket();
    const onInvite = (payload: GuildScoutInvitePayload) => ingest(payload);
    socket.on('guild:scout-invite', onInvite);

    fetch('/api/guild2/scout')
      .then((r) => (r.ok ? (r.json() as Promise<{ invites?: GuildScoutInvitePayload[] }>) : null))
      .then((j) => {
        for (const invite of j?.invites ?? []) ingest(invite);
      })
      .catch(() => {});

    return () => {
      socket.off('guild:scout-invite', onInvite);
    };
  }, []);

  return null;
}
