/**
 * 공유 토큰 → 결과 공유 화면 값. 서버 전용(서비스 롤로 참가자 전용 로그를 읽는다).
 * 페이지·메타데이터·카드 이미지가 같은 요청에서 여러 번 부르므로 React cache 로 묶는다.
 *
 * - view: 미리보기 카드·메타데이터용 요약
 * - log : 공개 기보 화면(GameLogView) props — 익명 물약 상대는 항상 '???'
 */

import { cache } from 'react';
import { getGameRule } from '@/lib/gameRules';
import {
  getSupabaseServiceRole,
  isSupabaseServiceRoleConfigured,
} from '@/lib/supabase/service-role';
import { getResultShareSecret, verifyResultShareToken } from './resultToken';
import { buildResultShareView, type ResultShareView } from './resultShareView';
import {
  buildPublicLogProps,
  type PublicLogProps,
  type PublicLogRow,
  type PublicParticipantRow,
} from './publicLogProps';

export interface ResultShareData {
  view: ResultShareView;
  log: PublicLogProps;
}

export const loadResultShare = cache(async (token: string): Promise<ResultShareData | null> => {
  const secret = getResultShareSecret();
  if (!secret || !isSupabaseServiceRoleConfigured()) return null;
  const parsed = verifyResultShareToken(token, secret);
  if (!parsed) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = getSupabaseServiceRole() as any;
  const [logRes, partRes, rankRes] = await Promise.all([
    db
      .from('game_logs')
      .select(
        'id, game_id, mode, played_at, play_time_seconds, total_turns, counts_for_stats, game_record, room_snapshot',
      )
      .eq('id', parsed.logId)
      .maybeSingle(),
    db
      .from('game_log_participants')
      .select(
        'position, member_id, nickname_snapshot, title_snapshot, anonymized, is_winner, is_draw, is_resign',
      )
      .eq('game_log_id', parsed.logId)
      .order('position'),
    db
      .from('rank_match_history')
      .select('id', { count: 'exact', head: true })
      .eq('game_log_id', parsed.logId),
  ]);

  const log = logRes.data as PublicLogRow | null;
  if (logRes.error || !log) return null;
  const participants = (partRes.data ?? []) as PublicParticipantRow[];
  const gameName = getGameRule(log.game_id)?.name ?? log.room_snapshot?.gameName ?? log.game_id;

  const view = buildResultShareView(log, participants, parsed.position, {
    gameName,
    // 무승부 랭크전은 rank_match_history 에 남지 않아 방 제목으로도 본다
    isRanked: (rankRes.count ?? 0) > 0 || /^\[랭크\]/.test(log.room_snapshot?.title ?? ''),
  });
  if (!view) return null;

  return { view, log: buildPublicLogProps(log, participants, parsed.position, gameName) };
});
