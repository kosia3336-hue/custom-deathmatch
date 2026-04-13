export const ID_TOTAL_ROUNDS = 7;
export const ID_INITIAL_SCORE = 4;
export const ID_INITIAL_COIN_STOCK = {
  coin50: 2,
  coin10: 6,
  coin1: 10,
} as const;

export type IDPhase = 'submit' | 'reveal' | 'finished';
export type IDWinType = 'elimination' | 'score' | 'tiebreaker' | 'timeout' | 'leave';
export type IDBadge = 'majorShareholder' | 'miser' | null;

export interface IDCoinAllocation {
  coin50: number;
  coin10: number;
  coin1: number;
}

export interface IDCoinStock {
  coin50: number;
  coin10: number;
  coin1: number;
}

export interface IDPlayerInfo {
  id: string;
  nickname: string;
  score: number;
  coinStock: IDCoinStock;
  submitted: boolean;
  investCoins: IDCoinAllocation | null;
  donateCoins: IDCoinAllocation | null;
  investBadge: IDBadge;
  donateBadge: IDBadge;
}

export interface IDRevealPlayerData {
  investCoins: IDCoinAllocation;
  donateCoins: IDCoinAllocation;
  investTotal: number;
  donateTotal: number;
  investBadge: IDBadge;
  donateBadge: IDBadge;
  scoreChange: number;
}

export interface IDRevealData {
  players: Record<string, IDRevealPlayerData>;
  investTied: boolean;
  donateTied: boolean;
}

export interface IDRoundRecord {
  round: number;
  players: Record<string, {
    investCoins: IDCoinAllocation;
    donateCoins: IDCoinAllocation;
    investTotal: number;
    donateTotal: number;
    investBadge: IDBadge;
    donateBadge: IDBadge;
    scoreChange: number;
    scoreAfter: number;
    coinStockAfter: IDCoinStock;
  }>;
}

export interface InvestDonateGameData {
  round: number;
  totalRounds: number;
  phase: IDPhase;
  players: Record<string, IDPlayerInfo>;
  revealData: IDRevealData | null;
  roundHistory: IDRoundRecord[];
  winner: string | null;
  winType: IDWinType | null;
  rematchReason: string | null;
}

export type InvestDonateAction =
  | { type: 'submit'; invest: IDCoinAllocation; donate: IDCoinAllocation }
  | { type: 'cancelSubmit' };

export function coinValue(alloc: IDCoinAllocation): number {
  return alloc.coin50 * 50 + alloc.coin10 * 10 + alloc.coin1;
}

export function stockTotal(stock: IDCoinStock): number {
  return stock.coin50 * 50 + stock.coin10 * 10 + stock.coin1;
}
