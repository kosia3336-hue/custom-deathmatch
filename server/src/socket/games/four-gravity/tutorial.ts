import type {
  Direction,
  FgTutorialStepId,
  FourGravityTutorialHint,
  Position,
} from '@shared/types/four-gravity.js';
import { FG_TUTORIAL_TOTAL } from '@shared/types/four-gravity.js';
import {
  createEmptyBoard,
  cloneBoard,
  applyGravity,
  findMovedPosition,
  calcNeutralCandidates,
} from './board.js';
import type {
  CellType,
  InternalState,
  TutorialComBeat,
  TutorialComScript,
} from './types.js';

export const FG_TUTORIAL_COM_WAIT = 2;

export const TUTORIAL_GUIDE_ID = 'TUTORIAL';

export const FG_TUTORIAL_STEPS: FgTutorialStepId[] = [
  'intro',
  'turn-order',
  'place',
  'gravity',
  'gravity-move',
  'neutral',
  'com-down',
  'place-2',
  'no-repeat',
  'none-skip',
  'win-intro',
  'win-own',
  'win-opp',
  'win-both',
  'win-neutral',
  'win-no-space',
];

export const FG_TUTORIAL_CELLS = {
  comFirst: { row: 4, col: 4 } as Position,
  place: { row: 6, col: 4 } as Position,
  neutral: { row: 4, col: 4 } as Position,
  comDown: { row: 2, col: 7 } as Position,
  comDownNeutral: { row: 5, col: 7 } as Position,
  place2: { row: 5, col: 4 } as Position,
};

const ACK_STEPS = new Set<FgTutorialStepId>([
  'intro',
  'turn-order',
  'gravity-move',
  'com-down',
  'none-skip',
  'win-intro',
  'win-own',
  'win-opp',
  'win-both',
  'win-neutral',
  'win-no-space',
]);

const COPY: Record<FgTutorialStepId, { title: string; body: string }> = {
  intro: {
    title: '사중력 사목',
    body: '9×9 게임판에서 상대보다 먼저 돌 4개를 연달아 이으면 이기는 전략 게임입니다.',
  },
  'turn-order': {
    title: '턴 순서',
    body: '교대로 진행합니다. 매 턴은 돌 놓기 → 중력 선택 → 중립 돌 배치 순서입니다.',
  },
  place: {
    title: '돌 놓기',
    body: '빈 칸 하나에 돌을 놓습니다. 하이라이트된 칸에 놓아보세요.',
  },
  gravity: {
    title: '중력 선택',
    body: '상·하·좌·우·무 중 하나로 중력을 적용할 수 있습니다. 「상」을 눌러보세요.',
  },
  'gravity-move': {
    title: '중력 이동',
    body: '중력을 적용하면 판 위의 모든 일반 돌이 그 방향으로 이동합니다.',
  },
  neutral: {
    title: '중립 돌',
    body: '돌이 지나온 자리 중 한 곳에 중립 돌을 놓아야 합니다. 하이라이트된 칸에 놓아보세요.',
  },
  'com-down': {
    title: '중력 하',
    body: '상대가 「하」를 썼습니다. 나와 상대의 돌이 모두 아래로 이동했습니다. 중립 돌은 중력에 움직이지 않고 그 자리에 남습니다.',
  },
  'place-2': {
    title: '당신의 차례',
    body: '하이라이트된 칸에 돌을 놓아보세요.',
  },
  'no-repeat': {
    title: '연속 방향 금지',
    body: '직전에 쓴 중력은 연속해서 쓸 수 없습니다. 당신은 「상」을 썼으므로 이번엔 고를 수 없습니다. 「무」를 눌러보세요.',
  },
  'none-skip': {
    title: '중력 무',
    body: '「무」는 중력을 적용하지 않습니다. 이때만 중립 돌을 건너뛰고 턴이 끝납니다.',
  },
  'win-intro': {
    title: '승리 조건',
    body: '이어서 승리하는 경우를 살펴봅니다.',
  },
  'win-own': {
    title: '사목 완성',
    body: '중력을 적용한 뒤 자기 돌로 정확히 4개를 만들면 이깁니다. 5개 이상은 인정하지 않습니다.',
  },
  'win-opp': {
    title: '상대 사목',
    body: '내가 중력을 적용했는데 상대 돌이 사목이 되면 상대가 이깁니다.',
  },
  'win-both': {
    title: '동시 사목',
    body: '나와 상대의 사목이 동시에 완성되면, 중력을 적용한 플레이어가 이깁니다.',
  },
  'win-neutral': {
    title: '중립 돌 사목',
    body: '자기 차례가 끝난 시점에 중립 돌로 사목을 만들면 이깁니다.',
  },
  'win-no-space': {
    title: '착수 불가',
    body: '중립 돌을 포함해 상대가 더 이상 둘 곳이 없으면 이깁니다.',
  },
};

