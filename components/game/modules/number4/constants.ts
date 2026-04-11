import type { NF4WinType, NF4Number } from '@/shared/types/number4';

export const WIN_TYPE_LABELS: Record<NF4WinType, string> = {
  score: '승점 우위',
  elimination: '상대 탈락',
  tiebreaker: '타이브레이커',
  timeout: '시간 초과',
};

export interface NumberInfo {
  number: NF4Number;
  reward: number;
  label: string;
  condition: string;
  color: string;
}

export const NUMBER_INFO: NumberInfo[] = [
  { number: 0, reward: 5, label: '넘버 0', condition: '양측 흑색 합 ≥ 11', color: '#8b5cf6' },
  { number: 1, reward: 1, label: '넘버 1', condition: '내 백색 ≥ 상대 백색', color: '#22c55e' },
  { number: 2, reward: 2, label: '넘버 2', condition: '내 곱 > 상대 곱', color: '#3b82f6' },
  { number: 3, reward: 3, label: '넘버 3', condition: '내 백색 ≥ 상대 흑+2', color: '#f59e0b' },
  { number: 4, reward: 4, label: '넘버 4', condition: '내 백색 ≥ 상대 흑×2', color: '#ef4444' },
];
