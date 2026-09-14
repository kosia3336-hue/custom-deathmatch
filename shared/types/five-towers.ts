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

export const FT_ADVISOR_ME = 'me';
export const FT_ADVISOR_OPP = 'opp';

export function ftEmptyStacked(): Record<FTTower, number> {
  return { A: 0, B: 0, C: 0, D: 0, E: 0 };
}

export function ftCopyStacked(p: Record<FTTower, number>): Record<FTTower, number> {
  return { A: p.A ?? 0, B: p.B ?? 0, C: p.C ?? 0, D: p.D ?? 0, E: p.E ?? 0 };
}

export function ftPublicTower(id: FTTower, over: Partial<FTTowerPublicInfo> = {}): FTTowerPublicInfo {
  return {
    id,
    completed: false,
    completedBy: null,
    milestonesReached: { half: false, complete: false },
    minKnownHeight: 0,
    ...over,
    id,
  };
}

export function ftEmptyTowers(): Record<FTTower, FTTowerPublicInfo> {
  return {
    A: ftPublicTower('A'),
    B: ftPublicTower('B'),
    C: ftPublicTower('C'),
    D: ftPublicTower('D'),
    E: ftPublicTower('E'),
  };
}

/** 공개 밴드. 진짜 높이 필드 없음. 0–5 / 6–10 / 11. */
export function ftHeightBand(pub: FTTowerPublicInfo, myStacked: number): { lo: number; hi: number } {
  if (pub.completed) return { lo: FT_TOWER_MAX_HEIGHT, hi: FT_TOWER_MAX_HEIGHT };
  const lo0 = pub.milestonesReached.half ? FT_HALF_MILESTONE : 0;
  const hi0 = pub.milestonesReached.half ? FT_TOWER_MAX_HEIGHT - 1 : FT_HALF_MILESTONE - 1;
  const lo = Math.max(lo0, myStacked, pub.minKnownHeight);
  const hi = Math.max(lo, hi0);
  return { lo, hi };
}

export type FtAdvisorMeAction =
  | { kind: 'stack'; tower: FTTower; count: FTStackCount }
  | { kind: 'info'; targets: [FTTower, FTTower]; sumAtTime: number }
  | { kind: 'zero'; tower: FTTower }
  | { kind: 'secret'; tower: FTTower; count: FTStackCount };

export type FtAdvisorOppSight =
  | { kind: 'stack'; tower: FTTower }
  | { kind: 'secret-hidden' }
  | { kind: 'secret-revealed'; tower: FTTower };

export interface FtAdvisorPly {
  by: 'me' | 'opp';
  me?: FtAdvisorMeAction;
  opp?: FtAdvisorOppSight;
  half?: FTTower | null;
  complete?: FTTower | null;
}

export type FtAdvisorAsk = 'my-turn' | 'opp-turn' | 'finished';

export type FtAdvisorResult =
  | { kind: 'playing' }
  | { kind: 'win'; reason: string }
  | { kind: 'loss'; reason: string };

export interface FtAdvisorSnapshot {
  turn: number;
  iAmToMove: boolean;
  myScore: number;
  oppScore: number;
  myStacked: Record<FTTower, number>;
  itemUsed: boolean;
  myItemUsedKind: FTItem | null;
  towers: Record<FTTower, FTTowerPublicInfo>;
  myInfoResults: FTInfoResult[];
  mySecretLog: FTSecretLog[];
  actionLog: FTActionLogEntry[];
  milestoneLog: FTMilestoneEntry[];
  oppSecretPending: boolean;
  justUsedInfo: boolean;
  result: FtAdvisorResult;
  winType: FTWinType | null;
}

export type FtAdvisorWinner = 'me' | 'opp';

function isTower(v: unknown): v is FTTower {
  return v === 'A' || v === 'B' || v === 'C' || v === 'D' || v === 'E';
}

function isCount(v: unknown): v is FTStackCount {
  return v === 1 || v === 2 || v === 3;
}

export function ftOppStackTurns(snap: FtAdvisorSnapshot, tower: FTTower): number[] {
  const turns: number[] = [];
  for (const e of snap.actionLog) {
    if (e.actorId !== FT_ADVISOR_OPP) continue;
    if (e.kind !== 'stack-public') continue;
    if (e.tower !== tower) continue;
    turns.push(e.turn);
  }
  return turns;
}

export function ftOppSecretPendingKind(snap: FtAdvisorSnapshot): 'preHalf' | 'half' | null {
  if (!snap.oppSecretPending) return null;
  const hidden = snap.actionLog.some(
    (e) => e.actorId === FT_ADVISOR_OPP && (e.kind === 'secret-hidden' || e.kind === 'secret-revealed'),
  );
  if (!hidden) return null;
  const revealed = snap.actionLog.some(
    (e) => e.actorId === FT_ADVISOR_OPP && e.kind === 'secret-revealed',
  );
  if (revealed) return null;
  return 'preHalf';
}

