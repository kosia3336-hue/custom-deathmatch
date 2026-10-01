import { describe, it, expect } from 'vitest';
import { createEmptyBoard } from '../socket/games/four-gravity/board.js';
import type { InternalState } from '../socket/games/four-gravity/types.js';
import {
  FG_TUTORIAL_CELLS,
  TUTORIAL_GUIDE_ID,
  applyTutorialLesson,
  tickTutorialCom,
  tutorialAck,
  tutorialGravity,
  tutorialHint,
  tutorialNeutral,
  tutorialPlace,
} from '../socket/games/four-gravity/tutorial.js';

function makeState(): InternalState {
  const white = { id: 'p1', nickname: '나', stoneCount: 0 };
  const black = { id: TUTORIAL_GUIDE_ID, nickname: 'COM', stoneCount: 0 };
  const s: InternalState = {
    endGameCallback: () => {},
    roomId: 'tut-1',
    board: createEmptyBoard(),
    currentPlayer: white.id,
    currentColor: 'white',
    phase: 'waiting',
    turnNumber: 1,
    lastGravityBlack: null,
    lastGravityWhite: null,
    placedPosition: null,
    movedPosition: null,
    neutralCandidates: [],
    blackPlayer: black,
    whitePlayer: white,
    neutralCount: 0,
    winner: null,
    winLine: null,
    winType: null,
    startedAt: 0,
    turnStartedAt: 0,
    timeLimitSeconds: null,
    turnTimer: null,
    playMode: 'tutorial',
    aiDifficulty: 'normal',
    superAi: false,
    gameOver: false,
    reviewing: false,
    actionLog: [],
    undoSnapshots: [],
    ownerToken: null,
    tutorialStep: 'intro',
    tutorialCom: null,
    tutorialComTimer: null,
  };
  applyTutorialLesson(s, 'intro');
  return s;
}

function flushCom(s: InternalState) {
  let guard = 0;
  while (s.tutorialCom && guard++ < 20) tickTutorialCom(s);
}

describe('사중력 사목 튜토리얼', () => {
  it('intro에서 시작만 받고 돌 놓기는 거절한다', () => {
    const s = makeState();
    expect(tutorialPlace(s, 6, 4)).toBeTruthy();
    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('turn-order');
  });

  it('COM 선공 전에는 표시된 칸이 아니면 돌을 놓을 수 없다', () => {
    const s = makeState();
    tutorialAck(s);
    tutorialAck(s);
    flushCom(s);
    expect(s.tutorialStep).toBe('place');
    expect(s.board[4][4]).toBe('black');
    expect(tutorialPlace(s, 0, 0)).toBe('표시된 칸에 돌을 놓으세요.');
    expect(s.board[6][4]).toBe('empty');
  });

  it('16단계를 따라가면 후공이 상·중립·무를 배우고 완료한다', () => {
    const s = makeState();
    expect(tutorialHint(s)?.ackLabel).toBe('시작');

    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('turn-order');

    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialCom?.left).toBe(2);
    expect(s.board[4][4]).toBe('empty');
    expect(tutorialHint(s)?.comCountdown).toBe(2);
    tickTutorialCom(s);
    expect(s.tutorialCom?.left).toBe(1);
    expect(s.board[4][4]).toBe('empty');
    flushCom(s);
    expect(s.tutorialStep).toBe('place');
    expect(s.tutorialCom).toBeNull();
    expect(tutorialHint(s)?.highlightCells).toEqual([FG_TUTORIAL_CELLS.place]);
    expect(s.currentColor).toBe('white');
    expect(s.currentPlayer).toBe('p1');
    expect(s.board[FG_TUTORIAL_CELLS.comFirst.row][FG_TUTORIAL_CELLS.comFirst.col]).toBe('black');

    expect(tutorialPlace(s, FG_TUTORIAL_CELLS.place.row, FG_TUTORIAL_CELLS.place.col)).toBeNull();
    expect(s.tutorialStep).toBe('gravity');
    expect(s.board[6][4]).toBe('white');

    expect(tutorialGravity(s, 'down')).toBe('상을 누르세요.');
    expect(tutorialGravity(s, 'up')).toBe('broadcast');
    expect(s.tutorialStep).toBe('gravity-move');
    expect(s.board[0][4]).toBe('black');
    expect(s.board[1][4]).toBe('white');
    expect(s.lastGravityWhite).toBe('up');

    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('neutral');
    expect(s.phase).toBe('neutral');

    expect(tutorialNeutral(s, 0, 0)).toBe('표시된 칸에 중립 돌을 놓으세요.');
    expect(tutorialNeutral(s, FG_TUTORIAL_CELLS.neutral.row, FG_TUTORIAL_CELLS.neutral.col)).toBeNull();
    expect(s.tutorialCom?.script).toBe('down');
    flushCom(s);
    expect(s.tutorialStep).toBe('com-down');
    expect(s.board[2][4]).toBe('black');
    expect(s.board[3][4]).toBe('white');
    expect(s.board[4][4]).toBe('neutral');
    expect(s.board[8][7]).toBe('black');
    expect(s.board[5][7]).toBe('empty');
    expect(s.lastGravityBlack).toBe('down');

    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialCom?.script).toBe('down-neutral');
    flushCom(s);
    expect(s.board[5][7]).toBe('neutral');
    expect(s.tutorialStep).toBe('place-2');

    expect(tutorialPlace(s, FG_TUTORIAL_CELLS.place2.row, FG_TUTORIAL_CELLS.place2.col)).toBeNull();
    expect(s.tutorialStep).toBe('no-repeat');
    expect(s.board[5][4]).toBe('white');

    expect(tutorialGravity(s, 'up')).toBe('무를 고르세요.');
    expect(tutorialGravity(s, 'none')).toBe('broadcast');
    expect(s.tutorialStep).toBe('none-skip');
    expect(s.board[5][4]).toBe('white');

    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('win-intro');
    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('win-own');
    expect(s.winLine).toHaveLength(4);
    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('win-opp');
    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('win-both');
    expect(s.winLine).toHaveLength(8);
    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('win-neutral');
    expect(tutorialAck(s)).toEqual({ ok: true });
    expect(s.tutorialStep).toBe('win-no-space');
    expect(tutorialHint(s)?.ackLabel).toBe('완료');
    expect(tutorialAck(s)).toEqual({ ok: true, complete: true });
  });
});
