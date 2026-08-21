/**
 * 더미 사고 시간. 난이도(상·중·하)와 무관.
 * 정수 초를 독립 샘플한다. 5초 칸으로 묶지 않는다.
 */

export function sampleUnimodalSecond(min: number, max: number, mode: number): number {
  if (min > max) throw new Error('sampleUnimodalSecond: min > max');
  const lo = Math.ceil(min);
  const hi = Math.floor(max);
  const peak = Math.min(hi, Math.max(lo, Math.round(mode)));
  const weights: number[] = [];
  const values: number[] = [];
  for (let t = lo; t <= hi; t++) {
    values.push(t);
    weights.push(Math.max(1, (Math.max(peak - lo, hi - peak) + 1) - Math.abs(t - peak)));
  }
  const total = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * total;
  for (let i = 0; i < values.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return values[i]!;
  }
  return values[values.length - 1]!;
}

/** 사목·양면장기: 각자 앞 2수 = 전역 턴 1~4는 5초. 이후 30~90초, 60초 근처가 잦음. */
export function boardGameThinkSeconds(turnNumber: number): number {
  if (turnNumber <= 4) return 5;
  return sampleUnimodalSecond(30, 90, 60);
}

export function boardGameThinkMs(turnNumber: number): number {
  return boardGameThinkSeconds(turnNumber) * 1000;
}

/** gravity / neutral 같은 턴 후속 클릭. 사고 시간 분포와 별개. */
export function boardGameFollowUpMs(): number {
  return 450 + Math.floor(Math.random() * 900);
}

/** 심리·동시 제출 (넘버4 등): 5~90초, 30초 근처가 잦음. 등급 무관.
 * 이 값은 **탐색 예산**이다. idle sleep 후 ms 계산 금지 — `runPsychologySearch` 사용.
 */
export function psychologyThinkSeconds(): number {
  return sampleUnimodalSecond(5, 90, 30);
}

export function psychologyThinkMs(): number {
  return psychologyThinkSeconds() * 1000;
}

/**
 * 짧은 심리 판단: 5~30초, 10초 근처.
 * 인디언홀덤Q 액션, 배수 흑과백 **의심 여부** 등.
 */
export function shortPsychologyThinkSeconds(): number {
  return sampleUnimodalSecond(5, 30, 10);
}

export function shortPsychologyThinkMs(): number {
  return shortPsychologyThinkSeconds() * 1000;
}

/** 인디언홀덤Q 액션 — `shortPsychologyThinkMs` 와 동일 (5~30·모드 10) */
export function indianPokerThinkSeconds(): number {
  return shortPsychologyThinkSeconds();
}

export function indianPokerThinkMs(): number {
  return shortPsychologyThinkMs();
}

/** 수학적으로 이미 진 판: 3~10초, 5초 근처. 탐색 예산. */
export function hopelessThinkSeconds(): number {
  return sampleUnimodalSecond(3, 10, 5);
}

export function hopelessThinkMs(): number {
  return hopelessThinkSeconds() * 1000;
}

/** 콰트로 멀리건·오픈: 5~10초, 7초 근처. 탐색 예산. 교환은 psychologyThinkMs. */
export function quatroQuickThinkSeconds(): number {
  return sampleUnimodalSecond(5, 10, 7);
}

export function quatroQuickThinkMs(): number {
  return quatroQuickThinkSeconds() * 1000;
}

/** @deprecated 별칭 — `quatroQuickThinkMs` */
export function quatroMulliganThinkSeconds(): number {
  return quatroQuickThinkSeconds();
}

export function quatroMulliganThinkMs(): number {
  return quatroQuickThinkMs();
}

/** 클라 타이머와 같은 기준. 서버 턴 타이머가 막혀 있어도 더미는 수를 내지 않는다. */
export function turnTimeExpired(
  turnStartedAt: number,
  timeLimitSeconds: number | null,
): boolean {
  if (timeLimitSeconds == null || timeLimitSeconds <= 0) return false;
  return Date.now() >= turnStartedAt + timeLimitSeconds * 1000;
}

export function capThinkToTurnLimit(
  thinkMs: number,
  turnStartedAt: number,
  timeLimitSeconds: number | null,
  reserveMs = 1200,
): number {
  const deadline = turnStartedAt + thinkMs;
  const turnEnd =
    timeLimitSeconds != null && timeLimitSeconds > 0
      ? turnStartedAt + timeLimitSeconds * 1000 - reserveMs
      : Number.POSITIVE_INFINITY;
  const target = Math.min(deadline, turnEnd);
  return Math.max(0, target - Date.now());
}
