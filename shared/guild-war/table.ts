import {
  bestCombo,
  buildDeck,
  comboScore,
  isFourOfAKind,
  isValidCombo,
  requiredBellRank,
  assignRanks,
  worstCombo,
} from './combo';
import {
  ANTE,
  BELL_FAIL,
  COUNTDOWN_MS,
  COMBO_MS,
  RTB_MAX_PER_GUILD,
  RTB_MAX_SEATS,
  RTB_MIN_PLAYERS,
  TURN_MS,
  type ApplyResult,
  type RtbAction,
  type RtbCard,
  type RtbGuild,
  type RtbKickReason,
  type RtbPlayer,
  type RtbState,
  type SettleLine,
  type SettleResult,
} from './types';

function clone(state: RtbState): RtbState {
  return structuredClone(state);
}

function nick(state: RtbState, id: string): string {
  return state.roster.find((p) => p.id === id)?.nickname ?? id;
}

function pushLog(state: RtbState, line: string) {
  state.log = [...state.log.slice(-36), line];
}

/** 로비로 내보낼 좌석을 적어 둔다. 실제 강퇴는 매니저가 한다 (§13.4). */
function markKick(state: RtbState, playerId: string, reason: RtbKickReason) {
  if (state.pendingKick.some((k) => k.playerId === playerId)) return;
  state.pendingKick = [...state.pendingKick, { playerId, reason }];
}

function player(state: RtbState, id: string): RtbPlayer | undefined {
  return state.players.find((p) => p.id === id) ?? state.roster.find((p) => p.id === id);
}

function guildOf(state: RtbState, playerId: string): RtbGuild | undefined {
  const p = player(state, playerId);
  return p ? state.guilds[p.guildId] : undefined;
}

export function available(state: RtbState, playerId: string): number {
  const g = guildOf(state, playerId);
  if (!g) return 0;
  return Math.max(0, g.snapshot - g.spent);
}

function spend(state: RtbState, playerId: string, amount: number) {
  const p = player(state, playerId);
  if (!p) return;
  const g = state.guilds[p.guildId];
  if (!g) return;
  g.spent += amount;
  state.pot += amount;
}

function canPickCard(state: RtbState): boolean {
  return state.deck.length > 0 || state.face != null;
}

function aliveIds(state: RtbState): string[] {
  return state.players.filter((p) => state.alive[p.id]).map((p) => p.id);
}

function pickFirst(roster: RtbPlayer[], nextFirstId: string | null): string {
  if (nextFirstId && roster.some((p) => p.id === nextFirstId)) return nextFirstId;
  return roster[Math.floor(Math.random() * roster.length)]!.id;
}

/** 선은 1번, 나머지는 매 세트 셔플 (§8.5). */
function orderSeats(list: RtbPlayer[], firstId: string): RtbPlayer[] {
  const first = list.find((p) => p.id === firstId) ?? null;
  const rest = list.filter((p) => p.id !== firstId);
  for (let i = rest.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = rest[i]!;
    rest[i] = rest[j]!;
    rest[j] = t;
  }
  return first ? [first, ...rest] : rest;
}

/** 공동 1등이면 그 세트에서 자리 번호가 빠른 사람. */
function earliestSeated(state: RtbState, ids: string[]): string | null {
  if (ids.length === 0) return null;
  const want = new Set(ids);
  const seated = state.players.find((p) => want.has(p.id));
  return seated?.id ?? ids[0] ?? null;
}

function nextFirstFromSettle(state: RtbState, settle: SettleResult): string | null {
  if (settle.kind === 'bell_success') {
    return settle.winners[0]?.playerId ?? state.bellId;
  }
  return earliestSeated(
    state,
    settle.winners.map((w) => w.playerId),
  );
}

function credit(state: RtbState, guildId: string, amount: number) {
  const g = state.guilds[guildId];
  if (!g) return;
  g.balance += amount;
}

function commitSpent(state: RtbState) {
  for (const g of Object.values(state.guilds)) {
    g.balance = Math.max(0, g.snapshot - g.spent);
    g.spent = 0;
    g.snapshot = g.balance;
  }
}

function beginCombo(state: RtbState) {
  state.phase = 'combo';
  state.currentId = null;
  state.turnEndsAt = null;
  state.comboEndsAt = Date.now() + COMBO_MS;
  state.combo = {};
  state.comboTimedOut = {};
  pushLog(state, '조합을 고르세요');
  // 벨 이후 이미 내린 사람은 1분을 기다리게 두지 않는다 (§10.5·GW-44).
  submitComboForAbsentees(state);
}

function finishSet(state: RtbState, settle: SettleResult) {
  const potBefore = state.pot;
  const before: Record<string, number> = {};
  for (const [id, g] of Object.entries(state.guilds)) before[id] = g.snapshot;
  commitSpent(state);
  if (settle.kind !== 'extinct') {
    for (const w of settle.winners) credit(state, w.guildId, w.amount);
  }
  for (const g of Object.values(state.guilds)) {
    g.snapshot = g.balance;
    g.spent = 0;
  }
  const deltas: Record<string, number> = {};
  for (const [id, g] of Object.entries(state.guilds)) {
    const d = g.balance - (before[id] ?? g.balance);
    if (d !== 0) deltas[id] = d;
  }
  state.pot = 0;
  settle.potBefore = potBefore;
  settle.guildDeltas = deltas;
  state.settle = settle;
  state.currentId = null;
  state.turnEndsAt = null;
  state.comboEndsAt = null;
  state.nextFirstId = nextFirstFromSettle(state, settle);
  pushLog(state, settle.note);
  beginNextSetWait(state);
}

