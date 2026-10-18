import { describe, expect, it } from 'vitest';
import {
  bnw2NoteStage,
  initializeBNW2PointNotes,
  updateBNW2PointNote,
} from '../../../lib/bnw2PointNotes';
import type { BNW2GameData } from '../../../shared/types/bnw2';

describe('흑과백2 라운드별 개인 메모', () => {
  it('새 라운드는 직전 메모를 이어받고 0도 유지한다', () => {
    const first = updateBNW2PointNote(initializeBNW2PointNotes({}, 1), 1, 193, 10);
    expect(initializeBNW2PointNotes(first, 3)).toEqual({ 1: 193, 2: 193, 3: 193 });
    expect(initializeBNW2PointNotes({ 1: 0 }, 2)).toEqual({ 1: 0, 2: 0 });
    expect(initializeBNW2PointNotes(first, 1)).toBe(first);
  });

  it('과거 메모 수정·초기화가 현재 메모에 영향을 주지 않는다', () => {
    const second = initializeBNW2PointNotes({ 1: 193 }, 2);
    const edited = updateBNW2PointNote(second, 1, 185, 10);
    expect(edited[1]).toBe(185);
    expect(edited[2]).toBe(193);
    expect(updateBNW2PointNote(edited, 1, 200, 10)).toEqual({ 1: 200, 2: 193 });
    expect(second[1]).toBe(193);
  });

  it('라운드 이동이나 단계 변경으로 기존 추정값을 자동으로 초기화하지 않는다', () => {
    const notes = { 1: 193, 2: 183 };
    expect(initializeBNW2PointNotes(notes, 1)).toBe(notes);
    expect(initializeBNW2PointNotes(notes, 2)).toBe(notes);
  });

  it('입력은 선택한 라운드의 공개된 단계 범위 안의 정수로 제한한다', () => {
    expect(updateBNW2PointNote({}, 1, 199, 3)[1]).toBe(60);
    expect(updateBNW2PointNote({}, 1, -1, 3)[1]).toBe(41);
    expect(updateBNW2PointNote({}, 1, 52.9, 3)[1]).toBe(52);
    // 맨 아래 칸은 0 과 1~20 이 같은 모양이라 0~20 — 올인(잔여 0)이 드러나지 않는다
    expect(updateBNW2PointNote({}, 1, 10, 0)[1]).toBe(10);
    expect(updateBNW2PointNote({}, 1, 0, 1)[1]).toBe(0);
    expect(updateBNW2PointNote({}, 1, 25, 1)[1]).toBe(20);
    expect(updateBNW2PointNote({}, 0, 1, 3)).toEqual({});
    expect(updateBNW2PointNote({}, 1, NaN, 3)).toEqual({});
  });

  it('과거 메모는 과거 공개 단계, 현재 메모는 현재 단계만 참조한다', () => {
    const data = {
      round: 2,
      players: { opponent: { stage: 3, remainingPoints: null } },
      roundHistory: [{ round: 1, players: { opponent: { stageAfter: 8, points: null } } }],
    } as unknown as BNW2GameData;
    expect(bnw2NoteStage(data, 'opponent', 1)).toBe(8);
    expect(bnw2NoteStage(data, 'opponent', 2)).toBe(3);
  });
});
