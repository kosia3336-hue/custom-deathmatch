import { SBNW_MAX_SCORE, SBNW_TOTAL_ROUNDS } from '@/shared/types/silper-bnw';
export const WIN_TYPE_LABELS: Record<string, string> = {
  score: `승점 ${SBNW_MAX_SCORE}선승`,
  roundsScore: `${SBNW_TOTAL_ROUNDS}라운드 종료 후 승점 우세`,
  tiebreakTile: '최대 타일 비교 승',
  rematch: '재대결 결정',
  autoLoss: '타일 소진 자동 패배',
  timeout: '시간 초과',
  leave: '기권',
  draw: '무승부',
};
