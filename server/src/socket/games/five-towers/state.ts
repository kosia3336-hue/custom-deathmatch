import { scheduleTurnExpiry } from "../../gameTurnExpiry.js";
import type { GameState } from '@shared/types/events.js';
import type {
  FTAction,
  FTActionLogEntry,
  FTGameData,
  FTInfoResult,
  FTMilestoneEntry,
  FTPlayerInfo,
  FTSecretLog,
  FTStackCount,
  FTTower,
  FTTowerPublicInfo,
  FTUnresolvedSecret,
  FTWinType,
} from '@shared/types/five-towers.js';
import type {
  FiveTowersActionRecord,
  FiveTowersArchiveRecord,
  FiveTowersItemUsage,
  FiveTowersMilestoneRecord,
  FiveTowersTowerRecord,
} from '@shared/types/archive.js';
import { sessions } from '../../../store/sessions.js';
import { socketRoom } from '../../utils.js';
import { isDbgViewer } from '../../_dbg-viewer.js';
import {
  FT_HALF_MILESTONE,
  FT_MAX_SCORE,
  FT_TOWERS,
  FT_TOWER_MAX_HEIGHT,
  MILESTONE_DISPLAY_MS,
  TIMEOUT_LIMIT,
  WIN_DISPLAY_MS,
} from './constants.js';
import type { IO, TypedSocket } from './constants.js';
import {
  errorMessage,
  pickAutoStackTower,
  validateAction,
} from './judge.js';
import type {
  FTPlayerInternal,
  FTPlayerSnapshot,
  FTTowerInternal,
  FTTowerSnapshot,
  FTUndoSnapshot,
  InternalState,
} from './types.js';
import { isTokenAnonymized } from '../../../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../../../shop/maskNicknames.js';
import { nicknameForViewer } from '../../../rank/maskRankIdentity.js';
import { getActiveSkin } from '../../skins.js';

export const gameStates = new Map<string, InternalState>();

/* ────────── helpers ────────── */

function emptyHeights(): Record<FTTower, number> {
  return FT_TOWERS.reduce((acc, t) => {
    acc[t] = 0;
    return acc;
  }, {} as Record<FTTower, number>);
}

export function makePlayer(id: string, nickname: string): FTPlayerInternal {
  return {
    id,
    nickname,
    score: 0,
    myStackedHeights: emptyHeights(),
    itemUsed: false,
    itemUsedKind: null,
    itemUsedTurn: null,
    itemUsedDetail: null,
  };
}

export function makeTowers(playerIds: string[]): Record<FTTower, FTTowerInternal> {
  const out = {} as Record<FTTower, FTTowerInternal>;
  for (const id of FT_TOWERS) {
    out[id] = {
      id,
      height: 0,
      completed: false,
      completedBy: null,
      halfReached: false,
      contributions: playerIds.reduce((acc, pid) => {
        acc[pid] = 0;
        return acc;
      }, {} as Record<string, number>),
    };
  }
  return out;
}

export function getPlayer(s: InternalState, id: string): FTPlayerInternal | null {
  if (s.player1.id === id) return s.player1;
  if (s.player2.id === id) return s.player2;
  return null;
}

export function getOpponent(s: InternalState, id: string): FTPlayerInternal | null {
  if (s.player1.id === id) return s.player2;
  if (s.player2.id === id) return s.player1;
  return null;
}

function phaseMessage(s: InternalState, viewerToken: string): string {
  if (s.phase === 'finished') return '게임이 종료되었습니다.';
  const p = getPlayer(s, s.currentPlayerId);
  const nick = p
    ? nicknameForViewer(s.roomId, p.id, p.nickname, viewerToken)
    : '플레이어';
  return `${s.turn}턴 — ${nick} 차례`;
}

/* ────────── game data builders ────────── */

function playerToInfo(p: FTPlayerInternal, isSelf: boolean): FTPlayerInfo {
  return {
    id: p.id,
    nickname: p.nickname,
    score: p.score,
    myStackedHeights: isSelf ? { ...p.myStackedHeights } : null,
    itemUsed: isSelf ? p.itemUsed : false,
    myItemUsedKind: isSelf ? p.itemUsedKind : null,
  };
}

function towerToPublic(t: FTTowerInternal): FTTowerPublicInfo {
  return {
    id: t.id,
    completed: t.completed,
    completedBy: t.completedBy,
    milestonesReached: { half: t.halfReached, complete: t.completed },
    minKnownHeight: t.completed ? FT_TOWER_MAX_HEIGHT : (t.halfReached ? FT_HALF_MILESTONE : 0),
  };
}

