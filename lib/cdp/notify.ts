/**
 * Next API → 게임 서버 internal endpoint 호출 헬퍼.
 *  - 소켓 서버 다운 시에도 호출자 흐름은 막지 않는다 (catch & ignore).
 */
import 'server-only';

interface NotifyCdpAdjustedArgs {
  memberId: string;
  newBalance: number;
  delta: number;
  reason: 'shop_purchase' | 'admin_adjust';
  ref?: { kind: string; id: string };
}

interface NotifyShopItemChangedArgs {
  itemId: string;
  stock: number | null;
  isActive: boolean;
}

interface NotifyInventoryUpdatedArgs {
  memberId: string;
  kind: 'nickname_change' | 'rank_reset' | 'spectator_lock' | 'anonymity';
  countAfter: number;
  reason: 'purchase' | 'auto_use' | 'manual_use' | 'admin_adjust';
  ref?: { kind: string; id: string };
}

interface NotifyRankStatsResetArgs {
  memberId: string;
  seasonId: number;
  ticketCountAfter: number;
}

function getSocketBaseUrl(): string {
  return (
    process.env.SOCKET_SERVER_INTERNAL_URL ??
    process.env.NEXT_PUBLIC_SOCKET_URL ??
    'http://localhost:4001'
  );
}

function getInternalSecret(): string {
  return process.env.INTERNAL_SECRET ?? 'dev-internal-secret';
}

export async function notifyCdpAdjusted(args: NotifyCdpAdjustedArgs): Promise<void> {
  const url = `${getSocketBaseUrl()}/internal/notify-cdp-adjusted`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: getInternalSecret(), ...args }),
    });
  } catch {
    // 소켓 서버 다운 — 무시
  }
}

export async function notifyShopItemChanged(args: NotifyShopItemChangedArgs): Promise<void> {
  const url = `${getSocketBaseUrl()}/internal/notify-shop-item-changed`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: getInternalSecret(), ...args }),
    });
  } catch {
    // 무시
  }
}

export async function notifyInventoryUpdated(args: NotifyInventoryUpdatedArgs): Promise<void> {
  const url = `${getSocketBaseUrl()}/internal/notify-inventory-updated`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: getInternalSecret(), ...args }),
    });
  } catch {
    // 무시
  }
}

export async function notifyRankStatsReset(args: NotifyRankStatsResetArgs): Promise<void> {
  const url = `${getSocketBaseUrl()}/internal/notify-rank-stats-reset`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: getInternalSecret(), ...args }),
    });
  } catch {
    // 무시
  }
}

export async function notifyInvalidateBiasTitles(): Promise<void> {
  const url = `${getSocketBaseUrl()}/internal/invalidate-bias-titles`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: getInternalSecret() }),
    });
  } catch {
    // 무시
  }
}

export async function notifyInvalidateOwnedTitles(memberId: string): Promise<void> {
  const url = `${getSocketBaseUrl()}/internal/invalidate-owned-titles`;
  try {
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret: getInternalSecret(), memberId }),
    });
  } catch {
    // 무시
  }
}
