export interface ResultShareSummary {
  gameName: string;
  result: string;
  playTimeMs: number;
  totalTurns: number;
}

/** 공유에 개인 ID·닉네임·패·비공개 로그 주소를 포함하지 않는다. */
export function resultShareText(summary: ResultShareSummary): string {
  const seconds = Math.max(
    0,
    Math.floor(Number.isFinite(summary.playTimeMs) ? summary.playTimeMs / 1000 : 0),
  );
  const turns = Math.max(
    0,
    Math.floor(Number.isFinite(summary.totalTurns) ? summary.totalTurns : 0),
  );
  return `커스텀 데스매치\n${summary.gameName.slice(0, 40)} · ${summary.result.slice(0, 16)}\n플레이 ${Math.floor(seconds / 60)}분 ${seconds % 60}초 · ${turns}턴`;
}

export function resultShareTemplate(summary: ResultShareSummary, origin: string) {
  const url = new URL('/lobby', origin);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('공유 주소 설정이 올바르지 않습니다.');
  return {
    objectType: 'text' as const,
    text: resultShareText(summary),
    link: { webUrl: url.href, mobileWebUrl: url.href },
    buttonTitle: '게임하러 가기',
  };
}
