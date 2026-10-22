import { LOOP_CHECK_PATH_LENGTH, LOOP_CHECK_SIZE, type LoopCheckBoard } from '../types/loop-check';

export function areLoopCheckNeighbors(first: number, second: number) {
  return (
    Math.abs(Math.floor(first / LOOP_CHECK_SIZE) - Math.floor(second / LOOP_CHECK_SIZE)) +
      Math.abs((first % LOOP_CHECK_SIZE) - (second % LOOP_CHECK_SIZE)) ===
    1
  );
}

/** 저장된 한 경로와 비교하지 않고 제출 경로의 실제 색상 배열을 검증한다. */
export function validateLoopCheckPath(board: LoopCheckBoard, value: unknown): string | null {
  if (!Array.isArray(value) || value.length !== LOOP_CHECK_PATH_LENGTH)
    return '10칸을 연결해 주세요.';
  if (value.some((cell) => !Number.isInteger(cell) || cell < 0 || cell >= LOOP_CHECK_SIZE ** 2))
    return '선택한 칸이 올바르지 않습니다.';
  if (new Set(value).size !== LOOP_CHECK_PATH_LENGTH) return '같은 칸을 두 번 지날 수 없습니다.';
  if (value.some((cell, index) => index > 0 && !areLoopCheckNeighbors(value[index - 1], cell)))
    return '상하좌우로 인접한 칸을 연결해 주세요.';
  const colors = value.map((cell) => board.cells[cell]);
  if (colors.some((color) => !Number.isInteger(color) || color < 0 || color > 9))
    return '게임판 정보가 올바르지 않습니다.';
  if (
    new Set(colors.slice(0, 5)).size !== 5 ||
    colors.some((color, index) => index >= 5 && color !== colors[index - 5])
  )
    return '서로 다른 5색이 같은 순서로 두 번 반복되어야 합니다.';
  return null;
}
