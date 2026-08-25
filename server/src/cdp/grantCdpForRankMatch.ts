/**
 * 랭크 게임 종료 후 CDP 적립 배치 처리 + 본인 소켓 emit.
 */
import type { IO } from '../socket/types.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import { sessions } from '../store/sessions.js';
import type { CdpGrantInput } from './calc.js';
import { applyGuildCdpBuffV4 } from './guildBuffV4.js';
import { applyGuildRoleCdpV4 } from './guildRoleCdpV4.js';

export type { CdpGrantInput } from './calc.js';

export interface CdpGrantResult {
  memberId: string;
  amount: number;
  newBalance: number;
  reason: CdpGrantInput['reason'];
  breakdown: CdpGrantInput['breakdown'];
  inserted: boolean;
}

interface GrantRpcRow {
  inserted: boolean;
  new_balance: number;
}

export async function grantCdpForRankMatch(
  io: IO | null,
  rawInputs: CdpGrantInput[],
): Promise<CdpGrantResult[]> {
  if (!isSupabaseConfigured() || rawInputs.length === 0) return [];
  const sb = getSupabaseAdmin();
  const out: CdpGrantResult[] = [];

  const buffed = await applyGuildCdpBuffV4(rawInputs);
  const inputs = await applyGuildRoleCdpV4(buffed);

  for (const inp of inputs) {
    if (inp.amount <= 0) {
      // 몰수패 등: 잔액 변동 없음. 잔액 조회만.
      const { data: balRow } = await sb
        .from('member_cdp')
        .select('balance')
        .eq('member_id', inp.memberId)
        .maybeSingle();
      out.push({
        memberId: inp.memberId,
        amount: 0,
        newBalance: Number((balRow as { balance?: number } | null)?.balance ?? 0),
        reason: inp.reason,
        breakdown: inp.breakdown,
        inserted: false,
      });
      continue;
    }

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb.rpc as any)('grant_cdp_for_rank_match', {
        p_member_id: inp.memberId,
        p_rank_match_id: inp.rankMatchId,
        p_amount: inp.amount,
        p_reason: inp.reason,
        p_metadata: {
          base: inp.breakdown.base,
          tier_bonus: inp.breakdown.tierBonus,
          tier: inp.breakdown.tierAtGrant,
          ...(inp.breakdown.guildBuffBonus
            ? {
                guild_buff_level: inp.breakdown.guildBuffLevel,
                guild_buff_bonus: inp.breakdown.guildBuffBonus,
              }
            : {}),
          ...(inp.breakdown.guildRoleBonus
            ? {
                guild_role: inp.breakdown.guildRole,
                guild_role_bonus: inp.breakdown.guildRoleBonus,
              }
            : {}),
        },
      });
      if (error) throw error;

      const row: GrantRpcRow | undefined = Array.isArray(data) ? data[0] : data;
      const inserted = Boolean(row?.inserted);
      const newBalance = Number(row?.new_balance ?? 0);
      console.log(
        `[cdp:grant] member=${inp.memberId} match=${inp.rankMatchId} amount=${inp.amount} reason=${inp.reason} inserted=${inserted} balance=${newBalance}`,
      );
      out.push({
        memberId: inp.memberId,
        amount: inp.amount,
        newBalance,
        reason: inp.reason,
        breakdown: inp.breakdown,
        inserted,
      });
    } catch (err) {
      console.warn('[cdp:grant] 실패:', (err as Error).message, {
        memberId: inp.memberId,
        rankMatchId: inp.rankMatchId,
        amount: inp.amount,
        reason: inp.reason,
      });
      out.push({
        memberId: inp.memberId,
        amount: 0,
        newBalance: 0,
        reason: inp.reason,
        breakdown: inp.breakdown,
        inserted: false,
      });
    }
  }

  if (io) {
    for (const g of out) {
      if (g.amount === 0 && !g.inserted) continue;
      const token = sessions.getTokenByMemberId(g.memberId);
      if (!token) continue;
      const sid = sessions.getSocketByToken(token);
      if (!sid) continue;
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;
      const original = inputs.find((x) => x.memberId === g.memberId);
      sock.emit('cdp:granted', {
        rankMatchId: original?.rankMatchId ?? '',
        amount: g.amount,
        newBalance: g.newBalance,
        reason: g.reason,
        breakdown: g.breakdown,
      });
    }
  }

  return out;
}
