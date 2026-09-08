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
