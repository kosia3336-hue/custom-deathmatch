/**
 * 남은 시간 표시. 올림으로 센다.
 *
 * 내림이면 3분짜리 판이 시작하자마자 2:59 로 뜬다 — 첫 갱신은 이미 몇십 ms
 * 흐른 뒤라 남은 시간이 정확히 180 인 순간을 사람이 볼 일이 없기 때문이다.
 * 실제로 '3분인데 2분대에서 시작한다' 는 신고가 그것이었다. 올림이면 시작은
 * 3:00 이고, 진짜로 0 이 됐을 때만 0:00 이 된다.
 *
 * 마지막 10초는 0.1초까지 센다 — 그때부터는 초 단위가 너무 굵다.
 */
export function formatCountdown(remaining: number): string {
  if (remaining <= 10 && remaining > 0) return remaining.toFixed(1);
  const whole = Math.ceil(remaining);
  const min = Math.floor(whole / 60);
  const sec = whole % 60;
  return `${min}:${sec.toString().padStart(2, '0')}`;
}

/** 한 타이머의 각 초는 한 번만 울린다. 지연된 프레임의 소리를 몰아서 재생하지 않는다. */
export function createCountdownTickGate() {
  let clock: string | null = null;
  let lastSecond = 6;
  return (clockKey: string | null, remaining: number | null): number | null => {
    if (clock !== clockKey) {
      clock = clockKey;
      lastSecond = 6;
    }
    if (clockKey === null || remaining === null || !Number.isFinite(remaining) || remaining <= 0 || remaining > 5) return null;
    const second = Math.ceil(remaining);
    if (second >= lastSecond) return null;
    lastSecond = second;
    return second;
  };
}
