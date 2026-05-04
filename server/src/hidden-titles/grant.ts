/**
 * system_grant_hidden_title RPC 호출 + 부여 시 후속 알림 처리.
 */
import { getSupabaseAdmin } from '../db/supabase.js';
import { sessions } from '../store/sessions.js';
import { markAllTitleNotifsRead } from '../db/notifications.js';
import type { IO } from '../socket/types.js';
import { roomStore } from '../store/rooms.js';
import { HIDDEN_TITLES, type HiddenTitleKey } from './constants.js';

interface SystemGrantResult {
  granted: boolean;
  reason?: string;
  title_id?: string;
  holder_id?: string;
  created: boolean;
}

/**
 * 서버 코드에서만 호출한다.
 * 결과가 granted === true 이면 부여가 성공한 최초 1인.
 * 보유자가 이미 있는 경우(already_has_holder) 는 정상 흐름.
 */
export async function grantHiddenTitle(
  io: IO | null,
  key: HiddenTitleKey,
  memberId: string,
): Promise<SystemGrantResult | null> {
  const def = HIDDEN_TITLES[key];
  if (!def) return null;

  const sb = getSupabaseAdmin();

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (sb.rpc as any)('system_grant_hidden_title', {
      p_title_key: def.key,
      p_title_name: def.name,
      p_title_color: def.color,
      p_title_description: def.description,
      p_title_condition_text: def.conditionText,
      p_member_id: memberId,
    });
    if (error) {
      console.warn(`[hidden-titles] ${key} grant error:`, error.message);
      return null;
    }
    const result = data as SystemGrantResult;

    if (result.granted && result.title_id) {
      console.log(
        `[hidden-titles] "${def.name}" 최초 부여 → member=${memberId}` +
          (result.created ? ' (칭호 생성 + 부여)' : ''),
      );
      if (io) {
        emitOrQueueTitleGranted(io, memberId, {
          titleId: result.title_id,
          name: def.name,
          color: def.color,
          description: def.description,
        });
      }
    }

    return result;
  } catch (err) {
    console.warn(`[hidden-titles] ${key} grant failed:`, (err as Error).message);
    return null;
  }
}

interface EmitPayload {
  titleId: string;
  name: string;
  color: string;
  description: string | null;
}

/**
 * 히든 칭호 즉시 알림. 오프라인/인게임이면 pending 으로 보관.
 * Next.js 관리자 notify-title-granted 엔드포인트와 동일한 분기.
 */
function emitOrQueueTitleGranted(io: IO, memberId: string, payload: EmitPayload): void {
  const token = sessions.getTokenByMemberId(memberId);
  if (!token) return; // 이번 서버 기동 중 미접속 — notifications 로 다음 접속 시 처리

  const socketId = sessions.getSocketByToken(token);
  if (!socketId) {
    sessions.addPendingTitle(token, payload);
    return;
  }

  const roomId = sessions.getRoom(socketId);
  const isInGame = roomId ? roomStore.get(roomId)?.status === 'playing' : false;
  if (isInGame) {
    sessions.addPendingTitle(token, payload);
    return;
  }

  const sock = io.sockets.sockets.get(socketId);
  if (!sock) {
    sessions.addPendingTitle(token, payload);
    return;
  }

  sock.emit('title:granted', payload);
  markAllTitleNotifsRead(memberId).catch((err) => {
    console.warn('[hidden-titles] mark read 실패:', err);
  });
}
