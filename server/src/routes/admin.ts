/**
 * 소켓 서버 내부 HTTP 엔드포인트.
 * Next.js 서버(관리자 API)에서만 호출. INTERNAL_SECRET 으로 인증.
 */

import type { FastifyInstance } from 'fastify';
import type { IO } from '../socket/types.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { markAllTitleNotifsRead } from '../db/notifications.js';
import config from '../config.js';

interface NotifyTitleGrantedBody {
  secret: string;
  memberId: string;
  titleId: string;
  name: string;
  color: string;
  description: string | null;
}

export function registerAdminRoutes(app: FastifyInstance, getIO: () => IO | null) {
  app.post<{ Body: NotifyTitleGrantedBody }>(
    '/internal/notify-title-granted',
    async (req, reply) => {
      const { secret, memberId, titleId, name, color, description } = req.body;

      if (secret !== config.internalSecret) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const io = getIO();
      if (!io) {
        return reply.status(503).send({ status: 'not_ready' });
      }

      const payload = { titleId, name, color, description };

      const token = sessions.getTokenByMemberId(memberId);
      if (!token) {
        // 이번 서버 기동 중 한 번도 접속 안 한 유저 — Supabase 알림으로 다음 접속 시 처리
        return reply.send({ status: 'no_session' });
      }

      const socketId = sessions.getSocketByToken(token);
      if (!socketId) {
        // 오프라인: pending 저장 → 다음 session:restore 시 emit
        sessions.addPendingTitle(token, payload);
        return reply.send({ status: 'pending_offline' });
      }

      // 온라인: 게임 중 여부 확인
      const roomId = sessions.getRoom(socketId);
      const isInGame = roomId ? (roomStore.get(roomId)?.status === 'playing') : false;

      if (isInGame) {
        sessions.addPendingTitle(token, payload);
        return reply.send({ status: 'pending_in_game' });
      }

      // 온라인 + 게임 밖: 즉시 emit + Supabase 알림 읽음 처리
      const sock = io.sockets.sockets.get(socketId);
      if (sock) {
        sock.emit('title:granted', payload);
        markAllTitleNotifsRead(memberId).catch((err) => {
          console.warn('[notify-title-granted] mark read 실패:', err);
        });
        return reply.send({ status: 'emitted' });
      }

      // 소켓이 직전 disconnect (경쟁 조건): pending 저장
      sessions.addPendingTitle(token, payload);
      return reply.send({ status: 'pending_race' });
    },
  );
}