function buildUnresolvedSecrets(s: InternalState, viewerId: string | null): FTUnresolvedSecret[] {
  // 풀리지 않은 시크릿: 마지막 행동이 secret-hidden인지 + 그 다음 턴에 마일스톤으로 풀리지 않은 경우
  // 단순화: 시크릿 사용 후 해당 탑이 아직 노출되지 않았다면 unresolved
  const out: FTUnresolvedSecret[] = [];
  for (const pid of [s.player1.id, s.player2.id]) {
    const p = getPlayer(s, pid)!;
    if (p.itemUsedKind !== 'secret' || !p.itemUsedDetail || p.itemUsedDetail.item !== 'secret') continue;
    const detail = p.itemUsedDetail;
    const tower = s.towers[detail.target];
    // 시크릿 후 마일스톤으로 공개되었으면 더 이상 unresolved 아님
    if (tower.halfReached || tower.completed) continue;
    out.push({
      turn: p.itemUsedTurn ?? 0,
      actorId: pid,
      details: viewerId === pid ? { target: detail.target, count: detail.count } : null,
    });
  }
  return out;
}

export function buildGameDataForPlayer(s: InternalState, viewerId: string): FTGameData {
  const maskNick = (id: string, nick: string) =>
    nicknameForViewer(s.roomId, id, nick, viewerId);
  const players: Record<string, FTPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, viewerId === s.player1.id), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, viewerId === s.player2.id), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };
  const towers = FT_TOWERS.reduce((acc, t) => {
    acc[t] = towerToPublic(s.towers[t]);
    return acc;
  }, {} as Record<FTTower, FTTowerPublicInfo>);

  const myInfoResults = s.infoResults[viewerId] ?? [];
  const mySecretLog = s.secretLog[viewerId] ?? [];
  const actionLog = buildActionLogFor(s, viewerId);

  return {
    phase: s.phase,
    turn: s.turn,
    currentPlayerId: s.currentPlayerId,
    firstPlayerId: s.firstPlayerId,
    players,
    towers,
    myInfoResults: [...myInfoResults],
    mySecretLog: [...mySecretLog],
    unresolvedSecrets: buildUnresolvedSecrets(s, viewerId),
    actionLog: actionLog.map(e => ({
      ...e,
      actorNickname: maskNick(e.actorId, e.actorNickname),
    })),
    milestoneLog: s.milestoneLog.map(m => ({
      ...m,
      actorNickname: maskNick(m.actorId, m.actorNickname),
    })),
    winner: s.winner,
    winType: s.winType,
    finishReason: s.finishReason,
  };
}

function buildSpectatorGameData(s: InternalState): FTGameData {
  /*
    관전자도 플레이어와 같은 판정을 거쳐야 한다. 예전에는 익명 물약만 보고
    랭크는 보지 않아, 랭크 판을 관전하면 탑 쌓기 알림·액션 로그·플레이어 목록에
    실명이 그대로 나왔다. nicknameForViewer 는 viewerId 가 null 이면 '본인'
    예외가 없으므로 랭크 플레이어 닉을 모두 가린다.
  */
  const maskNick = (id: string, nick: string) => nicknameForViewer(s.roomId, id, nick, null);
  const players: Record<string, FTPlayerInfo> = {
    [s.player1.id]: { ...playerToInfo(s.player1, false), nickname: maskNick(s.player1.id, s.player1.nickname) },
    [s.player2.id]: { ...playerToInfo(s.player2, false), nickname: maskNick(s.player2.id, s.player2.nickname) },
  };
  const towers = FT_TOWERS.reduce((acc, t) => {
    acc[t] = towerToPublic(s.towers[t]);
    return acc;
  }, {} as Record<FTTower, FTTowerPublicInfo>);

  const actionLog = buildActionLogForSpectator(s);

  return {
    phase: s.phase,
    turn: s.turn,
    currentPlayerId: s.currentPlayerId,
    firstPlayerId: s.firstPlayerId,
    players,
    towers,
    myInfoResults: [],
    mySecretLog: [],
    unresolvedSecrets: buildUnresolvedSecrets(s, null),
    actionLog: actionLog.map(e => ({
      ...e,
      actorNickname: maskNick(e.actorId, e.actorNickname),
    })),
    milestoneLog: s.milestoneLog.map(m => ({
      ...m,
      actorNickname: maskNick(m.actorId, m.actorNickname),
    })),
    winner: s.winner,
    winType: s.winType,
    finishReason: s.finishReason,
  };
}