/**
 * 세트 사이 대기. 결과는 어느 쪽이든 15초 보여 준다 (§8.5).
 * - 다음 세트 인원이 되면 `countdown` → 만료 시 새 세트
 * - 모자라면 `settle` → 만료 시 `idle`
 * - 보여 줄 결과가 없으면 곧장 `idle`
 */
function beginNextSetWait(state: RtbState) {
  const seated = state.roster.filter((p) => (state.guilds[p.guildId]?.balance ?? 0) >= 1);
  if (seated.length >= RTB_MIN_PLAYERS) {
    state.phase = 'countdown';
    state.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    return;
  }
  // 이미 대기로 내려온 뒤라면 지난 세트 결과를 다시 띄우지 않는다.
  if (state.settle && state.phase !== 'idle') {
    state.phase = 'settle';
    state.countdownEndsAt = Date.now() + COUNTDOWN_MS;
    pushLog(state, '다음 세트 인원 부족.');
    return;
  }
  state.phase = 'idle';
  state.countdownEndsAt = null;
}

function lastAliveSettle(state: RtbState, winnerId: string) {
  const p = player(state, winnerId)!;
  finishSet(state, {
    kind: 'last_alive',
    potBefore: state.pot,
    winners: [{ playerId: winnerId, guildId: p.guildId, amount: state.pot }],
    vanished: 0,
    lines: settleLines(state, { [winnerId]: 1 }, null),
    note: `${p.nickname} 만 남아 팟 ${state.pot}를 가져갑니다.`,
    guildDeltas: {},
  });
}

function extinctSettle(state: RtbState) {
  const gone = state.pot;
  finishSet(state, {
    kind: 'extinct',
    potBefore: gone,
    winners: [],
    vanished: gone,
    lines: settleLines(state, {}, null),
    note: '받을 사람이 없어 팟이 소멸했습니다.',
    guildDeltas: {},
  });
}

function fourSettle(state: RtbState, winnerId: string) {
  const p = player(state, winnerId)!;
  finishSet(state, {
    kind: 'four',
    potBefore: state.pot,
    winners: [{ playerId: winnerId, guildId: p.guildId, amount: state.pot }],
    vanished: 0,
    lines: settleLines(state, { [winnerId]: 1 }, null),
    note: `${p.nickname} 포카드. 팟 ${state.pot} 전부.`,
    guildDeltas: {},
  });
}

function settleLines(
  state: RtbState,
  ranks: Record<string, number>,
  bellId: string | null,
): SettleLine[] {
  return state.players.map((p) => {
    const combo = state.combo[p.id] ?? null;
    const timedOut = Boolean(state.comboTimedOut[p.id]);
    const died = !state.alive[p.id];
    return {
      playerId: p.id,
      nickname: p.nickname,
      guildName: p.guildName,
      guildMarkUrl: p.guildMarkUrl,
      combo: died ? null : combo,
      score: combo && !timedOut ? comboScore(combo) : null,
      rank: ranks[p.id] ?? null,
      timedOut,
      died,
      isBell: bellId === p.id,
    };
  });
}

function splitFirst(
  state: RtbState,
  firstIds: string[],
): { winners: SettleResult['winners']; vanished: number } {
  const n = firstIds.length;
  const share = Math.floor(state.pot / n);
  const vanished = state.pot - share * n;
  const winners = firstIds.map((id) => {
    const p = player(state, id)!;
    return { playerId: id, guildId: p.guildId, amount: share };
  });
  return { winners, vanished };
}

function comparisonRows(state: RtbState): { id: string; score: number }[] {
  return aliveIds(state)
    .filter((id) => state.combo[id] && !state.comboTimedOut[id])
    .map((id) => ({ id, score: comboScore(state.combo[id]!) }));
}

function settleFirstOf(state: RtbState, rows: { id: string; score: number }[], bellId: string | null) {
  const ranks = assignRanks(rows, null);
  const firstIds = rows.filter((r) => ranks[r.id] === 1).map((r) => r.id);
  const split = splitFirst(state, firstIds);
  return { ranks, firstIds, split, bellId };
}

