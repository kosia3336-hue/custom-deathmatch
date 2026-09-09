/**
 * 상단 바에 보낼 시계의 기준 시각.
 *
 * 착수를 기다리는 단계에서만 보낸다. 공개·정산·종료 단계까지 보내면 상단 바가
 * 직전 라운드 시작 시각을 계속 세어 내려간다 — 아무도 착수를 기다리지 않는
 * 구간에서 숫자가 줄고, 마지막 5초 경고음까지 울리고, 다음 라운드가 시작되는
 * 순간 제한시간으로 되돌아간다. 그래서 '3분짜리인데 2분 5초에서 시작한다' 는
 * 신고가 들어왔다. 실제로는 새 라운드가 아니라 앞 라운드의 잔여 시간이었다.
 *
 * 판마다 착수 단계 이름이 달라 목록은 게임이 준다. 대신 규칙은 여기 한 군데에
 * 적어 둔다 — 새 게임을 붙일 때 이 함수를 쓰면 같은 실수를 반복하지 않는다.
 *
 * 턴제 판(사목·양면장기·오목 등)은 착수 단계가 끊기지 않으므로 이 함수가 필요
 * 없다. 그쪽은 매 턴 시각을 다시 잡는다.
 */
export function inputPhaseClock<P extends string>(
  timeLimitSeconds: number | null,
  phase: P,
  inputPhases: readonly P[],
  turnStartedAt: number,
): number | null {
  if (!timeLimitSeconds) return null;
  return inputPhases.includes(phase) ? turnStartedAt : null;
}