/** viewer 기준 액션 로그 가공:
 *  - info-self: 본인만 표시 (다른 사람에겐 숨김 → 정보 사용 자체가 노출되지 않음)
 *  - zero-self: 본인은 그대로, 상대에겐 일반 stack-public 으로 위장 (탑은 비공개; tower 미설정)
 *  - stack-public / secret-hidden / secret-revealed: 본인은 풀 정보, 상대는 count 마스킹
 */
function buildActionLogFor(s: InternalState, viewerId: string): FTActionLogEntry[] {
  const out: FTActionLogEntry[] = [];
  for (const e of s.actionLog) {
    if (e.kind === 'info-self') {
      if (e.actorId === viewerId) out.push({ ...e });
      // 상대/관전자에게는 완전히 숨김 (액션 자체 미노출)
      continue;
    }
    if (e.kind === 'zero-self') {
      if (e.actorId === viewerId) {
        out.push({ ...e });
      } else {
        // 상대에겐 일반 stack-public 처럼 보임. 탑은 행위자가 어디 쌓았는지 공개되지 않으므로
        //   tower 는 그대로 노출 (제로의 대상 탑은 사실상 stack 과 동일하게 공개됨).
        // 단, count 는 비공개.
        out.push({
          turn: e.turn,
          actorId: e.actorId,
          actorNickname: e.actorNickname,
          kind: 'stack-public',
          tower: e.tower,
          // count 미설정 (상대는 1~3 중 하나로 인식)
        });
      }
      continue;
    }
    if (e.actorId === viewerId) {
      out.push({ ...e });
      continue;
    }
    // 상대 행동: count 마스킹, secret-hidden 은 tower 도 마스킹
    const masked: FTActionLogEntry = { ...e };
    if (e.kind === 'stack-public' || e.kind === 'secret-hidden' || e.kind === 'secret-revealed') {
      masked.count = undefined;
    }
    if (e.kind === 'secret-hidden') {
      masked.tower = undefined;
    }
    out.push(masked);
  }
  return out;
}

function buildActionLogForSpectator(s: InternalState): FTActionLogEntry[] {
  const out: FTActionLogEntry[] = [];
  for (const e of s.actionLog) {
    if (e.kind === 'info-self') continue;
    if (e.kind === 'zero-self') {
      out.push({
        turn: e.turn,
        actorId: e.actorId,
        actorNickname: e.actorNickname,
        kind: 'stack-public',
        tower: e.tower,
      });
      continue;
    }
    const masked: FTActionLogEntry = { ...e, count: undefined };
    if (e.kind === 'secret-hidden') masked.tower = undefined;
    out.push(masked);
  }
  return out;
}

function buildGameState(s: InternalState, gameData: FTGameData, viewerToken: string): GameState {
  return {
    roomId: s.roomId,
    message: phaseMessage(s, viewerToken),
    currentTurn: s.phase === 'turn' ? s.currentPlayerId : null,
    turnNumber: s.turn,
    startedAt: s.startedAt,
    turnStartedAt: s.timeLimitSeconds ? s.turnStartedAt : null,
    gameData,
    activeSkin: getActiveSkin(s.roomId),
  };
}

function _applyDbgView(s: InternalState, viewerId: string, data: FTGameData): FTGameData {
  const oppId = viewerId === s.player1.id ? s.player2.id : s.player1.id;
  const opp = getPlayer(s, oppId)!;
  const lastOppAction = s.actionLog.slice().reverse().find(e => e.actorId === oppId);
  const oppNick = isTokenAnonymized(s.roomId, oppId) ? ANONYMOUS_NICKNAME : opp.nickname;
  const maskNick = (id: string, nick: string) =>
    isTokenAnonymized(s.roomId, id) ? ANONYMOUS_NICKNAME : nick;
  return {
    ...data,
    players: {
      ...data.players,
      [oppId]: { ...playerToInfo(opp, true), nickname: oppNick },
    },
    unresolvedSecrets: [
      ...buildUnresolvedSecrets(s, viewerId),
      ...buildUnresolvedSecrets(s, oppId),
    ],
    actionLog: s.actionLog.map(e => ({ ...e, actorNickname: maskNick(e.actorId, e.actorNickname) })),
    _x: {
      latestOppAction: lastOppAction ? { ...lastOppAction } : null,
      opponentInfoResults: [...(s.infoResults[oppId] ?? [])],
      opponentSecretLog: [...(s.secretLog[oppId] ?? [])],
    },
  } as FTGameData;
}

/* ────────── broadcast ────────── */

