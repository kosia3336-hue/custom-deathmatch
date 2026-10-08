/** 종료 알림 누락 시 이미 정산된 서버 결과를 다시 요청한다. */
export function recoverGameResult(sync: () => void, hasResult: () => boolean): () => void {
  sync();
  const timer = setInterval(() => {
    if (hasResult()) clearInterval(timer);
    else sync();
  }, 1500);
  return () => clearInterval(timer);
}
