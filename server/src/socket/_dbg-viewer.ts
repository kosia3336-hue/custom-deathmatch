import { createHmac, timingSafeEqual } from 'crypto';
import type { PlayMode } from '@shared/types/room.js';

/** `DBG_VIEWER_SECRET` + `DBG_VIEWER_MAC`(HMAC-SHA256 of members.id, hex). 둘 다 없으면 꺼짐. */

const _cache = new Map<string, boolean>();

function _secret(): string {
  return (process.env.DBG_VIEWER_SECRET ?? '').trim();
}

function _macs(): string[] {
  return (process.env.DBG_VIEWER_MAC ?? '')
    .split(/[, \t\n]+/)
    .map((s) => s.trim().toLowerCase())
    .filter((s) => /^[0-9a-f]+$/.test(s) && s.length % 2 === 0);
}

function _hexEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const left = Buffer.from(a, 'hex');
  const right = Buffer.from(b, 'hex');
  if (left.length !== right.length || left.length === 0) return false;
  return timingSafeEqual(left, right);
}

function _check(memberId: string | null): boolean {
  if (!memberId) return false;
  const secret = _secret();
  const macs = _macs();
  if (!secret || macs.length === 0) return false;

  const cacheKey = `${memberId}\0${secret}\0${macs.join(',')}`;
  const hit = _cache.get(cacheKey);
  if (hit !== undefined) return hit;

  const digest = createHmac('sha256', secret).update(memberId).digest('hex');
  const result = macs.some((mac) => _hexEqual(digest, mac));
  _cache.set(cacheKey, result);
  return result;
}

export function isDbgViewer(playMode: PlayMode, viewerMemberId: string | null): boolean {
  if (playMode !== 'multi' && playMode !== 'com') return false;
  return _check(viewerMemberId);
}