function samePos(a: Position, b: Position): boolean {
  return a.row === b.row && a.col === b.col;
}

function setTurn(s: InternalState, color: 'black' | 'white', phase: InternalState['phase']) {
  s.currentColor = color;
  s.currentPlayer = color === 'black' ? s.blackPlayer.id : s.whitePlayer.id;
  s.phase = phase;
}

function clearOutcome(s: InternalState) {
  s.winner = null;
  s.winLine = null;
  s.winType = null;
  s.gameOver = false;
  s.movedPosition = null;
}

function paint(
  board: CellType[][],
  cells: Position[],
  type: CellType,
) {
  for (const p of cells) board[p.row][p.col] = type;
}

function line(row: number, cols: number[]): Position[] {
  return cols.map((col) => ({ row, col }));
}

function demoBoard(s: InternalState, step: FgTutorialStepId) {
  const board = createEmptyBoard();
  s.placedPosition = null;
  s.movedPosition = null;
  s.neutralCandidates = [];
  s.lastGravityBlack = null;
  s.lastGravityWhite = null;
  setTurn(s, 'white', 'waiting');

  switch (step) {
    case 'win-own': {
      const cells = line(8, [2, 3, 4, 5]);
      paint(board, cells, 'white');
      s.board = board;
      s.winLine = cells;
      s.whitePlayer = { ...s.whitePlayer, stoneCount: 4 };
      s.blackPlayer = { ...s.blackPlayer, stoneCount: 0 };
      s.neutralCount = 0;
      break;
    }
    case 'win-opp': {
      const cells = line(8, [2, 3, 4, 5]);
      paint(board, cells, 'black');
      s.board = board;
      s.winLine = cells;
      s.whitePlayer = { ...s.whitePlayer, stoneCount: 0 };
      s.blackPlayer = { ...s.blackPlayer, stoneCount: 4 };
      s.neutralCount = 0;
      break;
    }
    case 'win-both': {
      const mine = line(8, [0, 1, 2, 3]);
      const opp = line(0, [5, 6, 7, 8]);
      paint(board, mine, 'white');
      paint(board, opp, 'black');
      s.board = board;
      s.winLine = [...mine, ...opp];
      s.whitePlayer = { ...s.whitePlayer, stoneCount: 4 };
      s.blackPlayer = { ...s.blackPlayer, stoneCount: 4 };
      s.neutralCount = 0;
      break;
    }
    case 'win-neutral': {
      const cells = line(4, [3, 4, 5, 6]);
      paint(board, cells, 'neutral');
      s.board = board;
      s.winLine = cells;
      s.whitePlayer = { ...s.whitePlayer, stoneCount: 0 };
      s.blackPlayer = { ...s.blackPlayer, stoneCount: 0 };
      s.neutralCount = 4;
      break;
    }
    default: {
      s.board = board;
      s.winLine = null;
      s.whitePlayer = { ...s.whitePlayer, stoneCount: 0 };
      s.blackPlayer = { ...s.blackPlayer, stoneCount: 0 };
      s.neutralCount = 0;
    }
  }
}

const COM_BEATS: Record<TutorialComScript, TutorialComBeat[]> = {
  first: ['place', 'gravity'],
  down: ['place', 'gravity'],
  'down-neutral': ['neutral'],
};

function nextComBeat(script: TutorialComScript, beat: TutorialComBeat): TutorialComBeat | null {
  const beats = COM_BEATS[script];
  const i = beats.indexOf(beat);
  return beats[i + 1] ?? null;
}

