/**
 * 랭크 방 제목 — '닉[티어] VS 닉[티어]'.
 *
 * 서버에 저장되는 방 제목은 '[랭크] 게임명' 그대로 둔다(게임 기록의 room_snapshot.title 로
 * 무승부 랭크전을 가려내는 데 쓴다). 화면에서만 이 형식으로 바꿔 그리고, '[랭크]' 는
 * 제목 옆 아이콘(RankedRoomBadge)으로 보여 준다.
 *
 * 닉네임·티어는 서버가 보는 사람 기준으로 이미 가려서 보낸다 — 방 안에서는 본인만 실명,
 * 로비에서는 모두 '???', 익명 물약을 쓴 사람의 티어는 null('???').
 */
import type { RankTier } from '@/shared/types/rank';
import type { Player, RoomSummary } from '@/shared/types/room';

export const RANK_TIER_LABEL: Record<RankTier, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

const HIDDEN = '???';

export function rankTierLabel(tier: RankTier | null | undefined): string {
  return tier ? RANK_TIER_LABEL[tier] : HIDDEN;
}

function matchupTitle(sides: { name: string; tier: RankTier | null | undefined }[]): string {
  return sides.map((side) => `${side.name || HIDDEN}[${rankTierLabel(side.tier)}]`).join(' VS ');
}

/** 방 안(대기실·게임) — 플레이어면 본인을 앞에 둔다. 예: '천하[다이아] VS ???[언랭]' */
export function rankedRoomMatchup(
  room: { players: Pick<Player, 'id' | 'nickname' | 'rankTier'>[] },
  myId: string | null | undefined,
): string {
  const players = [...room.players].sort((a, b) =>
    a.id === myId ? -1 : b.id === myId ? 1 : 0,
  );
  return matchupTitle(players.map((p) => ({ name: p.nickname, tier: p.rankTier })));
}

/** 로비 목록 — 이름은 모두 ???. 예: '???[다이아] VS ???[언랭]' */
export function rankedLobbyMatchup(room: Pick<RoomSummary, 'rankTiers'>): string {
  const tiers = room.rankTiers?.length ? room.rankTiers : [null, null];
  return matchupTitle(tiers.map((tier) => ({ name: HIDDEN, tier })));
}
