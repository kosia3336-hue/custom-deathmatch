/**
 * 명추리 COM.
 *
 * 알파벳은 무작위로 고른다 — 어느 글자를 고르든 정보량은 비슷하고, 고르는 수를
 * 잘 두는 것보다 결과를 읽어 내는 쪽이 이 게임의 본체다.
 *
 * 명추리는 '판이 하나로 굳었을 때' 외친다. 지금까지 공개된 결과와 모순되지 않는
 * 배치가 **딱 하나만** 남으면 그때부터 두 라운드를 더 두고 선언한다. 곧바로 외치면
 * 사람 입장에서 너무 갑작스럽고, 같은 정보를 사람도 볼 수 있으니 따라올 여지를 준다.
 *
 * 판이 굳지 않아도 MYEONGCHURI_AI_FORCE_ROUND 라운드가 되면 아는 만큼으로 외친다 —
 * 영영 안 외치면 판이 끝나지 않는다.
 */
import {
  evaluateMyeongchuri,
  randomMyeongchuriLetters,
} from '@shared/logic/myeongchuri.js';
import {
  MYEONGCHURI_LETTERS,
  MYEONGCHURI_LETTERS_PER_PICK,
  MYEONGCHURI_NUMBER_COUNT,
  MYEONGCHURI_SYMBOL_COUNT,
  MYEONGCHURI_SYMBOLS,
  type MyeongchuriLetter,
  type MyeongchuriRoundResult,
  type MyeongchuriTile,
} from '@shared/types/myeongchuri.js';

/** 판이 끝내 굳지 않아도 이 라운드가 되면 외친다. */
export const MYEONGCHURI_AI_FORCE_ROUND = 15;
/** 판이 하나로 굳은 뒤 몇 라운드를 더 두고 외치는지. */
export const MYEONGCHURI_AI_DECLARE_DELAY = 2;
/**
 * 탐색 상한. 이 수를 넘으면 '아직 모른다' 로 보고 물러난다.
 *
 * 라운드가 적을 때는 후보가 천문학적이라 끝까지 세는 것이 무의미하다. 서버는
 * 한 판만 도는 것이 아니므로, 답이 안 나오는 탐색에 시간을 쓰지 않고 끊는다.
 */
const MAX_STEPS = 300_000;

type Assignment = Partial<Record<MyeongchuriLetter, MyeongchuriTile>>;

/** 이 라운드의 네 글자가 모두 정해졌다면, 그 배치가 공개된 결과와 맞는지 본다. */
function roundAgrees(round: MyeongchuriRoundResult, assignment: Assignment): boolean {
  const tiles: MyeongchuriTile[] = [];
  for (const letter of round.letters) {
    const tile = assignment[letter];
    if (!tile) return true; // 아직 다 안 정해졌으면 판단을 미룬다
    tiles.push(tile);
  }
  const evaluation = evaluateMyeongchuri(tiles);
  if (round.value != null) return evaluation.value === round.value;
  // 비공개였던 라운드도 정보다 — 같은 사유로 비공개가 되어야 한다
  return evaluation.hidden === round.hidden;
}

/** 아직 모르는 글자 중, 이미 공개된 라운드에 많이 나온 것부터 채운다(빨리 걸러지도록). */
function searchOrder(rounds: MyeongchuriRoundResult[]): MyeongchuriLetter[] {
  const count = new Map<MyeongchuriLetter, number>();
  for (const letter of MYEONGCHURI_LETTERS) count.set(letter, 0);
  for (const round of rounds) {
    for (const letter of round.letters) count.set(letter, (count.get(letter) ?? 0) + 1);
  }
  return [...MYEONGCHURI_LETTERS].sort((a, b) => (count.get(b) ?? 0) - (count.get(a) ?? 0));
}

/**
 * 공개된 결과와 모순되지 않는 배치를 찾는다.
 *
 * 해가 둘째로 나오는 순간 멈춘다 — 전부 셀 필요 없이 '하나뿐인가' 만 알면 된다.
 * 하나뿐이면 그 배치를, 여럿이거나 상한을 넘겼으면 null 을 돌려준다.
 */
