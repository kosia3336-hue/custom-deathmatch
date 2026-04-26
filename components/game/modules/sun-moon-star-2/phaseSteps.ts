import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';

/* ════════════════════════════════════════════════════════════
 * PhaseStepper 공용 헬퍼
 *   · 모바일/데스크탑 stepper 가 같은 단계 정의·라벨 로직 공유
 * ════════════════════════════════════════════════════════════ */

export type StepKey = 'powder' | 'betFirst' | 'betSecond' | 'resolve';

export const STEPS: { key: StepKey; label: string }[] = [
  { key: 'powder', label: '분배' },
  { key: 'betFirst', label: '선베팅' },
  { key: 'betSecond', label: '후베팅' },
  { key: 'resolve', label: '정산' },
];

export function stepIndexFromPhase(phase: SMS2GameData['phase']): number {
  switch (phase) {
    case 'powder':
      return 0;
    case 'betFirst':
      return 1;
    case 'betSecond':
      return 2;
    case 'resolve':
    case 'roundEnd':
    case 'finished':
      return 3;
    default:
      return -1;
  }
}

export function buildTurnLabel({
  phase,
  isMyTurn,
  isSpectator,
  firstNick,
  secondNick,
  myIsFirst,
}: {
  phase: SMS2GameData['phase'];
  isMyTurn: boolean;
  isSpectator: boolean;
  firstNick: string;
  secondNick: string;
  myIsFirst?: boolean;
}): string | null {
  switch (phase) {
    case 'powder':
      if (isSpectator) return '양측 분배 중';
      return isMyTurn ? '내가 분배 중' : '상대가 분배 중';
    case 'betFirst': {
      const who = isSpectator ? firstNick : myIsFirst ? '나' : firstNick;
      return isMyTurn && !isSpectator ? '내가 선 베팅 중' : `${who} (선) 베팅 중`;
    }
    case 'betSecond': {
      const who = isSpectator ? secondNick : myIsFirst === false ? '나' : secondNick;
      return isMyTurn && !isSpectator ? '내가 후 베팅 중' : `${who} (후) 베팅 중`;
    }
    case 'resolve':
      return '정산 중';
    case 'roundEnd':
      return '라운드 결과';
    case 'finished':
      return '게임 종료';
    default:
      return null;
  }
}
