/**
 * 에스키모 COM — 수 읽기 엔진.
 *
 * 판이 25칸뿐이고 한 수의 가짓수도 많아야 50개 남짓이라, 규칙을 그대로 따라
 * 몇 수 앞까지 다 두어 보는 탐색(알파베타)이 가장 강하다. 승부가 '누가 마지막
 * 한 칸을 막느냐' 로 갈리는 전술 게임이라 평가 함수보다 읽는 깊이가 실력이다.
 *
 * · 보통: 2수(내 수 → 상대 응수)만 읽는다. 바로 이기는 수는 두고, 바로 지는 수는
 *   피하지만, 그 밖에는 비슷한 수 중에서 무작위로 고른다.
 * · 어려움: 정해진 시간 동안 1수, 2수, 3수… 점점 깊게 읽어(반복 심화) 가장 깊이
 *   읽은 결과로 둔다. 워커 스레드에서 돌려 게임 서버를 멈추지 않는다.
 *
 * 반복수는 '그 판이 이전에 나왔는지' 라 지나온 길에 따라 결과가 달라진다. 그래서
 * 전치표(transposition table)는 수 순서 정렬에만 쓰고 점수를 재사용하지 않는다.
 */
import { ESKIMO_BEAR, ESKIMO_BEAR_LOCK_TURNS, ESKIMO_SIZE } from '@shared/types/eskimo.js';
import type { AbstractAiDifficulty } from '@shared/types/game.js';
import type { EskimoAction, EskimoBoard } from '@shared/types/eskimo.js';

const N = ESKIMO_SIZE;
const CELLS = N * N;
const EMPTY = 0;
const FIRST = 1;
const SECOND = 2;
const BEAR = 3;

/** 이기는 점수. 빨리 이길수록·늦게 질수록 좋게 ply 만큼 깎는다. */
const WIN = 1_000_000;
const WIN_THRESHOLD = WIN - 1000;

export const ESKIMO_HARD_THINK_MS = 2500;
const HARD_MAX_DEPTH = 24;
const NORMAL_DEPTH = 2;
/** 보통 난이도가 '거의 같은 수' 로 보고 섞어 고르는 점수 폭 */
const NORMAL_SLACK = 120;

const DIRS: readonly [number, number][] = [
  [-1, 0],
  [-1, 1],
  [0, 1],
  [1, 1],
  [1, 0],
  [1, -1],
  [0, -1],
  [-1, -1],
];
const ORTHO: readonly [number, number][] = [
  [-1, 0],
  [0, 1],
  [1, 0],
  [0, -1],
];

/** 칸마다 방향별로 '한 칸 옆' 칸 번호. 판 밖이면 -1. */
const STEP: Int8Array[] = DIRS.map(([dr, dc]) => {
  const table = new Int8Array(CELLS);
  for (let i = 0; i < CELLS; i += 1) {
    const r = Math.floor(i / N) + dr;
    const c = (i % N) + dc;
    table[i] = r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
  }
  return table;
});
const ORTHO_STEP: Int8Array[] = ORTHO.map(([dr, dc]) => {
  const table = new Int8Array(CELLS);
  for (let i = 0; i < CELLS; i += 1) {
    const r = Math.floor(i / N) + dr;
    const c = (i % N) + dc;
    table[i] = r >= 0 && r < N && c >= 0 && c < N ? r * N + c : -1;
  }
  return table;
});

/*
  판 모양을 숫자 하나로 — 조브리스트 해시. 칸·말 종류마다 난수를 정해 두고 XOR 한다.
  32비트 두 개를 53비트 안에 접어 Set 키로 쓴다(충돌은 사실상 없다).
*/
function seededRandom(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}
const rand = seededRandom(0xe5c1);
const ZOBRIST_HI = Array.from({ length: CELLS * 4 }, () => rand());
const ZOBRIST_LO = Array.from({ length: CELLS * 4 }, () => rand() & 0x1fffff);

