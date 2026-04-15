/**
 * 배수 판정: 상대 타일이 내 타일의 배수인지 확인.
 * 같은 숫자는 배수 관계에서 제외 (둘 다 6 → 의심 실패).
 */
export function judgeMultiple(
  myTile: number,
  opTile: number,
): { success: boolean; detail: string } {
  const success = opTile % myTile === 0 && opTile !== myTile;
  const detail = success
    ? `${opTile} ÷ ${myTile} = ${opTile / myTile}`
    : opTile === myTile
      ? `${opTile} = ${myTile} (같은 숫자)`
      : `${opTile} ÷ ${myTile} = ${(opTile / myTile).toFixed(2)} (정수 아님)`;
  return { success, detail };
}
