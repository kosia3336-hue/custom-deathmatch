/* ════════════════════════════════════════════════════════════════
   5개의 탑 (Five Towers) - 공유 타입 / 상수
═════════════════════════════════════════════════════════════════ */

export const FT_MAX_SCORE = 3;
export const FT_TOWER_MAX_HEIGHT = 11;
export const FT_HALF_MILESTONE = 6;
export const FT_MIN_STACK = 1;
export const FT_MAX_STACK = 3;

export const FT_TOWERS = ['A', 'B', 'C', 'D', 'E'] as const;
export type FTTower = (typeof FT_TOWERS)[number];

export const FT_ITEMS = ['info', 'zero', 'secret'] as const;
export type FTItem = (typeof FT_ITEMS)[number];

export type FTPhase = 'turn' | 'milestone' | 'finished';

export type FTWinType = 'score' | 'leave' | 'timeout';

export type FTStackCount = 1 | 2 | 3;

/* ── 액션 ────────────────────────────────────────────── */

export type FTAction =
  | { type: 'stack'; tower: FTTower; count: FTStackCount }
  | { type: 'item'; item: 'info'; targets: [FTTower, FTTower] }
  | { type: 'item'; item: 'zero'; target: FTTower }
  | { type: 'item'; item: 'secret'; target: FTTower; count: FTStackCount };

/* ── 클라이언트 송신용 ─────────────────────────────────── */

export interface FTPlayerInfo {
  id: string;
  nickname: string;
  score: number;
  /** 본인에게만: 본인이 직접 쌓은 탑별 누적값 */
  myStackedHeights: Record<FTTower, number> | null;
  /** 본인에게만 true 송신. 상대에게는 항상 false */
  itemUsed: boolean;
  /** 본인에게만: 사용한 아이템 종류 */
  myItemUsedKind: FTItem | null;
}

export interface FTTowerPublicInfo {
  id: FTTower;
  completed: boolean;
  completedBy: string | null;
  milestonesReached: { half: boolean; complete: boolean };
  /** 마일스톤 기반 추정 하한 (0/6/11) */
  minKnownHeight: number;
}

export interface FTInfoResult {
  turn: number;
  targets: [FTTower, FTTower];
  /** 사용 시점 양측 합 */
  sumAtTime: number;
}

export interface FTSecretLog {
  turn: number;
  target: FTTower;
  count: FTStackCount;
  revealed: boolean;
}

export interface FTUnresolvedSecret {
  turn: number;
  actorId: string;
  /** 본인이 사용한 시크릿이라면 풀 정보, 아니면 null */
  details: { target: FTTower; count: FTStackCount } | null;
}

export type FTActionLogKind =
  | 'stack-public'
  | 'secret-hidden'
  | 'secret-revealed'
  | 'info-self'
  | 'zero-self';

export interface FTActionLogEntry {
  turn: number;
  actorId: string;
  actorNickname: string;
  kind: FTActionLogKind;
  tower?: FTTower;
  /** 본인 행동 시 정확값 / 상대 행동 시 undefined */
  count?: 0 | 1 | 2 | 3;
  targets?: [FTTower, FTTower];
  sum?: number;
  milestone?: 'half' | 'complete';
  scoreChange?: number;
}

export interface FTMilestoneEntry {
  turn: number;
  tower: FTTower;
  kind: 'half' | 'complete';
  actorId: string;
  actorNickname: string;
  scoreChange?: 1;
}

export interface FTGameData {
  phase: FTPhase;
  turn: number;
  currentPlayerId: string;
  firstPlayerId: string;
  players: Record<string, FTPlayerInfo>;
  towers: Record<FTTower, FTTowerPublicInfo>;
  /** 본인에게만 (관전자/상대는 빈 배열) */
  myInfoResults: FTInfoResult[];
  /** 본인이 사용한 시크릿 이력 */
  mySecretLog: FTSecretLog[];
  unresolvedSecrets: FTUnresolvedSecret[];
  actionLog: FTActionLogEntry[];
  milestoneLog: FTMilestoneEntry[];
  winner: string | null;
  winType: FTWinType | null;
  finishReason: string | null;
}

export type FTErrorReason =
  | 'phaseMismatch'
  | 'notYourTurn'
  | 'invalidTower'
  | 'invalidCount'
  | 'towerCompleted'
  | 'overflow'
  | 'itemAlreadyUsed'
  | 'sameTargets'
  | 'unknownAction';
