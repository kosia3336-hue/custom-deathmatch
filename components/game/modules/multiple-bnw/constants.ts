import type { MBNWWinType } from '@/shared/types/multiple-bnw';

export const WIN_TYPE_LABELS: Record<NonNullable<MBNWWinType>, string> = {
  score: '점수 우위',
  suspectCount: '배수의심 성공 횟수',
  draw: '무승부',
  timeout: '시간 초과',
  abandon: '상대방 접속 종료',
};
