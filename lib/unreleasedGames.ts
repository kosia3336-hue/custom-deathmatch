/**
 * 출시 전 게임 — 관리자에게만 보인다.
 *
 * DB(games.is_active)를 끄면 서버가 아예 목록에서 빼므로 관리자도 못 만든다.
 * 그래서 DB 는 켜 둔 채, 화면에서만 일반 사용자에게 감춘다.
 *
 * ── 한계 ──────────────────────────────────────────────────────
 * 이건 '숨김' 이지 '차단' 이 아니다. 목록에 안 뜰 뿐, 방 주소를 직접 알거나
 * 소켓 이벤트를 손으로 보내면 일반 사용자도 들어갈 수 있다. 출시 전 게임을
 * 조용히 시험하는 용도이지, 접근 제어로 쓸 수 없다. 정말 막아야 한다면
 * 서버(방 생성·입장)에서 같은 판정을 해야 한다.
 *
 * ── 쓰는 법 ───────────────────────────────────────────────────
 * 아래 배열에 게임 ID 를 넣으면 즉시 감춰진다. 출시할 때 지우면 된다.
 */
export const UNRELEASED_GAME_IDS: readonly string[] = [
  // 예: 'game-022',
];

export function isUnreleasedGame(gameId: string): boolean {
  return UNRELEASED_GAME_IDS.includes(gameId);
}

/**
 * 목록에서 출시 전 게임을 걸러 낸다. 관리자면 그대로 둔다.
 * 게임 목록을 다루는 모든 화면이 같은 판정을 쓰도록 이 함수 하나만 부른다.
 */
export function filterUnreleased<T extends { id: string }>(games: T[], isAdmin: boolean): T[] {
  if (isAdmin) return games;
  return games.filter((g) => !isUnreleasedGame(g.id));
}