/** onlyPlayerId 를 주면 그 플레이어 화면에만 보낸다 (상대·관전자에게 티가 나면 안 되는 갱신). */
export async function broadcastState(io: IO, s: InternalState, onlyPlayerId?: string) {
  const room = socketRoom(s.roomId);
  const sockets = await io.in(room).fetchSockets();
  for (const sock of sockets) {
    const pid = sessions.getToken(sock.id) ?? sock.id;
    if (onlyPlayerId && pid !== onlyPlayerId) continue;
    const isPlayer = pid === s.player1.id || pid === s.player2.id;
    let gameData = isPlayer
      ? buildGameDataForPlayer(s, pid)
      : buildSpectatorGameData(s);
    if (isPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
      gameData = _applyDbgView(s, pid, gameData);
    }
    const raw = gameData as Record<string, unknown>;
    const ext = raw['_x'];
    if (ext !== undefined) { delete raw['_x']; sock.emit('ext:data', ext); }
    sock.emit('game:state', buildGameState(s, gameData, pid));
  }
}

export function emitStateToSocket(socket: TypedSocket, s: InternalState) {
  const pid = sessions.getToken(socket.id) ?? socket.id;
  const isPlayer = pid === s.player1.id || pid === s.player2.id;
  let gameData = isPlayer
    ? buildGameDataForPlayer(s, pid)
    : buildSpectatorGameData(s);
  if (isPlayer && isDbgViewer(s.playMode, sessions.getMemberId(pid))) {
    gameData = _applyDbgView(s, pid, gameData);
  }
  const raw = gameData as Record<string, unknown>;
  const ext = raw['_x'];
  if (ext !== undefined) { delete raw['_x']; socket.emit('ext:data', ext); }
  socket.emit('game:state', buildGameState(s, gameData, pid));
}

/* ────────── timer ────────── */

export function clearTurnTimer(s: InternalState) {
  if (s.turnTimer) {
    clearTimeout(s.turnTimer);
    s.turnTimer = null;
  }
}

export function startTurnTimer(io: IO, s: InternalState) {
  clearTurnTimer(s);
  s.turnStartedAt = Date.now();
  if (!s.timeLimitSeconds) return;
  s.turnTimer = scheduleTurnExpiry(io, s, 'turnTimer', () => s.currentPlayerId, () => handleTurnTimeout(io, s), s.timeLimitSeconds * 1000);
}

function handleTurnTimeout(io: IO, s: InternalState) {
  if (s.gameOver || s.phase !== 'turn') return;
  const actor = getPlayer(s, s.currentPlayerId);
  if (!actor) return;

  s.consecutiveTimeouts[actor.id] = (s.consecutiveTimeouts[actor.id] ?? 0) + 1;

  if (s.consecutiveTimeouts[actor.id] >= TIMEOUT_LIMIT) {
    const opponent = getOpponent(s, actor.id);
    finishByTimeout(io, s, actor, opponent);
    return;
  }

  s.lastAutoActedBy = actor.id;
  const auto = pickAutoStackTower(s);
  applyAction(io, s, actor, auto);
}

/* ────────── undo ────────── */

function snapshotPlayer(p: FTPlayerInternal): FTPlayerSnapshot {
  return {
    score: p.score,
    myStackedHeights: { ...p.myStackedHeights },
    itemUsed: p.itemUsed,
    itemUsedKind: p.itemUsedKind,
    itemUsedTurn: p.itemUsedTurn,
    itemUsedDetail: p.itemUsedDetail ? { ...p.itemUsedDetail } : null,
  };
}

function restorePlayer(p: FTPlayerInternal, snap: FTPlayerSnapshot) {
  p.score = snap.score;
  p.myStackedHeights = { ...snap.myStackedHeights };
  p.itemUsed = snap.itemUsed;
  p.itemUsedKind = snap.itemUsedKind;
  p.itemUsedTurn = snap.itemUsedTurn;
  p.itemUsedDetail = snap.itemUsedDetail ? { ...snap.itemUsedDetail } : null;
}

function snapshotTower(t: FTTowerInternal): FTTowerSnapshot {
  return {
    height: t.height,
    completed: t.completed,
    completedBy: t.completedBy,
    halfReached: t.halfReached,
    contributions: { ...t.contributions },
  };
}

function restoreTower(t: FTTowerInternal, snap: FTTowerSnapshot) {
  t.height = snap.height;
  t.completed = snap.completed;
  t.completedBy = snap.completedBy;
  t.halfReached = snap.halfReached;
  t.contributions = { ...snap.contributions };
}

