/**
 * 회원 조회 헬퍼 (서버 service_role 기반).
 *
 * socket 인증 시 Supabase access_token 으로 회원 정보 (id, nickname, displayed_title) 를 한 번에 가져온다.
 */

import type { EquippedSkin } from '@shared/types/skin.js';
import { getSupabaseAdmin, getMemberIdFromToken } from './supabase.js';

export interface MemberInfo {
  id: string;
  nickname: string;
  status: 'active' | 'suspended' | 'banned' | 'withdrawn';
  displayedTitle: { id: string; name: string; color: string; effect: string | null } | null;
  /** 소속 길드 마크 (미가입/마크 미등록이면 null) */
  guildMark: { url: string; name: string } | null;
  equippedSkins: EquippedSkin[];
  /** expires_at 이 있는 착용 스킨의 만료 시각 목록 (무기한 스킨은 제외) */
  skinExpiries: Array<{ skinId: string; expiresAt: Date }>;
}

/** access_token → 회원 정보 (모두 미설정/실패 시 null) */
export async function getMemberFromAccessToken(accessToken: string): Promise<MemberInfo | null> {
  const memberId = await getMemberIdFromToken(accessToken);
  if (!memberId) return null;

  const sb = getSupabaseAdmin();

  const { data: memberRow, error: memberErr } = await sb
    .from('members')
    .select('id, nickname, withdrawn_at, displayed_title_id')
    .eq('id', memberId)
    .maybeSingle();
  if (memberErr || !memberRow) return null;
  const member = memberRow as { id: string; nickname: string; withdrawn_at: string | null; displayed_title_id: string | null };

  if (member.withdrawn_at) return null;

  const { data: privRow } = await sb
    .from('members_private')
    .select('status')
    .eq('member_id', memberId)
    .maybeSingle();
  const status = (privRow as { status?: string } | null)?.status as MemberInfo['status'] | undefined;

  let displayedTitle: MemberInfo['displayedTitle'] = null;
  if (member.displayed_title_id) {
    const { data: titleRow } = await sb
      .from('titles')
      .select('id, name, color, effect')
      .eq('id', member.displayed_title_id)
      .maybeSingle();
    const title = titleRow as { id: string; name: string; color: string; effect: string | null } | null;
    if (title) {
      displayedTitle = { id: title.id, name: title.name, color: title.color, effect: title.effect ?? null };
    }
  }

  // 소속 길드 마크 (컬럼 미배포/미가입이면 null)
  let guildMark: MemberInfo['guildMark'] = null;
  try {
    const { data: gmRow } = await sb
      .from('guild_members')
      .select('guilds!inner(name, mark_url)')
      .eq('member_id', memberId)
      .maybeSingle();
    const raw = (gmRow as { guilds: { name: string; mark_url: string | null } | { name: string; mark_url: string | null }[] } | null)?.guilds;
    const g = Array.isArray(raw) ? raw[0] : raw;
    if (g?.mark_url) guildMark = { url: g.mark_url, name: g.name };
  } catch {
    guildMark = null;
  }

  // 착용 중인 스킨 (게임 ID + 만료 시각 포함)
  let equippedSkins: EquippedSkin[] = [];
  const skinExpiries: Array<{ skinId: string; expiresAt: Date }> = [];
  const { data: skinRows } = await sb
    .from('member_skins')
    .select('skin_id, expires_at, skins!inner(game_id)')
    .eq('member_id', memberId)
    .eq('equipped', true)
    .is('revoked_at', null)
    .or('expires_at.is.null,expires_at.gt.' + new Date().toISOString());
  if (Array.isArray(skinRows)) {
    equippedSkins = (skinRows as Array<{ skin_id: string; expires_at: string | null; skins: { game_id: string } | { game_id: string }[] }>)
      .map((r) => {
        const game = Array.isArray(r.skins) ? r.skins[0] : r.skins;
        if (!game) return null;
        if (r.expires_at) skinExpiries.push({ skinId: r.skin_id, expiresAt: new Date(r.expires_at) });
        return { skinId: r.skin_id, gameId: game.game_id };
      })
      .filter((s): s is EquippedSkin => s !== null);
  }

  return {
    id: member.id,
    nickname: member.nickname,
    status: status ?? 'active',
    displayedTitle,
    guildMark,
    equippedSkins,
    skinExpiries,
  };
}
