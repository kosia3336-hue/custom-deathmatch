export interface ResultShareSummary {
  gameName: string;
  result: string;
  playTimeMs: number;
  totalTurns: number;
  /** 공유하는 본인 닉네임. 카드의 'OO vs 상대' 에 쓴다. */
  selfName?: string;
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

const cleanName = (name: string) => name.trim().slice(0, 16);

/** '가, 나, 다 외 2명' — 이름이 없으면 빈 문자열 */
function formatOpponents(opponents: string[] | undefined): string {
  const names = (opponents ?? []).map(cleanName).filter(Boolean);
  if (names.length === 0) return '';
  const rest = names.length - MAX_OPPONENTS_SHOWN;
  return `${names.slice(0, MAX_OPPONENTS_SHOWN).join(', ')}${rest > 0 ? ` 외 ${rest}명` : ''}`;
}

function safeCount(value: number): number {
  return Math.max(0, Math.floor(Number.isFinite(value) ? value : 0));
}

/** 'm분 s초' */
function formatPlayTime(playTimeMs: number): string {
  const seconds = safeCount(playTimeMs / 1000);
  return `${Math.floor(seconds / 60)}분 ${seconds % 60}초`;
}

/**
 * 공유 글: 게임명·승패·대전 상대·일시·시간·턴. 링크는 넣지 않는다.
 * 회원 ID·패·행동 로그는 넣지 않는다.
 */
export function resultShareText(summary: ResultShareSummary): string {
  const opponents = formatOpponents(summary.opponents);
  const when = summary.playedAt != null ? formatShareDateTime(summary.playedAt) : null;
  return [
    `커스텀 데스매치 · ${summary.gameName.slice(0, 40)}`,
    `${summary.result.slice(0, 16)}${opponents ? ` vs ${opponents}` : ''}`,
    `${when ? `${when} · ` : ''}플레이 ${formatPlayTime(summary.playTimeMs)} · ${safeCount(summary.totalTurns)}턴`,
  ].join('\n');
}

/** 이미지 공유가 안 되는 곳에서 대신 보낼 글(링크 없음) */
export function resultSharePayload(summary: ResultShareSummary) {
  return { title: '커스텀 데스매치 전적', text: resultShareText(summary) };
}

export type ResultCardTone = 'win' | 'draw' | 'other';

export interface ResultCardContent {
  gameName: string;
  resultLabel: string;
  tone: ResultCardTone;
  /** '나 vs 상대' — 이름이 하나도 없으면 빈 문자열 */
  vsLine: string;
  /** '2026.09.12 21:30 · 플레이 2분 5초 · 12턴' */
  meta: string;
}

/** 결과 카드 이미지에 그릴 글자들(순수). 그리기는 lib/resultCardImage.ts */
export function resultCardContent(summary: ResultShareSummary): ResultCardContent {
  const resultLabel = summary.result.slice(0, 16);
  const self = cleanName(summary.selfName ?? '');
  const opponents = formatOpponents(summary.opponents);
  const when = summary.playedAt != null ? formatShareDateTime(summary.playedAt) : null;
  return {
    gameName: summary.gameName.slice(0, 40),
    resultLabel,
    tone: resultLabel === '승리' ? 'win' : resultLabel === '무승부' ? 'draw' : 'other',
    vsLine: [self, opponents ? `vs ${opponents}` : ''].filter(Boolean).join(' '),
    meta: [when, `플레이 ${formatPlayTime(summary.playTimeMs)}`, `${safeCount(summary.totalTurns)}턴`]
      .filter(Boolean)
      .join(' · '),
  };
}
