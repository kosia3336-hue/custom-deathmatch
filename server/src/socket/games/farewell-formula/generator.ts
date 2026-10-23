import { setImmediate } from 'node:timers/promises';
import {
  DEFAULT_FAREWELL_FORMULA_DIFFICULTY,
  FAREWELL_FORMULA_DIFFICULTIES,
  type FarewellFormulaDifficulty,
} from '@shared/types/farewell-formula.js';
import { getFarewellFormulaPuzzleBank } from './bank.js';
import {
  generateProceduralFarewellPuzzle,
  type FarewellGoodbyeCount,
  type FarewellRandomSource,
} from './procedural.js';
import type { FarewellFormulaPuzzle } from './types.js';

export { getFarewellFormulaPuzzleBank } from './bank.js';

const ROUND_GOODBYE_COUNTS = [2, 2, 3, 3, 4, 4, 5] as const;
const GOODBYE_COUNTS = [2, 3, 4, 5] as const;
const CACHE_PER_BUCKET = 2;
const RECENT_KEY_LIMIT = 512;

interface PuzzleBucket {
  count: FarewellGoodbyeCount;
  difficulty: FarewellFormulaDifficulty;
  ready: FarewellFormulaPuzzle[];
}

function clonePuzzle(puzzle: FarewellFormulaPuzzle): FarewellFormulaPuzzle {
  return {
    ...puzzle,
    tokens: puzzle.tokens.map((token) => ({ ...token })),
    solutions: puzzle.solutions.map((solution) => ({
      removedUnitIds: [...solution.removedUnitIds],
      expression: solution.expression,
    })),
  };
}

/** 진행 중인 방의 타이머를 막지 않도록 백그라운드에서 검증한 문제만 캐시에 넣는다. */
export class FarewellFormulaPuzzlePool {
  private readonly buckets = FAREWELL_FORMULA_DIFFICULTIES.flatMap((difficulty) =>
    GOODBYE_COUNTS.map((count): PuzzleBucket => ({ count, difficulty, ready: [] })),
  );
  private readonly pending = new Set<PuzzleBucket>();
  private readonly recentKeys = new Set<string>();
  private readonly fallback = getFarewellFormulaPuzzleBank();
  private refillPromise: Promise<void> | null = null;

  constructor(private readonly random: FarewellRandomSource = Math.random) {}

  /** 서버 기동 때 8개 버킷(난이도×삭제 횟수)을 미리 채운다. */
  warm(): Promise<void> {
    for (const bucket of this.buckets) {
      if (bucket.ready.length < CACHE_PER_BUCKET) this.pending.add(bucket);
    }
    return this.refill();
  }

  take(
    round: number,
    usedKeys: ReadonlySet<string>,
    difficulty: FarewellFormulaDifficulty,
    random: FarewellRandomSource = this.random,
  ): FarewellFormulaPuzzle {
    const count =
      ROUND_GOODBYE_COUNTS[Math.max(0, Math.min(ROUND_GOODBYE_COUNTS.length - 1, round - 1))]!;
    const bucket = this.buckets.find(
      (entry) => entry.count === count && entry.difficulty === difficulty,
    )!;
    // 생성 문제는 꺼내 쓰고 버린다. 같은 방의 문제와 겹치는 캐시 항목도 제외한다.
    const index = bucket.ready.findIndex((puzzle) => !usedKeys.has(puzzle.key));
    const generated = index < 0 ? null : bucket.ready.splice(index, 1)[0]!;
    this.pending.add(bucket);
    void this.refill().catch((error: unknown) => {
      console.warn('[이별 공식] 자동 출제 캐시 보충 실패', error);
    });
    if (generated) return clonePuzzle(generated);

    // 부팅 직후·동시 게임 증가·검증 시간 초과 시에도 이미 검증된 문제로 즉시 시작한다.
    const fallback = this.fallback.filter(
      (puzzle) =>
        puzzle.goodbyeCount === count &&
        puzzle.difficulty === difficulty &&
        !usedKeys.has(puzzle.key),
    );
    const selected = fallback[Math.floor(random() * fallback.length)];
    if (!selected) throw new Error(`[이별 공식] ${difficulty} ${count}회 문제 후보가 없습니다.`);
    return clonePuzzle(selected);
  }

  private refill(): Promise<void> {
    if (!this.refillPromise) {
      this.refillPromise = this.fillPending().finally(() => {
        this.refillPromise = null;
      });
    }
    return this.refillPromise;
  }

  private async fillPending() {
    // take()는 조합 검증을 실행하지 않고 바로 반환한다.
    await setImmediate();
    while (this.pending.size > 0) {
      const bucket = this.pending.values().next().value!;
      this.pending.delete(bucket);
      if (bucket.ready.length >= CACHE_PER_BUCKET) continue;
      const puzzle = await generateProceduralFarewellPuzzle(
        bucket.count,
        bucket.difficulty,
        this.recentKeys,
        this.random,
      );
      if (!puzzle) continue;
      bucket.ready.push(puzzle);
      this.recentKeys.add(puzzle.key);
      if (this.recentKeys.size > RECENT_KEY_LIMIT) {
        this.recentKeys.delete(this.recentKeys.values().next().value!);
      }
      // 한 종류가 캐시를 독점하지 않도록 다른 버킷 뒤에 재등록한다.
      if (bucket.ready.length < CACHE_PER_BUCKET) this.pending.add(bucket);
    }
  }
}

const puzzlePool = new FarewellFormulaPuzzlePool();

export function warmFarewellFormulaPuzzles() {
  return puzzlePool.warm();
}

export function generateFarewellFormulaPuzzle(
  round: number,
  usedKeys: ReadonlySet<string> = new Set(),
  random: FarewellRandomSource = Math.random,
  difficulty: FarewellFormulaDifficulty = DEFAULT_FAREWELL_FORMULA_DIFFICULTY,
): FarewellFormulaPuzzle {
  return puzzlePool.take(round, usedKeys, difficulty, random);
}
