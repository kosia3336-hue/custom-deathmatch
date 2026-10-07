import { describe, expect, it } from 'vitest';
import { cycleTowerNote, parseTowerNote, towerNoteTone } from '../../../lib/fiveTowersNotes';

const tones = (note: ReturnType<typeof parseTowerNote>) =>
  Array.from({ length: 10 }, (_, i) => towerNoteTone(note, i + 1));
describe('5개의 탑 개인 메모', () => {
  it('5칸을 두 번 누르면 5칸만 회색이고 세 번째에는 원복된다', () => {
    const color = cycleTowerNote(parseTowerNote(0), 5);
    const gray = cycleTowerNote(color, 5);
    expect(tones(color)).toEqual([...Array(5).fill('color'), ...Array(5).fill('empty')]);
    expect(tones(gray)).toEqual([...Array(4).fill('color'), 'gray', ...Array(5).fill('empty')]);
    expect(cycleTowerNote(gray, 5)).toEqual({ height: 0, grayFrom: null });
  });
  it('맨 위가 회색일 때 아래 칸을 누르면 그 칸부터 맨 위까지만 회색이다', () => {
    const note = cycleTowerNote({ height: 5, grayFrom: 5 }, 3);
    expect(note).toEqual({ height: 5, grayFrom: 3 });
    expect(tones(note)).toEqual([
      'color',
      'color',
      'gray',
      'gray',
      'gray',
      ...Array(5).fill('empty'),
    ]);
  });
  it('높은 숫자를 누르면 기존 회색 구간도 새 높이까지 이어진다', () => {
    expect(cycleTowerNote({ height: 5, grayFrom: 3 }, 8)).toEqual({ height: 8, grayFrom: 3 });
    expect(cycleTowerNote({ height: 5, grayFrom: null }, 8)).toEqual({ height: 8, grayFrom: null });
  });
  it('숫자 및 이전 전체 회색 저장값을 안전하게 옮긴다', () => {
    expect(parseTowerNote(6)).toEqual({ height: 6, grayFrom: null });
    expect(parseTowerNote({ height: 8, tone: 'gray' })).toEqual({ height: 8, grayFrom: 8 });
    expect(parseTowerNote({ height: 5, grayFrom: 3 })).toEqual({ height: 5, grayFrom: 3 });
    expect(parseTowerNote({ height: 'oops', grayFrom: 3 })).toEqual({ height: 0, grayFrom: null });
  });
});