function settleShowdown(state: RtbState) {
  const bellId = state.bellId;
  const rows = comparisonRows(state);
  /** 벨을 울리고 아직 살아 있는가. 죽었으면 벌칙도 우대도 없다. */
  const bellLive = bellId != null && state.alive[bellId] === true;
  /** 벨이 조합까지 냈는가. 안 냈으면 순위를 못 매기니 자동 실패다 (§10.9). */
  const bellRanked = bellLive && rows.some((r) => r.id === bellId);

  if (rows.length === 0) {
    // 아무도 조합을 못 냈다. 벨이 살아 있으면 실패이므로 벌칙은 걷는다.
    if (bellLive) spend(state, bellId!, BELL_FAIL);
    extinctSettle(state);
    return;
  }
  if (rows.length === 1 && !bellLive) {
    lastAliveSettle(state, rows[0]!.id);
    return;
  }

  if (bellRanked) {
    const ranks = assignRanks(rows, bellId);
    // N = 다이만 뺀 생존. 조합 타임아웃은 패배이지 다이가 아니라 여기 들어간다 (§10.7).
    const n = aliveIds(state).length;
    const bellRank = ranks[bellId!]!;
    const need = requiredBellRank(n);
    const p = player(state, bellId!)!;
    if (bellRank <= need) {
      finishSet(state, {
        kind: 'bell_success',
        potBefore: state.pot,
        winners: [{ playerId: bellId!, guildId: p.guildId, amount: state.pot }],
        vanished: 0,
        lines: settleLines(state, ranks, bellId),
        note: `${p.nickname} 벨 성공 (${bellRank}등 / ${n}명, ${need}등 이내). 팟 ${state.pot}.`,
        guildDeltas: {},
      });
      return;
    }
    spend(state, bellId!, BELL_FAIL);
    const firstIds = rows.filter((r) => ranks[r.id] === 1).map((r) => r.id);
    const split = splitFirst(state, firstIds);
    finishSet(state, {
      kind: 'bell_fail',
      potBefore: state.pot,
      winners: split.winners,
      vanished: split.vanished,
      lines: settleLines(state, ranks, bellId),
      note: `${p.nickname} 벨 실패 (${bellRank}등). +${BELL_FAIL} 후 1등에게.`,
      guildDeltas: {},
    });
    return;
  }

  if (bellLive) {
    // 벨을 울려 놓고 조합을 안 냈다. 벌칙을 걷지 않으면 「지겠으면 안 낸다」로 회피된다.
    spend(state, bellId!, BELL_FAIL);
    const { ranks, split } = settleFirstOf(state, rows, bellId);
    finishSet(state, {
      kind: 'bell_fail',
      potBefore: state.pot,
      winners: split.winners,
      vanished: split.vanished,
      lines: settleLines(state, ranks, bellId),
      note: `${nick(state, bellId!)} 조합 미제출 · 벨 실패. +${BELL_FAIL} 후 1등에게.`,
      guildDeltas: {},
    });
    return;
  }

  const { ranks, firstIds, split } = settleFirstOf(state, rows, null);
  finishSet(state, {
    kind: 'first',
    potBefore: state.pot,
    winners: split.winners,
    vanished: split.vanished,
    lines: settleLines(state, ranks, null),
    note:
      split.winners.length > 1
        ? `공동 1등 ${split.winners.length}명. 각 ${split.winners[0]?.amount ?? 0}, ${split.vanished} 소멸.`
        : `${nick(state, firstIds[0]!)} 1등. 팟 ${split.winners[0]?.amount ?? 0}.`,
    guildDeltas: {},
  });
}

/**
 * 버리기 단계에서 죽을 때 손패 정리 (GW-44).
 * 5장 중 랜덤 1장을 버려 새 앞면으로 만든다. 그냥 버리면 앞면 슬롯이 비어
 * 「앞면은 항상 공개 1장」(§9.1)이 깨진다.
 */
function dumpRandomOnDeath(state: RtbState, id: string) {
  const hand = state.hands[id] ?? [];
  if (hand.length <= 4) return;
  const dumped = hand[Math.floor(Math.random() * hand.length)]!;
  state.hands[id] = hand.filter((c) => c.id !== dumped.id);
  state.face = dumped;
  pushLog(state, `${nick(state, id)} 이탈 · 손패 한 장이 앞면으로`);
}

function randomDiscardOne(state: RtbState, id: string) {
  const hand = state.hands[id] ?? [];
  if (hand.length !== 5) return;
  const dumped = hand[Math.floor(Math.random() * hand.length)]!;
  state.hands[id] = hand.filter((c) => c.id !== dumped.id);
  state.face = dumped;
}

/** 벨 이후 마지막 교환을 랜덤으로 끝낸다. 다이하지 않는다. */
function forceLastSwap(state: RtbState, id: string) {
  const hand = state.hands[id] ?? [];
  if (hand.length >= 5) {
    randomDiscardOne(state, id);
    pushLog(state, `${nick(state, id)} 랜덤 교환`);
    return;
  }
  if (!canPickCard(state)) {
    pushLog(state, `${nick(state, id)} 집을 카드가 없어 건너뜀`);
    return;
  }
  const canDeck = state.deck.length > 0;
  const canFace = state.face != null;
  const takeFace = canFace && (!canDeck || Math.random() < 0.5);
  if (takeFace) {
    const taken = state.face!;
    state.face = null;
    state.hands[id] = [...hand, taken];
  } else {
    const taken = state.deck.shift();
    if (!taken) return;
    state.hands[id] = [...hand, taken];
  }
  randomDiscardOne(state, id);
  pushLog(state, `${nick(state, id)} 랜덤 교환`);
}

function finishForcedLastSwap(state: RtbState, id: string) {
  forceLastSwap(state, id);
  const wasCurrent = state.currentId === id;
  state.lastSwapQueue = state.lastSwapQueue.filter((x) => x !== id);
  if (wasCurrent) startNextLastSwap(state);
}

function forceWorstCombo(state: RtbState, id: string) {
  if (state.combo[id] || state.comboTimedOut[id]) return;
  const pick = worstCombo(state.hands[id] ?? []);
  if (pick.length === 0) {
    state.comboTimedOut[id] = true;
    return;
  }
  state.combo[id] = pick;
  pushLog(state, `${nick(state, id)} 최저 조합 제출`);
}

function lastSwapPending(state: RtbState, id: string): boolean {
  if (state.lastSwapQueue.includes(id)) return true;
  if (state.currentId !== id || !state.bellId) return false;
  return state.phase === 'last_swap' || state.phase === 'pick_source' || state.phase === 'discard';
}

function onRoster(state: RtbState, id: string): boolean {
  return state.roster.some((p) => p.id === id);
}

/** 벨 이후 명단에서 내린 생존자. 조합이 열리면 최저를 넣는다. */
function submitComboForAbsentees(state: RtbState) {
  if (state.phase !== 'combo' || !state.bellId) return;
  for (const id of aliveIds(state)) {
    if (!onRoster(state, id)) forceWorstCombo(state, id);
  }
  maybeComboDone(state);
}

