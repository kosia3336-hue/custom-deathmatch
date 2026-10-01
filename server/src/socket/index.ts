import { randomUUID } from 'node:crypto';
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
import { registerDevDummyHandlers } from '../dummy/register.js';
import { registerSuperAiHandlers } from './superAi.js';
import { registerEventRoomHandlers, eventRoom, EVENT_ROOM_KEY, EVENT_SOCKET_CHANNEL } from './eventRoomHandlers.js';
import {
  registerSmsEventRoomHandlers,
  smsEventRoom,
  EVENT_SMS_ROOM_KEY,
  EVENT_SMS_SOCKET_CHANNEL,
} from './smsEventRoomHandlers.js';
import {
  registerGuildWarRoomHandlers,
  guildWarRoom,
  GUILD_WAR_ROOM_ID,
  GUILD_WAR_CHANNEL,
} from './guildWarRoomHandlers.js';
import { socketRoom, maskedClientRoomFor, guildRoom, emitToRoomWithViewerNickname } from './utils.js';
import { getMemberFromAccessToken } from '../db/member.js';
import { fetchAndMarkPendingTitles, markAllTitleNotifsRead } from '../db/notifications.js';
import { scheduleSkinExpiries, cancelSkinExpiries } from './skinExpiry.js';
import { scheduleEffectExpiry, cancelEffectExpiry } from './effectExpiry.js';
import { rankQueueStore } from '../store/rankQueue.js';

type IO = Server<ClientToServerEvents, ServerToClientEvents>;

/** 인게임 재연결 유예 시간 (ms) */
const RECONNECT_GRACE_PLAYING = 30_000;

/** 핸드셰이크에서 검증된 회원 정보 (게스트면 null) */
interface SocketMember {
  id: string;
  nickname: string;
  displayedTitle: { id: string; name: string; color: string; effect: string | null } | null;
  guildId?: string | null;
  guildName?: string | null;
  equippedSkins?: { skinId: string; gameId: string }[];
  skinExpiries?: { skinId: string; expiresAt: Date }[];
  effectExpiry?: Date | null;
}

function getSocketMember(socket: { data: unknown }): SocketMember | null {
  return (socket.data as { member?: SocketMember | null }).member ?? null;
}

/** 검증된 회원 정보를 세션 토큰에 바인딩 (닉네임·칭호·스킨·길드방) */
function bindMemberToSession(
  socket: { data: unknown; id: string; join: (room: string) => void },
  token: string,
): void {
  const member = getSocketMember(socket);
  if (!member) return;
  sessions.setNickname(socket.id, member.nickname, true);
  sessions.setMemberInfo(
    token,
    member.id,
    member.displayedTitle,
    member.equippedSkins ?? [],
    member.guildId ?? null,
    member.guildName ?? null,
  );
  scheduleSkinExpiries(token, member.skinExpiries ?? []);
  scheduleEffectExpiry(token, member.effectExpiry ?? null);
  // 길드 채팅 — 소속 길드가 있으면 해당 소켓방에 합류
  if (member.guildId) socket.join(guildRoom(member.guildId));
}

/**
 * `session:restore` 로 들어온 토큰을 어떻게 다룰지 가른다.
 *
 *   'restore'  이 소켓의 것이 맞다 — 세션을 이어 준다.
 *   'reauth'   회원에게 묶인 토큰인데 이 연결은 인증이 안 붙었다. 넘겨주지도,
 *              버리지도 않는다 — 클라이언트가 인증을 다시 받아 붙으면 된다.
 *   'reissue'  형식이 틀렸거나 '다른 회원' 의 토큰이다 — 새 토큰을 발급한다.
 *
 * reauth 를 reissue 와 갈라 놓는 것이 핵심이다. 액세스 토큰 갱신이 한 번
 * 실패하면 그 연결은 게스트로 붙는데, 그걸 탈취로 보아 토큰을 갈아 끼우면
 * 진행 중이던 판에 묶인 토큰이 사라져 새로고침해도 게임으로 못 돌아온다.
 */
export function classifyRestoreToken(
  rawToken: unknown,
  boundMemberId: string | null,
  authedMemberId: string | null,
): 'restore' | 'reauth' | 'reissue' {
  if (typeof rawToken !== 'string' || rawToken.length < 8) return 'reissue';
  if (boundMemberId === null) return 'restore';
  if (authedMemberId === null) return 'reauth';
  return boundMemberId === authedMemberId ? 'restore' : 'reissue';
}

