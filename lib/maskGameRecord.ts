/**
 * 저장된 게임 기록(game_record) 안의 닉네임 마스킹.
 *
 * 기록은 "원본을 저장하고 조회 시 가린다"는 방침이다
 * (`server/src/socket/gameEndPersistence.ts` 의 participants 주석 참고).
 * 참가자 목록은 `anonymized` 플래그로 화면에서 가리고 있었지만,
 * 게임별 뷰어에 그대로 넘어가는 game_record 는 가려지지 않아
 * 익명물약을 쓴 사람의 실명이 기록 화면에 그대로 보였다.
 *
 * game_record 의 players 는 방 안에서만 쓰는 player token 으로 키가 잡혀 있어
 * member_id 로 짝지을 수 없다. 그래서 토큰을 찾아 가리는 대신, 기록 전체를
 * 훑어 가려야 할 닉네임 문자열을 치환한다. players[token].nickname 뿐 아니라
 * finishReason 같은 문장 속 이름까지 한 번에 걸린다.
 */

const MASK = '???';

/** 긴 닉네임부터 바꾼다. 짧은 쪽이 긴 쪽의 일부일 때 조각이 남지 않는다. */
function byLengthDesc(a: string, b: string) {
  return b.length - a.length;
}

function maskString(value: string, hidden: string[]) {
  let next = value;
  for (const nickname of hidden) next = next.replaceAll(nickname, MASK);
  return next;
}

/**
 * 기록 안에서 `hiddenNicknames` 에 해당하는 이름을 전부 '???' 로 바꾼 사본을 만든다.
 * 가릴 이름이 없으면 원본을 그대로 돌려준다.
 */
export function maskGameRecordNicknames<T>(record: T, hiddenNicknames: string[]): T {
  const hidden = hiddenNicknames.filter((nickname) => nickname && nickname !== MASK);
  if (hidden.length === 0) return record;
  const targets = [...hidden].sort(byLengthDesc);

  const walk = (value: unknown): unknown => {
    if (typeof value === 'string') return maskString(value, targets);
    if (Array.isArray(value)) return value.map(walk);
    if (value && typeof value === 'object') {
      return Object.fromEntries(
        Object.entries(value as Record<string, unknown>).map(([key, child]) => [key, walk(child)]),
      );
    }
    return value;
  };

  return walk(record) as T;
}