export interface EskimoAiInput {
  board: EskimoBoard;
  firstPlayerId: string;
  /** COM 의 id */
  playerId: string;
  bearLockTurns: number;
  /** 지금까지 나온 판 모양(서버의 eskimoPositionKey, 시작 판 포함) */
  positions: string[];
  difficulty: AbstractAiDifficulty;
  /** 어려움에서 쓸 시간(ms). 테스트에서 줄인다. */
  thinkMs?: number;
  /** 보통 난이도의 무작위 선택용. 테스트에서 고정한다. */
  random?: () => number;
}

interface Move {
  from: number;
  to: number;
}

class Position {
  cells: Uint8Array;
  side: number;
  bearLock: number;
  bear: number;
  hi: number;
  lo: number;

  constructor(cells: Uint8Array, side: number, bearLock: number) {
    this.cells = cells;
    this.side = side;
    this.bearLock = bearLock;
    this.bear = cells.indexOf(BEAR);
    let hi = 0;
    let lo = 0;
    for (let i = 0; i < CELLS; i += 1) {
      if (cells[i] !== EMPTY) {
        hi ^= ZOBRIST_HI[i * 4 + cells[i]];
        lo ^= ZOBRIST_LO[i * 4 + cells[i]];
      }
    }
    this.hi = hi >>> 0;
    this.lo = lo;
  }

  key() {
    return this.hi * 0x200000 + this.lo;
  }

  /** 지금 차례인 쪽의 모든 수. 곰 수는 뒤에 붙는다. */
  moves(out: Move[] = []): Move[] {
    const { cells, side } = this;
    for (let i = 0; i < CELLS; i += 1) {
      if (cells[i] !== side) continue;
      for (let d = 0; d < 8; d += 1) {
        const step = STEP[d];
        let at = i;
        let next = step[at];
        while (next !== -1 && cells[next] === EMPTY) {
          at = next;
          next = step[at];
        }
        if (at !== i) out.push({ from: i, to: at });
      }
    }
    if (this.bearLock === 0 && this.bear >= 0) {
      for (let d = 0; d < 8; d += 1) {
        const to = STEP[d][this.bear];
        if (to !== -1 && cells[to] === EMPTY) out.push({ from: this.bear, to });
      }
    }
    return out;
  }

  /** 수를 두고, 되돌릴 때 쓸 이전 곰 잠금을 돌려준다. */
  play(m: Move): number {
    const piece = this.cells[m.from];
    const prevLock = this.bearLock;
    this.cells[m.to] = piece;
    this.cells[m.from] = EMPTY;
    this.hi = (this.hi ^ ZOBRIST_HI[m.from * 4 + piece] ^ ZOBRIST_HI[m.to * 4 + piece]) >>> 0;
    this.lo = this.lo ^ ZOBRIST_LO[m.from * 4 + piece] ^ ZOBRIST_LO[m.to * 4 + piece];
    if (piece === BEAR) {
      this.bear = m.to;
      this.bearLock = ESKIMO_BEAR_LOCK_TURNS;
    } else if (this.bearLock > 0) {
      this.bearLock -= 1;
    }
    this.side = 3 - this.side;
    return prevLock;
  }

  undo(m: Move, prevLock: number) {
    const piece = this.cells[m.to];
    this.cells[m.from] = piece;
    this.cells[m.to] = EMPTY;
    this.hi = (this.hi ^ ZOBRIST_HI[m.from * 4 + piece] ^ ZOBRIST_HI[m.to * 4 + piece]) >>> 0;
    this.lo = this.lo ^ ZOBRIST_LO[m.from * 4 + piece] ^ ZOBRIST_LO[m.to * 4 + piece];
    if (piece === BEAR) this.bear = m.from;
    this.bearLock = prevLock;
    this.side = 3 - this.side;
  }