/** 벨 이후 타임아웃·퇴장: 다이 대신 강제 플레이. */
function forcePlayAfterBell(state: RtbState, id: string) {
  if (!state.bellId || state.alive[id] !== true) return;
  if (lastSwapPending(state, id)) finishForcedLastSwap(state, id);
  if (state.phase === 'combo') {
    forceWorstCombo(state, id);
    maybeComboDone(state);
  }
}

function afterDie(state: RtbState, diedId: string) {
  state.alive[diedId] = false;
  state.lastSwapQueue = state.lastSwapQueue.filter((id) => id !== diedId && state.alive[id]);
  const left = aliveIds(state);
  if (left.length === 0) {
    extinctSettle(state);
    return;
  }
  if (left.length === 1) {
    lastAliveSettle(state, left[0]!);
    return;
  }
  if (state.phase === 'last_swap' || state.bellId) {
    advanceLastSwap(state, diedId);
    return;
  }
  advanceTurn(state, diedId);
}

function advanceTurn(state: RtbState, fromId: string) {
  const ids = state.players.map((p) => p.id);
  const i = Math.max(0, ids.indexOf(fromId));
  for (let k = 1; k <= ids.length; k++) {
    const nid = ids[(i + k) % ids.length]!;
    if (!state.alive[nid]) continue;
    beginTurn(state, nid);
    return;
  }
}

function beginTurn(state: RtbState, id: string) {
  if (!state.bellId && state.deck.length === 0) {
    beginCombo(state);
    return;
  }
  state.currentId = id;
  state.phase = 'turn';
  state.turnEndsAt = Date.now() + TURN_MS;
}

function advanceLastSwap(state: RtbState, doneId: string) {
  state.lastSwapQueue = state.lastSwapQueue.filter((id) => id !== doneId && state.alive[id]);
  startNextLastSwap(state);
}

function startNextLastSwap(state: RtbState) {
  while (state.lastSwapQueue.length > 0) {
    const id = state.lastSwapQueue[0]!;
    if (!state.alive[id]) {
      state.lastSwapQueue.shift();
      continue;
    }
    if (!canPickCard(state)) {
      pushLog(state, `${nick(state, id)} 집을 카드가 없어 건너뜀`);
      state.lastSwapQueue.shift();
      continue;
    }
    state.currentId = id;
    state.phase = 'last_swap';
    state.turnEndsAt = Date.now() + TURN_MS;
    return;
  }
  beginCombo(state);
}

function ringBell(state: RtbState, id: string) {
  state.bellId = id;
  const ids = state.players.map((p) => p.id);
  const i = ids.indexOf(id);
  const order = [...ids.slice(i + 1), ...ids.slice(0, i)].filter((pid) => state.alive[pid]);
  state.lastSwapQueue = order;
  pushLog(state, `${nick(state, id)} 벨`);
  startNextLastSwap(state);
}

function maybeComboDone(state: RtbState) {
  const pending = aliveIds(state).filter((id) => !state.combo[id] && !state.comboTimedOut[id]);
  if (pending.length === 0) settleShowdown(state);
}

function startSet(state: RtbState) {
  const roster = state.roster.filter((p) => {
    const g = state.guilds[p.guildId];
    return g && g.balance >= 1;
  });
  if (roster.length < RTB_MIN_PLAYERS) {
    state.phase = 'idle';
    state.players = [];
    state.currentId = null;
    state.countdownEndsAt = null;
    pushLog(state, '칩 있는 사람이 3명 미만입니다.');
    return;
  }

  const firstId = pickFirst(roster, state.nextFirstId);
  const ordered = orderSeats(roster, firstId);
  for (const g of Object.values(state.guilds)) {
    g.snapshot = g.balance;
    g.spent = 0;
  }
  state.pot = 0;
  const playing: RtbPlayer[] = [];
  for (const p of ordered) {
    const g = state.guilds[p.guildId]!;
    if (g.snapshot - g.spent < ANTE) {
      // 앤티를 못 낸 사람은 로비로 강퇴한다 (GW-22). 좌석은 다음 세트에 대기열로 채운다.
      pushLog(state, `${p.nickname} 앤티 불가 → 강퇴`);
      markKick(state, p.id, 'ante');
      continue;
    }
    g.spent += ANTE;
    state.pot += ANTE;
    playing.push(p);
  }
  if (playing.length < RTB_MIN_PLAYERS) {
    // 세트가 시작하지 않았으므로 걷은 앤티를 전부 되돌리고 대기로 간다.
    for (const g of Object.values(state.guilds)) g.spent = 0;
    state.pot = 0;
    state.phase = 'idle';
    state.players = [];
    state.currentId = null;
    state.countdownEndsAt = null;
    pushLog(state, '앤티 후 3명 미만. 앤티를 돌려주고 대기합니다.');
    return;
  }

  state.setIndex += 1;
  state.players = playing;
  state.firstId = playing[0]!.id;
  state.bellId = null;
  state.lastSwapQueue = [];
  state.settle = null;
  state.combo = {};
  state.comboTimedOut = {};
  state.countdownEndsAt = null;
  state.hands = {};
  state.alive = {};
  for (const p of playing) state.alive[p.id] = true;

  const deck = buildDeck(playing.length);
  for (const p of playing) {
    state.hands[p.id] = [deck.shift()!, deck.shift()!, deck.shift()!, deck.shift()!];
  }
  state.face = deck.shift() ?? null;
  state.deck = deck;
  state.nextFirstId = null;
  pushLog(state, `세트 ${state.setIndex} · 선 ${nick(state, state.firstId)} · 팟 ${state.pot}`);
  beginTurn(state, state.firstId);
}

