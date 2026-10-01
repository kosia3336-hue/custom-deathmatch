/**
 * 길드전 (링 더 벨) 소켓 핸들러.
 * guildWar:join / guildWar:sit / guildWar:spectate / guildWar:leave / guildWar:meta:get / guildWar:action
 */

import { guildWarRoom } from './guildWarRoom.js';
import type { IO, TypedSocket } from './types.js';
import type { RtbActionPayload } from '@shared/types/ring-the-bell.js';

export { guildWarRoom, GUILD_WAR_ROOM_ID, GUILD_WAR_CHANNEL } from './guildWarRoom.js';

export function registerGuildWarRoomHandlers(_io: IO, socket: TypedSocket): void {
  socket.on('guildWar:join', (callback) => {
    void (async () => {
      try {
        callback(await guildWarRoom.join(socket));
      } catch (err) {
        console.error('[guildWar:join] 예외:', (err as Error).message);
        callback({ success: false, error: '서버 오류가 발생했습니다.', errorCode: 'UNKNOWN' });
      }
    })();
  });

  socket.on('guildWar:leave', () => {
    try {
      guildWarRoom.leave(socket);
    } catch (err) {
      console.error('[guildWar:leave] 예외:', (err as Error).message);
    }
  });

  socket.on('guildWar:sit', (callback) => {
    void (async () => {
      try {
        callback(await guildWarRoom.sit(socket));
      } catch (err) {
        console.error('[guildWar:sit] 예외:', (err as Error).message);
        callback({ success: false, error: '서버 오류가 발생했습니다.', errorCode: 'UNKNOWN' });
      }
    })();
  });

  socket.on('guildWar:spectate', (callback) => {
    try {
      callback(guildWarRoom.spectate(socket));
    } catch (err) {
      console.error('[guildWar:spectate] 예외:', (err as Error).message);
      callback({ success: false, error: '서버 오류가 발생했습니다.' });
    }
  });

  socket.on('guildWar:meta:get', (callback) => {
    try {
      callback(guildWarRoom.getMeta());
    } catch {
      callback({ seated: 0, spectatorCount: 0, isOpen: false, isPeriod: false });
    }
  });

  socket.on('guildWar:action', (payload: RtbActionPayload) => {
    try {
      guildWarRoom.handleAction(socket, payload);
    } catch (err) {
      console.error('[guildWar:action] 예외:', (err as Error).message);
    }
  });
}
