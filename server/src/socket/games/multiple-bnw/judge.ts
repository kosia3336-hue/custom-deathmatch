/**
 * 배수 판정: 상대 타일이 내 타일의 배수인지 확인.
 * 같은 숫자(1배수)도 성공으로 처리.
 */
export function judgeMultiple(
  myTile: number,
  opTile: number,
): { success: boolean; detail: string } {
  const success = opTile % myTile === 0;
  const detail = success
    ? `${opTile} ÷ ${myTile} = ${opTile / myTile}`
    : `${opTile} ÷ ${myTile} = ${(opTile / myTile).toFixed(2)} (정수 아님)`;
  return { success, detail };
}