function appendComStep(s: InternalState, step: FourGravityActionLike) {
  const log = s.actionLog[s.actionLog.length - 1];
  if (log && log.color === 'black' && log.turnNumber === s.turnNumber) {
    log.steps.push(step);
    return;
  }
  s.actionLog.push({
    turnNumber: s.turnNumber,
    color: 'black',
    nickname: s.blackPlayer.nickname,
    steps: [step],
  });
}

type FourGravityActionLike =
  | { type: 'place'; row: number; col: number }
  | { type: 'gravity'; direction: Direction }
  | { type: 'neutral'; row: number; col: number };

function applyComBeat(s: InternalState, script: TutorialComScript, beat: TutorialComBeat) {
  if (script === 'first' && beat === 'place') {
    const p = FG_TUTORIAL_CELLS.comFirst;
    s.board[p.row][p.col] = 'black';
    s.blackPlayer = { ...s.blackPlayer, stoneCount: 1 };
    s.placedPosition = p;
    appendComStep(s, { type: 'place', row: p.row, col: p.col });
    setTurn(s, 'black', 'gravity');
    return;
  }
  if (script === 'first' && beat === 'gravity') {
    s.lastGravityBlack = 'none';
    s.movedPosition = s.placedPosition;
    s.neutralCandidates = [];
    appendComStep(s, { type: 'gravity', direction: 'none' });
    s.placedPosition = null;
    s.turnNumber += 1;
    return;
  }
  if (script === 'down' && beat === 'place') {
    const p = FG_TUTORIAL_CELLS.comDown;
    s.board[p.row][p.col] = 'black';
    s.blackPlayer = { ...s.blackPlayer, stoneCount: s.blackPlayer.stoneCount + 1 };
    s.placedPosition = p;
    appendComStep(s, { type: 'place', row: p.row, col: p.col });
    setTurn(s, 'black', 'gravity');
    return;
  }
  if (script === 'down' && beat === 'gravity') {
    const before = cloneBoard(s.board);
    s.board = applyGravity(s.board, 'down');
    s.lastGravityBlack = 'down';
    const moved = findMovedPosition(s.placedPosition!, 'down', before, s.board);
    s.movedPosition = moved;
    s.neutralCandidates = calcNeutralCandidates(s.placedPosition!, moved, s.board);
    appendComStep(s, { type: 'gravity', direction: 'down' });
    setTurn(s, 'black', 'neutral');
    return;
  }
  if (beat === 'neutral') {
    const n = FG_TUTORIAL_CELLS.comDownNeutral;
    if (s.board[n.row][n.col] === 'empty') {
      s.board[n.row][n.col] = 'neutral';
      s.neutralCount += 1;
    }
    appendComStep(s, { type: 'neutral', row: n.row, col: n.col });
    s.placedPosition = null;
    s.neutralCandidates = [];
    s.turnNumber += 1;
  }
}

function finishComScript(s: InternalState, script: TutorialComScript) {
  s.tutorialCom = null;
  if (script === 'first') {
    clearOutcome(s);
    setTurn(s, 'white', 'place');
    s.tutorialStep = 'place';
    return;
  }
  if (script === 'down') {
    setTurn(s, 'white', 'waiting');
    s.tutorialStep = 'com-down';
    return;
  }
  s.placedPosition = null;
  s.neutralCandidates = [];
  setTurn(s, 'white', 'place');
  s.tutorialStep = 'place-2';
}

export function clearTutorialComTimer(s: InternalState) {
  if (s.tutorialComTimer) {
    clearTimeout(s.tutorialComTimer);
    s.tutorialComTimer = null;
  }
}

export function beginTutorialCom(s: InternalState, script: TutorialComScript): void {
  clearTutorialComTimer(s);
  s.tutorialCom = { script, beat: 'place', left: FG_TUTORIAL_COM_WAIT };
  setTurn(s, 'black', 'waiting');
}

export function tickTutorialCom(s: InternalState): void {
  const c = s.tutorialCom;
  if (!c) return;
  if (c.left > 1) {
    c.left -= 1;
    return;
  }
  applyComBeat(s, c.script, c.beat);
  const next = nextComBeat(c.script, c.beat);
  if (!next) {
    finishComScript(s, c.script);
    return;
  }
  s.tutorialCom = { script: c.script, beat: next, left: FG_TUTORIAL_COM_WAIT };
}

