import { writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, it, vi, expect } from 'vitest';
import type { IO, TypedSocket } from '../socket/types.js';
import type { Player } from '@shared/types/room.js';
const modules: Record<string, () => Promise<any>> = {
  'multiple-bnw': () => import('../socket/games/multiple-bnw/index.js'),
  'winning-streak': () => import('../socket/games/winning-streak/index.js'),
  bnw2: () => import('../socket/games/bnw2/index.js'),
  'silper-bnw': () => import('../socket/games/silper-bnw/index.js'),
  'five-towers': () => import('../socket/games/five-towers/index.js'),
  'grape-sugar-2': () => import('../socket/games/grape-sugar-2/index.js'),
  'sun-moon-star-2': () => import('../socket/games/sun-moon-star-2/index.js'),
  'bank-game': () => import('../socket/games/bank-game/index.js'),
  quatro: () => import('../socket/games/quatro/index.js'),
  'seed-seotda': () => import('../socket/games/seed-seotda/index.js'),
  'double-sided-poker': () => import('../socket/games/double-sided-poker/index.js'),
};
const states: Record<string, () => Promise<any>> = {
  'multiple-bnw': () => import('../socket/games/multiple-bnw/state.js'),
  'winning-streak': () => import('../socket/games/winning-streak/state.js'),
  bnw2: () => import('../socket/games/bnw2/state.js'),
  'silper-bnw': () => import('../socket/games/silper-bnw/state.js'),
  'five-towers': () => import('../socket/games/five-towers/state.js'),
  'grape-sugar-2': () => import('../socket/games/grape-sugar-2/state.js'),
  'sun-moon-star-2': () => import('../socket/games/sun-moon-star-2/state.js'),
  'bank-game': () => import('../socket/games/bank-game/state.js'),
  quatro: () => import('../socket/games/quatro/state.js'),
  'seed-seotda': () => import('../socket/games/seed-seotda/state.js'),
  'double-sided-poker': () => import('../socket/games/double-sided-poker/state.js'),
};
const games = [
  ['multiple-bnw', 'MultipleBnw'],
  ['winning-streak', 'WinningStreak'],
  ['bnw2', 'BNW2'],
  ['silper-bnw', 'SilperBnw'],
  ['five-towers', 'FiveTowers'],
  ['grape-sugar-2', 'GrapeSugar2'],
  ['sun-moon-star-2', 'SunMoonStar2'],
  ['bank-game', 'BankGame'],
  ['quatro', 'Quatro'],
  ['seed-seotda', 'SeedSeotda'],
  ['double-sided-poker', 'DoubleSidedPoker'],
];
const path = fileURLToPath(new URL('../../../public/dev/refactor-fixtures', import.meta.url));
if (process.env.GENERATE_REFACTOR_FIXTURES === '1') mkdirSync(path, { recursive: true });
describe('local refactor fixtures', () => {
  for (const [slug, name] of games)
    it(slug, async () => {
      vi.useFakeTimers();
      const mod = await modules[slug]();
      const st = await states[slug]();
      const players = ['me', 'opponent'].map(
        (id, i) =>
          ({
            id,
            nickname: i ? '상대 플레이어' : 'MIS2',
            isHost: !i,
            isReady: true,
            joinedAt: Date.now(),
          }) as Player,
      );
      const roomId = 'refactor-' + slug;
      const io = {
        in: () => ({ fetchSockets: async () => [] }),
        to: () => ({ emit: vi.fn() }),
      } as unknown as IO;
      const snapshots: Record<string, unknown> = {};
      let state: any;
      const data = (id = 'me') => {
        const socket = { id, emit: vi.fn() } as unknown as TypedSocket;
        if (slug === 'seed-seotda') st.emitSeedSeotdaStateToSocket(socket, roomId);
        else if (slug === 'double-sided-poker')
          st.emitDoubleSidedPokerStateToSocket(socket, roomId);
        else if (slug === 'quatro') st.emitStateToSocketImpl(socket, state);
        else st.emitStateToSocket(socket, state);
        return (socket.emit as any).mock.calls.find((call: any) => call[0] === 'game:state')?.[1]
          .gameData;
      };
      try {
        mod['init' + name](io, roomId, players, 'multi', Date.now(), 60, vi.fn());
        state = (st.gameStates ?? st.seedSeotdaStates ?? st.doubleSidedPokerStates).get(roomId);
        expect(state).toBeTruthy();
        snapshots.initial = data();
        snapshots.spectator = data('spectator');
        const act = (id: string, a: any) =>
          mod['handle' + name + 'Action'](
            io,
            { id, emit: vi.fn() } as unknown as TypedSocket,
            roomId,
            a,
          );
        const save = () => {
          const d = data();
          if (d) snapshots[(d as any).phase] = d;
        };
        if (slug === 'multiple-bnw') {
          act('me', { type: 'submitTile', tile: 3 });
          save();
          act('opponent', { type: 'respondTile', tile: 4 });
          save();
          act('me', { type: 'suspectFirst', suspect: false });
          act('opponent', { type: 'suspectSecond', suspect: false });
          save();
        }
        if (slug === 'winning-streak') {
          act('me', { type: 'selectCard', card: 'spade' });
          act('opponent', { type: 'selectCard', card: 'heart' });
          save();
        }
        if (slug === 'bnw2') {
          act('me', { type: 'submitFirst', points: 5 });
          save();
          act('opponent', { type: 'submitSecond', points: 8 });
          save();
        }
        if (slug === 'silper-bnw') {
          act('me', { type: 'submitFirst', tiles: [1] });
          save();
          act('opponent', { type: 'submitSecond', tiles: [2] });
          save();
        }
        if (slug === 'five-towers') {
          act('me', { type: 'stack', tower: 'A', count: 1 });
          save();
        }
        if (slug === 'grape-sugar-2') {
          act('me', { type: 'submit', card: 'plus5', sugar: 2 });
          act('opponent', { type: 'submit', card: 'minus3', sugar: 3 });
          save();
        }
        if (slug === 'sun-moon-star-2') {
          act('me', { type: 'submitPowder', powder: { sun: 5, moon: 0, star: 0 } });
          act('opponent', { type: 'submitPowder', powder: { sun: 0, moon: 2, star: 0 } });
          save();
          const first = state.firstPlayerSide === 'p1' ? state.player1 : state.player2;
          const second = first === state.player1 ? state.player2 : state.player1;
          act(first.id, { type: 'submitBet', bet: { sun: 1, moon: 0, star: 0 } });
          save();
          act(second.id, { type: 'submitBet', bet: { sun: 0, moon: 2, star: 0 } });
          save();
          await vi.advanceTimersByTimeAsync(5000);
          save();
        }
        if (slug === 'bank-game') {
          const first = state.firstSide === 'p1' ? state.player1 : state.player2;
          const second = first === state.player1 ? state.player2 : state.player1;
          act(first.id, { type: 'submitBet', bet: { 1000: 1, 3000: 0, 5000: 0, 10000: 0 } });
          save();
          await vi.advanceTimersByTimeAsync(1800);
          save();
          act(second.id, { type: 'submitBet', bet: { 1000: 0, 3000: 1, 5000: 0, 10000: 0 } });
          save();
          await vi.advanceTimersByTimeAsync(2000);
          save();
        }
        if (slug === 'quatro') {
          for (let i = 0; i < 4; i++) {
            const d = data() as any;
            if (d.phase === 'mulligan') act(d.currentTurnId, { type: 'mulligan', use: false });
          }
          save();
          const d = data() as any;
          if (d.phase === 'open') {
            act('me', { type: 'open', cardId: d.me.hand.find((h: any) => !h.open).card.id });
            act('opponent', {
              type: 'open',
              cardId: (data('opponent') as any).me.hand.find((h: any) => !h.open).card.id,
            });
            save();
          }
        }
        if (slug === 'seed-seotda') {
          act('me', { type: 'skip-seed' });
          act('opponent', { type: 'skip-seed' });
          save();
          const d = data() as any;
          act(d.currentTurnId, { type: 'bet', amount: 2 });
          save();
          act(d.currentTurnId === 'me' ? 'opponent' : 'me', { type: 'call' });
          save();
        }
        if (slug === 'double-sided-poker') {
          const d = data() as any;
          act(d.currentTurnId, { type: 'bet', side: 'front', amount: 2 });
          save();
          act(d.currentTurnId === 'me' ? 'opponent' : 'me', { type: 'call', side: 'front' });
          save();
        }
        await vi.advanceTimersByTimeAsync(1000);
        save();
        expect((snapshots.initial as any).players || (snapshots.initial as any).me).toBeTruthy();
        const expected = {
          'multiple-bnw': 'result',
          'winning-streak': 'reveal',
          bnw2: 'reveal',
          'silper-bnw': 'reveal',
          'five-towers': 'turn',
          'grape-sugar-2': 'reveal',
          'sun-moon-star-2': 'resolve',
          'bank-game': 'reveal',
          quatro: 'exchange',
          'seed-seotda': 'round-result',
          'double-sided-poker': 'round-result',
        }[slug];
        expect(
          snapshots[expected!],
          `${slug} reaches ${expected} after legal actions`,
        ).toBeTruthy();
        for (const sample of Object.values(snapshots) as any[]) {
          const key = ['roundHistory', 'history', 'rounds', 'actionLog', 'log'].find(
            (k) => Array.isArray(sample[k]) && sample[k].length,
          );
          if (!key) continue;
          const row = sample[key].at(-1);
          snapshots.longRecords = {
            ...sample,
            [key]: Array.from({ length: 20 }, (_, i) => ({ ...row, round: i + 1, turn: i + 1 })),
            ...(slug === 'quatro'
              ? {
                  firstByRound: Object.fromEntries(
                    Array.from({ length: 20 }, (_, i) => [i + 1, 'me']),
                  ),
                }
              : {}),
          };
        }
        if (process.env.GENERATE_REFACTOR_FIXTURES === '1')
          writeFileSync(`${path}/${slug}.json`, JSON.stringify(snapshots, null, 2));
      } finally {
        mod['cleanup' + name](roomId);
        vi.clearAllTimers();
        vi.useRealTimers();
      }
    });
});
