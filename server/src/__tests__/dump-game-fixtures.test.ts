/*
  게임별 초기 화면 상태(gameData)를 JSON 으로 뽑는다. 테스트가 아니라 도구다.
  모듈 레이아웃을 고칠 때 실제 데이터로 화면을 띄워 보기 위한 것.

  평소에는 건너뛴다 — 테스트가 아니고 파일을 쓰기 때문이다.
  실행: DUMP_FIXTURES=1 npx vitest run dump-game-fixtures
  결과: <repo>/tmp-game-fixtures/<gameId>.json (git 에 올리지 않는다)
*/
import { describe, it } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gameModules } from '../socket/game.js';
import { sessions } from '../store/sessions.js';
import type { Player } from '@shared/types/room.js';

const OUT = join(process.cwd(), '..', 'tmp-game-fixtures');

const me: Player = {
  id: 'me-token',
  nickname: '나',
  isHost: true,
  isReady: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;
const foe: Player = {
  id: 'foe-token',
  nickname: '상대',
  isHost: false,
  isReady: true,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
} as any;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const io: any = {
  in: () => ({ fetchSockets: async () => [], emit: () => {} }),
  to: () => ({ emit: () => {} }),
  emit: () => {},
};

describe.skipIf(!process.env.DUMP_FIXTURES)('게임 화면 fixture 뽑기', () => {
  it('모든 게임의 초기 gameData 를 저장한다', () => {
    mkdirSync(OUT, { recursive: true });
    sessions.linkToken('sock-me', me.id);
    const done: string[] = [];
    const failed: string[] = [];

    for (const [gameId, mod] of Object.entries(gameModules)) {
      const roomId = `fixture-${gameId}`;
      let captured: unknown = null;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const socket: any = {
        id: 'sock-me',
        emit: (event: string, payload: unknown) => {
          if (event === 'game:state') captured = payload;
        },
        join: () => {},
        leave: () => {},
      };
      try {
        mod.init(io, roomId, [me, foe], 'multi', Date.now(), 60, () => {}, {});
        mod.emitStateToSocket(socket, roomId);
        if (captured) {
          writeFileSync(join(OUT, `${gameId}.json`), JSON.stringify(captured, null, 2));
          done.push(gameId);
        } else {
          failed.push(`${gameId}: 상태 없음`);
        }
      } catch (e) {
        failed.push(`${gameId}: ${(e as Error).message}`);
      } finally {
        try {
          mod.cleanup(roomId);
        } catch {
          /* 정리 실패는 무시 */
        }
      }
    }

    console.log(`\n뽑음 ${done.length}종: ${done.join(', ')}`);
    if (failed.length) console.log(`\n실패 ${failed.length}종:\n  ${failed.join('\n  ')}`);
  });
});