/** 빈 테이블. 좌석·길드는 매니저가 채운다. */
export function createTable(opts?: { roster?: RtbPlayer[]; guilds?: Record<string, RtbGuild> }): RtbState {
  return {
    setIndex: 0,
    phase: 'idle',
    roster: opts?.roster ?? [],
    players: [],
    guilds: opts?.guilds ?? {},
    pot: 0,
    deck: [],
    face: null,
    hands: {},
    alive: {},
    combo: {},
    comboTimedOut: {},
    currentId: null,
    bellId: null,
    lastSwapQueue: [],
    firstId: null,
    nextFirstId: null,
    pendingKick: [],
    turnEndsAt: null,
    comboEndsAt: null,
    countdownEndsAt: null,
    settle: null,
    log: [],
    revealAll: false,
  };
}

/* ────────────── 좌석 (서버 전용 헬퍼) ────────────── */

export function seatedCountForGuild(state: RtbState, guildId: string): number {
  return state.roster.filter((p) => p.guildId === guildId).length;
}

export function canSeat(state: RtbState, guildId: string): boolean {
  if (state.roster.length >= RTB_MAX_SEATS) return false;
  return seatedCountForGuild(state, guildId) < RTB_MAX_PER_GUILD;
}

/**
 * 테이블 8칸. 대기(`idle`)는 다음 세트 명단.
 * 세트·정산 중에는 이번 세트 순서, 나간 칸은 비우고, 다음 세트 합류자를 빈칸에 넣는다.
 */
export function displaySeats(state: RtbState): Array<RtbPlayer | null> {
  const pad = (list: Array<RtbPlayer | null>): Array<RtbPlayer | null> =>
    Array.from({ length: RTB_MAX_SEATS }, (_, i) => list[i] ?? null);

  if (state.phase === 'idle' || state.players.length === 0) {
    return pad(state.roster);
  }

  const extras = state.roster.filter((p) => !state.players.some((x) => x.id === p.id));
  const shown = state.players.map((p) => (state.roster.some((r) => r.id === p.id) ? p : null));
  const seats = pad(shown);
  let ei = 0;
  for (let i = 0; i < seats.length && ei < extras.length; i++) {
    if (seats[i] == null) seats[i] = extras[ei++];
  }
  return seats;
}

/** 좌석 추가. 다음 세트부터 참여한다. 이미 앉아 있으면 그대로. */
export function seatPlayer(state: RtbState, p: RtbPlayer, balance: number): RtbState {
  const s = clone(state);
  if (s.roster.some((x) => x.id === p.id)) return s;
  if (!canSeat(s, p.guildId)) return s;
  s.roster = [...s.roster, p];
  const g = s.guilds[p.guildId];
  if (g) {
    g.name = p.guildName;
    g.markUrl = p.guildMarkUrl;
  } else {
    s.guilds[p.guildId] = {
      id: p.guildId,
      name: p.guildName,
      markUrl: p.guildMarkUrl,
      balance,
      snapshot: balance,
      spent: 0,
    };
  }
  pushLog(s, `${p.nickname} 착석`);
  return s;
}

/** 세트 진행 중이 아닌 길드 잔액 동기화. 진행 중이면 balance만 바꾸고 스냅샷은 유지. */
export function setGuildBalance(state: RtbState, guildId: string, balance: number): RtbState {
  const s = clone(state);
  const g = s.guilds[guildId];
  if (!g) return s;
  g.balance = balance;
  if (!isSetRunning(s)) {
    g.snapshot = balance;
    g.spent = 0;
  }
  return s;
}

/**
 * 세트가 실제로 굴러가는 중인가. idle·settle·countdown 은 세트 사이다.
 * settle 을 여기 포함시키면 정산 직후 좌석을 빼는 순간 killPlayer 가 한 번 더 돌아
 * 같은 세트를 두 번 정산한다.
 */
export function isSetRunning(state: RtbState): boolean {
  return state.phase !== 'idle' && state.phase !== 'settle' && state.phase !== 'countdown';
}

/** 좌석 해제. 세트 중이면 벨 이전은 다이, 벨 이후는 강제 플레이. */
export function unseatPlayer(state: RtbState, playerId: string): RtbState {
  let s = clone(state);
  const inSet = isSetRunning(s) && s.players.some((p) => p.id === playerId) && s.alive[playerId] === true;
  // 명단을 먼저 비운다. 마지막 교환이 끝나 조합이 열릴 때 최저를 넣을 수 있다.
  s.roster = s.roster.filter((p) => p.id !== playerId);
  if (inSet) s = killPlayer(s, playerId, '퇴장');
  const stillUsed = new Set([...s.roster, ...s.players].map((p) => p.guildId));
  for (const id of Object.keys(s.guilds)) {
    if (!stillUsed.has(id)) delete s.guilds[id];
  }
  return s;
}

/** 자기 차례가 아니어도 처리한다 (퇴장·강퇴·연결 끊김). 벨 이후는 다이가 아니다. */
export function killPlayer(state: RtbState, playerId: string, reason: string): RtbState {
  const s = clone(state);
  // 세트가 끝난 뒤에도 alive 는 그대로 남아 있다. 그때 죽이면 정산이 두 번 돈다.
  if (!isSetRunning(s) || s.alive[playerId] !== true) return s;
  if (s.bellId) {
    pushLog(s, `${nick(s, playerId)} ${reason}`);
    forcePlayAfterBell(s, playerId);
    return s;
  }
  pushLog(s, `${nick(s, playerId)} ${reason} · 다이`);
  if (s.currentId === playerId) {
    dumpRandomOnDeath(s, playerId);
    afterDie(s, playerId);
    return s;
  }
  s.alive[playerId] = false;
  s.lastSwapQueue = s.lastSwapQueue.filter((id) => id !== playerId && s.alive[id]);
  const left = aliveIds(s);
  if (left.length === 0) {
    extinctSettle(s);
    return s;
  }
  if (s.phase === 'combo') {
    maybeComboDone(s);
    return s;
  }
  if (left.length === 1) lastAliveSettle(s, left[0]!);
  return s;
}