export function applyTutorialLesson(s: InternalState, step: FgTutorialStepId): void {
  s.tutorialStep = step;
  clearTutorialComTimer(s);
  s.tutorialCom = null;
  clearOutcome(s);
  s.placedPosition = null;
  s.neutralCandidates = [];

  switch (step) {
    case 'intro':
    case 'turn-order':
      s.board = createEmptyBoard();
      s.lastGravityBlack = null;
      s.lastGravityWhite = null;
      s.blackPlayer = { ...s.blackPlayer, stoneCount: 0 };
      s.whitePlayer = { ...s.whitePlayer, stoneCount: 0 };
      s.neutralCount = 0;
      setTurn(s, 'white', 'waiting');
      break;
    default:
      setTurn(s, 'white', 'waiting');
      break;
  }
}

function highlightCells(s: InternalState): Position[] {
  if (s.winLine && s.winLine.length > 0) return s.winLine;
  switch (s.tutorialStep) {
    case 'place':
      return [FG_TUTORIAL_CELLS.place];
    case 'neutral':
      return [FG_TUTORIAL_CELLS.neutral];
    case 'place-2':
      return [FG_TUTORIAL_CELLS.place2];
    default:
      return [];
  }
}

function highlightGravity(s: InternalState): Direction | null {
  if (s.tutorialStep === 'gravity') return 'up';
  if (s.tutorialStep === 'no-repeat') return 'none';
  return null;
}

export function tutorialHint(s: InternalState): FourGravityTutorialHint | null {
  if (s.playMode !== 'tutorial' || !s.tutorialStep) return null;
  const id = s.tutorialStep;
  const copy = COPY[id];
  const done = Boolean(s.winner);
  const last = id === 'win-no-space';
  const com = s.tutorialCom;
  if (com) {
    return {
      step: FG_TUTORIAL_STEPS.indexOf(id) + 1,
      total: FG_TUTORIAL_TOTAL,
      id,
      title: copy.title,
      body: copy.body,
      highlightCells: [],
      highlightGravity: null,
      canAck: false,
      ackLabel: '다음',
      comCountdown: com.left,
    };
  }
  return {
    step: FG_TUTORIAL_STEPS.indexOf(id) + 1,
    total: FG_TUTORIAL_TOTAL,
    id,
    title: done ? '튜토리얼 완료' : copy.title,
    body: done
      ? '로비에서 멀티나 COM으로 한 판 해보세요.'
      : copy.body,
    highlightCells: done ? [] : highlightCells(s),
    highlightGravity: done ? null : highlightGravity(s),
    canAck: !done && ACK_STEPS.has(id),
    ackLabel: last ? '완료' : id === 'intro' ? '시작' : '다음',
    comCountdown: null,
  };
}

export type TutorialAckResult = { ok: true; complete?: true } | { error: string };

export function tutorialAck(s: InternalState): TutorialAckResult {
  if (s.tutorialCom) return { error: 'COM의 수를 기다려 주세요.' };
  switch (s.tutorialStep) {
    case 'intro':
      applyTutorialLesson(s, 'turn-order');
      return { ok: true };
    case 'turn-order':
      beginTutorialCom(s, 'first');
      return { ok: true };
    case 'gravity-move':
      s.tutorialStep = 'neutral';
      s.phase = 'neutral';
      return { ok: true };
    case 'com-down':
      beginTutorialCom(s, 'down-neutral');
      return { ok: true };
    case 'none-skip':
      s.tutorialStep = 'win-intro';
      demoBoard(s, 'win-intro');
      return { ok: true };
    case 'win-intro':
      s.tutorialStep = 'win-own';
      demoBoard(s, 'win-own');
      return { ok: true };
    case 'win-own':
      s.tutorialStep = 'win-opp';
      demoBoard(s, 'win-opp');
      return { ok: true };
    case 'win-opp':
      s.tutorialStep = 'win-both';
      demoBoard(s, 'win-both');
      return { ok: true };
    case 'win-both':
      s.tutorialStep = 'win-neutral';
      demoBoard(s, 'win-neutral');
      return { ok: true };
    case 'win-neutral':
      s.tutorialStep = 'win-no-space';
      demoBoard(s, 'win-no-space');
      return { ok: true };
    case 'win-no-space':
      return { ok: true, complete: true };
    default:
      return { error: '지금은 다음으로 넘어갈 수 없습니다.' };
  }
}

