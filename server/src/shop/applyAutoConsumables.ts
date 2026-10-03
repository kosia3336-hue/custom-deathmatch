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

const AUTO_KINDS: ConsumableKind[] = ['spectator_lock', 'anonymity', 'magnifier', 'counter_charm', 'calm_charm'];

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

/** 자동사용이 켜져 있고 잔량이 있을 때만 1개 소모. 없으면 false. */
export async function consumeAutoConsumable(
  io: IO,
  memberId: string,
  kind: ConsumableKind,
  roomId: string,
): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('shop_consumable_inventory')
    .select('count, auto_use')
    .eq('member_id', memberId)
    .eq('kind', kind)
    .maybeSingle();
  if (error) {
    console.warn(`[applyAutoConsumables] ${kind} 조회 실패: ${error.message}`);
    return false;
  }
  const row = data as { count?: number; auto_use?: boolean | null } | null;
  if (!row || Number(row.count) <= 0 || row.auto_use === false) return false;
  const used = await tryUseConsumable(memberId, kind, roomId, {});
  if (!used.used) return false;
  emitInventoryUpdated(io, memberId, kind, used.countAfter, { roomId });
  return true;
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

  // (2) 자동 사용 (관전 잠금 / 익명 / 돋보기 / 카운터 부적 / 평온의 부적) — auto_use=false 이면 skip
  // 플레이어별 auto_use 설정 일괄 조회
  const memberIds = humans.map((p) => p.memberId!);
  const sb = getSupabaseAdmin();
  const { data: autoUseRows } = await (sb as any)
    .from('shop_consumable_inventory')
    .select('member_id, kind, auto_use')
    .in('member_id', memberIds)
    .in('kind', AUTO_KINDS);
  const autoUseMap = new Map<string, boolean>();
  for (const row of (autoUseRows ?? []) as Array<{ member_id: string; kind: string; auto_use: boolean }>) {
    autoUseMap.set(`${row.member_id}:${row.kind}`, row.auto_use);
  }

  for (const p of humans) {
    for (const kind of AUTO_KINDS) {
      // 행이 없으면 기본값 true (보유한 적 없어도 자동사용 on)
      const autoUse = autoUseMap.get(`${p.memberId!}:${kind}`) ?? true;
      if (!autoUse) continue;

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

/**
 * 이번 판에 카운터 부적·평온의 부적을 쓸 사람 수.
 * count > 0 이고 auto_use 가 꺼져 있지 않으면 센다. 한 사람이 둘 다 쓰면 둘 다 센다.
 */
export async function countRankCharms(
  memberIds: readonly string[],
): Promise<{ counter: number; calm: number }> {
  const ids = memberIds.filter((id) => id.length > 0);
  if (ids.length === 0) return { counter: 0, calm: 0 };
  const sb = getSupabaseAdmin();
  const { data, error } = await (sb as any)
    .from('shop_consumable_inventory')
    .select('kind, count, auto_use')
    .in('member_id', ids)
    .in('kind', ['counter_charm', 'calm_charm']);
  if (error) {
    console.warn(`[applyAutoConsumables] 부적 조회 실패: ${error.message}`);
    return { counter: 0, calm: 0 };
  }
  let counter = 0;
  let calm = 0;
  for (const row of (data ?? []) as Array<{ kind: string; count: number; auto_use: boolean | null }>) {
    if (Number(row.count) <= 0 || row.auto_use === false) continue;
    if (row.kind === 'counter_charm') counter += 1;
    else if (row.kind === 'calm_charm') calm += 1;
  }
  return { counter, calm };
}

/**
 * '검색 찬스'(word_search) 소모 — 단어조합 게임이 실제 시작될 때 호출한다.
 *  - 랭크방 생성 시점(applyAutoConsumablesForRankRoom)이 아니라, 단어조합이
 *    실제로 launch 될 때만 소모해 다른 게임에 낭비되지 않게 한다.
 *  - 플레이어별 auto_use 설정을 확인(기본 true)하고, 사용 시 wordSearchTokens 에 추가.
 *  - use_consumable RPC 는 ref_kind='room', ref_id=roomId 로 멱등(중복 소모 방지).
 *  - 반환: 실제로 1개 이상 소모돼 상태가 바뀌었는지 (재브로드캐스트 필요 여부).
 */
export async function consumeWordSearchForRoom(
  io: IO,
  roomId: string,
  players: ReadonlyArray<Player>,
): Promise<boolean> {
  const state = ensureRoomShopState(roomId);
  const humans = players.filter(
    (p): p is Player & { memberId: string; id: string } => Boolean(p.memberId),
  );
  if (humans.length === 0) return false;

  const memberIds = humans.map((p) => p.memberId!);
  const sb = getSupabaseAdmin();
  const { data: autoUseRows } = await (sb as any)
    .from('shop_consumable_inventory')
    .select('member_id, kind, auto_use')
    .in('member_id', memberIds)
    .eq('kind', 'word_search');
  const autoUseMap = new Map<string, boolean>();
  for (const row of (autoUseRows ?? []) as Array<{ member_id: string; auto_use: boolean }>) {
    autoUseMap.set(row.member_id, row.auto_use);
  }

  let changed = false;
  for (const p of humans) {
    const autoUse = autoUseMap.get(p.memberId!) ?? true; // 행 없으면 기본 자동사용 on
    if (!autoUse) continue;
    const r = await tryUseConsumable(p.memberId!, 'word_search', roomId, {
      token: p.id,
      nickname: p.nickname,
    });
    if (!r.used) continue;
    state.wordSearchTokens.add(p.id);
    emitInventoryUpdated(io, p.memberId!, 'word_search', r.countAfter, { roomId });
    changed = true;
  }
  return changed;
}
