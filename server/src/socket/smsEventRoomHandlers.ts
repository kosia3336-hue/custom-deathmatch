import { smsEventRoom, EVENT_SMS_ROOM_KEY, EVENT_SMS_SOCKET_CHANNEL } from './smsEventRoom.js';
import { sessions } from '../store/sessions.js';
import type { IO, TypedSocket } from './types.js';
import type { SmsMarkId, SmsPickAction } from '@shared/types/sun-moon-star-event.js';
import { SMSE_MARK_IDS } from '@shared/types/sun-moon-star-event.js';

export { smsEventRoom, EVENT_SMS_ROOM_KEY, EVENT_SMS_SOCKET_CHANNEL };

export function registerSmsEventRoomHandlers(_io: IO, socket: TypedSocket): void {
  socket.on('smsEvent:join', (callback) => {
    void (async () => {
      try {
        const res = await smsEventRoom.join(socket);
        callback(res);
      } catch (err) {
        console.error('[smsEvent:join] 예외:', (err as Error).message);
        callback({ success: false, error: '서버 오류가 발생했습니다.', errorCode: 'UNKNOWN' });
      }
    })();
  });

  socket.on('smsEvent:leave', () => {
    try {
      smsEventRoom.leave(socket);
    } catch (err) {
      console.error('[smsEvent:leave] 예외:', (err as Error).message);
    }
  });

  socket.on('smsEvent:meta:get', (callback) => {
    try {
      callback(smsEventRoom.getMeta());
    } catch {
      callback({ activePlayers: 0, spectatorCount: 0, isOpen: false, status: 'closed' });
    }
  });

  socket.on('game:action', (data: Record<string, unknown>) => {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    if (sessions.getRoom(socket.id) !== EVENT_SMS_ROOM_KEY) return;
    if (!smsEventRoom.hasSeatForToken(token)) return;

    if (data.type === 'pick' && typeof data.mark === 'string' && SMSE_MARK_IDS.includes(data.mark as SmsMarkId)) {
      smsEventRoom.handlePick(socket, data.mark as SmsMarkId);
    }
  });
}
