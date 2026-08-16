import { loadResolvedDisplayedTitle } from '@shared/titles/resolve-displayed.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';

const expiryTimers = new Map<string, ReturnType<typeof setTimeout>>();

/**
 * 장착 이펙트에 만료가 있으면 타이머를 건다.
 * 만료 시 게임 중이 아니면 세션 표시 칭호를 다시 resolve 한다 (overlay 제거).
 */
export function scheduleEffectExpiry(token: string, expiresAt: Date | null | undefined): void {
  cancelEffectExpiry(token);
  if (!expiresAt) return;

  const delay = expiresAt.getTime() - Date.now();
  if (delay <= 0) return;

  const timer = setTimeout(() => {
    void onEffectExpired(token);
  }, delay);
  expiryTimers.set(token, timer);
}

export function cancelEffectExpiry(token: string): void {
  const timer = expiryTimers.get(token);
  if (!timer) return;
  clearTimeout(timer);
  expiryTimers.delete(token);
}

async function onEffectExpired(token: string): Promise<void> {
  expiryTimers.delete(token);

  const socketId = sessions.getSocketByToken(token);
  const roomId = socketId ? sessions.getRoom(socketId) : undefined;
  const room = roomId ? roomStore.get(roomId) : undefined;
  if (room?.status === 'playing') return;

  const memberId = sessions.getMemberId(token);
  if (!memberId) return;

  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from('members')
    .select('displayed_title_id, displayed_effect_id')
    .eq('id', memberId)
    .maybeSingle();
  const row = data as {
    displayed_title_id: string | null;
    displayed_effect_id: string | null;
  } | null;

  const displayedTitle = await loadResolvedDisplayedTitle(
    sb,
    memberId,
    row?.displayed_title_id ?? null,
    row?.displayed_effect_id ?? null,
  );

  sessions.setMemberInfo(
    token,
    memberId,
    displayedTitle,
    sessions.getEquippedSkins(token),
    sessions.getGuildId(token),
    sessions.getGuildName(token),
  );
}