function pushUndoSnapshot(s: InternalState) {
  const towers = {} as Record<FTTower, FTTowerSnapshot>;
  for (const id of FT_TOWERS) towers[id] = snapshotTower(s.towers[id]);

  s.undoSnapshots.push({
    turn: s.turn,
    phase: s.phase,
    currentPlayerId: s.currentPlayerId,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    towers,
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as FTActionLogEntry[],
    milestoneLog: JSON.parse(JSON.stringify(s.milestoneLog)) as FTMilestoneEntry[],
    consecutiveTimeouts: { ...s.consecutiveTimeouts },
    player1Info: JSON.parse(JSON.stringify(s.infoResults[s.player1.id] ?? [])) as FTInfoResult[],
    player2Info: JSON.parse(JSON.stringify(s.infoResults[s.player2.id] ?? [])) as FTInfoResult[],
    player1Secret: JSON.parse(JSON.stringify(s.secretLog[s.player1.id] ?? [])) as FTSecretLog[],
    player2Secret: JSON.parse(JSON.stringify(s.secretLog[s.player2.id] ?? [])) as FTSecretLog[],
  });
}

function applyUndoSnapshot(s: InternalState, snap: FTUndoSnapshot) {
  s.turn = snap.turn;
  s.phase = snap.phase;
  s.currentPlayerId = snap.currentPlayerId;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  for (const id of FT_TOWERS) restoreTower(s.towers[id], snap.towers[id]);
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as FTActionLogEntry[];
  s.milestoneLog = JSON.parse(JSON.stringify(snap.milestoneLog)) as FTMilestoneEntry[];
  s.consecutiveTimeouts = { ...snap.consecutiveTimeouts };
  s.infoResults = {
    [s.player1.id]: JSON.parse(JSON.stringify(snap.player1Info)) as FTInfoResult[],
    [s.player2.id]: JSON.parse(JSON.stringify(snap.player2Info)) as FTInfoResult[],
  };
  s.secretLog = {
    [s.player1.id]: JSON.parse(JSON.stringify(snap.player1Secret)) as FTSecretLog[],
    [s.player2.id]: JSON.parse(JSON.stringify(snap.player2Secret)) as FTSecretLog[],
  };
}

export function performFiveTowersUndo(io: IO, roomId: string): boolean {
  const s = gameStates.get(roomId);
  if (!s || s.gameOver) return false;
  if (s.undoSnapshots.length < 2) return false;

  s.aiGeneration++;
  clearTurnTimer(s);

  // COM 모드: 직전이 COM 차례였다면 한 번 더 되돌림 (사용자 차례 회복)
  const popOnce = () => {
    s.undoSnapshots.pop();
    applyUndoSnapshot(s, s.undoSnapshots[s.undoSnapshots.length - 1]);
  };

  popOnce();

  if (s.playMode === 'com' && s.currentPlayerId !== getHumanId(s)) {
    if (s.undoSnapshots.length >= 2) {
      popOnce();
    }
  }

  startTurnTimer(io, s);
  broadcastState(io, s);
  if (s.playMode === 'com') s.onAITurn?.(io, s);
  return true;
}

function getHumanId(s: InternalState): string {
  // AI_PLAYER_ID 가 아닌 쪽
  const AI = 'COM';
  return s.player1.id === AI ? s.player2.id : s.player1.id;
}

/* ────────── core action handling ────────── */

export function handleAction(io: IO, socket: TypedSocket, s: InternalState, actorId: string, action: FTAction) {
  const actor = getPlayer(s, actorId);
  if (!actor) {
    socket.emit('error', { message: '플레이어가 아닙니다.' });
    return;
  }
  const v = validateAction(s, actor, action);
  if (!v.ok) {
    socket.emit('error', { message: errorMessage(v.reason) });
    return;
  }
  s.consecutiveTimeouts[actor.id] = 0;
  applyAction(io, s, actor, action);
}

function applyAction(io: IO, s: InternalState, actor: FTPlayerInternal, action: FTAction) {
  /*
    정보 아이템은 턴을 소모하지 않는다. 시계도 그대로 흘러야 한다 — 다시 걸면 상대 화면의
    남은 시간이 처음으로 돌아가 '정보를 썼다' 가 드러났다. 갱신도 쓴 사람에게만 보낸다.
  */
  const consumesTurn = !(action.type === 'item' && action.item === 'info');
  if (consumesTurn) clearTurnTimer(s);

  if (action.type === 'stack') {
    applyStack(s, actor, action.tower, action.count);
  } else if (action.type === 'item') {
    if (action.item === 'info') {
      applyInfo(s, actor, action.targets);
    } else if (action.item === 'zero') {
      applyZero(s, actor, action.target);
    } else if (action.item === 'secret') {
      applySecret(s, actor, action.target, action.count);
    }
  }

  // 마일스톤/완성 처리
  processMilestones(s);

  // 게임 종료 체크
  if (checkGameOver(s)) {
    clearTurnTimer(s);
    finalize(io, s);
    return;
  }

  if (consumesTurn) {
    advanceTurn(s);
  }
  pushUndoSnapshot(s);
  if (consumesTurn) {
    startTurnTimer(io, s);
    broadcastState(io, s);
  } else {
    broadcastState(io, s, actor.id);
  }

  if (s.playMode === 'com') s.onAITurn?.(io, s);
}

