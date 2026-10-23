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
import { GAME_IDS } from '@/shared/types/game';

export const UNRELEASED_GAME_IDS: readonly string[] = [
  GAME_IDS.NO_VOWEL,
  GAME_IDS.FAREWELL_FORMULA,
];

export function isUnreleasedGame(gameId: string): boolean {
  return UNRELEASED_GAME_IDS.includes(gameId);
}

/** 출시 전 게임의 이름을 대신할 말. 종목이 무엇인지까지는 감춘다. */
export const UNRELEASED_GAME_LABEL = '신규 게임';

/**
 * 화면에 띄울 게임 이름.
 *
 * 출시 전 게임으로 방을 열면 방 자체는 로비에 그대로 뜬다(감추면 시험을 못 한다).
 * 대신 종목 이름만 가려서, 일반 사용자에게는 무엇을 시험 중인지 보이지 않게 한다.
 * 관리자는 어느 방이 무슨 게임인지 알아야 하므로 실제 이름을 그대로 본다.
 */
export function displayGameName(gameId: string, gameName: string, isAdmin: boolean): string {
  return !isAdmin && isUnreleasedGame(gameId) ? UNRELEASED_GAME_LABEL : gameName;
}

/**
 * 목록에서 출시 전 게임을 걸러 낸다. 관리자면 그대로 둔다.
 * 게임 목록을 다루는 모든 화면이 같은 판정을 쓰도록 이 함수 하나만 부른다.
 */
export function filterUnreleased<T extends { id: string }>(games: T[], isAdmin: boolean): T[] {
  if (isAdmin) return games;
  return games.filter((g) => !isUnreleasedGame(g.id));
}
