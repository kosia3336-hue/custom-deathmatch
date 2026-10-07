/** 판·점수·조작/메모와 상하 도킹 영역을 함께 보존하는 전체 캔버스 높이. */
export function gameWorkspaceHeight({
  viewport,
  frameChrome,
  stageMinimum,
  stageContent = 0,
  docks = 0,
  workspaceChrome = 0,
}: {
  viewport: number;
  frameChrome: number;
  stageMinimum: number;
  stageContent?: number;
  docks?: number;
  workspaceChrome?: number;
}) {
  return Math.ceil(
    Math.max(
      viewport,
      frameChrome + Math.max(stageMinimum, stageContent) + docks + workspaceChrome,
    ),
  );
}