function applyStack(
  s: InternalState,
  actor: FTPlayerInternal,
  towerId: import('@shared/types/five-towers.js').FTTower,
  count: FTStackCount,
) {
  const tower = s.towers[towerId];
  const room = FT_TOWER_MAX_HEIGHT - tower.height;
  const actual = Math.min(count, room) as FTStackCount;
  tower.height += actual;
  tower.contributions[actor.id] = (tower.contributions[actor.id] ?? 0) + actual;
  actor.myStackedHeights[towerId] = (actor.myStackedHeights[towerId] ?? 0) + actual;

  s.actionLog.push({
    turn: s.turn,
    actorId: actor.id,
    actorNickname: actor.nickname,
    kind: 'stack-public',
    tower: towerId,
    count: actual,
  });
}

function applyInfo(
  s: InternalState,
  actor: FTPlayerInternal,
  targets: [import('@shared/types/five-towers.js').FTTower, import('@shared/types/five-towers.js').FTTower],
) {
  const sum = s.towers[targets[0]].height + s.towers[targets[1]].height;
  actor.itemUsed = true;
  actor.itemUsedKind = 'info';
  actor.itemUsedTurn = s.turn;
  actor.itemUsedDetail = { item: 'info', targets, sum };

  if (!s.infoResults[actor.id]) s.infoResults[actor.id] = [];
  s.infoResults[actor.id].push({ turn: s.turn, targets, sumAtTime: sum });

  // 정보 사용은 actionLog에 기록하되, 본인 시점에서만 보임 (kind: 'info-self').
  // 다른 시점에서는 buildSpectatorGameData / maskLogEntryFor 에서 필터됨.
  s.actionLog.push({
    turn: s.turn,
    actorId: actor.id,
    actorNickname: actor.nickname,
    kind: 'info-self',
    targets,
    sum,
  });
}

function applyZero(
  s: InternalState,
  actor: FTPlayerInternal,
  target: import('@shared/types/five-towers.js').FTTower,
) {
  actor.itemUsed = true;
  actor.itemUsedKind = 'zero';
  actor.itemUsedTurn = s.turn;
  actor.itemUsedDetail = { item: 'zero', target };

  // 본인 로그용 zero-self 기록
  s.actionLog.push({
    turn: s.turn,
    actorId: actor.id,
    actorNickname: actor.nickname,
    kind: 'zero-self',
    tower: target,
    count: 0,
  });

  // 상대에겐 일반 stack-public 으로 보이도록 stack-public 도 별도로 push
  // → 단, 본인 시점에선 둘 다 보이지 않게 하려면 zero-self 만 push하고, 마스킹 시
  //   상대 시점에서 zero-self → stack-public 으로 변환. 여기서는 후자 전략 사용:
  //   이미 zero-self 로 push 됨. 상대 시점은 maskLogEntryFor 에서 변환 처리.
}

function applySecret(
  s: InternalState,
  actor: FTPlayerInternal,
  target: import('@shared/types/five-towers.js').FTTower,
  count: FTStackCount,
) {
  const tower = s.towers[target];
  const room = FT_TOWER_MAX_HEIGHT - tower.height;
  const actual = Math.min(count, room) as FTStackCount;
  tower.height += actual;
  tower.contributions[actor.id] = (tower.contributions[actor.id] ?? 0) + actual;
  actor.myStackedHeights[target] = (actor.myStackedHeights[target] ?? 0) + actual;

  actor.itemUsed = true;
  actor.itemUsedKind = 'secret';
  actor.itemUsedTurn = s.turn;
  actor.itemUsedDetail = { item: 'secret', target, count: actual };

  if (!s.secretLog[actor.id]) s.secretLog[actor.id] = [];
  s.secretLog[actor.id].push({ turn: s.turn, target, count: actual, revealed: false });

  // 본인은 풀 정보, 상대/관전자는 마스킹된 형태로 보게 됨 (buildActionLogFor 에서 처리).
  s.actionLog.push({
    turn: s.turn,
    actorId: actor.id,
    actorNickname: actor.nickname,
    kind: 'secret-hidden',
    tower: target,
    count: actual,
  });
}

