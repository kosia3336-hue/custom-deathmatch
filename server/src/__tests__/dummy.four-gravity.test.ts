import { describe, it, expect } from 'vitest';
import { sampleUnimodalSecond, boardGameThinkSeconds, turnTimeExpired } from '../dummy/thinkTime.js';
import { findImmediateWins } from '../dummy/ai/four-gravity-tactics.js';
import { pickFourGravityAction, type FourGravityDummyView } from '../dummy/ai/four-gravity.js';
import type { CellType } from '@shared/types/four-gravity.js';

const BOARD_SIZE = 9;

function emptyBoard(): CellType[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array(BOARD_SIZE).fill('empty') as CellType[]);
}

describe('dummy thinkTime', () => {
  it('각자 앞 2수(전역 1~4턴)는 항상 5초', () => {
    expect(boardGameThinkSeconds(1)).toBe(5);
    expect(boardGameThinkSeconds(2)).toBe(5);
    expect(boardGameThinkSeconds(3)).toBe(5);
    expect(boardGameThinkSeconds(4)).toBe(5);
  });

  it('5턴부터는 30~90 정수', () => {
    for (let i = 0; i < 40; i++) {
      const t = boardGameThinkSeconds(5);
      expect(t).toBeGreaterThanOrEqual(30);
      expect(t).toBeLessThanOrEqual(90);
      expect(Number.isInteger(t)).toBe(true);
    }
  });

  it('1초 단위이고 60 근처 빈도가 양 끝보다 높다', () => {
    const n = 8000;
    const counts = new Map<number, number>();
    for (let i = 0; i < n; i++) {
      const t = sampleUnimodalSecond(30, 90, 60);
      counts.set(t, (counts.get(t) ?? 0) + 1);
    }
    expect(counts.size).toBeGreaterThan(20);
    const near = (counts.get(60) ?? 0) + (counts.get(59) ?? 0) + (counts.get(61) ?? 0);
    const edge = (counts.get(30) ?? 0) + (counts.get(90) ?? 0);
    expect(near).toBeGreaterThan(edge);
  });

  it('턴 제한이 지나면 turnTimeExpired', () => {
    expect(turnTimeExpired(Date.now() - 180_000, 180)).toBe(true);
    expect(turnTimeExpired(Date.now(), 180)).toBe(false);
    expect(turnTimeExpired(Date.now(), null)).toBe(false);
  });
});

describe('사목 더미 즉시승', () => {
  it('가로 3에 붙여 gravity none이면 즉시승으로 잡는다', () => {
    const board = emptyBoard();
    board[4][2] = 'black';
    board[4][3] = 'black';
    board[4][4] = 'black';
    const wins = findImmediateWins(board, 'black', {
      lastGravityBlack: null,
      lastGravityWhite: null,
    });
    expect(wins.some((m) => m.place.row === 4 && m.place.col === 5 && m.gravity === 'none')).toBe(true);
  });

  it('하 등급도 즉시승을 버린다', () => {
    const board = emptyBoard();
    board[4][2] = 'black';
    board[4][3] = 'black';
    board[4][4] = 'black';
    const view: FourGravityDummyView = {
      gameOver: false,
      turnNumber: 6,
      turnStartedAt: Date.now(),
      timeLimitSeconds: 180,
      lastGravityBlack: null,
      lastGravityWhite: null,
      data: {
        board,
        currentPlayer: 'dummy',
        currentColor: 'black',
        phase: 'place',
        lastGravity: null,
        placedPosition: null,
        movedPosition: null,
        neutralCandidates: [],
        players: {
          black: { id: 'dummy', nickname: 'd', stoneCount: 3 },
          white: { id: 'human', nickname: 'h', stoneCount: 0 },
        },
        neutralCount: 0,
        winner: null,
        winLine: null,
        winType: null,
      },
    };
    const picked = pickFourGravityAction(view, 'dummy', '하', null);
    expect(picked).not.toBeNull();
    expect(picked!.action.type).toBe('place');
    expect(picked!.pending).not.toBeNull();
    const wins = findImmediateWins(board, 'black', {
      lastGravityBlack: null,
      lastGravityWhite: null,
    });
    const place = picked!.action as { type: 'place'; row: number; col: number };
    expect(wins.some((m) => m.place.row === place.row && m.place.col === place.col)).toBe(true);
  });
});
