export const WS_TOTAL_ROUNDS = 10;

export const CARD_TYPES = ['spade', 'diamond', 'heart', 'club', 'blackJoker', 'colorJoker'] as const;
export type WSCardType = typeof CARD_TYPES[number];

export type WSPhase = 'cardSelect' | 'reveal' | 'result' | 'finished';
export type WSWinType = 'streak' | 'wins' | 'draw' | 'timeout' | 'abandon' | 'stuck' | null;
export type WSMatchResult = 'win' | 'lose' | 'draw_lose' | 'draw_win';

export interface WSCardCount {
  spade: number;
  diamond: number;
  heart: number;
  club: number;
  blackJoker: number;
  colorJoker: number;
}

export const WS_INITIAL_CARDS: WSCardCount = {
  spade: 2,
  diamond: 2,
  heart: 2,
  club: 2,
  blackJoker: 1,
  colorJoker: 1,
};

export interface WSPlayerInfo {
  id: string;
  nickname: string;
  currentStreak: number;
  maxStreak: number;
  totalWins: number;
  remainingCards: WSCardCount;
  lastPlayedCard: WSCardType | null;
  submitted: boolean;
}

export interface WSRevealPlayerData {
  card: WSCardType;
  result: WSMatchResult;
  streakBefore: number;
  streakAfter: number;
  maxStreakBefore: number;
  maxStreakAfter: number;
  maxStreakUpdated: boolean;
  totalWinsAfter: number;
}

export interface WSRevealData {
  players: Record<string, WSRevealPlayerData>;
  matchDescription: string;
}

export interface WSRoundRecord {
  round: number;
  players: Record<string, {
    card: WSCardType;
    result: WSMatchResult;
    streakBefore: number;
    streakAfter: number;
    maxStreakAfter: number;
    totalWinsAfter: number;
  }>;
}

export interface WinningStreakGameData {
  round: number;
  phase: WSPhase;
  players: Record<string, WSPlayerInfo>;
  revealData: WSRevealData | null;
  roundHistory: WSRoundRecord[];
  winner: string | null;
  winType: WSWinType;
}

export type WinningStreakAction = { type: 'selectCard'; card: WSCardType };

export const WS_CARD_NAMES: Record<WSCardType, string> = {
  spade: '스페이드',
  diamond: '다이아몬드',
  heart: '하트',
  club: '클로버',
  blackJoker: '흑백조커',
  colorJoker: '컬러조커',
};

export const WS_MATCHUP: Record<WSCardType, Record<WSCardType, WSMatchResult>> = {
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

export function wsGetMatchup(a: WSCardType, b: WSCardType): WSMatchResult {
  return WS_MATCHUP[a][b];
}

export function wsIsWinResult(r: WSMatchResult): boolean {
  return r === 'win' || r === 'draw_win';
}

export function wsMatchDescription(cardA: WSCardType, cardB: WSCardType, resultA: WSMatchResult): string {
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
  const winner = resultA === 'win' ? WS_CARD_NAMES[cardA] : WS_CARD_NAMES[cardB];
  const loser = resultA === 'win' ? WS_CARD_NAMES[cardB] : WS_CARD_NAMES[cardA];
  return `${winner}이(가) ${loser}을(를) 이깁니다!`;
}

export function wsJudgeMatch(
  cardA: WSCardType,
  cardB: WSCardType,
): { resultA: WSMatchResult; resultB: WSMatchResult; description: string } {
  const resultA = WS_MATCHUP[cardA][cardB];
  const resultB = WS_MATCHUP[cardB][cardA];
  return { resultA, resultB, description: wsMatchDescription(cardA, cardB, resultA) };
}

export function wsCopyCards(c: WSCardCount): WSCardCount {
  return { ...c };
}

export function wsCardsTotal(c: WSCardCount): number {
  return c.spade + c.diamond + c.heart + c.club + c.blackJoker + c.colorJoker;
}

export function wsLegalCards(cards: WSCardCount, lastPlayed: WSCardType | null): WSCardType[] {
  const available: WSCardType[] = [];
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    if (ct === lastPlayed) continue;
    available.push(ct);
  }
  if (available.length === 0 && lastPlayed && cards[lastPlayed] > 0) {
    available.push(lastPlayed);
  }
  return available;
}