  /** 곰의 상하좌우가 말·판 끝으로 모두 막혔는지 */
  surrounded(): boolean {
    for (let d = 0; d < 4; d += 1) {
      const n = ORTHO_STEP[d][this.bear];
      if (n !== -1 && this.cells[n] === EMPTY) return false;
    }
    return true;
  }

  /** 곰 사방 중 비어 있는 칸들 */
  openSides(out: number[] = []): number[] {
    for (let d = 0; d < 4; d += 1) {
      const n = ORTHO_STEP[d][this.bear];
      if (n !== -1 && this.cells[n] === EMPTY) out.push(n);
    }
    return out;
  }

  /** side 의 말 중 한 번에 target 칸에 멈출 수 있는 말 수 */
  reachers(side: number, target: number): number {
    let count = 0;
    for (let d = 0; d < 8; d += 1) {
      // target 에서 거꾸로 걸어가며 처음 만나는 말을 본다. target 너머(진행 방향)는 막혀 있어야 멈춘다.
      const forward = STEP[d][target];
      if (forward !== -1 && this.cells[forward] === EMPTY) continue;
      const back = STEP[(d + 4) % 8];
      let at = back[target];
      while (at !== -1 && this.cells[at] === EMPTY) at = back[at];
      if (at !== -1 && this.cells[at] === side) count += 1;
    }
    return count;
  }
}

function toCells(board: EskimoBoard, firstPlayerId: string): Uint8Array {
  const cells = new Uint8Array(CELLS);
  for (let r = 0; r < N; r += 1) {
    for (let c = 0; c < N; c += 1) {
      const piece = board[r][c];
      cells[r * N + c] =
        piece === null
          ? EMPTY
          : piece === ESKIMO_BEAR
            ? BEAR
            : piece === firstPlayerId
              ? FIRST
              : SECOND;
    }
  }
  return cells;
}

/** 서버의 판 모양 문자열(F/S/B/.)을 엔진 해시로 */
function keyOfPositionString(text: string): number | null {
  if (text.length !== CELLS) return null;
  const cells = new Uint8Array(CELLS);
  for (let i = 0; i < CELLS; i += 1) {
    const ch = text[i];
    cells[i] = ch === 'F' ? FIRST : ch === 'S' ? SECOND : ch === 'B' ? BEAR : EMPTY;
  }
  return new Position(cells, FIRST, 0).key();
}

/**
 * 판 점수 — 지금 둘 차례인 쪽 기준. 끝난 판은 탐색이 직접 판정하므로 여기서는
 * '누가 마지막 칸을 막기 좋은가' 만 본다.
 */
function evaluate(pos: Position): number {
  const me = pos.side;
  const opp = 3 - me;
  const open = pos.openSides();
  let score = 0;

  if (open.length === 1) {
    // 마지막 한 칸 — 내가 지금 막을 수 있으면 사실상 이긴 판(탐색이 확인한다),
    // 상대만 막을 수 있으면 다음 수에 내가 그 위협을 풀어야 한다.
    const target = open[0];
    const mine = pos.reachers(me, target);
    const theirs = pos.reachers(opp, target);
    if (mine > 0) score += 20_000;
    score -= theirs * 2_500;
  }

  for (const target of open) {
    score += (pos.reachers(me, target) - pos.reachers(opp, target)) * 60;
  }
  // 막힌 면이 많을수록 판이 끝에 가깝다 — 차례를 쥔 쪽에 조금 더 준다.
  score += (4 - open.length) * 25;

  // 곰을 곧 옮길 수 있는 쪽이 유리하다(곰을 막힌 자리로 밀어 넣는 수가 생긴다).
  if (pos.bearLock === 0) score += 40;
  else if (pos.bearLock % 2 === 1) score -= 20;

  // 둘 수가 많은 쪽이 낫다. 둘 수가 없으면 진다.
  const myMoves = pos.moves().length;
  pos.side = opp;
  const oppMoves = pos.moves().length;
  pos.side = me;
  score += (myMoves - oppMoves) * 4;
  return score;
}

