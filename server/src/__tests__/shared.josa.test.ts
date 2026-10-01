import { describe, expect, it } from 'vitest';
import { josa } from '../../../shared/lib/josa';

describe('조사 고르기', () => {
  it('받침 없는 닉네임에는 가·를·는·와·로', () => {
    expect(josa('나', '이/가')).toBe('나가');
    expect(josa('상대', '이/가')).toBe('상대가');
    expect(josa('나', '을/를')).toBe('나를');
    expect(josa('영희', '은/는')).toBe('영희는');
    expect(josa('바다', '과/와')).toBe('바다와');
    expect(josa('바다', '으로/로')).toBe('바다로');
  });

  it('받침 있는 닉네임에는 이·을·은·과·으로', () => {
    expect(josa('선플', '이/가')).toBe('선플이');
    expect(josa('후플', '이/가')).toBe('후플이');
    expect(josa('판', '을/를')).toBe('판을');
    expect(josa('산', '으로/로')).toBe('산으로');
  });

  it('ㄹ 받침은 으로 대신 로', () => {
    expect(josa('길', '으로/로')).toBe('길로');
    expect(josa('길', '이/가')).toBe('길이');
  });

  it('영문·숫자는 읽는 소리로 본다', () => {
    expect(josa('Tom', '이/가')).toBe('Tom이');
    expect(josa('Alice', '이/가')).toBe('Alice가');
    expect(josa('player7', '이/가')).toBe('player7이');
    expect(josa('bot2', '이/가')).toBe('bot2가');
    expect(josa('Lv.3', '이/가')).toBe('Lv.3이');
  });

  it('낱자 자음은 받침이 있는 것으로 본다', () => {
    expect(josa('ㅋㅋ', '이/가')).toBe('ㅋㅋ이');
  });

  it('판단할 수 없으면 둘 다 적는다', () => {
    expect(josa('별⭐', '이/가')).toBe('별⭐이(가)');
    expect(josa('???', '을/를')).toBe('???을(를)');
    expect(josa('!!', '으로/로')).toBe('!!(으)로');
  });
});
