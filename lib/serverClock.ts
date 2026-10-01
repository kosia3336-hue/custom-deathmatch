/**
 * 서버 시각 보정.
 *
 * 턴 타이머는 서버가 찍은 시각(turnStartedAt, deadline 등)과 '지금' 을 비교한다.
 * 지금을 기기 시계(Date.now())로 읽으면 기기마다 시계가 몇 초씩 어긋나 있어서,
 * 같은 판을 보는 두 사람의 남은 시간이 서로 다르고 서버 마감과도 어긋난다.
 *
 * 연결될 때 서버 시각을 몇 번 물어 '서버 − 기기' 오차를 재 두고, 서버 시각과
 * 비교하는 곳은 모두 serverNow() 를 쓴다. 기기 안에서만 쓰는 시각(로컬 잠금 등)은
 * 어느 쪽을 써도 되지만, 서버 시각과 한 식에 섞이면 serverNow() 로 맞춘다.
 */

export interface ClockSample {
  /** 요청을 보낸 기기 시각 */
  sentAt: number;
  /** 응답을 받은 기기 시각 */
  receivedAt: number;
  /** 서버가 응답한 서버 시각 */
  serverNow: number;
}

const SAMPLE_COUNT = 5;
const SAMPLE_TIMEOUT_MS = 3000;
/** 이보다 오래 걸린 왕복은 한쪽 방향 지연이 커 오차 추정을 흐리므로 버린다. */
const MAX_RTT_MS = 2000;

let offsetMs = 0;

/** 서버 기준 현재 시각(ms). */
export function serverNow(): number {
  return Date.now() + offsetMs;
}

export function getServerClockOffset(): number {
  return offsetMs;
}

/**
 * 표본들에서 오차를 고른다. 왕복이 가장 짧은 표본이 가장 믿을 만하다(NTP 와 같은 생각):
 * 서버가 응답한 순간은 보낸 시각과 받은 시각의 한가운데라고 본다.
 */
export function estimateClockOffset(samples: ClockSample[]): number | null {
  const valid = samples.filter(
    (s) =>
      Number.isFinite(s.serverNow) &&
      s.receivedAt >= s.sentAt &&
      s.receivedAt - s.sentAt <= MAX_RTT_MS,
  );
  if (valid.length === 0) return null;
  const best = valid.reduce((a, b) =>
    b.receivedAt - b.sentAt < a.receivedAt - a.sentAt ? b : a,
  );
  return Math.round(best.serverNow - (best.sentAt + best.receivedAt) / 2);
}

interface ClockSocket {
  connected: boolean;
  timeout: (ms: number) => {
    emit: (event: 'time:sync', cb: (err: Error | null, serverNow: number) => void) => void;
  };
}

function sampleOnce(socket: ClockSocket): Promise<ClockSample | null> {
  return new Promise((resolve) => {
    const sentAt = Date.now();
    socket.timeout(SAMPLE_TIMEOUT_MS).emit('time:sync', (err, value) => {
      if (err) resolve(null);
      else resolve({ sentAt, receivedAt: Date.now(), serverNow: value });
    });
  });
}

let syncing = false;

/** 연결될 때마다 부른다. 실패하면 이전 오차를 그대로 쓴다. */
export async function syncServerClock(socket: ClockSocket): Promise<void> {
  if (syncing || !socket.connected) return;
  syncing = true;
  try {
    const samples: ClockSample[] = [];
    for (let i = 0; i < SAMPLE_COUNT && socket.connected; i++) {
      const s = await sampleOnce(socket);
      if (s) samples.push(s);
    }
    const next = estimateClockOffset(samples);
    if (next !== null) offsetMs = next;
  } finally {
    syncing = false;
  }
}
