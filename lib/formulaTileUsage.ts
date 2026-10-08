/** 수식의 숫자 토큰을 실제 타일 한 장씩에 대응시킨다. 같은 값도 별개의 타일이다. */
export function formulaTileUsage(
  expression: string,
  numbers: readonly number[],
  preferredIndices: readonly number[] = [],
) {
  const usedIndices: number[] = [];
  const invalidNumbers: string[] = [];
  const candidates = [...new Set([...preferredIndices, ...numbers.map((_, index) => index)])];
  // 서버 파서와 같이 공백을 제거한 뒤 숫자 토큰을 읽는다. 1 3은 두 장이 아닌 13이다.
  for (const literal of expression.replace(/\s/g, '').match(/\d+/g) ?? []) {
    const index = candidates.find(
      (index) => numbers[index] === Number(literal) && !usedIndices.includes(index),
    );
    if (index === undefined) invalidNumbers.push(literal);
    else usedIndices.push(index);
  }
  return { usedIndices, invalidNumbers };
}
