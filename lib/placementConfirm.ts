/**
 * 착수 확인 — 한 번 눌러 자리를 보여 주고, 같은 자리를 한 번 더 눌러야 둔다.
 *
 * 추상전략 판은 칸이 작다. 손가락으로 누르면 옆 칸에 잘못 두기 쉬운데, 착수는
 * 무를 수 없다. 마우스는 올리기만 해도 반투명 돌이 먼저 보이지만 터치에는 그
 * 단계가 없다. 그래서 터치에서만 첫 탭을 '올려 보기' 로 쓴다.
 *
 * - 확인이 필요 없으면(마우스) 바로 둔다.
 * - 보여 주던 자리를 다시 누르면 둔다.
 * - 다른 자리를 누르면 보여 주는 자리만 옮긴다.
 *
 * React 와 무관한 순수 함수로 두어 테스트한다. 훅은
 * components/game/abstract-strategy/usePlacementConfirm.ts.
 */
export type PlacementTap = { kind: 'arm'; key: string } | { kind: 'commit'; key: string };

export function tapPlacement(armed: string | null, key: string, needsConfirm: boolean): PlacementTap {
  if (!needsConfirm || armed === key) return { kind: 'commit', key };
  return { kind: 'arm', key };
}
