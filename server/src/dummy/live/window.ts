/**
 * 운영 더미 창·식별. 로스터는 roster.ts.
 * 평일 KST만. 캡틴영준·아이언현성 off / 최연승 21:00–23:00 / Jack 23:30–01:00. 토·일 전원 쉼.
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

export function isJackLiveWindow(d = new Date()): boolean {
  return isLiveDummyWindowOpen(findRosterByKey('jack').window, d);
}

export function isIronhyunseongLiveWindow(d = new Date()): boolean {
  return isLiveDummyWindowOpen(findRosterByKey('ironhyunseong').window, d);
}

export function rejoinDelayMs(): number {
  return (5 + Math.floor(Math.random() * 6)) * 1000;
}
