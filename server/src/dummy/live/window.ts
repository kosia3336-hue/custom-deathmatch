/**
 * 운영 더미 창·식별. 로스터는 roster.ts.
 * 타이탄: 매일 22:00 ≤ t < 24:00 KST.
 * 최연승: 매일 21:00 ≤ t < 22:30 KST.
 */

export {
  LIVE_DUMMY_NICKNAME,
  LIVE_DUMMY_TIER,
  LIVE_DUMMY_TIER_OVERRIDES,
  liveDummyTierForGame,
  liveDummyTierFor,
} from '@shared/dummy.js';

export {
  LIVE_DUMMY_ROSTER,
  findRosterByKey,
  findRosterBySocketId,
  isLiveDummyWindowOpen,
} from './roster.js';

import { findRosterByKey, isLiveDummyWindowOpen } from './roster.js';

export const LIVE_DUMMY_SOCKET_ID = 'live-dummy:titan';
export const LIVE_DUMMY_EMAIL = 'dummy_titan@dummy.internal';

export function isLiveDummyEnabled(): boolean {
  const v = (process.env.DUMMY_LIVE ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'yes';
}

export function isTitanLiveWindow(d = new Date()): boolean {
  return isLiveDummyWindowOpen(findRosterByKey('titan').window, d);
}

export function isYeonseungLiveWindow(d = new Date()): boolean {
  return isLiveDummyWindowOpen(findRosterByKey('yeonseung').window, d);
}

export function rejoinDelayMs(): number {
  return (5 + Math.floor(Math.random() * 6)) * 1000;
}