export function ftInferredBand(snap: FtAdvisorSnapshot, tower: FTTower): { lo: number; hi: number } {
  const pub = snap.towers[tower]!;
  const mine = snap.myStacked[tower] ?? 0;
  const base = ftHeightBand(pub, mine);
  if (pub.completed) return base;
  const nOpp = ftOppStackTurns(snap, tower).length;
  const secret = ftOppSecretPendingKind(snap);
  const secretCould =
    secret === 'preHalf' ? !pub.milestonesReached.half : false;
  if (nOpp === 0 && !secretCould) {
    const v = Math.min(base.hi, Math.max(base.lo, mine));
    return { lo: v, hi: v };
  }
  const lo = Math.max(base.lo, mine);
  const hi = Math.min(base.hi, mine + 3 * nOpp + (secretCould ? 3 : 0));
  return { lo, hi: Math.max(lo, hi) };
}

export function ftSureCompleteTowers(snap: FtAdvisorSnapshot): FTTower[] {
  return FT_TOWERS.filter((t) => {
    const pub = snap.towers[t];
    if (!pub || pub.completed) return false;
    return ftInferredBand(snap, t).lo >= FT_TOWER_MAX_HEIGHT - FT_MAX_STACK;
  });
}

export function ftIsKnownGift(snap: FtAdvisorSnapshot, tower: FTTower, count: FTStackCount): boolean {
  const pub = snap.towers[tower];
  if (!pub || pub.completed) return true;
  const { lo, hi } = ftInferredBand(snap, tower);
  if (lo !== hi) return false;
  const left = FT_TOWER_MAX_HEIGHT - Math.min(FT_TOWER_MAX_HEIGHT, lo + count);
  return left === 1 || left === 2;
}

function markHalf(towers: Record<FTTower, FTTowerPublicInfo>, t: FTTower): void {
  const cur = towers[t]!;
  if (cur.completed) return;
  towers[t] = {
    ...cur,
    milestonesReached: { half: true, complete: cur.milestonesReached.complete },
    minKnownHeight: Math.max(cur.minKnownHeight, FT_HALF_MILESTONE),
  };
}

function markComplete(
  towers: Record<FTTower, FTTowerPublicInfo>,
  t: FTTower,
  by: string,
): void {
  towers[t] = {
    ...towers[t]!,
    completed: true,
    completedBy: by,
    milestonesReached: { half: true, complete: true },
    minKnownHeight: FT_TOWER_MAX_HEIGHT,
  };
}

function consumeTurn(meAction: FtAdvisorMeAction | undefined): boolean {
  if (!meAction) return true;
  return meAction.kind !== 'info';
}

