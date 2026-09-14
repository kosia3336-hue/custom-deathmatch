/**
 * 운영 기보 compact JSON → opening-book-data.ts
 * 입력: JSON 배열 [{ w, line }] 또는 MCP untrusted-data 래퍼 파일.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const MIN_WEIGHT = 2;
const PIECE_CH = { king: 'k', infantry: 'i', gold: 'g', silver: 's', copper: 'c' };
const FIRST_ROW = ['copper', 'silver', 'king', 'gold', 'infantry'];
const SECOND_ROW = ['infantry', 'gold', 'king', 'silver', 'copper'];

function createInitialBoard() {
  const board = Array.from({ length: 5 }, () => Array.from({ length: 5 }, () => null));
  for (let c = 0; c < 5; c++) {
    board[0][c] = { piece: SECOND_ROW[c], owner: 'second', isPromoted: false };
    board[4][c] = { piece: FIRST_ROW[c], owner: 'first', isPromoted: false };
  }
  return board;
}

function nextIsPromoted(piece, isPromoted) {
  if (piece === 'king') return false;
  return !isPromoted;
}

function decodeBookMove(code) {
  const move = /^m(\d)(\d)(\d)(\d)$/.exec(code);
  if (move) {
    return {
      type: 'move',
      from: { row: Number(move[1]), col: Number(move[2]) },
      to: { row: Number(move[3]), col: Number(move[4]) },
    };
  }
  const drop = /^p(infantry|gold|silver|copper)(\d)(\d)$/.exec(code);
  if (drop) {
    return {
      type: 'place-prisoner',
      pieceType: drop[1],
      position: { row: Number(drop[2]), col: Number(drop[3]) },
    };
  }
  return null;
}

function parseKifuToken(token) {
  const m = /^(first|second):(m\d{4}|p(?:infantry|gold|silver|copper)\d{2})$/.exec(token);
  if (!m) return null;
  const move = decodeBookMove(m[2]);
  if (!move) return null;
  return { owner: m[1], move, code: m[2] };
}

function positionBookKey(board, prisoners, owner) {
  let s = owner === 'first' ? 'f' : 's';
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const cell = board[r][c];
      if (!cell) {
        s += '.';
        continue;
      }
      s += (cell.owner === 'first' ? 'F' : 'S') + PIECE_CH[cell.piece] + (cell.isPromoted ? 'p' : '');
    }
  }
  const hand = (side) => [...prisoners[side]].sort().join('');
  return `${s}|${hand('first')}/${hand('second')}`;
}

function applyMove(board, prisoners, move, owner) {
  const b = board.map((row) => row.map((c) => (c ? { ...c } : null)));
  const p = { first: [...prisoners.first], second: [...prisoners.second] };
  if (move.type === 'move') {
    const cell = b[move.from.row]?.[move.from.col];
    if (!cell || cell.owner !== owner) return null;
    const target = b[move.to.row]?.[move.to.col];
    if (target === undefined) return null;
    if (target && target.owner !== owner) {
      if (target.piece !== 'king') p[owner].push(target.piece);
    }
    b[move.to.row][move.to.col] = {
      piece: cell.piece,
      owner: cell.owner,
      isPromoted: nextIsPromoted(cell.piece, cell.isPromoted),
    };
    b[move.from.row][move.from.col] = null;
    return { board: b, prisoners: p };
  }
  const idx = p[owner].indexOf(move.pieceType);
  if (idx === -1) return null;
  const dest = b[move.position.row]?.[move.position.col];
  if (dest === undefined || dest) return null;
  p[owner].splice(idx, 1);
  b[move.position.row][move.position.col] = { piece: move.pieceType, owner, isPromoted: false };
  return { board: b, prisoners: p };
}

function extractArrayJson(text) {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1 || end <= start) throw new Error('no json array');
  return JSON.parse(text.slice(start, end + 1));
}

function loadRows(rawPath) {
  const text = readFileSync(rawPath, 'utf8');
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed)) return parsed;
    if (typeof parsed.result === 'string') return extractArrayJson(parsed.result);
  } catch {
    /* MCP 덤프가 순수 JSON이 아니면 아래에서 배열만 잘라 쓴다. */
  }
  return extractArrayJson(text);
}

const rawPath = process.argv[2];
if (!rawPath) {
  console.error('usage: node build-opening-book.mjs <kifu-json-or-mcp-dump>');
  process.exit(1);
}

const rows = loadRows(rawPath);
const votes = new Map();

for (const row of rows) {
  if (row.w !== 'first' && row.w !== 'second') continue;
  if (!row.line) continue;
  let board = createInitialBoard();
  let prisoners = { first: [], second: [] };
  let stm = 'first';
  for (const token of row.line.split('|')) {
    const parsed = parseKifuToken(token);
    if (!parsed || parsed.owner !== stm) break;
    const key = positionBookKey(board, prisoners, stm);
    if (stm === row.w) {
      let byMove = votes.get(key);
      if (!byMove) {
        byMove = new Map();
        votes.set(key, byMove);
      }
      byMove.set(parsed.code, (byMove.get(parsed.code) ?? 0) + 1);
    }
    const applied = applyMove(board, prisoners, parsed.move, stm);
    if (!applied) break;
    board = applied.board;
    prisoners = applied.prisoners;
    stm = stm === 'first' ? 'second' : 'first';
  }
}

const book = {};
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
const keys = Object.keys(book);
const body =
  `/** 멀티 기보 승자 가중 오프닝 북 (${keys.length}국면, 최소 ${MIN_WEIGHT}기). 닉네임 없음. */\n` +
  `export const STATS_OPENING_BOOK: Record<string, string> = ${JSON.stringify(book, null, 2)};\n`;
writeFileSync(out, body);
console.info(`wrote ${keys.length} book entries from ${rows.length} games`);
