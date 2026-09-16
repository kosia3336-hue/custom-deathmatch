/**
 * 소켓 서버 내부 HTTP 엔드포인트.
 * Next.js 서버(관리자 API)에서만 호출. INTERNAL_SECRET 으로 인증.
 */

import type { FastifyInstance } from 'fastify';
import type { IO } from '../socket/types.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { markAllTitleNotifsRead } from '../db/notifications.js';
import {
  onInquirySubmit as hiddenOnInquirySubmit,
  onTitleGranted as hiddenOnTitleGranted,
  onNicknameChanged as hiddenOnNicknameChanged,
  onNoticeReadForHidden as hiddenOnNoticeReadForHidden,
  onShopPurchase as hiddenOnShopPurchase,
} from '../hidden-titles/hooks.js';
import { isValidInternalSecret } from '../config.js';
import { invalidateBiasTitlesCache } from '../shop/biasTitlesCache.js';
import { invalidateOwnedTitles } from '../shop/playerOwnedTitles.js';
import { rankQueueStore } from '../store/rankQueue.js';
import { getSupabaseAdmin } from '../db/supabase.js';
import { guildRoom } from '../socket/utils.js';

interface NotifyTitleGrantedBody {
  secret: string;
  memberId: string;
  titleId: string;
  name: string;
  color: string;
  description: string | null;
  effect?: string | null;
}

interface NotifyNoticePublishedBody {
  secret: string;
  noticeId: string;
  title: string;
  category: string;
}

interface NotifyGuildScoutInviteBody {
  secret: string;
  memberId: string;
  inviteId: string;
  guildId: string;
  guildName: string;
  fromNickname: string;
  targetHadGuild: boolean;
  targetGuildName: string | null;
}

interface NotifyGuildJoinRequestBody {
  secret: string;
  memberId: string;
  requestId: string;
  guildId: string;
  guildName: string;
  fromNickname: string;
}

interface NotifyCdpAdjustedBody {
  secret: string;
  memberId: string;
  newBalance: number;
  delta: number;
  reason: 'shop_purchase' | 'admin_adjust';
  ref?: { kind: string; id: string };
}

interface NotifyShopItemChangedBody {
  secret: string;
  itemId: string;
  stock: number | null;
  isActive: boolean;
}

