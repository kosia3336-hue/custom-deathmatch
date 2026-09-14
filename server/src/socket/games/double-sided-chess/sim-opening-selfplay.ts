/**
 * 선 첫수 자기대전. 북 끄고 슈퍼끼리.
 *
 *   pnpm exec tsx src/socket/games/double-sided-chess/sim-opening-selfplay.ts --opening ubo
 *
 * --opening: ubo | lance | bishop | all
 * --think: 수당 ms (기본 2500)
 * --probe: 1수 뒤 후수 탐색 ms (기본 6000)
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialBoard } from '../../../../../shared/logic/double-sided-chess.js';
import type { Cell, Owner, PieceType } from '../../../../../shared/types/double-sided-chess.js';
import { applyMove, checkTerminal, type AIWorkerData } from './ai.js';
import { findBestMoveIterativeSuperStats } from './ai-strong.js';
import {
  countNonKingPieces,
  hasAnyValidAction,
  isKingInOpponentTerritory,
} from './board.js';
import { decodeBookMove, encodeBookMove } from './opening-book.js';
import type { AIMove } from './types.js';

type OpeningId = 'ubo' | 'lance' | 'bishop';
type WinType = 'king-captured' | 'king-entered' | 'all-captured' | 'no-moves' | 'max-turns';

const OPENINGS: Record<OpeningId, { label: string; first: string; replies: string[] }> = {
  ubo: { label: '우보 44-34', first: 'm4434', replies: ['m0413', 'm0010'] },
  lance: { label: '토은앞 40-31', first: 'm4031', replies: ['m0413', 'm0112', 'm0312', 'm0010'] },
  bishop: { label: '은왕앞 41-32', first: 'm4132', replies: ['m0312', 'm0413', 'm0010'] },
};

const MAX_TURNS = 80;
const here = dirname(fileURLToPath(import.meta.url));

function argValue(name: string, fallback: string): string {
  const i = process.argv.indexOf(`--${name}`);
  if (i === -1 || !process.argv[i + 1]) return fallback;
  return process.argv[i + 1];
}

function emptyHands(): { first: PieceType[]; second: PieceType[] } {
  return { first: [], second: [] };
}

function mustMove(code: string): AIMove {
  const move = decodeBookMove(code);
  if (!move) throw new Error(`bad move ${code}`);
  return move;
}

function classifyWin(
  captured: PieceType | null,
  board: Cell[][],
  prisoners: { first: PieceType[]; second: PieceType[] },
  justMoved: Owner,
): WinType | null {
  if (!checkTerminal(board, prisoners, justMoved, captured, 0, 'first')) return null;
  if (captured === 'king') return 'king-captured';
  if (isKingInOpponentTerritory(board, justMoved)) return 'king-entered';
  const opp: Owner = justMoved === 'first' ? 'second' : 'first';
  if (countNonKingPieces(board, opp) === 0 && prisoners[opp].length === 0) return 'all-captured';
  if (!hasAnyValidAction(board, prisoners[opp], opp)) return 'no-moves';
  return 'no-moves';
}

interface GameResult {
  name: string;
  forced: string[];
  winner: Owner | 'draw';
  winType: string;
  turns: number;
  line: string;
  avgDepth: number;
}

function playGame(forced: AIMove[], thinkMs: number, name: string): GameResult {
  let board = createInitialBoard();
  let prisoners = emptyHands();
  let owner: Owner = 'first';
  let turn = 1;
  let lastMove: AIMove | null = null;
  const line: string[] = [];
  const depths: number[] = [];

  const finish = (winner: Owner | 'draw', winType: string): GameResult => ({
    name,
    forced: forced.map(encodeBookMove),
    winner,
    winType,
    turns: turn,
    line: line.join('|'),
    avgDepth: depths.length ? Math.round(depths.reduce((a, b) => a + b, 0) / depths.length * 10) / 10 : 0,
  });

  const applyOne = (move: AIMove, depth: number): GameResult | null => {
    const applied = applyMove(board, prisoners, move, owner);
    board = applied.board;
    prisoners = applied.prisoners;
    line.push(`${owner}:${encodeBookMove(move)}`);
    depths.push(depth);
    lastMove = move;
    const kind = classifyWin(applied.captured, board, prisoners, owner);
    if (kind) return finish(owner, kind);
    owner = owner === 'first' ? 'second' : 'first';
    turn += 1;
    return null;
  };

  for (const move of forced) {
    const done = applyOne(move, 0);
    if (done) return done;
  }

  while (turn <= MAX_TURNS) {
    const data: AIWorkerData = {
      board,
      prisoners,
      currentOwner: owner,
      turnNumber: turn,
      lastMove,
      skipOpeningBook: true,
      useSuper: true,
    };
    const stats = findBestMoveIterativeSuperStats(data, thinkMs);
    const done = applyOne(stats.move, stats.completedDepth);
    if (done) return done;
  }

  return finish('draw', 'max-turns');
}

function probeAfterFirst(first: AIMove, probeMs: number) {
  const applied = applyMove(createInitialBoard(), emptyHands(), first, 'first');
  const stats = findBestMoveIterativeSuperStats({
    board: applied.board,
    prisoners: applied.prisoners,
    currentOwner: 'second',
    turnNumber: 2,
    lastMove: first,
    skipOpeningBook: true,
    useSuper: true,
  }, probeMs);
  return {
    secondMove: encodeBookMove(stats.move),
    secondScore: stats.score,
    firstPov: -stats.score,
    depth: stats.completedDepth,
    nodes: stats.nodes,
  };
}

function runOpening(id: OpeningId, thinkMs: number, probeMs: number) {
  const spec = OPENINGS[id];
  const first = mustMove(spec.first);
  console.info(`\n=== ${spec.label} probe ${probeMs}ms ===`);
  const probe = probeAfterFirst(first, probeMs);
  console.info(
    `probe second=${probe.secondMove} depth=${probe.depth} secondScore=${probe.secondScore} firstPov=${probe.firstPov}`,
  );

  const games: GameResult[] = [];
  console.info(`=== ${spec.label} PV ===`);
  const pv = playGame([first], thinkMs, `${id}-pv`);
  games.push(pv);
  const pvSecond = pv.line.split('|')[1]?.split(':')[1] ?? '';
  console.info(`PV winner=${pv.winner} turns=${pv.turns} type=${pv.winType} m2=${pvSecond}`);

  for (const reply of spec.replies) {
    if (reply === pvSecond) {
      console.info(`skip forced ${reply} (same as PV)`);
      continue;
    }
    console.info(`=== ${spec.label} vs ${reply} ===`);
    const g = playGame([first, mustMove(reply)], thinkMs, `${id}-vs-${reply}`);
    games.push(g);
    console.info(`winner=${g.winner} turns=${g.turns} type=${g.winType}`);
  }

  return {
    id,
    label: spec.label,
    thinkMs,
    probeMs,
    probe,
    games,
    firstWins: games.filter((g) => g.winner === 'first').length,
    secondWins: games.filter((g) => g.winner === 'second').length,
    draws: games.filter((g) => g.winner === 'draw').length,
  };
}

function outPath(id: string): string {
  const dir = join(here, '../../../../../logs/2026-09-09');
  mkdirSync(dir, { recursive: true });
  return join(dir, `sim-opening-${id}.json`);
}

function main() {
  const openingArg = argValue('opening', 'all');
  const thinkMs = Number(argValue('think', '2500'));
  const probeMs = Number(argValue('probe', '6000'));
  const ids: OpeningId[] = openingArg === 'all'
    ? ['ubo', 'lance', 'bishop']
    : [openingArg as OpeningId];
  if (ids.some((id) => !OPENINGS[id])) {
    throw new Error(`unknown opening ${openingArg}`);
  }

  const results = ids.map((id) => {
    const r = runOpening(id, thinkMs, probeMs);
    writeFileSync(outPath(id), `${JSON.stringify(r, null, 2)}\n`);
    console.info(`wrote ${outPath(id)}`);
    return r;
  });

  console.info('\n===== SUMMARY =====');
  for (const r of results) {
    console.info(
      `${r.label}: first ${r.firstWins}-${r.secondWins}-${r.draws}  probeFirstPov=${r.probe.firstPov} d=${r.probe.depth} m2=${r.probe.secondMove}`,
    );
  }
}

main();