/** 세트 정산 후, 잔액 0인 길드의 착석자를 전원 내린다. 반환값에 내려간 id. */
export function dropBrokeGuilds(state: RtbState): { state: RtbState; dropped: string[] } {
  const broke = new Set(
    Object.values(state.guilds)
      .filter((g) => g.balance <= 0)
      .map((g) => g.id),
  );
  if (broke.size === 0) return { state, dropped: [] };
  const dropped = state.roster.filter((p) => broke.has(p.guildId)).map((p) => p.id);
  let s = state;
  for (const id of dropped) s = unseatPlayer(s, id);
  return { state: s, dropped };
}

/** 카운트다운이 끝났거나, 비어 있던 방에 3명이 찼을 때. */
export function startNextSet(state: RtbState): RtbState {
  const s = clone(state);
  startSet(s);
  return s;
}

/** 좌석·잔액이 바뀐 뒤 다음 세트 카운트다운을 다시 잡는다. 세트 중에는 그대로. */
export function rearmCountdown(state: RtbState): RtbState {
  if (isSetRunning(state)) return state;
  const s = clone(state);
  beginNextSetWait(s);
  return s;
}

/**
 * 세트 사이에 명단이 바뀌었을 때 대기/카운트만 맞춘다. 타이머는 리셋하지 않는다.
 * 3이 되는 첫 시작은 매니저의 maybeStart 가 즉시 연다.
 */
export function syncWaitAfterRosterChange(state: RtbState): RtbState {
  if (isSetRunning(state)) return state;
  const s = clone(state);
  const ready = readySeatCount(s);
  if (s.phase === 'idle') return s;
  if (ready >= RTB_MIN_PLAYERS) {
    if (s.phase === 'settle') s.phase = 'countdown';
    return s;
  }
  if (s.phase === 'countdown') {
    if (s.settle) {
      s.phase = 'settle';
      return s;
    }
    s.phase = 'idle';
    s.countdownEndsAt = null;
  }
  return s;
}

/** 엔진이 적어 둔 강퇴 대상을 꺼내고 비운다. 매니저만 부른다 (§13.4). */
export function drainKicks(state: RtbState): { state: RtbState; kicks: RtbState['pendingKick'] } {
  if (state.pendingKick.length === 0) return { state, kicks: [] };
  const s = clone(state);
  const kicks = s.pendingKick;
  s.pendingKick = [];
  return { state: s, kicks };
}

/** 정산 결과 15초 노출이 끝났다. 대기 화면으로 넘긴다. */
export function endSettleDisplay(state: RtbState): RtbState {
  if (state.phase !== 'settle') return state;
  const s = clone(state);
  s.phase = 'idle';
  s.countdownEndsAt = null;
  return s;
}

/** 지금 새 세트를 열 수 있는 착석 인원이 있는가. 칩 1개 이상인 좌석만 센다. */
export function readySeatCount(state: RtbState): number {
  return state.roster.filter((p) => (state.guilds[p.guildId]?.balance ?? 0) >= 1).length;
}

/**
 * 관전자·상대에게 남의 손패·덱 내용·제출한 조합을 숨긴다. 장수만 남김.
 *
 * 조합을 가리는 이유 (§10.5·GW-48): 정산 전에 남의 점수가 보이면 벨을 울린 사람이
 * 실패를 미리 알고 제출을 포기해 벌칙 2칩을 피할 수 있다.
 */
export function maskStateFor(state: RtbState, viewerId: string | null): RtbState {
  const revealing = state.phase === 'settle' || state.phase === 'countdown' || state.revealAll;
  const hands: Record<string, RtbCard[]> = {};
  for (const [id, cards] of Object.entries(state.hands)) {
    if (id === viewerId || revealing) {
      hands[id] = cards;
      continue;
    }
    hands[id] = cards.map((_, i) => ({ id: `hidden-${id}-${i}`, color: 'red', rank: 0 }));
  }
  const combo: Record<string, RtbCard[] | undefined> = {};
  for (const [id, cards] of Object.entries(state.combo)) {
    if (!cards) continue;
    // 제출했다는 사실(배열 존재)만 남기고 내용은 가린다.
    combo[id] =
      id === viewerId || revealing
        ? cards
        : cards.map((_, i) => ({ id: `combo-${id}-${i}`, color: 'red', rank: 0 }));
  }
  return {
    ...state,
    hands,
    combo,
    deck: state.deck.map((_, i) => ({ id: `deck-${i}`, color: 'red' as const, rank: 0 })),
  };
}

export function turnIndex(state: RtbState, playerId: string): number {
  return state.players.findIndex((p) => p.id === playerId);
}

