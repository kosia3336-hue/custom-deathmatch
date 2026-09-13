/**
 * 공유 토큰 → 결과 공유 화면 값. 서버 전용(서비스 롤로 참가자 전용 로그를 읽는다).
 * 페이지·메타데이터·카드 이미지가 같은 요청에서 여러 번 부르므로 React cache 로 묶는다.
 */

import { cache } from 'react';
import { getGameRule } from '@/lib/gameRules';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { getResultShareSecret, verifyResultShareToken } from './resultToken';
import {
  buildResultShareView,
  type ResultShareView,
  type ShareLogRow,
  type ShareParticipantRow,
} from './resultShareView';

export const loadResultShare = cache(async (token: string): Promise<ResultShareView | null> => {
  const secret = getResultShareSecret();
  if (!secret || !isSupabaseServiceRoleConfigured()) return null;
  const parsed = verifyResultShareToken(token, secret);
  if (!parsed) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;
  const [logRes, partRes, rankRes] = await Promise.all([
    db
      .from('game_logs')
      .select('id, game_id, played_at, play_time_seconds, total_turns, room_snapshot')
      .eq('id', parsed.logId)
      .maybeSingle(),
    db
      .from('game_log_participants')
      .select('position, member_id, nickname_snapshot, anonymized, is_winner, is_draw, is_resign')
      .eq('game_log_id', parsed.logId),
    db
      .from('rank_match_history')
      .select('id', { count: 'exact', head: true })
      .eq('game_log_id', parsed.logId),
  ]);

  const log = logRes.data as ShareLogRow | null;
  if (logRes.error || !log) return null;

  return buildResultShareView(log, (partRes.data ?? []) as ShareParticipantRow[], parsed.position, {
    gameName: getGameRule(log.game_id)?.name,
    // 무승부 랭크전은 rank_match_history 에 남지 않아 방 제목으로도 본다
    isRanked: (rankRes.count ?? 0) > 0 || /^\[랭크\]/.test(log.room_snapshot?.title ?? ''),
  });
});
