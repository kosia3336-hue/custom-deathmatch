import type { PieceType, DSCWinType } from '@/shared/types/double-sided-chess';

export const PIECE_LABEL: Record<PieceType, { base: string; promoted: string }> = {
  infantry: { base: '보', promoted: '비' },
  gold: { base: '금', promoted: '계' },
  king: { base: '왕', promoted: '왕' },
  silver: { base: '은', promoted: '각' },
  copper: { base: '토', promoted: '향' },
};

export function getPieceLabel(piece: PieceType, isPromoted: boolean): string {
  const entry = PIECE_LABEL[piece];
  if (piece === 'king') return entry.base;
  return isPromoted ? entry.promoted : entry.base;
}

export const WIN_TYPE_LABEL: Record<DSCWinType, string> = {
  'king-captured': '왕 포획',
  'king-entered': '왕 진입',
  'all-captured': '전멸',
  'no-moves': '이동 불가',
  timeout: '⏱ 시간 초과',
};

export const WIN_TYPE_TOAST_LABEL: Record<DSCWinType, string> = {
  'king-captured': '왕이 포획되었습니다!',
  'king-entered': '왕이 진입했습니다!',
  'all-captured': '상대 말 전멸!',
  'no-moves': '이동할 수 없습니다!',
  timeout: '시간 초과!',
};

export const OWNER_COLOR = {
  first: { bg: 'bg-red-600', text: 'text-white', ring: 'ring-red-400', light: 'bg-red-50' },
  second: { bg: 'bg-blue-600', text: 'text-white', ring: 'ring-blue-400', light: 'bg-blue-50' },
} as const;
