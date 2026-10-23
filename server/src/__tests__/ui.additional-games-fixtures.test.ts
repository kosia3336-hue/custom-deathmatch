import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it, vi } from 'vitest';
import type { IO, TypedSocket } from '../socket/types.js';
import type { Player } from '@shared/types/room.js';
const games = [
  ['word-puzzle', 'WordPuzzle'],
  ['transletter', 'Transletter'],
  ['formula-completion', 'FormulaCompletion'],
  ['complete-hap', 'CompleteHap'],
  ['knights-tour', 'KnightTour'],
  ['kingmaking', 'Kingmaking'],
  ['triple-gomoku', 'TripleGomoku'],
  ['choice-holdem', 'ChoiceHoldem'],
  ['myeongchuri', 'Myeongchuri'],
  ['farewell-formula', 'FarewellFormula'],
  ['loop-check', 'LoopCheck'],
];
const modules: Record<string, () => Promise<any>> = {
  'word-puzzle': () => import('../socket/games/word-puzzle/index.js'),
  transletter: () => import('../socket/games/transletter/index.js'),
  'formula-completion': () => import('../socket/games/formula-completion/index.js'),
  'complete-hap': () => import('../socket/games/complete-hap/index.js'),
  'knights-tour': () => import('../socket/games/knights-tour/index.js'),
  kingmaking: () => import('../socket/games/kingmaking/index.js'),
  'triple-gomoku': () => import('../socket/games/triple-gomoku/index.js'),
  'choice-holdem': () => import('../socket/games/choice-holdem/index.js'),
  myeongchuri: () => import('../socket/games/myeongchuri/index.js'),
  'farewell-formula': () => import('../socket/games/farewell-formula/index.js'),
  'loop-check': () => import('../socket/games/loop-check/index.js'),
};
const path = fileURLToPath(new URL('../../../public/dev/refactor-fixtures', import.meta.url));
describe('additional previews use private server projections', () => {
  for (const [slug, name] of games)
    it(slug, async () => {
      vi.useFakeTimers();
      const mod = await modules[slug]();
      const roomId = `preview-${slug}`;
      const players = ['me', 'opponent'].map(
        (id, i) =>
          ({
            id,
            nickname: i ? '상대 플레이어' : 'MIS2',
            isHost: !i,
            isReady: true,
            joinedAt: Date.now(),
          }) satisfies Player,
      );
      const io = {
        in: () => ({ fetchSockets: async () => [] }),
        to: () => ({ emit: vi.fn() }),
      } as unknown as IO;
      const snapshots: Record<string, any> = {};
      const data = (id = 'me') => {
        const socket = { id, emit: vi.fn() } as unknown as TypedSocket;
        mod[`emit${name}StateToSocket`](socket, roomId);
        return (socket.emit as any).mock.calls.find((c: any[]) => c[0] === 'game:state')?.[1]
          .gameData;
      };
      const act = (id: string, action: Record<string, unknown>) => {
        const socket = { id, emit: vi.fn() } as unknown as TypedSocket;
        mod[`handle${name}Action`](io, socket, roomId, action);
        expect((socket.emit as any).mock.calls.filter((c: any[]) => c[0] === 'error')).toEqual([]);
      };
      const save = () => {
        const d = data();
        if (d) snapshots[d.phase] = d;
      };
      try {
        mod[`init${name}`](io, roomId, players, 'multi', Date.now(), 60, vi.fn());
        snapshots.initial = data();
        snapshots.spectator = data('spectator');
        expect(snapshots.initial.players.me.nickname).toBe('MIS2');
        expect(Object.keys(snapshots.spectator.players)).toEqual(
          Object.keys(snapshots.initial.players),
        );
        if (slug === 'word-puzzle') {
          await vi.advanceTimersByTimeAsync(snapshots.initial.roundSeconds * 1000);
          save();
          expect(data().phase).toBe('reveal');
        }
        if (slug === 'transletter') {
          await vi.advanceTimersByTimeAsync(snapshots.initial.timeLimitSec * 1000);
          save();
          expect(data().phase).toBe('finished');
        }
        if (slug === 'formula-completion') {
          const st = await import('../socket/games/formula-completion/state.js');
          act('me', {
            type: 'submit',
            expression: st.formulaCompletionStates.get(roomId)!.solution,
          });
          save();
          expect(data().lastResult.outcome).toBe('correct');
        }
        if (slug === 'complete-hap') {
          const gen = await import('../socket/games/complete-hap/generator.js');
          act('me', {
            type: 'call-gyul',
            sets: gen.findCompleteHapSets(snapshots.initial.board.cards),
          });
          save();
          expect(data().lastRoundResult.correct).toBe(true);
        }
        if (slug === 'loop-check') {
          const st = await import('../socket/games/loop-check/state.js');
          expect(snapshots.initial.solution).toBeUndefined();
          expect(snapshots.spectator.solution).toBeUndefined();
          act('me', {
            type: 'submit',
            roundId: snapshots.initial.roundId,
            path: st.loopCheckStates.get(roomId)!.solution,
          });
          save();
          expect(data().lastResult.outcome).toBe('correct');
        }
        if (slug === 'knights-tour') {
          act('me', { type: 'move', ...snapshots.initial.board.activeCells[0] });
          save();
          act('me', { type: 'submit' });
          act('opponent', { type: 'submit' });
          save();
          expect(data().lastRoundResult.visitedCounts.me).toBe(1);
        }
        if (slug === 'kingmaking') {
          act(data().currentPlayerId, { type: 'place', kind: 'normal', to: { row: 0, col: 0 } });
          save();
          expect(data().board[0][0]).toHaveLength(1);
        }
        if (slug === 'triple-gomoku') {
          for (const cell of [
            { q: -3, r: 0 },
            { q: 3, r: 0 },
            { q: 0, r: -3 },
            { q: 0, r: 3 },
          ]) {
            act(data().currentPlayerId, { type: 'place', to: cell });
            save();
          }
        }
        if (slug === 'choice-holdem') {
          expect(snapshots.initial.players.opponent.cards.every((c: unknown) => c === null)).toBe(
            true,
          );
          expect(snapshots.spectator.players.me.cards.every((c: unknown) => c === null)).toBe(true);
          act(data().currentTurnId, { type: 'call' });
          act(data().currentTurnId, { type: 'call' });
          save();
          act(data().currentTurnId, { type: 'arrange-choice', faceUpIndex: 0 });
          save();
          act(data().currentTurnId, { type: 'pick-choice', choice: 'face-up' });
          save();
          act(data().currentTurnId, { type: 'call' });
          act(data().currentTurnId, { type: 'call' });
          save();
          expect(data().phase).toBe('round-result');
        }
        if (slug === 'myeongchuri') {
          expect(snapshots.initial.tiles).toBeNull();
          expect(snapshots.spectator.tiles).toBeNull();
          act(data().currentPlayerId, { type: 'pick', letters: ['A', 'B'] });
          save();
          act(data().currentPlayerId, { type: 'pick', letters: ['C', 'D'] });
          save();
          expect(data().rounds).toHaveLength(1);
        }
        if (slug === 'farewell-formula') {
          const st = await import('../socket/games/farewell-formula/state.js');
          act('me', {
            type: 'submit',
            removedUnitIds:
              st.farewellFormulaStates.get(roomId)!.puzzle.solutions[0]!.removedUnitIds,
          });
          save();
          expect(data().lastResult.outcome).toBe('correct');
        }
        for (const sample of Object.values(snapshots)) {
          const key = ['history', 'rounds'].find(
            (k) => Array.isArray(sample[k]) && sample[k].length,
          );
          if (key)
            snapshots.longRecords = {
              ...sample,
              [key]: Array.from({ length: 20 }, (_, i) => ({
                ...sample[key].at(-1),
                round: i + 1,
              })),
            };
        }
        if (process.env.GENERATE_REFACTOR_FIXTURES === '1') {
          mkdirSync(path, { recursive: true });
          writeFileSync(`${path}/${slug}.json`, JSON.stringify(snapshots, null, 2));
        }
      } finally {
        mod[`cleanup${name}`](roomId);
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    });
});
