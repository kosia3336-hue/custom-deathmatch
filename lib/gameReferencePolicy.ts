/** 공통 초기 순서. 사용자가 저장한 배치는 이 순서보다 우선한다. */
export function gameReferenceKind(title: string): 'score' | 'history' | 'auto' | 'memo' {
  if (/^(점수|점수판|전적|플레이어 점수판)$/.test(title)) return 'score';
  if (/기록|로그/.test(title)) return 'history';
  if (/^(카운팅|상대 잔여 카드|잔여 카드|빛가루 트랙)$/.test(title)) return 'auto';
  return 'memo';
}

export function gameReferenceOrder(title: string, kind = gameReferenceKind(title)) {
  return { score: 0, auto: 10, history: 20, memo: 30 }[kind];
}
