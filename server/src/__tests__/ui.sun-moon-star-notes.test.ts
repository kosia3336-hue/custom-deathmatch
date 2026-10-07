import { describe, expect, it } from 'vitest';
import {
  powderStagesForRound,
  readPowderRoundNote,
  updatePowderRoundNote,
} from '../../../lib/sunMoonStarNotes';
import type { SMS2GameData } from '../../../shared/types/sun-moon-star-2';

describe('해달별2 라운드별 상대 빛가루 추리', () => {
  it('새 라운드는 빈 메모이며 과거 라운드 수정은 다른 메모를 바꾸지 않는다', () => {
    const r1 = updatePowderRoundNote({}, 1, 'sun', 7);
    expect(readPowderRoundNote(r1, 2)).toEqual({ sun: 0, moon: 0, star: 0 });
    const r2 = updatePowderRoundNote(r1, 2, 'moon', 12);
    const edited = updatePowderRoundNote(r2, 1, 'sun', 9);
    expect(readPowderRoundNote(edited, 1).sun).toBe(9);
    expect(readPowderRoundNote(edited, 2).moon).toBe(12);
    expect(readPowderRoundNote(r1, 1).sun).toBe(7);
  });
  it('공개 단계 갱신과 과거 기록 확인은 추리값을 덮어쓰지 않는다', () => {
    const data = {
      round: 2,
      players: { p2: { powderStage: 3 } },
      history: [{ round: 1, stageBefore: { p2: 5 }, stageAfter: { p2: 4 } }],
    } as SMS2GameData;
    const notes = updatePowderRoundNote({}, 1, 'star', 15);
    expect(powderStagesForRound(data, 'p2', 1)).toEqual({ before: 5, after: 4 });
    expect(powderStagesForRound(data, 'p2', 2)).toEqual({ before: 4, after: 3 });
    expect(readPowderRoundNote(notes, 1).star).toBe(15);
    expect(powderStagesForRound({ ...data, suddenDeath: true }, 'p2', 2).before).toBe(4);
  });
  it('입력값을 정수/보유 가능 최대치로 제한한다', () => {
    expect(updatePowderRoundNote({}, 1, 'sun', 81, 60)[1].sun).toBe(60);
    expect(updatePowderRoundNote({}, 1, 'sun', -2)[1].sun).toBe(0);
    expect(updatePowderRoundNote({}, 1, 'sun', 2.9)[1].sun).toBe(2);
    expect(updatePowderRoundNote({}, 1, 'sun', NaN)[1].sun).toBe(0);
  });
});
