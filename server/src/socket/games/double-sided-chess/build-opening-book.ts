/**
 * 운영 game_logs 양면장기 멀티 기보 → STATS_OPENING_BOOK.
 * 입력 JSON: [{ w: 'first'|'second', line: 'first:m4434|second:m0413|...' }]
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createInitialBoard } from '../../../../../shared/logic/double-sided-chess.js';
import { applyMove } from './ai.js';
import { encodeBookMove, parseKifuToken, positionBookKey } from './opening-book.js';
import type { Owner, PieceType } from '../../../../../shared/types/double-sided-chess.js';

const here = dirname(fileURLToPath(import.meta.url));

interface GameRow {
  w: 'first' | 'second';
  line: string;
}

function emptyHands(): { first: PieceType[]; second: PieceType[] } {
  return { first: [], second: [] };
}

const MIN_WEIGHT = 2;

function main() {
  const rawPath = process.argv[2] ?? join(here, 'opening-games.json');
  const rows = JSON.parse(readFileSync(rawPath, 'utf8')) as GameRow[];
  const votes = new Map<string, Map<string, number>>();

  for (const row of rows) {
    if (row.w !== 'first' && row.w !== 'second') continue;
    if (!row.line) continue;
    let board = createInitialBoard();
    let prisoners = emptyHands();
    let stm: Owner = 'first';
    for (const token of row.line.split('|')) {
      const parsed = parseKifuToken(token);
      if (!parsed || parsed.owner !== stm) break;
      const key = positionBookKey(board, prisoners, stm);
      if (stm === row.w) {
        const moveCode = encodeBookMove(parsed.move);
        let byMove = votes.get(key);
        if (!byMove) {
          byMove = new Map();
          votes.set(key, byMove);
        }
        byMove.set(moveCode, (byMove.get(moveCode) ?? 0) + 1);
      }
      const applied = applyMove(board, prisoners, parsed.move, stm);
      board = applied.board;
      prisoners = applied.prisoners;
      stm = stm === 'first' ? 'second' : 'first';
    }
  }

  const book: Record<string, string> = {};
  for (const [key, byMove] of votes) {
    let bestCode = '';
    let bestN = 0;
    for (const [code, n] of byMove) {
      if (n > bestN) {
        bestN = n;
        bestCode = code;
      }
    }
    if (bestN >= MIN_WEIGHT && bestCode) book[key] = bestCode;
  }

  const out = join(here, 'opening-book-data.ts');
  const body =
    `/** 멀티 기보 승자 가중 오프닝 북 (${Object.keys(book).length}국면, 최소 ${MIN_WEIGHT}기). */\n` +
    `export const STATS_OPENING_BOOK: Record<string, string> = ${JSON.stringify(book, null, 2)};\n`;
  writeFileSync(out, body);
  console.info(`wrote ${Object.keys(book).length} book entries from ${rows.length} games`);
}

main();
