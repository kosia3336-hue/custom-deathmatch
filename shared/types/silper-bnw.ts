export const SBNW_MAX_SCORE = 6;
export const SBNW_TOTAL_ROUNDS = 11;
export const SBNW_MAX_REMATCH = 5;
export const SBNW_TOTAL_TILE_COUNT = 19;

export type SBNWTile = 0 | 1 | 2 | 3 | 4;

export const SBNW_INITIAL_TILES: Record<SBNWTile, number> = {
  0: 6,
  1: 5,
  2: 4,
  3: 3,
  4: 1,
};

export type SBNWPhase =
  | 'firstSubmit'
  | 'secondSubmit'
  | 'reveal'
  | 'rematchIntro'
  | 'finished';

export type SBNWWinType =
  | 'score'
  | 'tiebreakTile'
  | 'rematch'
  | 'autoLoss'
  | 'timeout'
  | 'leave'
  | 'draw';

export interface SBNWFirstHint {
  digits: number;
}

export interface SBNWPlayerInfo {
  id: string;
  nickname: string;
  score: number;
  /** 본인에게만 공개. 상대/관전자는 null */
  tiles: Record<SBNWTile, number> | null;
  tileCount: number;
  submitted: boolean;
}

export interface SBNWRevealSide {
  tilesUsed: SBNWTile[];
  digits: number;
  /** bigint를 직렬화한 문자열 */
  valueStr: string;
}

export interface SBNWRevealData {
  firstPlayerId: string;
  first: SBNWRevealSide;
  second: SBNWRevealSide;
  winnerId: string | null;
}

export interface SBNWRoundPlayerRecord {
  nickname: string;
  tilesUsed: SBNWTile[];
  digits: number;
  valueStr: string;
  scoreBefore: number;
  scoreAfter: number;
  scoreChange: number;
  tileCountBefore: number;
  tileCountAfter: number;
}

export interface SBNWRoundRecord {
  round: number;
  rematchIndex: number;
  firstPlayerId: string;
  players: Record<string, SBNWRoundPlayerRecord>;
  winnerId: string | null;
}

export type SBNWSegmentResolution =
  | 'continuing'
  | 'score'
  | 'tiebreakTile'
  | 'rematchNeeded';

export interface SBNWSegmentSummary {
  rematchIndex: number;
  firstPlayerIdAtStart: string;
  finalScores: Record<string, number>;
  finalTiles: Record<string, Record<SBNWTile, number>>;
  resolution: SBNWSegmentResolution;
  winnerId: string | null;
  rounds: SBNWRoundRecord[];
}

export interface SBNWGameData {
  phase: SBNWPhase;
  round: number;
  firstPlayerId: string;
  players: Record<string, SBNWPlayerInfo>;
  /** secondSubmit 이상에서만 존재 */
  firstHint: SBNWFirstHint | null;
  /** reveal/rematchIntro/finished 단계에서만 존재 */
  revealData: SBNWRevealData | null;
  /** 현재 세그먼트 라운드 기록 */
  roundHistory: SBNWRoundRecord[];
  /** 과거 세그먼트 누적 (rematchIndex ≥ 1일 때) */
  segmentsHistory: SBNWSegmentSummary[];
  /** 0=본경기, 1+=재대결 회차 */
  rematchIndex: number;
  finishReason: string | null;
  winner: string | null;
  winType: SBNWWinType | null;
}

export type SBNWAction =
  | { type: 'submitFirst'; tiles: SBNWTile[] }
  | { type: 'submitSecond'; tiles: SBNWTile[] };
