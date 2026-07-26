import { v4 as uuid } from 'uuid';
import type { ChatMessage } from '@shared/types/events.js';
import { sessions } from '../store/sessions.js';
import { socketRoom, guildRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import { LOBBY_ROOM } from './types.js';
import { roomStore } from '../store/rooms.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import { maskChatMessageForViewer } from '../shop/maskNicknames.js';
import { getSupabaseAdmin } from '../db/supabase.js';

const lastMessageTime = new Map<string, number>();
const COOLDOWN_MS = 500;

export function registerChatHandlers(io: IO, socket: TypedSocket) {
  socket.on('disconnect', () => {
    lastMessageTime.delete(socket.id);
  });

  socket.on('chat:send', ({ message, scope }) => {
    const trimmed = message?.trim() ?? '';
    if (trimmed.length === 0 || trimmed.length > 200) return;

    const now = Date.now();
    const last = lastMessageTime.get(socket.id) ?? 0;
    if (now - last < COOLDOWN_MS) return;
    lastMessageTime.set(socket.id, now);

    const nickname = sessions.getNickname(socket.id);
    const token = sessions.getToken(socket.id);
    if (!nickname || !token) return;

    const senderTitle = sessions.getDisplayedTitleBySocket(socket.id);
    const senderGuildMark = sessions.getGuildMarkBySocket(socket.id);
    const senderMemberId = sessions.getMemberIdBySocket(socket.id);

    // v2.2: 로비 채팅 — 로그인 회원만 (게스트 차단). 방/관전 중이어도 보낼 수 있다
    // (방 안에서도 로비 채팅에 접근 가능하도록 v2.2에서 제한 완화).
    if (scope === 'lobby') {
      if (!senderMemberId) return; // 게스트 차단

      const lobbyMsg: ChatMessage = {
        id: uuid(),
        sender: socket.id,
        senderNickname: nickname,
        message: trimmed,
        scope: 'lobby',
        isSystem: false,
        timestamp: now,
        senderTitle: senderTitle ?? null,
        senderGuildMark: senderGuildMark ?? null,
        isSpectator: false,
        senderMemberId: senderMemberId ?? null,
      };

      io.to(LOBBY_ROOM).emit('chat:message', lobbyMsg);
      return;
    }

    // 길드 채팅 — 길드원만, DB 에 영속(오래된 메시지는 RPC 가 자동 정리)
    if (scope === 'guild') {
      if (!senderMemberId) return; // 게스트 차단
      const guildId = sessions.getGuildIdBySocket(socket.id);
      if (!guildId) return; // 길드 미가입

      void (async () => {
        const sb = getSupabaseAdmin();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data, error } = await (sb.rpc as any)('send_guild_chat', {
          p_member: senderMemberId,
          p_message: trimmed,
        });
        if (error) {
          console.warn('[chat] send_guild_chat 실패:', error.message);
          return;
        }
        const row = (Array.isArray(data) ? data[0] : data) as
          | { id: string; guild_id: string; created_at: string }
          | undefined;

        const guildMsg: ChatMessage = {
          id: row?.id ?? uuid(),
          sender: socket.id,
          senderNickname: nickname,
          message: trimmed,
          scope: 'guild',
          isSystem: false,
          timestamp: row?.created_at ? new Date(row.created_at).getTime() : now,
          senderTitle: senderTitle ?? null,
          senderGuildMark: senderGuildMark ?? null,
          isSpectator: false,
          senderMemberId: senderMemberId ?? null,
        };
        io.to(guildRoom(guildId)).emit('chat:message', guildMsg);
      })();
      return;
    }

    // room / game 스코프
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;

    // v2: 관전자도 채팅 가능 (6번 §6.7 / 7번 §7.5)
    const isSpectator = room.spectators.some((s) => s.id === token);
    const isPlayer = room.players.some((p) => p.id === token);
    if (!isSpectator && !isPlayer) return;

    const msg: ChatMessage = {
      id: uuid(),
      sender: socket.id,
      senderNickname: nickname,
      message: trimmed,
      scope,
      isSystem: false,
      timestamp: now,
      senderTitle: senderTitle ?? null,
      senderGuildMark: senderGuildMark ?? null,
      isSpectator,
      senderMemberId: senderMemberId ?? null,
    };

    // 익명 효과가 있으면 viewer 별 분기 emit, 아니면 broadcast.
    const shopState = getRoomShopState(roomId);
    if (
      shopState
      && shopState.anonymizedMemberIds.size > 0
      && senderMemberId
      && shopState.anonymizedMemberIds.has(senderMemberId)
    ) {
      const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
      if (sockets) {
        for (const sid of sockets) {
          const viewerMid = sessions.getMemberIdBySocket(sid);
          const masked = maskChatMessageForViewer(roomId, msg, viewerMid);
          io.sockets.sockets.get(sid)?.emit('chat:message', masked);
        }
        return;
      }
    }

    io.to(socketRoom(roomId)).emit('chat:message', msg);
  });

  // 길드 채팅 히스토리 요청 (탭 진입 시 1회)
  socket.on('guild:chat:load', () => {
    const senderMemberId = sessions.getMemberIdBySocket(socket.id);
    if (!senderMemberId) return;
    const guildId = sessions.getGuildIdBySocket(socket.id);
    if (!guildId) return;

    void (async () => {
      const sb = getSupabaseAdmin();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error } = await (sb.rpc as any)('get_guild_chat_history', {
        p_member: senderMemberId,
        p_limit: 50,
      });
      if (error) {
        console.warn('[chat] get_guild_chat_history 실패:', error.message);
        return;
      }
      const rows = (data ?? []) as Array<{
        id: string;
        member_id: string;
        message: string;
        created_at: string;
      }>;
      // 오래된 것부터 표시되도록 뒤집는다 (RPC 는 최신순으로 반환)
      // 닉네임은 오프라인 발신자도 있을 수 있어 세션 캐시가 아닌 DB 에서 조회.
      const senderNicknames = new Map<string, string>();
      const uniqueMemberIds = [...new Set(rows.map((r) => r.member_id))];
      if (uniqueMemberIds.length > 0) {
        const { data: memberRows } = await sb
          .from('members')
          .select('id, nickname')
          .in('id', uniqueMemberIds);
        for (const m of (memberRows ?? []) as { id: string; nickname: string }[]) {
          senderNicknames.set(m.id, m.nickname);
        }
      }
      const messages: ChatMessage[] = rows
        .slice()
        .reverse()
        .map((r) => ({
          id: r.id,
          sender: r.member_id,
          senderNickname: senderNicknames.get(r.member_id) ?? '???',
          message: r.message,
          scope: 'guild',
          isSystem: false,
          timestamp: new Date(r.created_at).getTime(),
          senderTitle: null,
          senderGuildMark: null,
          isSpectator: false,
          senderMemberId: r.member_id,
        }));
      socket.emit('guild:chat:history', { messages });
    })();
  });
}