export function ftAdvisorSnapshot(iAmFirst: boolean, history: FtAdvisorPly[]): FtAdvisorSnapshot {
  let turn = 1;
  let iAmToMove = iAmFirst;
  let myScore = 0;
  let oppScore = 0;
  const myStacked = ftEmptyStacked();
  let itemUsed = false;
  let myItemUsedKind: FTItem | null = null;
  const towers = ftEmptyTowers();
  const myInfoResults: FTInfoResult[] = [];
  const mySecretLog: FTSecretLog[] = [];
  const actionLog: FTActionLogEntry[] = [];
  const milestoneLog: FTMilestoneEntry[] = [];
  let oppSecretPending = false;
  let justUsedInfo = false;

  const playing = (): FtAdvisorSnapshot => ({
    turn,
    iAmToMove,
    myScore,
    oppScore,
    myStacked: ftCopyStacked(myStacked),
    itemUsed,
    myItemUsedKind,
    towers: {
      A: { ...towers.A },
      B: { ...towers.B },
      C: { ...towers.C },
      D: { ...towers.D },
      E: { ...towers.E },
    },
    myInfoResults: [...myInfoResults],
    mySecretLog: [...mySecretLog],
    actionLog: [...actionLog],
    milestoneLog: [...milestoneLog],
    oppSecretPending,
    justUsedInfo,
    result: { kind: 'playing' },
    winType: null,
  });

  const done = (result: FtAdvisorResult, winType: FTWinType): FtAdvisorSnapshot => ({
    ...playing(),
    iAmToMove: false,
    result,
    winType,
  });

  for (const ply of history) {
    justUsedInfo = false;
    if (ply.by === 'me') {
      const a = ply.me;
      if (!a) return done({ kind: 'loss', reason: '기록 수가 올바르지 않음' }, 'leave');
      if (a.kind === 'stack') {
        if (towers[a.tower]!.completed) {
          return done({ kind: 'loss', reason: '완성된 탑에 쌓음' }, 'leave');
        }
        myStacked[a.tower] += a.count;
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_ME,
          actorNickname: '나',
          kind: 'stack-public',
          tower: a.tower,
          count: a.count,
        });
      } else if (a.kind === 'info') {
        if (itemUsed) return done({ kind: 'loss', reason: '아이템을 두 번 씀' }, 'leave');
        if (a.targets[0] === a.targets[1]) {
          return done({ kind: 'loss', reason: '정보 대상이 같음' }, 'leave');
        }
        itemUsed = true;
        myItemUsedKind = 'info';
        myInfoResults.push({ turn, targets: a.targets, sumAtTime: a.sumAtTime });
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_ME,
          actorNickname: '나',
          kind: 'info-self',
          targets: a.targets,
          sum: a.sumAtTime,
        });
        justUsedInfo = true;
      } else if (a.kind === 'zero') {
        if (itemUsed) return done({ kind: 'loss', reason: '아이템을 두 번 씀' }, 'leave');
        itemUsed = true;
        myItemUsedKind = 'zero';
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_ME,
          actorNickname: '나',
          kind: 'zero-self',
          tower: a.tower,
          count: 0,
        });
      } else if (a.kind === 'secret') {
        if (itemUsed) return done({ kind: 'loss', reason: '아이템을 두 번 씀' }, 'leave');
        if (towers[a.tower]!.completed) {
          return done({ kind: 'loss', reason: '완성된 탑에 시크릿' }, 'leave');
        }
        itemUsed = true;
        myItemUsedKind = 'secret';
        myStacked[a.tower] += a.count;
        mySecretLog.push({ turn, target: a.tower, count: a.count, revealed: false });
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_ME,
          actorNickname: '나',
          kind: 'secret-hidden',
          tower: a.tower,
          count: a.count,
        });
      }
    } else {
      const o = ply.opp;
      if (!o) return done({ kind: 'loss', reason: '기록 수가 올바르지 않음' }, 'leave');
      if (o.kind === 'stack') {
        if (towers[o.tower]!.completed) {
          return done({ kind: 'loss', reason: '완성된 탑에 상대가 쌓음' }, 'leave');
        }
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_OPP,
          actorNickname: '상대',
          kind: 'stack-public',
          tower: o.tower,
        });
      } else if (o.kind === 'secret-hidden') {
        oppSecretPending = true;
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_OPP,
          actorNickname: '상대',
          kind: 'secret-hidden',
        });
      } else if (o.kind === 'secret-revealed') {
        oppSecretPending = false;
        actionLog.push({
          turn,
          actorId: FT_ADVISOR_OPP,
          actorNickname: '상대',
          kind: 'secret-revealed',
          tower: o.tower,
        });
      }
    }

    const actor = ply.by === 'me' ? FT_ADVISOR_ME : FT_ADVISOR_OPP;
    const actorNick = ply.by === 'me' ? '나' : '상대';
    let halfT = ply.half ?? null;
    let completeT = ply.complete ?? null;

    if (ply.by === 'me' && ply.me && (ply.me.kind === 'stack' || ply.me.kind === 'secret')) {
      const t = ply.me.tower;
      const tmp: FtAdvisorSnapshot = {
        turn,
        iAmToMove,
        myScore,
        oppScore,
        myStacked: ftCopyStacked(myStacked),
        itemUsed,
        myItemUsedKind,
        towers: {
          A: { ...towers.A },
          B: { ...towers.B },
          C: { ...towers.C },
          D: { ...towers.D },
          E: { ...towers.E },
        },
        myInfoResults,
        mySecretLog,
        actionLog,
        milestoneLog,
        oppSecretPending,
        justUsedInfo,
        result: { kind: 'playing' },
        winType: null,
      };
      const band = ftInferredBand(tmp, t);
      if (band.lo === band.hi) {
        if (band.lo >= FT_HALF_MILESTONE && !towers[t]!.milestonesReached.half) halfT = t;
        if (band.lo >= FT_TOWER_MAX_HEIGHT && !towers[t]!.completed) completeT = t;
      }
    }

    if (halfT && isTower(halfT) && !towers[halfT]!.milestonesReached.half) {
      markHalf(towers, halfT);
      milestoneLog.push({
        turn,
        tower: halfT,
        kind: 'half',
        actorId: actor,
        actorNickname: actorNick,
      });
      const last = actionLog[actionLog.length - 1];
      if (last?.kind === 'secret-hidden' && last.actorId === actor) {
        last.kind = 'secret-revealed';
        last.tower = halfT;
        last.milestone = 'half';
        if (actor === FT_ADVISOR_ME && mySecretLog.length > 0) {
          mySecretLog[mySecretLog.length - 1]!.revealed = true;
        }
        if (actor === FT_ADVISOR_OPP) oppSecretPending = false;
      }
    }

    if (completeT && isTower(completeT) && !towers[completeT]!.completed) {
      markComplete(towers, completeT, actor);
      if (ply.by === 'me') myScore += 1;
      else oppScore += 1;
      milestoneLog.push({
        turn,
        tower: completeT,
        kind: 'complete',
        actorId: actor,
        actorNickname: actorNick,
        scoreChange: 1,
      });
      const last = actionLog[actionLog.length - 1];
      if (last) {
        last.milestone = 'complete';
        last.scoreChange = 1;
        if (last.kind === 'secret-hidden') {
          last.kind = 'secret-revealed';
          last.tower = completeT;
          if (actor === FT_ADVISOR_ME && mySecretLog.length > 0) {
            mySecretLog[mySecretLog.length - 1]!.revealed = true;
          }
          if (actor === FT_ADVISOR_OPP) oppSecretPending = false;
        }
      }
    }

    if (myScore >= FT_MAX_SCORE) {
      return done({ kind: 'win', reason: '3점' }, 'score');
    }
    if (oppScore >= FT_MAX_SCORE) {
      return done({ kind: 'loss', reason: '상대 3점' }, 'score');
    }

    if (ply.by === 'me' ? consumeTurn(ply.me) : true) {
      turn += 1;
      iAmToMove = !iAmToMove;
    }
  }

  return playing();
}

