import type { DummyAiTier, LiveDummyKey } from '@shared/dummy.js';
import { LIVE_DUMMY_AI } from '@shared/dummy.js';

export type LiveDummyWindow =
  | { kind: 'dated'; dates: ReadonlySet<string>; startMin: number; endMin: number }
  | { kind: 'daily'; startMin: number; endMin: number };

export interface LiveDummyRuntime {
  key: LiveDummyKey;
  nickname: string;
  email: string;
  socketId: string;
  passwordSeed: string;
  defaultTier: DummyAiTier;
  window: LiveDummyWindow;
}

const RUNTIME: Record<
  LiveDummyKey,
  Omit<LiveDummyRuntime, 'nickname' | 'defaultTier'>
> = {
  titan: {
    key: 'titan',
    email: 'dummy_titan@dummy.internal',
    socketId: 'live-dummy:titan',
    passwordSeed: 'dummy:titan',
    window: { kind: 'daily', startMin: 22 * 60, endMin: 24 * 60 },
  },
  yeonseung: {
    key: 'yeonseung',
    email: 'dummy_yeonseung@dummy.internal',
    socketId: 'live-dummy:yeonseung',
    passwordSeed: 'dummy:yeonseung',
    window: { kind: 'daily', startMin: 21 * 60, endMin: 22 * 60 + 30 },
  },
};

export const LIVE_DUMMY_ROSTER: readonly LiveDummyRuntime[] = LIVE_DUMMY_AI.map((ai) => ({
  ...RUNTIME[ai.key],
  nickname: ai.nickname,
  defaultTier: ai.defaultTier,
}));

export function kstClock(d = new Date()): { ymd: string; mins: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d);
  let year = '',
    month = '',
    day = '',
    hour = 0,
    minute = 0;
  for (const p of parts) {
    if (p.type === 'year') year = p.value;
    if (p.type === 'month') month = p.value;
    if (p.type === 'day') day = p.value;
    if (p.type === 'hour') hour = Number(p.value);
    if (p.type === 'minute') minute = Number(p.value);
  }
  return { ymd: `${year}-${month}-${day}`, mins: hour * 60 + minute };
}

export function isLiveDummyWindowOpen(window: LiveDummyWindow, d = new Date()): boolean {
  const { ymd, mins } = kstClock(d);
  if (window.kind === 'dated') {
    if (!window.dates.has(ymd)) return false;
    return mins >= window.startMin && mins < window.endMin;
  }
  return mins >= window.startMin && mins < window.endMin;
}

export function findRosterByKey(key: LiveDummyKey): LiveDummyRuntime {
  return LIVE_DUMMY_ROSTER.find((r) => r.key === key)!;
}

export function findRosterBySocketId(socketId: string): LiveDummyRuntime | undefined {
  return LIVE_DUMMY_ROSTER.find((r) => r.socketId === socketId);
}

export function findRosterByNickname(nickname: string): LiveDummyRuntime | undefined {
  return LIVE_DUMMY_ROSTER.find((r) => r.nickname === nickname);
}
