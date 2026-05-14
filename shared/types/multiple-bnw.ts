export const MBNW_TILE_SET = [3, 4, 5, 6, 7, 8, 9, 10, 12] as const;
export type MBNWTile = typeof MBNW_TILE_SET[number];
export const MBNW_TOTAL_ROUNDS = 9;

export type MBNWTileColor = 'white' | 'black';
export type MBNWPhase =
  | 'tileSubmit'
  | 'tileRespond'
  | 'suspectFirst'
  | 'suspectSecond'
  | 'result'
  | 'finished';
export type MBNWWinType = 'score' | 'suspectCount' | 'draw' | 'timeout' | 'abandon' | null;

export const MBNW_TILE_COLOR: Record<MBNWTile, MBNWTileColor> = {
  3: 'white', 5: 'white', 7: 'white', 9: 'white',
  4: 'black', 6: 'black', 8: 'black', 10: 'black', 12: 'black',
};

export interface MBNWPlayerInfo {
  id: string;
  nickname: string;
  score: number;
  /** 본인에게만 전달. 상대방 PlayerState에는 빈 배열 [] */
  remainingTiles: MBNWTile[];
  submitted: boolean;
  isFirst: boolean;
}

export interface MBNWColorReveal {
  firstPlayerColor: MBNWTileColor | null;
  secondPlayerColor: MBNWTileColor | null;
}

export interface MBNWSuspectResult {
  firstSuspected: boolean | null;
  firstSuccess: boolean | null;
  secondSkipped: boolean;
  secondSuspected: boolean | null;
  secondSuccess: boolean | null;
}

/** ⑤ 정산 페이즈 결과 — 타일 숫자 비공개 */
export interface MBNWResultPlayerData {
  color: MBNWTileColor;
  suspected: boolean;
  suspectSuccess: boolean | null;
  bonusPoint: number;
  /** 숫자 정산 승리 여부 (null = 의심으로 승부 결정 or 타이) */
  normalWin: boolean | null;
  normalPoint: number;
  totalScoreChange: number;
  scoreAfter: number;
}

export interface MBNWResultData {
  players: Record<string, MBNWResultPlayerData>;
}

/** 라운드 기록 — 타일 숫자 비공개, 색상만 기록 */
export interface MBNWRoundRecord {
  round: number;
  firstPlayerId: string;
  players: Record<string, {
    color: MBNWTileColor;
    suspected: boolean;
    suspectSuccess: boolean | null;
    bonusPoint: number;
    normalPoint: number;
    scoreAfter: number;
  }>;
}

export interface MultipleBnwGameData {
  round: number;
  phase: MBNWPhase;
  firstPlayerId: string;
  players: Record<string, MBNWPlayerInfo>;
  colorReveal: MBNWColorReveal | null;
  suspectResult: MBNWSuspectResult | null;
  resultData: MBNWResultData | null;
  roundHistory: MBNWRoundRecord[];
  winner: string | null;
  winType: MBNWWinType;
  /** 의심 페이즈에서 내 타일 숫자 (본인에게만 전송) */
  myTile: number | null;
}

export type MultipleBnwAction =
  | { type: 'submitTile'; tile: number }
  | { type: 'respondTile'; tile: number }
  | { type: 'suspectFirst'; suspect: boolean }
  | { type: 'suspectSecond'; suspect: boolean };