class TimeUp extends Error {}

interface SearchContext {
  pos: Position;
  /** 실제 게임에서 나온 판 + 지금 읽는 길에서 나온 판 */
  seen: Set<number>;
  deadline: number;
  nodes: number;
  /** 차례별로 판 키 → 그 판에서 가장 좋았던 수(정렬용) */
  bestMoveAt: [Map<number, Move>, Map<number, Move>, Map<number, Move>];
  killers: Move[][];
  history: Int32Array;
}

function sameMove(a: Move | undefined, b: Move) {
  return !!a && a.from === b.from && a.to === b.to;
}

function orderMoves(ctx: SearchContext, moves: Move[], ply: number) {
  const ttMove = ctx.bestMoveAt[ctx.pos.side].get(ctx.pos.key());
  const killers = ctx.killers[ply] ?? [];
  const scored = moves.map((m) => {
    let s = ctx.history[m.from * CELLS + m.to];
    if (sameMove(ttMove, m)) s += 1e9;
    else if (sameMove(killers[0], m)) s += 1e8;
    else if (sameMove(killers[1], m)) s += 1e8 - 1;
    return { m, s };
  });
  scored.sort((a, b) => b.s - a.s);
  for (let i = 0; i < moves.length; i += 1) moves[i] = scored[i].m;
}

/**
 * 네가맥스 알파베타. 반환값은 '지금 둘 차례인 쪽' 기준 점수.
 * 수를 둔 직후 반복수면 둔 쪽 패, 포위면 둔 쪽 승. 둘 수가 없으면 차례인 쪽 패.
 */
function search(
  ctx: SearchContext,
  depth: number,
  alpha: number,
  beta: number,
  ply: number,
): number {
  ctx.nodes += 1;
  if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) throw new TimeUp();
  const { pos } = ctx;
  const moves = pos.moves();
  if (moves.length === 0) return -WIN + ply;
  if (depth <= 0) return evaluate(pos);

  orderMoves(ctx, moves, ply);
  let best = -Infinity;
  let bestMove: Move | null = null;
  for (const m of moves) {
    const prevLock = pos.play(m);
    const key = pos.key();
    let score: number;
    if (ctx.seen.has(key)) {
      score = -WIN + ply + 1; // 반복수 — 둔 쪽(나) 패
    } else if (pos.surrounded()) {
      score = WIN - ply - 1; // 포위 — 둔 쪽(나) 승
    } else {
      ctx.seen.add(key);
      try {
        score = -search(ctx, depth - 1, -beta, -alpha, ply + 1);
      } finally {
        ctx.seen.delete(key);
      }
    }
    pos.undo(m, prevLock);
    if (score > best) {
      best = score;
      bestMove = m;
    }
    if (score > alpha) alpha = score;
    if (alpha >= beta) {
      const k = (ctx.killers[ply] ??= []);
      if (!sameMove(k[0], m)) {
        k[1] = k[0];
        k[0] = m;
      }
      ctx.history[m.from * CELLS + m.to] += depth * depth;
      break;
    }
  }
  if (bestMove) ctx.bestMoveAt[pos.side].set(pos.key(), bestMove);
  return best;
}

/** 뿌리에서 수마다 정확한 점수를 매긴다(보통 난이도는 이 목록에서 고른다). */
function scoreRoot(ctx: SearchContext, moves: Move[], depth: number): { m: Move; score: number }[] {
  const { pos } = ctx;
  return moves.map((m) => {
    const prevLock = pos.play(m);
    const key = pos.key();
    let score: number;
    if (ctx.seen.has(key)) score = -WIN + 1;
    else if (pos.surrounded()) score = WIN - 1;
    else {
      ctx.seen.add(key);
      score = -search(ctx, depth - 1, -Infinity, Infinity, 1);
      ctx.seen.delete(key);
    }
    pos.undo(m, prevLock);
    return { m, score };
  });
}