function processMilestones(s: InternalState) {
  // 마지막 액션의 actor / 대상 파악
  const last = s.actionLog[s.actionLog.length - 1];
  if (!last) return;

  // 정보/제로는 칸 변동 없음
  if (last.kind === 'info-self') return;

  // 어떤 탑이 변경됐는지 — stack-public, zero-self, secret-hidden
  let towerId: import('@shared/types/five-towers.js').FTTower | null = null;

  if (last.kind === 'stack-public' && last.tower) towerId = last.tower;
  else if (last.kind === 'zero-self') towerId = null; // 변동 없음
  else if (last.kind === 'secret-hidden' && last.tower) towerId = last.tower;

  if (!towerId) return;
  const tower = s.towers[towerId];
  const actor = getPlayer(s, last.actorId);
  if (!actor) return;

  // 6칸 마일스톤 (한 번만)
  if (!tower.halfReached && tower.height >= FT_HALF_MILESTONE && tower.height < FT_TOWER_MAX_HEIGHT) {
    tower.halfReached = true;
    s.milestoneLog.push({
      turn: s.turn,
      tower: towerId,
      kind: 'half',
      actorId: actor.id,
      actorNickname: actor.nickname,
    });
    // 시크릿이었다면 공개 처리
    if (last.kind === 'secret-hidden') revealLastSecret(s, last, towerId, 'half');
    else last.milestone = 'half';
  }

  // 11칸 완성
  if (!tower.completed && tower.height >= FT_TOWER_MAX_HEIGHT) {
    tower.completed = true;
    tower.completedBy = actor.id;
    actor.score += 1;

    s.milestoneLog.push({
      turn: s.turn,
      tower: towerId,
      kind: 'complete',
      actorId: actor.id,
      actorNickname: actor.nickname,
      scoreChange: 1,
    });
    if (last.kind === 'secret-hidden') revealLastSecret(s, last, towerId, 'complete');
    else {
      last.milestone = 'complete';
      last.scoreChange = 1;
    }
  }
}

function revealLastSecret(
  s: InternalState,
  entry: FTActionLogEntry,
  towerId: import('@shared/types/five-towers.js').FTTower,
  milestone: 'half' | 'complete',
) {
  entry.kind = 'secret-revealed';
  entry.tower = towerId;
  entry.milestone = milestone;
  if (milestone === 'complete') entry.scoreChange = 1;
  // 본인 secretLog 의 마지막 항목 revealed 갱신
  const actor = getPlayer(s, entry.actorId);
  if (actor) {
    const log = s.secretLog[actor.id];
    if (log && log.length > 0) log[log.length - 1].revealed = true;
  }
}

function advanceTurn(s: InternalState) {
  s.currentPlayerId = s.currentPlayerId === s.player1.id ? s.player2.id : s.player1.id;
  s.turn += 1;
}

function checkGameOver(s: InternalState): boolean {
  return s.player1.score >= FT_MAX_SCORE || s.player2.score >= FT_MAX_SCORE;
}

/* ────────── finalize / endgame ────────── */

