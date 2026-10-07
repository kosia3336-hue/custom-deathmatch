/** 공통 초기 순서. 사용자가 저장한 배치는 이 순서보다 우선한다. */
export function gameReferenceOrder(title: string) {
  if (/^(점수|전적|플레이어 점수판)$/.test(title)) return 0;
  if (/기록|로그/.test(title)) return 10;
  if (/추리|메모|카운팅/.test(title)) return 20;
  return 30;
}
