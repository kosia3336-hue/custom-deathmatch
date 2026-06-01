import type { Server } from 'socket.io';
import type { ClientToServerEvents, ServerToClientEvents } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { registerLobbyHandlers, broadcastOnlineUsers } from './lobby.js';
import { LOBBY_ROOM } from './types.js';
import { registerRoomHandlers, handleLeaveRoom } from './room.js';
import { registerGameHandlers, emitGameStateToSocket } from './game.js';
import { registerChatHandlers } from './chat.js';
import { registerRankQueueHandlers } from './rankQueue.js';
import { registerEventRoomHandlers, eventRoom, EVENT_ROOM_KEY, EVENT_SOCKET_CHANNEL } from './eventRoomHandlers.js';
import { socketRoom, maskedClientRoomFor } from './utils.js';
import { isTokenAnonymized } from '../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { getMemberFromAccessToken } from '../db/member.js';
import { fetchAndMarkPendingTitles, markAllTitleNotifsRead } from '../db/notifications.js';
import { rankQueueStore } from '../store/rankQueue.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/** 인게임 재연결 유예 시간 (ms) */
const RECONNECT_GRACE_PLAYING = 30_000;

export function setupSocketHandlers(io: IO) {
  // 이벤트 룸 싱글톤 초기화 (운영 시간 폴링 시작)
  eventRoom.init(io);
  // ── v2 — connect 핸드셰이크에서 Supabase access_token 검증 ──────────────
  // accessToken 있으면 회원 검증 후 socket.data.member 세팅.
  // 없거나 실패하면 게스트로 연결 허용 (로비 관전 전용 — 방 생성/입장은 닉네임 체크로 차단).
  io.use(async (socket, next) => {
    try {
      const accessToken = (socket.handshake.auth as { accessToken?: string } | undefined)?.accessToken;
      if (!accessToken) {
        // 게스트: member 없이 연결 허용
        (socket.data as { member?: null }).member = null;
        return next();
      }
      const member = await getMemberFromAccessToken(accessToken);
      if (!member) {
        return next(new Error('UNAUTHENTICATED'));
      }
      if (member.status === 'banned' || member.status === 'withdrawn' || member.status === 'suspended') {
        return next(new Error('FORBIDDEN'));
      }
      // socket.data 에 저장 (전역 핸들러에서 접근)
      (socket.data as { member?: typeof member }).member = member;
      next();
    } catch (err) {
      console.error('[socket auth]', err);
      next(new Error('UNAUTHENTICATED'));
    }
  });

  io.on('connection', (socket) => {

    // ── 세션 복원 ─────────────────────────────────────────────────────────
    socket.on('session:restore', ({ token, confirmed }) => {
      const prevSocketId = sessions.getSocketByToken(token);
      const prevSocketAlive = !!prevSocketId && prevSocketId !== socket.id && io.sockets.sockets.has(prevSocketId);

      if (prevSocketAlive && !confirmed) {
        // 새 탭 시나리오: 기존 세션 정보를 새 탭에 알리고 대기
        const nickname = sessions.getNicknameByToken(token) ?? '';
        const roomId = sessions.getRoom(prevSocketId!) ?? undefined;
        socket.emit('session:exists', { nickname, roomId });
        return;
      }

      // linkToken을 먼저 실행: disconnect 이벤트(동기 가능)보다 앞서 방·닉네임을 이전
      const result = sessions.linkToken(socket.id, token);

      if (prevSocketAlive && confirmed) {
        // 인계 확정: 세션 이전 후 기존 탭 강제 해제
        const prevSocket = io.sockets.sockets.get(prevSocketId!);
        if (prevSocket) {
          prevSocket.emit('session:replaced');
          prevSocket.disconnect(true);
        }
      }

      // ── v2 — 회원 정보로 닉네임/칭호 자동 설정 ──────────────────────
      const member = (
        socket.data as {
          member?: {
            id: string;
            nickname: string;
            displayedTitle: { id: string; name: string; color: string; effect: string | null } | null;
            equippedSkins?: { skinId: string; gameId: string }[];
          };
        }
      ).member;
      if (member) {
        sessions.setNickname(socket.id, member.nickname, true);
        sessions.setMemberInfo(token, member.id, member.displayedTitle, member.equippedSkins ?? []);
      }

      // ── 칭호 획득 모달 pending 처리 ──────────────────────────────────────
      if (member) {
        const roomId = sessions.getRoom(socket.id);
        const isInGame = roomId ? roomStore.get(roomId)?.status === 'playing' : false;

        if (!isInGame) {
          if (sessions.hasPendingTitles(token)) {
            // 온라인 중 인게임으로 인해 지연된 알림 (in-memory)
            const pending = sessions.takePendingTitles(token);
            for (const notif of pending) socket.emit('title:granted', notif);
            markAllTitleNotifsRead(member.id).catch(() => {});
          } else {
            // 미접속 중 부여된 알림 — Supabase notifications 에서 읽어 emit
            fetchAndMarkPendingTitles(member.id)
              .then((notifs) => {
                for (const n of notifs) socket.emit('title:granted', n);
              })
              .catch((err) => {
                console.warn('[session:restore] pending title fetch 실패:', err);
              });
          }
        }
        // isInGame = true 면 game:ended 시 emit (sessions.pendingTitles는 그대로 유지)
      }

      if (member) broadcastOnlineUsers(io);

      if (result === 'restored') {
        const nickname = sessions.getNickname(socket.id);
        const roomId = sessions.getRoom(socket.id);

        if (!nickname) {
          // 닉네임 없으면 신규 세션과 동일하게 처리
          socket.emit('session:new', { nickname: '' });
          return;
        }

        // 재연결 유예 타이머 취소
        sessions.clearPendingDisconnect(token);

        // ── 이벤트 룸 재연결 ────────────────────────────────────────────
        if (roomId === EVENT_ROOM_KEY) {
          socket.leave(LOBBY_ROOM);
          socket.join(EVENT_SOCKET_CHANNEL);
          // room:state + event:state 재전송 (fire-and-forget)
          void eventRoom.rejoinSocket(socket, token);
          // roomId 전달해 클라이언트가 /room/{id}/play 로 복원 가능
          socket.emit('session:restored', { nickname, roomId });
          return;
        }

        if (roomId) {
          const room = roomStore.get(roomId);
          if (room) {
            // socket.io room 재입장 (LOBBY_ROOM에서 제거)
            socket.leave(LOBBY_ROOM);
            socket.join(socketRoom(roomId));

            // room:state + game:state 재전송
            const clientRoom = maskedClientRoomFor(roomId, token);
            if (clientRoom) socket.emit('room:state', clientRoom);
            if (room.status === 'playing') emitGameStateToSocket(socket, roomId, room.gameId);

            // 방 전체에 재연결 성공 알림 (playerId = token = Player.id)
            const reconnectedNickname = isTokenAnonymized(roomId, token)
              ? ANONYMOUS_NICKNAME
              : nickname;
            io.to(socketRoom(roomId)).emit('player:reconnected', {
              playerId: token,
              nickname: reconnectedNickname,
            });
          }
        }

        socket.emit('session:restored', { nickname, roomId: roomId ?? undefined });
      } else {
        // result === 'new': 신규 세션 — 닉네임을 함께 전달
        socket.emit('session:new', { nickname: member?.nickname ?? '' });
      }
    });

    // ── 닉네임 설정 (v2: deprecated — 회원 닉네임 자동 적용) ───────────
    socket.on('nickname:set', (_data, callback) => {
      const current = sessions.getNickname(socket.id);
      if (current) {
        callback({ success: true, nickname: current });
      } else {
        callback({ success: false, error: '회원 닉네임이 설정되지 않았습니다.' });
      }
    });

    // ── 스킨 세션 즉시 갱신 ───────────────────────────────────────────────
    socket.on('skin:sync', async (callback) => {
      try {
        const token = sessions.getToken(socket.id);
        if (!token) return callback({ ok: false });

        const accessToken = (socket.handshake.auth as { accessToken?: string } | undefined)?.accessToken;
        if (!accessToken) return callback({ ok: false });

        const member = await getMemberFromAccessToken(accessToken);
        if (!member) return callback({ ok: false });

        const memberId = sessions.getMemberId(token);
        sessions.setMemberInfo(token, memberId, member.displayedTitle, member.equippedSkins);
        callback({ ok: true });
      } catch {
        callback({ ok: false });
      }
    });

    registerLobbyHandlers(io, socket);
    registerRoomHandlers(io, socket);
    registerGameHandlers(io, socket);
    registerChatHandlers(io, socket);
    registerRankQueueHandlers(io, socket);
    registerEventRoomHandlers(io, socket);

    // ── 연결 끊김 ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const wasMember = !!sessions.getMemberIdBySocket(socket.id);
      rankQueueStore.removeBySocket(socket.id);

      const token = sessions.getToken(socket.id);
      const roomId = sessions.getRoom(socket.id);

      // ── 이벤트 룸 처리 ──────────────────────────────────────────────────
      if (token && roomId === EVENT_ROOM_KEY) {
        if (eventRoom.isSeatedAndInGame(token)) {
          // 게임 진행 중 좌석 플레이어: 30초 재연결 유예
          const timer = setTimeout(() => {
            eventRoom.forceLeaveByToken(token);
            sessions.removeSession(socket.id);
            if (wasMember) broadcastOnlineUsers(io);
          }, RECONNECT_GRACE_PLAYING);
          sessions.setPendingDisconnect(token, timer);
        } else {
          // 관전/대기 중: 즉시 퇴장 (leave() 내부에서 sessions.clearRoom 처리)
          eventRoom.handleDisconnect(socket);
          sessions.removeSession(socket.id);
        }
        if (wasMember) broadcastOnlineUsers(io);
        return;
      }

      // ── 일반 게임 룸 처리 ─────────────────────────────────────────────
      if (token && roomId) {
        const room = roomStore.get(roomId);
        // token = Player.id 이므로 직접 비교
        const isPlayer = room?.players.some((p) => p.id === token) ?? false;

        if (isPlayer && room?.status === 'playing') {
          // ─── 인게임: 30초 유예 ─────────────────────────────────────────
          const realNickname = sessions.getNickname(socket.id) ?? '알 수 없음';
          const nickname = isTokenAnonymized(roomId, token)
            ? ANONYMOUS_NICKNAME
            : realNickname;

          socket.to(socketRoom(roomId)).emit('player:reconnecting', {
            playerId: token,
            nickname,
            secondsLeft: RECONNECT_GRACE_PLAYING / 1000,
          });

          const timer = setTimeout(() => {
            handleLeaveRoom(io, socket);
            sessions.removeSession(socket.id);
            if (wasMember) broadcastOnlineUsers(io);
          }, RECONNECT_GRACE_PLAYING);

          sessions.setPendingDisconnect(token, timer);
          if (wasMember) broadcastOnlineUsers(io);
          return;
        }
        // 대기실 포함 그 외: 즉시 퇴장
      }

      handleLeaveRoom(io, socket);
      sessions.removeSession(socket.id);
      if (wasMember) broadcastOnlineUsers(io);
    });
  });
}
