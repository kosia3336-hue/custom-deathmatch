import type { MBNWWinType } from '@/shared/types/multiple-bnw';

export const WIN_TYPE_LABELS: Record<NonNullable<MBNWWinType>, string> = {
  score: '점수 우위',
  suspectCount: '배수의심 성공 횟수',
  tiebreaker: '타이브레이커',
  timeout: '시간 초과',
  abandon: '상대방 접속 종료',
};
