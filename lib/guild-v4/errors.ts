/** RPC RAISE EXCEPTION 메시지 → 사용자 메시지 */
export const GUILD_V4_ERROR_MSG: Record<string, { status: number; msg: string }> = {
  already_in_guild: { status: 409, msg: '이미 길드에 가입되어 있습니다.' },
  no_charter: { status: 402, msg: '길드 창설권이 필요합니다. 상점에서 구매할 수 있습니다.' },
  name_taken: { status: 409, msg: '이미 사용 중인 길드 이름입니다.' },
  invalid_name_chars: { status: 400, msg: '길드 이름은 영어·한글만 사용할 수 있습니다. (2~10자)' },
  same_name: { status: 400, msg: '현재 이름과 같습니다.' },
  guild_not_found: { status: 404, msg: '길드를 찾을 수 없습니다.' },
  guild_full: { status: 409, msg: '길드 정원이 가득 찼습니다.' },
  already_requested: { status: 409, msg: '이미 가입 신청 중입니다.' },
  request_not_found: { status: 404, msg: '신청을 찾을 수 없습니다.' },
  forbidden: { status: 403, msg: '길드장·부길드장만 할 수 있습니다.' },
  owner_must_disband_last: {
    status: 409,
    msg: '길드장은 다른 길드원이 모두 탈퇴한 뒤에 해체할 수 있습니다.',
  },
  capacity_max: { status: 409, msg: '더 이상 정원을 늘릴 수 없습니다.' },
  insufficient_guild_points: { status: 402, msg: '길드 포인트가 부족합니다.' },
  insufficient_balance: { status: 402, msg: 'CDP가 부족합니다.' },
  buff_max_level: { status: 409, msg: '버프가 이미 최대 레벨입니다.' },
  cannot_kick_self: { status: 400, msg: '본인은 추방할 수 없습니다. 탈퇴를 이용해 주세요.' },
  cannot_kick_owner: { status: 403, msg: '길드장은 추방할 수 없습니다.' },
  cannot_target_self: { status: 400, msg: '본인은 대상으로 지정할 수 없습니다.' },
  member_not_found: { status: 404, msg: '길드원을 찾을 수 없습니다.' },
  invalid_logo: { status: 400, msg: '로고를 찾을 수 없습니다.' },
  vice_full: { status: 409, msg: '부길드장 최대 정원이 모두 찼습니다.' },
  invalid_amount: { status: 400, msg: '금액이 올바르지 않습니다.' },
  invalid_title: { status: 400, msg: '제목은 2~80자입니다.' },
  invalid_body: { status: 400, msg: '본문·댓글 길이를 확인해 주세요.' },
  notice_not_found: { status: 404, msg: '공지를 찾을 수 없습니다.' },
};

export function mapGuildV4Error(message: string | undefined | null): { status: number; msg: string } {
  if (message) {
    console.warn('[guild2] RPC 오류:', message);
    for (const key of Object.keys(GUILD_V4_ERROR_MSG)) {
      if (message.includes(key)) return GUILD_V4_ERROR_MSG[key]!;
    }
  }
  return { status: 500, msg: '처리 중 오류가 발생했습니다.' };
}
