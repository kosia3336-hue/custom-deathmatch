import 'server-only';

import type { getSupabaseServiceRole } from '@/lib/supabase/service-role';
import { notifyGuildJoinRequest } from '@/lib/guild-v4/notify';

type Sb = ReturnType<typeof getSupabaseServiceRole>;

/**
 * 가입 신청 성공 뒤 길드장 우편함에만 넣는다. 부길드장에게는 안 보낸다.
 * 신청 자체는 이미 들어간 뒤라, 우편 실패해도 가입은 그대로 둔다.
 */
export async function sendGuildJoinRequestMail(
  sb: Sb,
  args: { guildId: string; applicantId: string; applicantNickname: string },
): Promise<void> {
  try {
    const { data: guild } = await sb
      .from('guilds')
      .select('owner_id, name')
      .eq('id', args.guildId)
      .maybeSingle();
    const ownerId = (guild as { owner_id?: string; name?: string } | null)?.owner_id;
    const guildName = (guild as { name?: string } | null)?.name?.trim();
    if (!ownerId || !guildName || ownerId === args.applicantId) return;

    const { data: req } = await sb
      .from('guild_join_requests')
      .select('id')
      .eq('guild_id', args.guildId)
      .eq('member_id', args.applicantId)
      .eq('status', 'pending')
      .maybeSingle();
    const requestId = (req as { id?: string } | null)?.id;
    if (!requestId) return;

    const nick = args.applicantNickname.trim() || '회원';
    // database.types.ts 에 mailbox_items 가 없다. 정본은 handover/infra/tables.md.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (sb.from('mailbox_items') as any).upsert(
      [
        {
          member_id: ownerId,
          source_key: `guild-join:${requestId}`,
          kind: 'guild',
          title: '길드 가입 신청',
          body: `${nick} 님이 ${guildName} 길드에 가입 신청했습니다.`,
          sender: nick,
          payload: {
            joinRequest: {
              requestId,
              guildId: args.guildId,
              guildName,
              fromNickname: nick,
            },
          },
        },
      ],
      { onConflict: 'member_id,source_key', ignoreDuplicates: true },
    );
    if (error) {
      console.warn('[guild2:join-mail]', error.message);
      return;
    }

    await notifyGuildJoinRequest(ownerId, {
      requestId,
      guildId: args.guildId,
      guildName,
      fromNickname: nick,
    });
  } catch (err) {
    console.warn('[guild2:join-mail]', (err as Error).message);
  }
}