export function actionFlags(state: RtbState, id: string) {
  const isCurrent = state.currentId === id;
  const alive = Boolean(state.alive[id]);
  const avail = available(state, id);
  const turnish = state.phase === 'turn' && isCurrent && alive;
  const last = state.phase === 'last_swap' && isCurrent && alive;
  const picking = state.phase === 'pick_source' && isCurrent && alive;
  const tablePick = turnish || last || picking;
  const turnCanTake = turnish && avail >= 1 && state.deck.length > 0;
  const lastCanTake = last && canPickCard(state);
  const pickCanTake = picking;
  return {
    isCurrent,
    alive,
    avail,
    canSwap: turnCanTake || lastCanTake,
    canDie: turnish,
    canBell: turnish && avail >= BELL_FAIL,
    canPickDeck:
      (turnCanTake && state.deck.length > 0) ||
      (lastCanTake && state.deck.length > 0) ||
      (pickCanTake && state.deck.length > 0),
    canPickFace:
      (turnCanTake && state.face != null) ||
      (lastCanTake && state.face != null) ||
      (pickCanTake && state.face != null),
    canDiscard: state.phase === 'discard' && isCurrent,
    canFour: state.phase === 'four_choice' && isCurrent && isFourOfAKind(state.hands[id] ?? []),
    tablePick,
    comboOpen:
      state.phase === 'combo' && alive && !state.combo[id] && !state.comboTimedOut[id],
  };
}

export function apply(state: RtbState, actorId: string, action: RtbAction): ApplyResult {
  const s = clone(state);

  if (action.type === 'toggle_reveal') {
    s.revealAll = !s.revealAll;
    return { ok: true, state: s };
  }

  if (action.type === 'refill') {
    for (const g of Object.values(s.guilds)) {
      g.balance += action.amount;
      if (s.phase === 'idle' || s.phase === 'countdown' || s.phase === 'settle') {
        g.snapshot = g.balance;
      }
    }
    pushLog(s, `전원 +${action.amount}칩`);
    return { ok: true, state: s };
  }

  if (action.type === 'start_set') {
    if (s.phase !== 'countdown' && s.phase !== 'idle' && s.phase !== 'settle') {
      return { ok: false, error: '지금은 세트를 시작할 수 없습니다.' };
    }
    startSet(s);
    return { ok: true, state: s };
  }

  if (action.type === 'begin_countdown') {
    if (s.phase !== 'settle' && s.phase !== 'countdown') {
      return { ok: false, error: '정산 중이 아닙니다.' };
    }
    beginNextSetWait(s);
    return { ok: true, state: s };
  }

  if (action.type === 'timeout') {
    return applyTimeout(s, actorId);
  }

  if (action.type === 'combo') {
    if (s.phase !== 'combo') return { ok: false, error: '조합 단계가 아닙니다.' };
    if (!s.alive[actorId]) return { ok: false, error: '생존자가 아닙니다.' };
    if (s.combo[actorId] || s.comboTimedOut[actorId]) return { ok: false, error: '이미 제출했습니다.' };
    const hand = s.hands[actorId] ?? [];
    const pick = action.cardIds
      .map((id) => hand.find((c) => c.id === id))
      .filter((c): c is RtbCard => Boolean(c));
    if (pick.length !== action.cardIds.length) return { ok: false, error: '손패에 없는 카드입니다.' };
    if (!isValidCombo(pick)) return { ok: false, error: '같은 숫자 또는 같은 색만 고르세요.' };
    s.combo[actorId] = pick;
    // 점수를 로그에 쓰면 전원에게 방송된다. 정산 전까지는 제출 사실만 알린다 (GW-48).
    pushLog(s, `${nick(s, actorId)} 조합 제출`);
    maybeComboDone(s);
    return { ok: true, state: s };
  }

  const current = s.currentId;
  if (current !== actorId) return { ok: false, error: '당신 차례가 아닙니다.' };
  if (!s.alive[actorId]) return { ok: false, error: '이미 다이했습니다.' };

  if (action.type === 'die') {
    if (s.phase !== 'turn') return { ok: false, error: '지금은 다이할 수 없습니다.' };
    pushLog(s, `${nick(s, actorId)} 다이`);
    afterDie(s, actorId);
    return { ok: true, state: s };
  }

  if (action.type === 'bell') {
    if (s.phase !== 'turn') return { ok: false, error: '지금은 벨을 칠 수 없습니다.' };
    if (available(s, actorId) < BELL_FAIL) {
      return { ok: false, error: `실패 대비 칩 ${BELL_FAIL}개가 필요합니다.` };
    }
    ringBell(s, actorId);
    return { ok: true, state: s };
  }

  if (action.type === 'swap') {
    const last = s.phase === 'last_swap';
    if (s.phase !== 'turn' && !last) return { ok: false, error: '지금은 교환할 수 없습니다.' };
    if (!last) {
      if (s.deck.length === 0) {
        beginCombo(s);
        return { ok: true, state: s };
      }
      if (available(s, actorId) < 1) return { ok: false, error: '칩이 없습니다.' };
      spend(s, actorId, 1);
    } else if (!canPickCard(s)) {
      pushLog(s, `${nick(s, actorId)} 집을 카드가 없어 건너뜀`);
      advanceLastSwap(s, actorId);
      return { ok: true, state: s };
    }
    // turnEndsAt 은 건드리지 않는다. 1분은 그 턴의 모든 행동을 합친 시간이다 (§13.1).
    s.phase = 'pick_source';
    return { ok: true, state: s };
  }

  if (action.type === 'pick') {
    const fromTurn = s.phase === 'turn';
    const fromLast = s.phase === 'last_swap';
    const fromPick = s.phase === 'pick_source';
    if (!fromTurn && !fromLast && !fromPick) {
      return { ok: false, error: '카드를 고를 차례가 아닙니다.' };
    }
    if (fromTurn) {
      if (s.deck.length === 0) {
        beginCombo(s);
        return { ok: true, state: s };
      }
      if (available(s, actorId) < 1) return { ok: false, error: '칩이 없습니다.' };
      if (action.source === 'deck' && s.deck.length === 0) {
        return { ok: false, error: '덱이 없습니다.' };
      }
      if (action.source === 'face' && s.face == null) {
        return { ok: false, error: '앞면이 없습니다.' };
      }
      spend(s, actorId, 1);
    }
    if (fromLast && !canPickCard(s)) {
      pushLog(s, `${nick(s, actorId)} 집을 카드가 없어 건너뜀`);
      advanceLastSwap(s, actorId);
      return { ok: true, state: s };
    }
    let taken: RtbCard | null = null;
    if (action.source === 'deck') {
      taken = s.deck.shift() ?? null;
      if (!taken) return { ok: false, error: '덱이 없습니다.' };
      pushLog(s, `${nick(s, actorId)} 덱`);
    } else {
      taken = s.face;
      s.face = null;
      if (!taken) return { ok: false, error: '앞면이 없습니다.' };
      pushLog(s, `${nick(s, actorId)} 앞면`);
    }
    s.hands[actorId] = [...(s.hands[actorId] ?? []), taken];
    s.phase = 'discard';
    return { ok: true, state: s };
  }

  if (action.type === 'discard') {
    if (s.phase !== 'discard') return { ok: false, error: '버릴 카드가 아닙니다.' };
    const hand = s.hands[actorId] ?? [];
    if (hand.length !== 5) return { ok: false, error: '5장이 아닙니다.' };
    const i = hand.findIndex((c) => c.id === action.cardId);
    if (i < 0) return { ok: false, error: '그 카드가 없습니다.' };
    const dumped = hand[i]!;
    const next = hand.filter((c) => c.id !== dumped.id);
    s.hands[actorId] = next;
    s.face = dumped;
    const wasLast = s.bellId != null;
    if (!wasLast && isFourOfAKind(next)) {
      s.phase = 'four_choice';
      return { ok: true, state: s };
    }
    if (wasLast) {
      advanceLastSwap(s, actorId);
      return { ok: true, state: s };
    }
    advanceTurn(s, actorId);
    return { ok: true, state: s };
  }

  if (action.type === 'four') {
    if (s.phase !== 'four_choice') return { ok: false, error: '포카드 선언 타이밍이 아닙니다.' };
    if (!isFourOfAKind(s.hands[actorId] ?? [])) return { ok: false, error: '포카드가 아닙니다.' };
    fourSettle(s, actorId);
    return { ok: true, state: s };
  }

  if (action.type === 'skip_four') {
    if (s.phase !== 'four_choice') return { ok: false, error: '포카드 단계가 아닙니다.' };
    advanceTurn(s, actorId);
    return { ok: true, state: s };
  }

  return { ok: false, error: '알 수 없는 행동입니다.' };
}

