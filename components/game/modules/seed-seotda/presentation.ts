import type { SeedSeotdaGameData } from '@/shared/types/seed-seotda';
export const PHASE_LABEL: Record<SeedSeotdaGameData['phase'], string> = {
  'seed-choice': '패 버리기',
  betting: '베팅',
  'round-result': '라운드 결과',
  finished: '게임 종료',
};