function toAction(m: Move): EskimoAction {
  return {
    type: 'move',
    from: { row: Math.floor(m.from / N), col: m.from % N },
    to: { row: Math.floor(m.to / N), col: m.to % N },
  };
}

export interface EskimoAiResult {
  action: EskimoAction;
  score: number;
  depth: number;
  nodes: number;
}

export function chooseEskimoAiAction(input: EskimoAiInput): EskimoAiResult | null {
  const side = input.playerId === input.firstPlayerId ? FIRST : SECOND;
  const pos = new Position(toCells(input.board, input.firstPlayerId), side, input.bearLockTurns);
  const seen = new Set<number>();
  for (const text of input.positions) {
    const key = keyOfPositionString(text);
    if (key !== null) seen.add(key);
  }
  seen.add(pos.key());
  const rootMoves = pos.moves();
  if (rootMoves.length === 0) return null;

  const ctx: SearchContext = {
    pos,
    seen,
    deadline: Infinity,
    nodes: 0,
    bestMoveAt: [new Map(), new Map(), new Map()],
    killers: [],
    history: new Int32Array(CELLS * CELLS),
  };

  if (input.difficulty !== 'hard') {
    const scored = scoreRoot(ctx, rootMoves, NORMAL_DEPTH);
    const best = Math.max(...scored.map((s) => s.score));
    // 이기는 수가 있으면 그것, 아니면 지지 않는 수 중 최선에 가까운 것들에서 무작위로
    const pool =
      best >= WIN_THRESHOLD
        ? scored.filter((s) => s.score === best)
        : scored.filter((s) => s.score >= best - NORMAL_SLACK && s.score > -WIN_THRESHOLD);
    const candidates = pool.length > 0 ? pool : scored.filter((s) => s.score === best);
    const random = input.random ?? Math.random;
    const pick = candidates[Math.floor(random() * candidates.length)];
    return { action: toAction(pick.m), score: pick.score, depth: NORMAL_DEPTH, nodes: ctx.nodes };
  }

  const thinkMs = input.thinkMs ?? ESKIMO_HARD_THINK_MS;
  ctx.deadline = Date.now() + thinkMs;
  let bestMove = rootMoves[0];
  let bestScore = -Infinity;
  let reached = 0;
  for (let depth = 1; depth <= HARD_MAX_DEPTH; depth += 1) {
    try {
      orderMoves(ctx, rootMoves, 0);
      // 지난 깊이의 최선 수를 맨 앞에 — 시간이 끊겨도 그 수는 끝까지 읽혔다
      const idx = rootMoves.findIndex((m) => sameMove(bestMove, m));
      if (idx > 0) rootMoves.unshift(...rootMoves.splice(idx, 1));
      let alpha = -Infinity;
      let iterBest: Move = rootMoves[0];
      for (const m of rootMoves) {
        const prevLock = pos.play(m);
        const key = pos.key();
        let score: number;
        try {
          if (seen.has(key)) score = -WIN + 1;
          else if (pos.surrounded()) score = WIN - 1;
          else {
            seen.add(key);
            try {
              score = -search(ctx, depth - 1, -Infinity, -alpha, 1);
            } finally {
              seen.delete(key);
            }
          }
        } finally {
          pos.undo(m, prevLock);
        }
        if (score > alpha) {
          alpha = score;
          iterBest = m;
        }
      }
      bestMove = iterBest;
      bestScore = alpha;
      reached = depth;
      ctx.bestMoveAt[pos.side].set(pos.key(), bestMove);
      // 승부가 정해졌으면 더 읽을 필요가 없다
      if (Math.abs(alpha) >= WIN_THRESHOLD) break;
    } catch (error) {
      if (error instanceof TimeUp) break;
      throw error;
    }
  }
  return { action: toAction(bestMove), score: bestScore, depth: reached, nodes: ctx.nodes };
}
