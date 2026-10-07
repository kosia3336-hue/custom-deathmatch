import { describe, expect, it } from 'vitest';
import { cycleTowerNote, parseTowerNote } from '../../../lib/fiveTowersNotes';

describe('5개의 탑 개인 메모', () => {
  it('같은 숫자를 세 번 누르면 색, 회색, 원복으로 순환한다', () => {
    const color = cycleTowerNote(parseTowerNote(0), 5);
    const gray = cycleTowerNote(color, 5);
    expect(color).toEqual({ height: 5, tone: 'color' });
    expect(gray).toEqual({ height: 5, tone: 'gray' });
    expect(cycleTowerNote(gray, 5)).toEqual({ height: 0, tone: 'color' });
  });
  it('높은 숫자를 누르면 회색 표시도 그 높이까지 함께 이어진다', () => {
    expect(cycleTowerNote({ height: 5, tone: 'gray' }, 8)).toEqual({ height: 8, tone: 'gray' });
    expect(cycleTowerNote({ height: 5, tone: 'color' }, 8)).toEqual({ height: 8, tone: 'color' });
  });
  it('기존 카운트 저장값을 보존하고 손상된 값은 초기화한다', () => {
    expect(parseTowerNote(6)).toEqual({ height: 6, tone: 'color' });
    expect(parseTowerNote({ height: 8, tone: 'gray' })).toEqual({ height: 8, tone: 'gray' });
    expect(parseTowerNote({ height: 'oops', tone: 'gray' })).toEqual({ height: 0, tone: 'color' });
  });
});
