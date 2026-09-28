import { NextResponse } from 'next/server';
import { getActiveMember } from '@/lib/auth/server';
import { isSupabaseServiceRoleConfigured } from '@/lib/supabase/service-role';
import { loadGuildChatBadge } from '@/lib/guild-v4/server';

export const dynamic = 'force-dynamic';

/** 길드 채팅 미읽음 배지. 전체 스냅샷은 가져오지 않는다. */
export async function GET() {
  if (!isSupabaseServiceRoleConfigured()) {
    return NextResponse.json({ guildId: null, chatSeenMessageId: null });
  }
  const member = await getActiveMember();
  if (!member) return NextResponse.json({ guildId: null, chatSeenMessageId: null });
  try {
    const badge = await loadGuildChatBadge(member.id);
    return NextResponse.json(badge);
  } catch (err) {
    console.error('[guild2:chat-badge]', (err as Error).message);
    return NextResponse.json({ guildId: null, chatSeenMessageId: null });
  }
}