export function ftAdvisorAsk(iAmFirst: boolean, history: FtAdvisorPly[]): FtAdvisorAsk {
  const snap = ftAdvisorSnapshot(iAmFirst, history);
  if (snap.result.kind !== 'playing') return 'finished';
  return snap.iAmToMove ? 'my-turn' : 'opp-turn';
}

export function ftAdvisorFinished(result: FtAdvisorResult): boolean {
  return result.kind === 'win' || result.kind === 'loss';
}

export function ftAdvisorWinnerFromResult(result: FtAdvisorResult): FtAdvisorWinner | null {
  if (result.kind === 'win') return 'me';
  if (result.kind === 'loss') return 'opp';
  return null;
}

export function ftFormatAction(action: FTAction): string {
  if (action.type === 'stack') return `쌓기 ${action.tower} ${action.count}칸`;
  if (action.item === 'info') return `정보 ${action.targets[0]}+${action.targets[1]}`;
  if (action.item === 'zero') return `제로 ${action.target}`;
  return `시크릿 ${action.target} ${action.count}칸`;
}

export interface FtAdvisorKifu {
  advisor: true;
  iAmFirst: boolean;
  winType: FTWinType | null;
  finishReason: string | null;
  finalScores: Record<string, number>;
  actions: Array<{
    turn: number;
    by: 'me' | 'opp';
    label: string;
    byAi?: boolean;
  }>;
  players: Record<string, { nickname: string }>;
}

function plyLabel(ply: FtAdvisorPly): string {
  if (ply.by === 'me' && ply.me) {
    const a = ply.me;
    if (a.kind === 'stack') return `쌓기 ${a.tower} ${a.count}칸`;
    if (a.kind === 'info') return `정보 ${a.targets[0]}+${a.targets[1]} 합 ${a.sumAtTime}`;
    if (a.kind === 'zero') return `제로 ${a.tower}`;
    return `시크릿 ${a.tower} ${a.count}칸`;
  }
  if (ply.by === 'opp' && ply.opp) {
    const o = ply.opp;
    if (o.kind === 'stack') return `공개 쌓기 ${o.tower}`;
    if (o.kind === 'secret-hidden') return '시크릿(숨김)';
    return `시크릿 공개 ${o.tower}`;
  }
  return '수';
}

export function buildFtAdvisorKifu(opts: {
  history: FtAdvisorPly[];
  iAmFirst: boolean;
  myNickname: string;
  result: FtAdvisorResult;
  winType: FTWinType | null;
}): FtAdvisorKifu {
  const snap = ftAdvisorSnapshot(opts.iAmFirst, opts.history);
  return {
    advisor: true,
    iAmFirst: opts.iAmFirst,
    winType: opts.winType,
    finishReason: opts.result.kind !== 'playing' ? opts.result.reason : null,
    finalScores: { me: snap.myScore, opp: snap.oppScore },
    actions: opts.history.map((ply, i) => ({
      turn: i + 1,
      by: ply.by,
      label: plyLabel(ply),
      byAi: ply.by === 'me',
    })),
    players: {
      me: { nickname: opts.myNickname || '나' },
      opp: { nickname: '상대' },
    },
  };
}

export { isTower as ftIsTower, isCount as ftIsCount };
