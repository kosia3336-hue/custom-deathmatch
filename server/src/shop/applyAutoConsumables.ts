/**
 * 랭크 매치 자동 소모 처리.
 *
 *  - 랭크 방이 만들어진 직후(밴픽 시작 직전) 호출한다.
 *  - 각 player(memberId) 마다:
 *      - spectator_lock 인벤토리가 있으면 → 1개 차감 + roomShopState.spectatorLockedTokens 에 추가
 *      - anonymity      인벤토리가 있으면 → 1개 차감 + roomShopState.anonymizedTokens     에 추가
 *  - 동시에 *착용 중인* bias 칭호 (Player.displayedTitle.id) 만 보고 캐시에 채워둔다.
 *    (단순 보유는 효과 없음 — README 결정사항 E)
 *
 *  멱등성: ref_kind='room', ref_id=roomId. 같은 방에 대해 두 번 호출돼도 차감 1회만.
 *  사용 후 socket 으로 inventory:updated 를 emit 하여 클라이언트 인벤토리 표시 즉시 갱신.
 */

import { getSupabaseAdmin } from '../db/supabase.js';
import { sessions } from '../store/sessions.js';
import type { Player } from '@shared/types/room.js';
import type { IO } from '../socket/types.js';
import type { ConsumableKind } from '../../../lib/supabase/database.types.js';
import { ensureRoomShopState } from './roomShopState.js';
import { getBiasTitleInfo } from './biasTitlesCache.js';

const AUTO_KINDS: ConsumableKind[] = ['spectator_lock', 'anonymity', 'magnifier'];

interface UseRpcRow {
  used: boolean;
  count_after: number;
  use_id: string | null;
}

async function tryUseConsumable(
  memberId: string,
  kind: ConsumableKind,
  roomId: string,
  metadata: Record<string, unknown>,
): Promise<{ used: boolean; countAfter: number }> {
  try {
    const sb = getSupabaseAdmin();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('use_consumable', {
      p_member_id: memberId,
      p_kind: kind,
      p_ref_kind: 'room',
      p_ref_id: roomId,
      p_metadata: metadata,
    });
    if (error) {
      console.warn(`[applyAutoConsumables] RPC ${kind} 실패: ${error.message}`);
      return { used: false, countAfter: 0 };
    }
    const row: UseRpcRow | undefined = Array.isArray(data) ? data[0] : data;
    return {
      used: row?.used === true,
      countAfter: Number(row?.count_after ?? 0),
    };
  } catch (err) {
    console.warn(`[applyAutoConsumables] ${kind} 예외:`, (err as Error).message);
    return { used: false, countAfter: 0 };
  }
}

function emitInventoryUpdated(
  io: IO,
  memberId: string,
  kind: ConsumableKind,
  countAfter: number,
  ref: { roomId: string },
): void {
  const token = sessions.getTokenByMemberId(memberId);
  if (!token) return;
  const sid = sessions.getSocketByToken(token);
  if (!sid) return;
  const sock = io.sockets.sockets.get(sid);
  if (!sock) return;
  sock.emit('inventory:updated', {
    kind,
    countAfter,
    reason: 'auto_use',
    ref: { kind: 'room', id: ref.roomId },
  });
}

/**
 * 랭크 매치 시작 시 호출.
 *  - roomId / players(memberId 기준) / io 필요.
 *  - 호출 후 roomShopState 가 채워져 있다.
 */
export async function applyAutoConsumablesForRankRoom(
  io: IO,
  roomId: string,
  players: ReadonlyArray<Player>,
): Promise<void> {
  const state = ensureRoomShopState(roomId);

  const humans = players.filter(
    (p): p is Player & { memberId: string; id: string } => Boolean(p.memberId),
  );

  // (1) bias 칭호 캐시 — *착용 중인* displayedTitle 만 효과 발동.
  for (const p of humans) {
    const titleId = p.displayedTitle?.id;
    if (!titleId) continue;
    try {
      const info = await getBiasTitleInfo(titleId);
      if (info) {
        state.biasTitlesByToken.set(p.id, new Set([titleId]));
      }
    } catch (err) {
      console.warn('[applyAutoConsumables] bias 캐시 실패:', (err as Error).message);
    }
  }

  // (2) 자동 사용 (관전 잠금 / 익명)
  for (const p of humans) {
    for (const kind of AUTO_KINDS) {
      const r = await tryUseConsumable(p.memberId!, kind, roomId, {
        token: p.id,
        nickname: p.nickname,
      });
      if (!r.used) continue;

      if (kind === 'spectator_lock') {
        state.spectatorLockedTokens.add(p.id);
      } else if (kind === 'anonymity') {
        state.anonymizedTokens.add(p.id);
        state.anonymizedMemberIds.add(p.memberId!);
      } else if (kind === 'magnifier') {
        state.magnifierTokens.add(p.id);
      }

      emitInventoryUpdated(io, p.memberId!, kind, r.countAfter, { roomId });
    }
  }
}
