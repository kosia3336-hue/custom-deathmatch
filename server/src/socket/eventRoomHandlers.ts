/**
 * 인디언홀덤 (이벤트) 소켓 핸들러.
 * - event:join / event:leave / event:meta:get
 * - game:action — game 채널이 아닌 이벤트 룸 액션 처리 분기 (token이 좌석이면 위임)
 *
 * 일반 game:action 은 game.ts 에서 라우팅되지만, 이벤트 룸은 별도 채널이라
 * 본 파일에서 'game:action' 도 함께 listen 한다.
 */

import { eventRoom } from './eventRoom.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from './types.js';
import type { IPEActionPayload } from '@shared/types/indian-poker-event.js';

export { eventRoom, EVENT_ROOM_KEY, EVENT_SOCKET_CHANNEL } from './eventRoom.js';

export function registerEventRoomHandlers(_io: IO, socket: TypedSocket): void {
  socket.on('event:join', (callback) => {
    void (async () => {
      try {
        const res = await eventRoom.join(socket);
        callback(res);
      } catch (err) {
        console.error('[event:join] 예외:', (err as Error).message);
        callback({ success: false, error: '서버 오류가 발생했습니다.', errorCode: 'UNKNOWN' });
      }
    })();
  });

  socket.on('event:leave', () => {
    try {
      eventRoom.leave(socket);
    } catch (err) {
      console.error('[event:leave] 예외:', (err as Error).message);
    }
  });

  socket.on('event:meta:get', (callback) => {
    try {
      callback(eventRoom.getMeta());
    } catch (err) {
      console.error('[event:meta:get] 예외:', (err as Error).message);
      callback({
        activePlayers: 0,
        spectatorCount: 0,
        isOpen: false,
        status: 'closed',
      });
    }
  });

  // game:action 가로채기 — 이벤트 룸 좌석에 있으면 본 엔진이 처리
  socket.on('game:action', (data: Record<string, unknown>) => {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    if (!eventRoom.hasSeatForToken(token)) return; // 좌석에 없으면 game.ts가 처리

    const payload: IPEActionPayload = {
      type: (data.type as IPEActionPayload['type']) ?? 'check',
      amount: typeof data.amount === 'number' ? data.amount : undefined,
    };
    eventRoom.handleAction(socket, payload);
  });
}
