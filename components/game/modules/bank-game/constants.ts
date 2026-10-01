import { josa } from '@/shared/lib/josa';
import type { BankDenomination, BankWinType } from '@/shared/types/bank-game';

/* ════════════════════════════════════════════════════════════
 * 은행놀이 — 프론트 전용 상수 / 디자인 토큰
 * 4종 액면을 색·아이콘으로 추상화 (지폐 사진 ❌)
 * ════════════════════════════════════════════════════════════ */

export interface DenomStyle {
  label: string;
  shortLabel: string;
  /** 본인 잔여/카드 색조 (배경) */
  bg: string;
  /** 진한 배경 (활성/선택 강조) */
  bgStrong: string;
  /** 텍스트 색 */
  text: string;
  /** 진한 텍스트 색 */
  textStrong: string;
  /** 보더 */
  border: string;
  /** 입력 stepper 강조 색 */
  ring: string;
}

export const DENOM_ORDER: BankDenomination[] = [1000, 3000, 5000, 10000];

export const DENOM_STYLES: Record<BankDenomination, DenomStyle> = {
  1000: {
    label: '1,000원',
    shortLabel: '1천',
    bg: 'bg-emerald-50',
    bgStrong: 'bg-emerald-100',
    text: 'text-emerald-700',
    textStrong: 'text-emerald-900',
    border: 'border-emerald-300',
    ring: 'ring-emerald-300',
  },
  3000: {
    label: '3,000원',
    shortLabel: '3천',
    bg: 'bg-amber-50',
    bgStrong: 'bg-amber-100',
    text: 'text-amber-700',
    textStrong: 'text-amber-900',
    border: 'border-amber-300',
    ring: 'ring-amber-300',
  },
  5000: {
    label: '5,000원',
    shortLabel: '5천',
    bg: 'bg-rose-50',
    bgStrong: 'bg-rose-100',
    text: 'text-rose-700',
    textStrong: 'text-rose-900',
    border: 'border-rose-300',
    ring: 'ring-rose-300',
  },
  10000: {
    label: '10,000원',
    shortLabel: '1만',
    bg: 'bg-violet-50',
    bgStrong: 'bg-violet-100',
    text: 'text-violet-700',
    textStrong: 'text-violet-900',
    border: 'border-violet-300',
    ring: 'ring-violet-300',
  },
};

export const PHASE_LABELS: Record<string, string> = {
  firstSubmit: '선 베팅',
  firstReveal: '선의 장수 공개',
  secondSubmit: '후 베팅',
  reveal: '정산 중',
  roundEnd: '라운드 결과',
  finished: '게임 종료',
};

export const PHASE_PILL_COLORS: Record<string, string> = {
  firstSubmit: 'bg-indigo-100 text-indigo-700',
  firstReveal: 'bg-amber-100 text-amber-700',
  secondSubmit: 'bg-amber-100 text-amber-700',
  reveal: 'bg-violet-100 text-violet-700',
  roundEnd: 'bg-emerald-100 text-emerald-700',
  finished: 'bg-gray-100 text-gray-700',
};

/** 4단계 페이즈 스테퍼용 라벨 (간결) */
export const STEPPER_PHASE_LABELS: Array<{ key: string; label: string }> = [
  { key: 'firstSubmit', label: '선 제출' },
  { key: 'firstReveal', label: '선 공개' },
  { key: 'secondSubmit', label: '후 제출' },
  { key: 'reveal', label: '정산' },
];

/** 본인 차례 라벨 — sms2 패턴 동일 */
export function buildBankTurnLabel(opts: {
  phase: string;
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst?: boolean;
}): string {
  const { phase, isMyTurn, isSpectator, firstNick, secondNick, myIsFirst } = opts;
  if (isSpectator) {
    if (phase === 'firstSubmit') return `${josa(firstNick, '이/가')} 베팅 중`;
    if (phase === 'firstReveal') return `${josa(secondNick, '이/가')} 추리 중`;
    if (phase === 'secondSubmit') return `${josa(secondNick, '이/가')} 베팅 중`;
    if (phase === 'reveal' || phase === 'roundEnd') return '정산 중';
    if (phase === 'finished') return '게임 종료';
    return '대기 중';
  }
  if (phase === 'firstSubmit') {
    return myIsFirst && isMyTurn ? '내가 선 베팅 중' : '상대(선) 베팅 대기';
  }
  if (phase === 'firstReveal') {
    return myIsFirst ? '상대(후) 추리 대기' : '내가 추리 중';
  }
  if (phase === 'secondSubmit') {
    return !myIsFirst && isMyTurn ? '내가 후 베팅 중' : '상대(후) 베팅 대기';
  }
  if (phase === 'reveal' || phase === 'roundEnd') return '정산 중';
  if (phase === 'finished') return '게임 종료';
  return '대기 중';
}

export const WIN_TYPE_LABELS: Record<NonNullable<BankWinType>, string> = {
  score: '승점 우세',
  draw: '승점 동률',
  timeout: '시간 초과',
  leave: '기권',
};

/** 정산 애니메이션 타이밍 — 서버 상수와 정렬 */
export const FIRST_REVEAL_BANNER_MS = 1300;
export const RESOLVE_FLIP_DELAY_MS = 1000;
export const RESOLVE_CROWN_DELAY_MS = 600;
export const RESOLVE_SUMMARY_DELAY_MS = 800;

export function formatKRW(amount: number): string {
  return amount.toLocaleString('ko-KR');
}
