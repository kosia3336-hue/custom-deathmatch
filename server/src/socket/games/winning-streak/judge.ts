import type { WSCardType, WSMatchResult } from '@shared/types/winning-streak.js';

const MATCHUP_TABLE: Record<WSCardType, Record<WSCardType, WSMatchResult>> = {
  spade: {
    spade: 'draw_lose', diamond: 'lose', heart: 'win',
    club: 'lose', blackJoker: 'win', colorJoker: 'lose',
  },
  diamond: {
    spade: 'win', diamond: 'draw_lose', heart: 'lose',
    club: 'win', blackJoker: 'win', colorJoker: 'lose',
  },
  heart: {
    spade: 'lose', diamond: 'win', heart: 'draw_lose',
    club: 'lose', blackJoker: 'win', colorJoker: 'lose',
  },
  club: {
    spade: 'win', diamond: 'lose', heart: 'win',
    club: 'draw_lose', blackJoker: 'win', colorJoker: 'lose',
  },
  blackJoker: {
    spade: 'lose', diamond: 'lose', heart: 'lose',
    club: 'lose', blackJoker: 'draw_lose', colorJoker: 'lose',
  },
  colorJoker: {
    spade: 'win', diamond: 'win', heart: 'win',
    club: 'win', blackJoker: 'win', colorJoker: 'draw_win',
  },
};

const CARD_NAMES: Record<WSCardType, string> = {
  spade: '♠ 스페이드',
  diamond: '♦ 다이아몬드',
  heart: '♥ 하트',
  club: '♣ 클로버',
  blackJoker: '흑백조커',
  colorJoker: '컬러조커',
};

function getMatchDescription(
  cardA: WSCardType,
  cardB: WSCardType,
  resultA: WSMatchResult,
): string {
  if (cardA === cardB) {
    if (cardA === 'colorJoker') return '컬러조커 미러! 양측 승리!';
    if (cardA === 'blackJoker') return '흑백조커 미러! 양측 패배';
    return '무승부! 같은 카드끼리는 양측 패배';
  }
  if (cardA === 'colorJoker' || cardB === 'colorJoker') {
    return '컬러조커는 무조건 이깁니다!';
  }
  if (cardA === 'blackJoker' || cardB === 'blackJoker') {
    return '흑백조커는 무조건 집니다!';
  }
  const winner = resultA === 'win' ? CARD_NAMES[cardA] : CARD_NAMES[cardB];
  const loser = resultA === 'win' ? CARD_NAMES[cardB] : CARD_NAMES[cardA];
  return `${winner}이(가) ${loser}을(를) 이깁니다!`;
}

export function judgeMatch(
  cardA: WSCardType,
  cardB: WSCardType,
): { resultA: WSMatchResult; resultB: WSMatchResult; description: string } {
  const resultA = MATCHUP_TABLE[cardA][cardB];
  const resultB = MATCHUP_TABLE[cardB][cardA];
  const description = getMatchDescription(cardA, cardB, resultA);
  return { resultA, resultB, description };
}

export function getMatchupResult(cardA: WSCardType, cardB: WSCardType): WSMatchResult {
  return MATCHUP_TABLE[cardA][cardB];
}