/** 다음 라운드 시작 전에 직전 종류만 남으면 고갈패. 마지막 라운드 정산에는 안 탄다. */
export function wsIsStuck(cards: WSCardCount, lastPlayed: WSCardType | null): boolean {
  if (!lastPlayed) return false;
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    if (ct !== lastPlayed) return false;
  }
  return cards[lastPlayed] > 0;
}

export interface WsAdvisorRound {
  myCard: WSCardType;
  oppCard: WSCardType;
}

export type WsAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string }
  | { kind: 'draw'; reason: string };

export interface WsAdvisorSide {
  remaining: WSCardCount;
  lastPlayed: WSCardType | null;
  currentStreak: number;
  maxStreak: number;
  totalWins: number;
}

export interface WsAdvisorSnapshot {
  round: number;
  left: number;
  my: WsAdvisorSide;
  opp: WsAdvisorSide;
  result: WsAdvisorResult;
  winType: WSWinType;
}

export type WsAdvisorWinner = 'me' | 'opp' | 'draw';

function applyStreak(
  current: number,
  max: number,
  totalWins: number,
  result: WSMatchResult,
): { streak: number; maxStreak: number; totalWins: number } {
  if (wsIsWinResult(result)) {
    const streak = current + 1;
    return { streak, maxStreak: Math.max(streak, max), totalWins: totalWins + 1 };
  }
  return { streak: 0, maxStreak: max, totalWins };
}

function finishByStats(
  myMax: number,
  oppMax: number,
  myWins: number,
  oppWins: number,
): { result: WsAdvisorResult; winType: WSWinType } {
  if (myMax !== oppMax) {
    const win = myMax > oppMax;
    return {
      result: {
        kind: win ? 'win' : 'loss',
        reason: `최대 연승 ${myMax} vs ${oppMax}`,
      },
      winType: 'streak',
    };
  }
  if (myWins !== oppWins) {
    const win = myWins > oppWins;
    return {
      result: {
        kind: win ? 'win' : 'loss',
        reason: `총승 ${myWins} vs ${oppWins}`,
      },
      winType: 'wins',
    };
  }
  return {
    result: { kind: 'draw', reason: `최대 연승 ${myMax} 총승 ${myWins} 동점` },
    winType: 'draw',
  };
}

function emptySide(): WsAdvisorSide {
  return {
    remaining: wsCopyCards(WS_INITIAL_CARDS),
    lastPlayed: null,
    currentStreak: 0,
    maxStreak: 0,
    totalWins: 0,
  };
}

export function wsAdvisorSnapshot(history: WsAdvisorRound[]): WsAdvisorSnapshot {
  const my = emptySide();
  const opp = emptySide();

  for (let i = 0; i < history.length; i++) {
    const rec = history[i]!;
    const judged = wsJudgeMatch(rec.myCard, rec.oppCard);
    const mine = applyStreak(my.currentStreak, my.maxStreak, my.totalWins, judged.resultA);
    const theirs = applyStreak(opp.currentStreak, opp.maxStreak, opp.totalWins, judged.resultB);
    my.currentStreak = mine.streak;
    my.maxStreak = mine.maxStreak;
    my.totalWins = mine.totalWins;
    opp.currentStreak = theirs.streak;
    opp.maxStreak = theirs.maxStreak;
    opp.totalWins = theirs.totalWins;
    my.remaining[rec.myCard] -= 1;
    opp.remaining[rec.oppCard] -= 1;
    my.lastPlayed = rec.myCard;
    opp.lastPlayed = rec.oppCard;

    const played = i + 1;
    if (played >= WS_TOTAL_ROUNDS) {
      const done = finishByStats(my.maxStreak, opp.maxStreak, my.totalWins, opp.totalWins);
      return {
        round: WS_TOTAL_ROUNDS + 1,
        left: 0,
        my,
        opp,
        result: done.result,
        winType: done.winType,
      };
    }

    const meStuck = wsIsStuck(my.remaining, my.lastPlayed);
    const oppStuck = wsIsStuck(opp.remaining, opp.lastPlayed);
    if (meStuck || oppStuck) {
      if (meStuck && oppStuck) {
        const done = finishByStats(my.maxStreak, opp.maxStreak, my.totalWins, opp.totalWins);
        return {
          round: played + 1,
          left: wsCardsTotal(my.remaining),
          my,
          opp,
          result: done.result,
          winType: done.winType,
        };
      }
      if (meStuck) {
        return {
          round: played + 1,
          left: wsCardsTotal(my.remaining),
          my,
          opp,
          result: { kind: 'loss', reason: '카드 고갈' },
          winType: 'stuck',
        };
      }
      return {
        round: played + 1,
        left: wsCardsTotal(my.remaining),
        my,
        opp,
        result: { kind: 'win', reason: '상대 카드 고갈' },
        winType: 'stuck',
      };
    }
  }

  return {
    round: history.length + 1,
    left: wsCardsTotal(my.remaining),
    my,
    opp,
    result: { kind: 'playing' },
    winType: null,
  };
}

