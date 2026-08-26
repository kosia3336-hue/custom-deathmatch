/** `guild_point_ledger.reason` — 소모(음수) 행만 관리자 화면에 쓴다. */

const SPEND_REASON_KO: Record<string, string> = {
  expansion_purchase: '정원 확장',
  mark_purchase: '마크 변경',
  name_change_purchase: '이름 변경',
  buff_cdp_purchase: 'CDP 수완 버프',
  scout: '스카우트',
  grant_cdp: '길드원 CDP 지급',
  admin_adjust: '관리자 조정',
  rank_card_purchase: '랭킹 카드',
};

export function guildSpendReasonKo(reason: string): string {
  return SPEND_REASON_KO[reason] ?? '기타 소모';
}