export function registerAdminRoutes(app: FastifyInstance, getIO: () => IO | null) {
  app.post<{ Body: NotifyTitleGrantedBody }>(
    '/internal/notify-title-granted',
    async (req, reply) => {
      const { secret, memberId, titleId, name, color, description, effect } = req.body;

      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const io = getIO();
      if (!io) {
        return reply.status(503).send({ status: 'not_ready' });
      }

      const payload = { titleId, name, color, description, effect: effect ?? null };

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

  app.post<{ Body: NotifyGuildScoutInviteBody }>(
    '/internal/notify-guild-scout-invite',
    async (req, reply) => {
      const { secret, memberId, ...payload } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (typeof memberId !== 'string' || !memberId || typeof payload.inviteId !== 'string') {
        return reply.status(400).send({ error: 'invalid payload' });
      }

      const io = getIO();
      const token = sessions.getTokenByMemberId(memberId);
      const socketId = token ? sessions.getSocketByToken(token) : null;
      const sock = io && socketId ? io.sockets.sockets.get(socketId) : null;
      if (sock) {
        sock.emit('guild:scout-invite', {
          inviteId: payload.inviteId,
          guildId: payload.guildId,
          guildName: payload.guildName,
          fromNickname: payload.fromNickname,
          targetHadGuild: payload.targetHadGuild === true,
          targetGuildName: payload.targetGuildName ?? null,
        });
        return reply.send({ status: 'emitted' });
      }
      return reply.send({ status: 'no_session' });
    },
  );

  app.post<{ Body: NotifyGuildJoinRequestBody }>(
    '/internal/notify-guild-join-request',
    async (req, reply) => {
      const { secret, memberId, requestId, guildId, guildName, fromNickname } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (
        typeof memberId !== 'string' ||
        !memberId ||
        typeof requestId !== 'string' ||
        !requestId
      ) {
        return reply.status(400).send({ error: 'invalid payload' });
      }

      const io = getIO();
      const token = sessions.getTokenByMemberId(memberId);
      const socketId = token ? sessions.getSocketByToken(token) : null;
      const sock = io && socketId ? io.sockets.sockets.get(socketId) : null;
      if (sock) {
        sock.emit('guild:join-request', {
          requestId,
          guildId: typeof guildId === 'string' ? guildId : '',
          guildName: typeof guildName === 'string' ? guildName : '',
          fromNickname: typeof fromNickname === 'string' ? fromNickname : '',
        });
        return reply.send({ status: 'emitted' });
      }
      return reply.send({ status: 'no_session' });
    },
  );

  // ── 공지 발행 브로드캐스트 ──────────────────────────────────────────────
  app.post<{ Body: NotifyNoticePublishedBody }>(
    '/internal/notify-notice-published',
    async (req, reply) => {
      const { secret, noticeId, title, category } = req.body;

      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }

      const io = getIO();
      if (!io) {
        return reply.status(503).send({ status: 'not_ready' });
      }

      io.emit('notice:published', { noticeId, title, category });
      return reply.send({ status: 'emitted' });
    },
  );

  // ── 히든 칭호 훅 트리거 (Next.js /api/hidden-titles/* 에서 호출) ─────
  // 요청만 받는다. 구체적 조건 로직은 서버 코드(hidden-titles/) 에 숨겨진다.

  app.post<{
    Body: {
      secret: string;
      kind: 'inquiry' | 'title_granted' | 'nickname_changed' | 'eureka_notice' | 'shop_purchase';
      memberId: string;
      noticeId?: string;
    };
  }>(
    '/internal/hidden-titles/check',
    async (req, reply) => {
      const { secret, kind, memberId, noticeId } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (!memberId) {
        return reply.status(400).send({ error: 'memberId required' });
      }

      const io = getIO();
      // io 없어도 DB 부여/notifications 는 진행되므로 계속한다.

      if (kind === 'inquiry') {
        hiddenOnInquirySubmit(io, memberId).catch((err) => {
          console.warn('[hidden-titles] inquiry hook 실패:', (err as Error).message);
        });
      } else if (kind === 'title_granted') {
        hiddenOnTitleGranted(io, memberId).catch((err) => {
          console.warn('[hidden-titles] title_granted hook 실패:', (err as Error).message);
        });
      } else if (kind === 'nickname_changed') {
        hiddenOnNicknameChanged(io, memberId).catch((err) => {
          console.warn('[hidden-titles] nickname_changed hook 실패:', (err as Error).message);
        });
      } else if (kind === 'eureka_notice') {
        if (!noticeId || typeof noticeId !== 'string') {
          return reply.status(400).send({ error: 'noticeId required' });
        }
        hiddenOnNoticeReadForHidden(io, memberId, noticeId).catch((err) => {
          console.warn('[hidden-titles] eureka_notice hook 실패:', (err as Error).message);
        });
      } else if (kind === 'shop_purchase') {
        hiddenOnShopPurchase(io, memberId).catch((err) => {
          console.warn('[hidden-titles] shop_purchase hook 실패:', (err as Error).message);
        });
      } else {
        return reply.status(400).send({ error: 'unknown kind' });
      }

      return reply.send({ ok: true });
    },
  );

  // ── CDP 잔액 변동 통보 (구매 / 어드민 조정) ───────────────────────────
  app.post<{ Body: NotifyCdpAdjustedBody }>(
    '/internal/notify-cdp-adjusted',
    async (req, reply) => {
      const { secret, memberId, newBalance, delta, reason, ref } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const io = getIO();
      if (!io) {
        return reply.status(503).send({ status: 'not_ready' });
      }

      const token = sessions.getTokenByMemberId(memberId);
      const sid = token ? sessions.getSocketByToken(token) : null;
      const sock = sid ? io.sockets.sockets.get(sid) : null;
      if (sock) {
        sock.emit('cdp:adjusted', { newBalance, delta, reason, ...(ref ? { ref } : {}) });
        return reply.send({ status: 'emitted' });
      }
      return reply.send({ status: 'no_session' });
    },
  );

  // ── 상점 아이템 변경 broadcast (재고 / 활성) ───────────────────────────
  app.post<{ Body: NotifyShopItemChangedBody }>(
    '/internal/notify-shop-item-changed',
    async (req, reply) => {
      const { secret, itemId, stock, isActive } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      const io = getIO();
      if (!io) {
        return reply.status(503).send({ status: 'not_ready' });
      }
      io.emit('shop:item_changed', { itemId, stock, isActive });
      return reply.send({ status: 'emitted' });
    },
  );

  // ── bias 칭호 캐시 무효화 (상점 아이템 추가/수정 시) ───────────────────
  app.post<{ Body: { secret: string } }>(
    '/internal/invalidate-bias-titles',
    async (req, reply) => {
      if (!isValidInternalSecret(req.body.secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      invalidateBiasTitlesCache();
      return reply.send({ ok: true });
    },
  );

  // ── 회원 보유 칭호 캐시 무효화 (구매/회수 후) ───────────────────────────
  app.post<{ Body: { secret: string; memberId: string } }>(
    '/internal/invalidate-owned-titles',
    async (req, reply) => {
      const { secret, memberId } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (typeof memberId !== 'string' || !memberId) {
        return reply.status(400).send({ error: 'memberId required' });
      }
      invalidateOwnedTitles(memberId);
      return reply.send({ ok: true });
    },
  );

  // ── 인벤토리 변동 통보 (구매 / 어드민 조정) ──────────────────────────
  app.post<{
    Body: {
      secret: string;
      memberId: string;
      kind: 'nickname_change' | 'rank_reset' | 'spectator_lock' | 'anonymity';
      countAfter: number;
      reason: 'purchase' | 'auto_use' | 'manual_use' | 'admin_adjust';
      ref?: { kind: string; id: string };
    };
  }>('/internal/notify-inventory-updated', async (req, reply) => {
    const { secret, memberId, kind, countAfter, reason, ref } = req.body;
    if (!isValidInternalSecret(secret)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const io = getIO();
    if (!io) return reply.status(503).send({ status: 'not_ready' });

    const token = sessions.getTokenByMemberId(memberId);
    const sid = token ? sessions.getSocketByToken(token) : null;
    const sock = sid ? io.sockets.sockets.get(sid) : null;
    if (sock) {
      sock.emit('inventory:updated', {
        kind,
        countAfter,
        reason,
        ...(ref ? { ref } : {}),
      });
      return reply.send({ status: 'emitted' });
    }
    return reply.send({ status: 'no_session' });
  });

  // ── 랭크 통계 초기화 통보 (랭크 초기화권 사용 후) ────────────────────
  app.post<{
    Body: {
      secret: string;
      memberId: string;
      seasonId: number;
      ticketCountAfter: number;
    };
  }>('/internal/notify-rank-stats-reset', async (req, reply) => {
    const { secret, memberId, seasonId, ticketCountAfter } = req.body;
    if (!isValidInternalSecret(secret)) {
      return reply.status(403).send({ error: 'Forbidden' });
    }
    const io = getIO();
    if (!io) return reply.status(503).send({ status: 'not_ready' });

    const token = sessions.getTokenByMemberId(memberId);

    // 큐에 들어가 있으면 즉시 빠지게 한다 (오래된 entry.tier/rp 무효화).
    rankQueueStore.removeByMemberId(memberId);

    const sid = token ? sessions.getSocketByToken(token) : null;
    const sock = sid ? io.sockets.sockets.get(sid) : null;
    if (sock) {
      sock.emit('rank:stats:reset', { seasonId, ticketCountAfter });
      sock.emit('rank:queue:status', { inQueue: false, waitSeconds: 0 });
      return reply.send({ status: 'emitted' });
    }
    return reply.send({ status: 'no_session' });
  });

  // ── 길드 가입/탈퇴/추방 — 접속 중인 소켓의 길드방 멤버십 즉시 동기화 ─────
  // (guildId/role 은 session:restore 때만 채워지므로, 접속 중 변경은 이 엔드포인트로 반영)
  app.post<{ Body: { secret: string; memberId: string } }>(
    '/internal/notify-guild-membership-changed',
    async (req, reply) => {
      const { secret, memberId } = req.body;
      if (!isValidInternalSecret(secret)) {
        return reply.status(403).send({ error: 'Forbidden' });
      }
      if (typeof memberId !== 'string' || !memberId) {
        return reply.status(400).send({ error: 'memberId required' });
      }

      const token = sessions.getTokenByMemberId(memberId);
      if (!token) return reply.send({ status: 'no_session' });

      const io = getIO();
      const socketId = sessions.getSocketByToken(token);
      const sock = io && socketId ? io.sockets.sockets.get(socketId) : null;

      const sb = getSupabaseAdmin();
      const { data } = await sb
        .from('guild_members')
        .select('guild_id, guilds!inner(name)')
        .eq('member_id', memberId)
        .maybeSingle();
      const row = data as { guild_id: string; guilds: { name: string } | { name: string }[] } | null;
      const raw = row?.guilds;
      const g = Array.isArray(raw) ? raw[0] : raw;
      const newGuildId = row?.guild_id ?? null;
      const newGuildName = g?.name ?? null;

      sessions.setGuildId(token, newGuildId);
      sessions.setGuildName(token, newGuildName);

      if (sock) {
        for (const room of sock.rooms) {
          if (room.startsWith('guild:')) sock.leave(room);
        }
        if (newGuildId) sock.join(guildRoom(newGuildId));
      }

      return reply.send({ status: 'synced', guildId: newGuildId, guildName: newGuildName });
    },
  );
}