export function solveMyeongchuri(
  rounds: MyeongchuriRoundResult[],
): Record<MyeongchuriLetter, MyeongchuriTile> | null {
  if (rounds.length === 0) return null;
  const order = searchOrder(rounds);
  const assignment: Assignment = {};
  const usedNumbers = new Set<number>();
  const usedSymbols = new Set<string>();
  let numbers = 0;
  let symbols = 0;
  let steps = 0;
  let found: Record<MyeongchuriLetter, MyeongchuriTile> | null = null;
  let many = false;

  const place = (index: number): void => {
    if (many || steps > MAX_STEPS) return;
    if (index === order.length) {
      if (found) {
        many = true;
        return;
      }
      found = { ...assignment } as Record<MyeongchuriLetter, MyeongchuriTile>;
      return;
    }
    const letter = order[index];

    const tryTile = (tile: MyeongchuriTile) => {
      if (many || steps > MAX_STEPS) return;
      steps += 1;
      assignment[letter] = tile;
      // 이 글자가 채워지며 완성된 라운드만 확인하면 된다
      const ok = rounds.every((round) =>
        round.letters.includes(letter) ? roundAgrees(round, assignment) : true,
      );
      if (ok) place(index + 1);
      delete assignment[letter];
    };

    if (numbers < MYEONGCHURI_NUMBER_COUNT) {
      numbers += 1;
      for (let value = 1; value <= 9; value += 1) {
        if (usedNumbers.has(value)) continue;
        usedNumbers.add(value);
        tryTile({ kind: 'number', value });
        usedNumbers.delete(value);
      }
      numbers -= 1;
    }
    if (symbols < MYEONGCHURI_SYMBOL_COUNT) {
      symbols += 1;
      for (const value of MYEONGCHURI_SYMBOLS) {
        if (usedSymbols.has(value)) continue;
        usedSymbols.add(value);
        tryTile({ kind: 'symbol', value });
        usedSymbols.delete(value);
      }
      symbols -= 1;
    }
  };

  place(0);
  if (many || steps > MAX_STEPS) return null;
  return found;
}

/** 이번 차례에 놓을 알파벳 — 이번 수식에 아직 없는 것 중 무작위. */
export function chooseMyeongchuriAiLetters(
  picks: readonly MyeongchuriLetter[],
): MyeongchuriLetter[] {
  return randomMyeongchuriLetters(picks, MYEONGCHURI_LETTERS_PER_PICK);
}

export interface MyeongchuriAiPlan {
  /** 지금 명추리를 외칠지 */
  declare: boolean;
  /** 외친다면 낼 답. 판이 굳지 않았다면 아는 만큼 채운 추측이다. */
  answer: Record<string, string> | null;
}

/**
 * 판이 굳은 라운드를 기억해 두고, 두 라운드 뒤에 외친다.
 * solvedAtRound 는 상태에 얹어 두고 이 함수가 갱신한다.
 */
export function planMyeongchuriAi(
  rounds: MyeongchuriRoundResult[],
  round: number,
  solvedAtRound: number | null,
): { solvedAtRound: number | null; plan: MyeongchuriAiPlan } {
  const solution = solveMyeongchuri(rounds);
  const nextSolvedAt = solution ? (solvedAtRound ?? round) : solvedAtRound;

  const ready = solution != null && nextSolvedAt != null && round >= nextSolvedAt + MYEONGCHURI_AI_DECLARE_DELAY;
  const forced = round >= MYEONGCHURI_AI_FORCE_ROUND;
  if (!ready && !forced) return { solvedAtRound: nextSolvedAt, plan: { declare: false, answer: null } };

  return {
    solvedAtRound: nextSolvedAt,
    plan: { declare: true, answer: toAnswer(solution) },
  };
}

/** 배치를 제출 형식(글자 → '1'~'9' 또는 기호)으로. 모르면 아무 값으로나 채운다. */
function toAnswer(
  solution: Record<MyeongchuriLetter, MyeongchuriTile> | null,
): Record<string, string> {
  const answer: Record<string, string> = {};
  if (solution) {
    for (const letter of MYEONGCHURI_LETTERS) {
      const tile = solution[letter];
      answer[letter] = tile.kind === 'number' ? String(tile.value) : tile.value;
    }
    return answer;
  }
  /*
    판이 안 굳었는데 외쳐야 하는 경우(강제 라운드). 틀려도 경고 한 번일 뿐이고,
    그래야 판이 끝난다. 숫자 다섯·기호 넷이라는 것만 지켜 그럴듯하게 채운다.
  */
  const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9].slice(0, MYEONGCHURI_NUMBER_COUNT).map(String);
  const symbols = [...MYEONGCHURI_SYMBOLS].slice(0, MYEONGCHURI_SYMBOL_COUNT);
  const pool = [...digits, ...symbols];
  MYEONGCHURI_LETTERS.forEach((letter, index) => {
    answer[letter] = pool[index] ?? digits[0];
  });
  return answer;
}
