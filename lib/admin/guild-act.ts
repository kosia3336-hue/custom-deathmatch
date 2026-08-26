import { mapGuildV4Error } from '@/lib/guild-v4/errors';

const ADMIN_GUILD_EXTRA: Record<string, { status: number; msg: string }> = {
  guild_disbanded: { status: 409, msg: '해체된 길드입니다.' },
  invalid_action: { status: 400, msg: '잘못된 작업입니다.' },
  invalid_capacity: { status: 400, msg: '정원은 3~30입니다.' },
  capacity_below_members: { status: 409, msg: '현재 인원보다 정원을 줄일 수 없습니다.' },
  cannot_target_owner: { status: 403, msg: '길드장은 이 대상으로 지정할 수 없습니다.' },
  reason_invalid: { status: 400, msg: '사유는 3~200자입니다.' },
  delta_zero: { status: 400, msg: '변경량은 0이 아니어야 합니다.' },
  delta_out_of_range: { status: 400, msg: '변경량 범위를 확인하세요.' },
};

export function mapAdminGuildError(message: string | undefined | null): { status: number; msg: string } {
  if (message) {
    for (const key of Object.keys(ADMIN_GUILD_EXTRA)) {
      if (message.includes(key)) return ADMIN_GUILD_EXTRA[key]!;
    }
  }
  const mapped = mapGuildV4Error(message);
  if (mapped.msg === '길드장·부길드장만 할 수 있습니다.') {
    return { status: 403, msg: '권한이 없습니다.' };
  }
  return mapped;
}

export const ADMIN_GUILD_ACTIONS = [
  'adjust_gp',
  'kick',
  'disband',
  'set_vice',
  'transfer_owner',
  'set_profile',
  'set_mark',
  'set_capacity',
  'resolve_join',
  'add_member',
] as const;

export type AdminGuildAction = (typeof ADMIN_GUILD_ACTIONS)[number];