export function setupSocketHandlers(io: IO) {
  // 이벤트 룸 싱글톤 초기화 (운영 시간 폴링 시작)
  eventRoom.init(io);
  smsEventRoom.init(io);
  guildWarRoom.init(io);
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

    // ── 시각 맞추기 ──────────────────────────────────────────────────────
    // 타이머 마감은 서버 시각(turnStartedAt 등)으로 온다. 기기 시계가 몇 초씩
    // 어긋나 있으면 사람마다 남은 시간이 다르게 보이므로, 클라이언트가 이 값으로
    // 오차를 잰다(lib/serverClock.ts).
    socket.on('time:sync', (callback) => {
      if (typeof callback === 'function') callback(Date.now());
    });

    // ── 세션 복원 ─────────────────────────────────────────────────────────
    socket.on('session:restore', ({ token: rawToken, confirmed }) => {
      // 세션 토큰은 Player.id 로 쓰이며 room:state 를 통해 같은 방의 다른 참가자에게
      // 그대로 노출된다. 남의 토큰으로 restore 하면 방·닉네임·회원 바인딩이 통째로
      // 넘어가 세션을 가로챌 수 있으므로, 이미 '다른 회원'에게 묶인 토큰이면 인계하지
      // 않고 서버가 새 토큰을 발급한다(같은 브라우저에서 계정만 바꿔 로그인한 경우도
      // 동일하게 새 세션으로 시작하는 것이 맞다).
      const authedMemberId = getSocketMember(socket)?.id ?? null;
      const boundMemberId =
        typeof rawToken === 'string' ? sessions.getMemberId(rawToken) : null;

      const verdict = classifyRestoreToken(rawToken, boundMemberId, authedMemberId);

      if (verdict === 'reauth') {
        // 이번 연결만 임시 토큰으로 게스트 처리한다. 클라이언트의 토큰은 그대로 둬야
        // 인증을 다시 받아 붙었을 때 진행 중이던 판으로 돌아올 수 있다.
        const temp = randomUUID();
        sessions.linkToken(socket.id, temp);
        socket.emit('session:reauth');
        return;
      }

      if (verdict === 'reissue') {
        const fresh = randomUUID();
        sessions.linkToken(socket.id, fresh);
        bindMemberToSession(socket, fresh);
        if (authedMemberId) broadcastOnlineUsers(io);
        socket.emit('session:new', {
          nickname: getSocketMember(socket)?.nickname ?? '',
          token: fresh,
        });
        return;
      }

      const token = rawToken;
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
      const member = getSocketMember(socket);
      bindMemberToSession(socket, token);

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
          void eventRoom.rejoinSocket(socket, token);
          socket.emit('session:restored', { nickname, roomId });
          return;
        }

        if (roomId === EVENT_SMS_ROOM_KEY) {
          socket.leave(LOBBY_ROOM);
          socket.join(EVENT_SMS_SOCKET_CHANNEL);
          smsEventRoom.rejoinSocket(socket, token);
          socket.emit('session:restored', { nickname, roomId });
          return;
        }

        if (roomId === GUILD_WAR_ROOM_ID) {
          socket.leave(LOBBY_ROOM);
          socket.join(GUILD_WAR_CHANNEL);
          guildWarRoom.rejoinSocket(socket, token);
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
            // 플레이어만 알린다. 관전자는 방 화면을 열 때마다 여기로 들어와서, 조건이
            // 없으면 관전자가 들어올 때마다 '님이 재연결되었습니다' 가 떴다.
            if (room.players.some((p) => p.id === token)) {
              emitToRoomWithViewerNickname(
                io,
                roomId,
                'player:reconnected',
                { playerId: token },
                nickname,
              );
            }
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
        sessions.setMemberInfo(token, memberId, member.displayedTitle, member.equippedSkins, member.guildId ?? null, member.guildName ?? null);
        scheduleSkinExpiries(token, member.skinExpiries);
        scheduleEffectExpiry(token, member.effectExpiry);
        if (member.guildId) socket.join(guildRoom(member.guildId));
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
    if (process.env.NODE_ENV !== 'production') {
      registerDevDummyHandlers(io, socket);
    }
    registerSuperAiHandlers(io, socket);
    registerEventRoomHandlers(io, socket);
    registerSmsEventRoomHandlers(io, socket);
    registerGuildWarRoomHandlers(io, socket);

    // ── 연결 끊김 ─────────────────────────────────────────────────────────
    socket.on('disconnect', () => {
      const wasMember = !!sessions.getMemberIdBySocket(socket.id);
      rankQueueStore.removeBySocket(socket.id);

      const token = sessions.getToken(socket.id);
      if (token) {
        cancelSkinExpiries(token);
        cancelEffectExpiry(token);
      }

      const roomId = sessions.getRoom(socket.id);

      // ── 이벤트 룸 처리 ──────────────────────────────────────────────────
      if (token && roomId === EVENT_SMS_ROOM_KEY) {
        if (smsEventRoom.isSeatedAndInRound(token)) {
          const timer = setTimeout(() => {
            smsEventRoom.forceLeaveByToken(token);
            sessions.removeSession(socket.id);
            if (wasMember) broadcastOnlineUsers(io);
          }, RECONNECT_GRACE_PLAYING);
          sessions.setPendingDisconnect(token, timer);
        } else {
          smsEventRoom.handleDisconnect(socket);
          sessions.removeSession(socket.id);
        }
        if (wasMember) broadcastOnlineUsers(io);
        return;
      }

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

      if (token && roomId === GUILD_WAR_ROOM_ID) {
        if (guildWarRoom.isSeatedAndInGame(token)) {
          const timer = setTimeout(() => {
            guildWarRoom.forceLeaveByToken(token);
            sessions.removeSession(socket.id);
            if (wasMember) broadcastOnlineUsers(io);
          }, RECONNECT_GRACE_PLAYING);
          sessions.setPendingDisconnect(token, timer);
        } else {
          guildWarRoom.handleDisconnect(socket);
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

          emitToRoomWithViewerNickname(
            io,
            roomId,
            'player:reconnecting',
            { playerId: token, secondsLeft: RECONNECT_GRACE_PLAYING / 1000 },
            realNickname,
            socket.id,
          );

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