function applyTimeout(s: RtbState, actorId: string): ApplyResult {
  if (s.phase === 'combo') {
    const target =
      actorId === 'system'
        ? aliveIds(s).filter((id) => !s.combo[id] && !s.comboTimedOut[id])
        : s.combo[actorId] || s.comboTimedOut[actorId]
          ? []
          : [actorId];
    for (const id of target) {
      if (!s.alive[id] || s.combo[id] || s.comboTimedOut[id]) continue;
      if (s.bellId) forceWorstCombo(s, id);
      else {
        s.comboTimedOut[id] = true;
        pushLog(s, `${nick(s, id)} 조합 시간 초과`);
      }
      markKick(s, id, 'combo_timeout');
    }
    maybeComboDone(s);
    return { ok: true, state: s };
  }

  const id = s.currentId;
  if (!id) return { ok: false, error: '타임아웃할 차례가 없습니다.' };
  if (actorId !== 'system' && actorId !== id) return { ok: false, error: '당신 차례가 아닙니다.' };

  if (s.bellId && (s.phase === 'last_swap' || s.phase === 'pick_source' || s.phase === 'discard')) {
    pushLog(s, `${nick(s, id)} 시간 초과`);
    markKick(s, id, 'turn_timeout');
    finishForcedLastSwap(s, id);
    if (s.phase === 'combo') {
      forceWorstCombo(s, id);
      maybeComboDone(s);
    }
    return { ok: true, state: s };
  }

  if (s.phase === 'turn' || s.phase === 'pick_source' || s.phase === 'discard') {
    pushLog(s, `${nick(s, id)} 시간 초과 · 다이`);
    markKick(s, id, 'turn_timeout');
    dumpRandomOnDeath(s, id);
    afterDie(s, id);
    return { ok: true, state: s };
  }
  if (s.phase === 'four_choice') {
    // 교환까지 다 끝낸 상태다. 선언만 안 한 것이므로 강퇴하지 않고 다음 사람에게 넘긴다.
    advanceTurn(s, id);
    return { ok: true, state: s };
  }
  return { ok: false, error: '타임아웃할 단계가 아닙니다.' };
}

export function phaseLabel(phase: RtbState['phase']): string {
  switch (phase) {
    case 'turn':
      return '턴';
    case 'pick_source':
      return '카드 선택';
    case 'discard':
      return '1장 버리기';
    case 'four_choice':
      return '포카드?';
    case 'last_swap':
      return '마지막 교환';
    case 'combo':
      return '조합';
    case 'settle':
      return '정산';
    case 'countdown':
      return '다음 세트';
    case 'idle':
      return '대기';
  }
}

export { bestCombo, comboScore, isValidCombo, isFourOfAKind, requiredBellRank, worstCombo };
