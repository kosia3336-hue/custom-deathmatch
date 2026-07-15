import type { GS2CardId } from '@/shared/types/grape-sugar-2';

export interface CardStyle {
  bg: string;
  text: string;
  border: string;
  icon: string;
  /** 강조용 그라데이션 */
  accent?: string;
}

export const CARD_STYLES: Record<GS2CardId, CardStyle> = {
  minus3: {
    bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-400',
    icon: '−3',
  },
  plus5: {
    bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-400',
    icon: '+5',
  },
  copy: {
    bg: 'bg-sky-100', text: 'text-sky-700', border: 'border-sky-400',
    icon: '×2',
  },
  grapeBless: {
    bg: 'bg-purple-100', text: 'text-purple-700', border: 'border-purple-400',
    icon: '',
  },
  earthCrush: {
    bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-500',
    icon: '',
  },
  dice: {
    bg: 'bg-yellow-100', text: 'text-yellow-700', border: 'border-yellow-500',
    icon: '',
  },
  breath: {
    bg: 'bg-teal-100', text: 'text-teal-700', border: 'border-teal-400',
    icon: '',
  },
  highRisk: {
    bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-500',
    icon: '×3',
  },
  spaceCrush: {
    bg: 'bg-indigo-100', text: 'text-indigo-700', border: 'border-indigo-500',
    icon: '',
    accent: 'bg-gradient-to-br from-indigo-500 via-purple-500 to-fuchsia-500',
  },
  noAction: {
    bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-400',
    icon: '∅',
  },
};

export const CARD_NAMES: Record<GS2CardId, string> = {
  minus3:     '-3',
  plus5:      '+5',
  copy:       '복사',
  grapeBless: '포도의가호',
  earthCrush: '지구뿌셔!',
  dice:       '주사위',
  breath:     '숨고르기',
  highRisk:   '하이리스크',
  spaceCrush: '우주뿌셔!',
  noAction:   '무행동',
};

export const CARD_HINTS: Record<GS2CardId, string> = {
  minus3:     '상대 라운드 설탕 -3',
  plus5:      '본인 라운드 설탕 +5',
  copy:       '본인 라운드 설탕 ×2',
  grapeBless: '승리 +2점 / 패배 -1점',
  earthCrush: '상대 라운드 설탕 ÷2 (올림)',
  dice:       '6면체 주사위 굴림',
  breath:     '게임 9R로 연장 (1회만)',
  highRisk:   '본인 ×3, 패배 시 다음R 9개 이전',
  spaceCrush: '상대 카드/설탕 무효화',
  noAction:   '효과 없음 (vs 우주뿌셔!=즉시 승리)',
};

export const CARD_SUBTYPE_LABEL: Record<string, string> = {
  self: '본인 강화',
  attack: '본인 강화 (공격형)',
  penalty: '상대 페널티',
  score: '점수',
  meta: '메타',
  cancel: '카운터',
  noop: '효과 없음',
};

export const WIN_TYPE_LABELS: Record<string, string> = {
  score: '승점',
  instantWin: '무행동 즉시 승리',
  timeout: '시간 초과',
  abandon: '기권',
  draw: '무승부',
};

export const PHASE_LABELS: Record<string, string> = {
  input: '입력',
  reveal: '공개·정산',
  roundEnd: '결과',
  extensionIntro: '연장전 시작',
  finished: '게임 종료',
};
