/**
 * 명추리 COM 의 판단.
 *
 * 가장 나쁜 실패는 '틀린 배치를 확정이라고 내놓는 것' 이다 — 그러면 COM 이 엉뚱한
 * 답을 자신 있게 제출한다. 그래서 "확정했다면 반드시 정답" 을 먼저 못 박는다.
 */
import { describe, expect, it } from 'vitest';
import { evaluateMyeongchuri } from '@shared/logic/myeongchuri.js';
import {
  MYEONGCHURI_LETTERS,
  type MyeongchuriLetter,
  type MyeongchuriRoundResult,
  type MyeongchuriSymbol,
  type MyeongchuriTile,
} from '@shared/types/myeongchuri.js';
import {
  MYEONGCHURI_AI_DECLARE_DELAY,
  MYEONGCHURI_AI_FORCE_ROUND,
  chooseMyeongchuriAiLetters,
  planMyeongchuriAi,
  solveMyeongchuri,
} from '../socket/games/myeongchuri/ai.js';

const n = (value: number): MyeongchuriTile => ({ kind: 'number', value });
const s = (value: MyeongchuriSymbol): MyeongchuriTile => ({ kind: 'symbol', value });

/** A=6 B=5 C=+ D=4 E=× F=7 G=- H=Max I=9 */
const FIXED: Record<MyeongchuriLetter, MyeongchuriTile> = {
  A: n(6), B: n(5), C: s('+'), D: n(4), E: s('×'),
  F: n(7), G: s('-'), H: s('Max'), I: n(9),
};

/** 실제 판처럼, 고른 네 글자의 계산 결과를 그대로 담은 라운드를 만든다. */
function round(index: number, letters: MyeongchuriLetter[]): MyeongchuriRoundResult {
  const evaluation = evaluateMyeongchuri(letters.map((letter) => FIXED[letter]));
  return {
    round: index,
    firstPlayerId: 'p1',
    secondPlayerId: 'p2',
    letters,
    value: evaluation.value,
    hidden: evaluation.hidden,
    randomFirst: false,
    randomSecond: false,
  };
}

/** 판이 하나로 굳을 때까지 라운드를 쌓는다. 굳은 시점의 라운드 목록을 돌려준다. */
function roundsUntilSolved(): MyeongchuriRoundResult[] {
  const combos: MyeongchuriLetter[][] = [
    ['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H'], ['I', 'A', 'E', 'C'],
    ['B', 'G', 'D', 'F'], ['H', 'I', 'B', 'E'], ['C', 'F', 'A', 'G'],
    ['D', 'H', 'E', 'I'], ['G', 'A', 'H', 'B'], ['F', 'C', 'I', 'D'],
    ['E', 'B', 'A', 'F'], ['I', 'G', 'C', 'H'], ['D', 'E', 'F', 'A'],
  ];
  const rounds: MyeongchuriRoundResult[] = [];
  for (const [index, letters] of combos.entries()) {
    rounds.push(round(index + 1, letters));
    if (solveMyeongchuri(rounds)) return rounds;
  }
  return rounds;
}

describe('명추리 COM — 배치 추리', () => {
  it('확정했다면 반드시 실제 배치와 같다', () => {
    const rounds: MyeongchuriRoundResult[] = [];
    const combos: MyeongchuriLetter[][] = [
      ['A', 'B', 'C', 'D'], ['E', 'F', 'G', 'H'], ['I', 'A', 'E', 'C'],
      ['B', 'G', 'D', 'F'], ['H', 'I', 'B', 'E'], ['C', 'F', 'A', 'G'],
    ];
    for (const [index, letters] of combos.entries()) {
      rounds.push(round(index + 1, letters));
      const solved = solveMyeongchuri(rounds);
      // 아직 모르면 null 이어도 된다. 다만 안다고 했으면 틀리면 안 된다.
      if (solved) expect(solved).toEqual(FIXED);
    }
  });

  it('정보가 없으면 확정하지 않는다', () => {
    expect(solveMyeongchuri([])).toBeNull();
    // 한 라운드로는 아홉 칸이 정해질 수 없다
    expect(solveMyeongchuri([round(1, ['A', 'B', 'C', 'D'])])).toBeNull();
  });

  it('라운드가 쌓이면 결국 판을 하나로 굳힌다', () => {
    const rounds = roundsUntilSolved();
    expect(solveMyeongchuri(rounds)).toEqual(FIXED);
  });
});

describe('명추리 COM — 알파벳 고르기', () => {
  it('이번 수식에 없는 알파벳 2개를 서로 다르게 고른다', () => {
    for (let i = 0; i < 200; i += 1) {
      const picked = chooseMyeongchuriAiLetters(['A', 'B']);
      expect(picked).toHaveLength(2);
      expect(new Set(picked).size).toBe(2);
      expect(picked).not.toContain('A');
      expect(picked).not.toContain('B');
      for (const letter of picked) expect(MYEONGCHURI_LETTERS).toContain(letter);
    }
  });
});

describe('명추리 COM — 언제 외치는가', () => {
  it('판이 굳어도 곧바로 외치지 않고 두 라운드를 더 둔다', () => {
    const rounds = roundsUntilSolved();
    const solvedAt = rounds.length;

    // 굳은 그 라운드에는 아직 외치지 않는다
    const first = planMyeongchuriAi(rounds, solvedAt, null);
    expect(first.solvedAtRound).toBe(solvedAt);
    expect(first.plan.declare).toBe(false);

    // 한 라운드 더 지나도 아직
    expect(planMyeongchuriAi(rounds, solvedAt + 1, solvedAt).plan.declare).toBe(false);

    // 두 라운드 뒤에 외치고, 답은 실제 배치와 같다
    const ready = planMyeongchuriAi(rounds, solvedAt + MYEONGCHURI_AI_DECLARE_DELAY, solvedAt);
    expect(ready.plan.declare).toBe(true);
    expect(ready.plan.answer).toEqual({
      A: '6', B: '5', C: '+', D: '4', E: '×', F: '7', G: '-', H: 'Max', I: '9',
    });
  });

  it('판이 안 굳어도 정해진 라운드가 되면 아는 만큼으로 외친다', () => {
    const rounds = [round(1, ['A', 'B', 'C', 'D'])];
    expect(planMyeongchuriAi(rounds, MYEONGCHURI_AI_FORCE_ROUND - 1, null).plan.declare).toBe(false);

    const forced = planMyeongchuriAi(rounds, MYEONGCHURI_AI_FORCE_ROUND, null);
    expect(forced.plan.declare).toBe(true);
    // 영영 안 외치면 판이 끝나지 않으므로, 틀리더라도 아홉 칸을 채워 낸다
    expect(Object.keys(forced.plan.answer ?? {})).toHaveLength(MYEONGCHURI_LETTERS.length);
  });
});