export function wsAdvisorFinished(result: WsAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss' || result.kind === 'draw';
}

export function wsAdvisorWinnerFromResult(result: WsAdvisorResult): WsAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  if (result.kind === 'draw') return 'draw';
  return null;
}

/** 남은 라운드 전승해도 상대 최대연승을 못 따라가면 이미 진 판. */
export function wsAdvisorHopeless(snap: WsAdvisorSnapshot, side: 'my' | 'opp'): boolean {
  const me = side === 'my' ? snap.my : snap.opp;
  const them = side === 'my' ? snap.opp : snap.my;
  const left = snap.left;
  const myBestMax = Math.max(me.maxStreak, me.currentStreak + left);
  if (myBestMax < them.maxStreak) return true;
  if (myBestMax === me.maxStreak && me.maxStreak === them.maxStreak) {
    if (me.totalWins + left < them.totalWins) return true;
  }
  return false;
}

export const WS_ADVISOR_ME = 'me';
export const WS_ADVISOR_OPP = 'opp';

export interface WsAdvisorKifu {
  advisor: true;
  winType: WSWinType;
  finalStats: Record<string, { maxStreak: number; totalWins: number }>;
  actions: Array<{
    round: number;
    matchDescription: string;
    players: Record<string, {
      nickname: string;
      card: WSCardType;
      result: WSMatchResult;
      streakBefore: number;
      streakAfter: number;
      maxStreakAfter: number;
      totalWinsAfter: number;
      byAi?: boolean;
    }>;
  }>;
  players: Record<string, { nickname: string }>;
}

export function buildWsAdvisorKifu(opts: {
  history: WsAdvisorRound[];
  myNickname: string;
  result: WsAdvisorResult;
  winType: WSWinType;
}): WsAdvisorKifu {
  const myNick = opts.myNickname || '나';
  const oppNick = '상대';
  const actions: WsAdvisorKifu['actions'] = [];
  const my = emptySide();
  const opp = emptySide();

  for (let i = 0; i < opts.history.length; i++) {
    const rec = opts.history[i]!;
    const judged = wsJudgeMatch(rec.myCard, rec.oppCard);
    const myBefore = my.currentStreak;
    const oppBefore = opp.currentStreak;
    const mine = applyStreak(my.currentStreak, my.maxStreak, my.totalWins, judged.resultA);
    const theirs = applyStreak(opp.currentStreak, opp.maxStreak, opp.totalWins, judged.resultB);
    my.currentStreak = mine.streak;
    my.maxStreak = mine.maxStreak;
    my.totalWins = mine.totalWins;
    opp.currentStreak = theirs.streak;
    opp.maxStreak = theirs.maxStreak;
    opp.totalWins = theirs.totalWins;
    actions.push({
      round: i + 1,
      matchDescription: judged.description,
      players: {
        me: {
          nickname: myNick,
          card: rec.myCard,
          result: judged.resultA,
          streakBefore: myBefore,
          streakAfter: my.currentStreak,
          maxStreakAfter: my.maxStreak,
          totalWinsAfter: my.totalWins,
          byAi: true,
        },
        opp: {
          nickname: oppNick,
          card: rec.oppCard,
          result: judged.resultB,
          streakBefore: oppBefore,
          streakAfter: opp.currentStreak,
          maxStreakAfter: opp.maxStreak,
          totalWinsAfter: opp.totalWins,
        },
      },
    });
  }

  return {
    advisor: true,
    winType: opts.winType,
    finalStats: {
      me: { maxStreak: my.maxStreak, totalWins: my.totalWins },
      opp: { maxStreak: opp.maxStreak, totalWins: opp.totalWins },
    },
    actions,
    players: { me: { nickname: myNick }, opp: { nickname: oppNick } },
  };
}