function buildArchive(s: InternalState): FiveTowersArchiveRecord {
  const finalTowers = {} as Record<import('@shared/types/five-towers.js').FTTower, FiveTowersTowerRecord>;
  for (const id of FT_TOWERS) {
    const t = s.towers[id];
    finalTowers[id] = {
      finalHeight: t.height,
      completedBy: t.completedBy,
      contributions: { ...t.contributions },
    };
  }

  const itemsUsed: Record<string, FiveTowersItemUsage> = {};
  for (const p of [s.player1, s.player2]) {
    if (!p.itemUsed || !p.itemUsedKind || p.itemUsedTurn == null || !p.itemUsedDetail) continue;
    const detail: FiveTowersItemUsage['detail'] = {};
    if (p.itemUsedDetail.item === 'info') {
      detail.targets = p.itemUsedDetail.targets;
      detail.sum = p.itemUsedDetail.sum;
    } else if (p.itemUsedDetail.item === 'zero') {
      detail.tower = p.itemUsedDetail.target;
      detail.count = 0;
    } else {
      detail.tower = p.itemUsedDetail.target;
      detail.count = p.itemUsedDetail.count;
    }
    itemsUsed[p.id] = {
      item: p.itemUsedKind,
      turn: p.itemUsedTurn,
      detail,
    };
  }

  // 액션 로그를 아카이브 액션으로 — 풀 정보 보유 (게임 종료 후이므로 모두 공개)
  const actions: FiveTowersActionRecord[] = s.actionLog.map((e) => {
    const base: FiveTowersActionRecord = {
      turn: e.turn,
      actorId: e.actorId,
      actorNickname: e.actorNickname,
      kind: 'stack',
    };
    if (e.kind === 'stack-public') {
      base.kind = 'stack';
      base.tower = e.tower;
      base.count = e.count;
    } else if (e.kind === 'secret-hidden' || e.kind === 'secret-revealed') {
      base.kind = 'item-secret';
      // tower / count 는 actor 의 itemUsedDetail 에서 보충 (이미 풀려있으면 entry 자체에 있음)
      const actor = getPlayer(s, e.actorId);
      if (actor?.itemUsedDetail?.item === 'secret') {
        base.tower = actor.itemUsedDetail.target;
        base.count = actor.itemUsedDetail.count;
      } else {
        base.tower = e.tower;
        base.count = e.count;
      }
    } else if (e.kind === 'zero-self') {
      base.kind = 'item-zero';
      base.tower = e.tower;
      base.count = 0;
    } else if (e.kind === 'info-self') {
      base.kind = 'item-info';
      base.targets = e.targets;
      base.sum = e.sum;
    }
    if (e.milestone) base.milestone = e.milestone;
    if (e.scoreChange) base.scoreChange = e.scoreChange;
    return base;
  });

  const milestones: FiveTowersMilestoneRecord[] = s.milestoneLog.map((m) => ({
    turn: m.turn,
    tower: m.tower,
    kind: m.kind,
    actorId: m.actorId,
    actorNickname: m.actorNickname,
  }));

  return {
    winType: s.winType,
    winnerId: s.winner,
    finalScores: { [s.player1.id]: s.player1.score, [s.player2.id]: s.player2.score },
    totalTurns: s.turn,
    finishReason: s.finishReason,
    finalTowers,
    itemsUsed,
    actions,
    milestones,
    players: {
      [s.player1.id]: { nickname: s.player1.nickname },
      [s.player2.id]: { nickname: s.player2.nickname },
    },
  };
}

function finalize(io: IO, s: InternalState) {
  // 승자 결정
  let winner: FTPlayerInternal | null = null;
  if (s.player1.score > s.player2.score) winner = s.player1;
  else if (s.player2.score > s.player1.score) winner = s.player2;

  s.winner = winner?.id ?? null;
  s.winType = s.winType ?? 'score';
  s.gameOver = true;
  s.phase = 'finished';

  void broadcastState(io, s);

  const p1 = s.player1;
  const p2 = s.player2;
  const rankings = winner
    ? [
        { playerId: winner.id, nickname: winner.nickname, rank: 1, score: winner.score },
        { playerId: winner.id === p1.id ? p2.id : p1.id, nickname: winner.id === p1.id ? p2.nickname : p1.nickname, rank: 2, score: winner.id === p1.id ? p2.score : p1.score },
      ]
    : [
        { playerId: p1.id, nickname: p1.nickname, rank: 1, score: p1.score },
        { playerId: p2.id, nickname: p2.nickname, rank: 1, score: p2.score },
      ];

  const archive = buildArchive(s);

  setTimeout(() => {
    s.endGameCallback(io, s.roomId, {
      rankings,
      totalTurns: s.turn,
      gameResultData: archive,
    });
  }, WIN_DISPLAY_MS);
}

function finishByTimeout(
  io: IO,
  s: InternalState,
  loser: FTPlayerInternal,
  winner: FTPlayerInternal | null,
) {
  s.winType = 'timeout';
  s.finishReason = `${loser.nickname} 님이 연속 ${TIMEOUT_LIMIT}회 시간 초과로 패배했습니다.`;
  if (winner) {
    // 승자 점수를 무조건 우위로 만듦
    if (winner.score <= loser.score) winner.score = loser.score + 1;
  }
  finalize(io, s);
}

export function handleFiveTowersLeave(io: IO, s: InternalState, leftPlayerId: string) {
  if (s.gameOver) return;
  const leaver = getPlayer(s, leftPlayerId);
  const opponent = getOpponent(s, leftPlayerId);
  if (!leaver || !opponent) return;

  s.winType = 'leave';
  s.finishReason = `${leaver.nickname} 님이 게임을 떠났습니다.`;
  // 승점 우위 보장
  if (opponent.score <= leaver.score) opponent.score = leaver.score + 1;
  finalize(io, s);
}

export function getFiveTowersResultData(roomId: string): unknown {
  const s = gameStates.get(roomId);
  if (!s) return undefined;
  return buildArchive(s);
}

/* ────────── re-exports for index ────────── */

export { applyAction as _internalApplyAction };