function expectedPlace(s: InternalState): Position | null {
  if (s.phase !== 'place') return null;
  if (s.tutorialStep === 'place') return FG_TUTORIAL_CELLS.place;
  if (s.tutorialStep === 'place-2') return FG_TUTORIAL_CELLS.place2;
  return null;
}

export function tutorialPlace(s: InternalState, row: number, col: number): string | null {
  if (s.tutorialCom) return 'COM의 수를 기다려 주세요.';
  const target = expectedPlace(s);
  if (!target) return '지금은 돌을 놓을 수 없습니다.';
  if (!samePos({ row, col }, target)) return '표시된 칸에 돌을 놓으세요.';
  if (s.board[row][col] !== 'empty') return '이미 돌이 있는 칸입니다.';

  s.board[row][col] = 'white';
  s.placedPosition = { row, col };
  s.whitePlayer = { ...s.whitePlayer, stoneCount: s.whitePlayer.stoneCount + 1 };
  s.actionLog.push({
    turnNumber: s.turnNumber,
    color: 'white',
    nickname: s.whitePlayer.nickname,
    steps: [{ type: 'place', row, col }],
  });
  s.phase = 'gravity';
  if (s.tutorialStep === 'place') s.tutorialStep = 'gravity';
  else if (s.tutorialStep === 'place-2') s.tutorialStep = 'no-repeat';
  return null;
}

export function expectedGravity(s: InternalState): Direction | null {
  if (s.phase !== 'gravity') return null;
  if (s.tutorialStep === 'gravity') return 'up';
  if (s.tutorialStep === 'no-repeat') return 'none';
  return null;
}

export type TutorialGravityResult = 'broadcast' | string;

export function tutorialGravity(s: InternalState, dir: Direction): TutorialGravityResult {
  if (s.tutorialCom) return 'COM의 수를 기다려 주세요.';
  const want = expectedGravity(s);
  if (!want) return '지금은 중력을 선택할 수 없습니다.';
  if (dir !== want) {
    if (want === 'up') return '상을 누르세요.';
    return '무를 고르세요.';
  }

  const log = s.actionLog[s.actionLog.length - 1];
  if (log) log.steps.push({ type: 'gravity', direction: dir });

  if (dir === 'none') {
    s.lastGravityWhite = 'none';
    s.movedPosition = s.placedPosition;
    s.neutralCandidates = [];
    s.tutorialStep = 'none-skip';
    setTurn(s, 'white', 'waiting');
    return 'broadcast';
  }

  const boardBefore = cloneBoard(s.board);
  s.board = applyGravity(s.board, dir);
  s.lastGravityWhite = dir;
  const movedPos = findMovedPosition(s.placedPosition!, dir, boardBefore, s.board);
  s.movedPosition = movedPos;
  s.neutralCandidates = calcNeutralCandidates(s.placedPosition!, movedPos, s.board);
  s.tutorialStep = 'gravity-move';
  setTurn(s, 'white', 'waiting');
  return 'broadcast';
}

export function tutorialNeutral(s: InternalState, row: number, col: number): string | null {
  if (s.tutorialCom) return 'COM의 수를 기다려 주세요.';
  if (s.tutorialStep !== 'neutral' || s.phase !== 'neutral') {
    return '지금은 중립 돌을 놓을 수 없습니다.';
  }
  const target = FG_TUTORIAL_CELLS.neutral;
  if (!samePos({ row, col }, target)) return '표시된 칸에 중립 돌을 놓으세요.';
  if (s.board[row][col] !== 'empty') return '이미 돌이 있는 칸입니다.';

  s.board[row][col] = 'neutral';
  s.neutralCount += 1;
  const log = s.actionLog[s.actionLog.length - 1];
  if (log) log.steps.push({ type: 'neutral', row, col });
  s.turnNumber += 1;
  beginTutorialCom(s, 'down');
  return null;
}
