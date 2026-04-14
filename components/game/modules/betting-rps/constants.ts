import type { BRPSWinType, BRPSResult, BRPSBetOutcome } from '@/shared/types/betting-rps';

export const WIN_TYPE_LABELS: Record<BRPSWinType, string> = {
  chips: '칩 비교',
  draw: '무승부',
  timeout: '시간 초과',
  leave: '상대 퇴장',
};

export const RESULT_LABELS: Record<BRPSResult, string> = {
  win: '승',
  draw: '무',
  lose: '패',
};

export const OUTCOME_LABELS: Record<BRPSBetOutcome, string> = {
  success: '성공',
  fail: '실패',
  refund: '반환',
};

export const RESULT_COLORS: Record<BRPSResult, string> = {
  win: 'text-blue-600',
  draw: 'text-amber-600',
  lose: 'text-red-600',
};

export const OUTCOME_COLORS: Record<BRPSBetOutcome, string> = {
  success: 'text-emerald-600',
  fail: 'text-red-600',
  refund: 'text-amber-600',
};
