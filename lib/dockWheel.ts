/** 화면 밖으로 잘린 상·하 도킹 창은 가로 휠 변환보다 전체 세로 스크롤이 우선이다. */
export function shouldRevealDock(
  deltaY: number,
  region: { top: number; bottom: number },
  viewport: { top: number; bottom: number; scrollTop: number; maxScroll: number },
): boolean {
  return deltaY > 0
    ? region.bottom > viewport.bottom + 1 && viewport.scrollTop < viewport.maxScroll - 1
    : deltaY < 0 && region.top < viewport.top - 1 && viewport.scrollTop > 1;
}
