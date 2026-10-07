import { describe, expect, it } from 'vitest';
import {
  clearSilperTileNote,
  createSilperRoundNotes,
  initializeSilperRoundNotes,
  updateSilperTileNote,
} from '../../../lib/silperTileNotes';
import { SBNW_INITIAL_TILES, type SBNWRoundRecord } from '../../../shared/types/silper-bnw';

describe('실퍼의 흑과백 개인 라운드 메모', () => {
  it('새 라운드는 직전 메모를 이어받고 과거 편집·초기화와 독립적으로 유지한다', () => {
    const first = updateSilperTileNote({}, 1, 0, 3);
    const next = initializeSilperRoundNotes(first, 2);
    expect(next[2][0]).toBe(3);
    expect(next[2]).not.toBe(next[1]);
    const edited = updateSilperTileNote(updateSilperTileNote(next, 2, 1, 2), 1, 0, 1);
    expect(edited[2]).toEqual({ ...SBNW_INITIAL_TILES, 0: 3, 1: 2 });
    expect(edited[1][0]).toBe(1);
    expect(first[1][0]).toBe(3);
    const reset = clearSilperTileNote(edited, 1);
    expect(reset[1]).toEqual(SBNW_INITIAL_TILES);
    expect(reset[2]).toEqual(edited[2]);
    expect(initializeSilperRoundNotes(reset, 3)[3]).toEqual(edited[2]);
    expect(initializeSilperRoundNotes(reset, 2)).toBe(reset);
  });

  it('중간 입장에서는 이전 공개 기록만 반영하고 재대결·다른 플레이어·이후 기록을 제외한다', () => {
    const record = (round: number, rematchIndex: number, player: string, tiles: number[]) =>
      ({ round, rematchIndex, players: { [player]: { tilesUsed: tiles } } }) as SBNWRoundRecord;
    const history = [
      record(1, 0, 'opponent', [0, 1]),
      record(2, 0, 'opponent', [1, 3]),
      record(3, 0, 'opponent', [4]),
      record(1, 1, 'opponent', [2]),
      record(1, 0, 'me', [4]),
    ];
    const snapshot = JSON.stringify(history);
    const notes = createSilperRoundNotes(3, 0, history, 'opponent');
    expect(notes[1]).toEqual(SBNW_INITIAL_TILES);
    expect(notes[2]).toEqual({ ...SBNW_INITIAL_TILES, 0: 5, 1: 4 });
    expect(notes[3]).toEqual({ ...SBNW_INITIAL_TILES, 0: 5, 1: 3, 3: 2 });
    expect(createSilperRoundNotes(2, 1, history, 'opponent')[2]).toEqual({
      ...SBNW_INITIAL_TILES,
      2: 3,
    });
    updateSilperTileNote(notes, 3, 0, 0);
    expect(JSON.stringify(history)).toBe(snapshot);
  });

  it('타일 보유 최대치 안에서만 입력하고 소수와 잘못된 라운드는 거부한다', () => {
    const notes = initializeSilperRoundNotes({}, 1);
    expect(updateSilperTileNote(notes, 1, 4, 99)[1][4]).toBe(1);
    expect(updateSilperTileNote(notes, 1, 0, -10)[1][0]).toBe(0);
    expect(updateSilperTileNote(notes, 1, 1, 1.5)).toBe(notes);
    expect(updateSilperTileNote(notes, 12, 1, 1)).toBe(notes);
    expect(clearSilperTileNote(notes, 0)).toBe(notes);
  });
});
