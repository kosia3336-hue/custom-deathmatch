export interface ResultShareSummary {
  gameName: string;
  result: string;
  playTimeMs: number;
  totalTurns: number;
  /** 대전 상대 닉네임(익명은 '???'). 솔로면 비운다. */
  opponents?: string[];
  /** 대전 일시. 없으면 표시하지 않는다. */
  playedAt?: string | number;
}

const MAX_OPPONENTS_SHOWN = 3;

const KST_DATE_TIME = new Intl.DateTimeFormat('ko-KR', {
  timeZone: 'Asia/Seoul',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
});

/** 2026.09.12 21:30 (KST) — 보는 기기의 시간대와 상관없이 같은 값이 나오게 한다. */
export function formatShareDateTime(value: string | number): string | null {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    KST_DATE_TIME.formatToParts(date).find((p) => p.type === type)?.value ?? '';
  return `${part('year')}.${part('month')}.${part('day')} ${part('hour')}:${part('minute')}`;
}

function opponentsLabel(opponents: string[] | undefined): string {
  const names = (opponents ?? []).map((n) => n.trim().slice(0, 16)).filter(Boolean);
  if (names.length === 0) return '';
  const shown = names.slice(0, MAX_OPPONENTS_SHOWN).join(', ');
  const rest = names.length - MAX_OPPONENTS_SHOWN;
  return ` vs ${shown}${rest > 0 ? ` 외 ${rest}명` : ''}`;
}

/**
 * 공유 글: 게임명·승패·대전 상대·일시·시간·턴.
 * 회원 ID·패·행동 로그·비공개 로그 주소는 넣지 않는다.
 */
export function resultShareText(summary: ResultShareSummary): string {
  const seconds = Math.max(
    0,
    Math.floor(Number.isFinite(summary.playTimeMs) ? summary.playTimeMs / 1000 : 0),
  );
  const turns = Math.max(
    0,
    Math.floor(Number.isFinite(summary.totalTurns) ? summary.totalTurns : 0),
  );
  const when = summary.playedAt != null ? formatShareDateTime(summary.playedAt) : null;
  return [
    `커스텀 데스매치 · ${summary.gameName.slice(0, 40)}`,
    `${summary.result.slice(0, 16)}${opponentsLabel(summary.opponents)}`,
    `${when ? `${when} · ` : ''}플레이 ${Math.floor(seconds / 60)}분 ${seconds % 60}초 · ${turns}턴`,
  ].join('\n');
}

/** 공유 시트에 넘길 제목·글·링크. 링크는 참가자 전용 로그가 아니라 로비로 연결한다. */
export function resultSharePayload(summary: ResultShareSummary, origin: string) {
  const url = new URL('/lobby', origin);
  if (!['http:', 'https:'].includes(url.protocol))
    throw new Error('공유 주소 설정이 올바르지 않습니다.');
  return { title: '커스텀 데스매치 전적', text: resultShareText(summary), url: url.href };
}
