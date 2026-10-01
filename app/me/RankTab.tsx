import { Card } from '@/components/cdm/Card';
import { Tag } from '@/components/cdm/Tag';
import { EmptyState } from '@/components/cdm/EmptyState';
import { getServerSupabase } from '@/lib/supabase/server';
import { rankOpponentName, type MatchParticipantRow } from '@/lib/anonymousOpponents';
import RankSeasonSelect from './RankSeasonSelect';

const TIER_KO: Record<string, string> = {
  unranked: '언랭',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

interface Season {
  id: number;
  name: string;
  is_active: boolean;
}

interface StatsRow {
  tier: string;
  rp: number;
  placement_done: boolean;
  placement_games: number;
  win_streak: number;
  loss_streak: number;
  season_wins: number;
  season_losses: number;
  season_draws: number;
  season_peak_tier: string;
}

interface MatchRow {
  id: string;
  game_log_id: string | null;
  winner_id: string;
  winner_tier: string;
  winner_rp_gain: number;
  winner_rp_after: number;
  winner_promoted: boolean;
  loser_id: string;
  loser_tier: string;
  loser_rp_loss: number;
  loser_rp_after: number;
  loser_demoted: boolean;
  game_id: string;
  is_forfeit: boolean;
  played_at: string;
}

export default async function RankTab({
  memberId,
  seasonId: seasonIdParam,
}: {
  memberId: string;
  seasonId: string | undefined;
}) {
  const sb = await getServerSupabase();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = sb as any;

  const { data: seasons } = await db
    .from('rank_seasons')
    .select('id, name, is_active')
    .order('id', { ascending: false });

  const seasonList = (seasons ?? []) as Season[];
  if (seasonList.length === 0) return <EmptyState title="아직 랭크 시즌이 없습니다" />;

  const activeSeason = seasonList.find((s) => s.is_active) ?? seasonList[0];
  const parsedId = seasonIdParam ? parseInt(seasonIdParam, 10) : NaN;
  const selectedSeasonId =
    !isNaN(parsedId) && seasonList.some((s) => s.id === parsedId) ? parsedId : activeSeason.id;
  const selectedSeason = seasonList.find((s) => s.id === selectedSeasonId)!;

  const [statsRes, seasonMatchesRes, wonRes, lostRes, gamesRes] = await Promise.all([
    db
      .from('rank_stats')
      .select(
        'tier, rp, placement_done, placement_games, win_streak, loss_streak, season_wins, season_losses, season_draws, season_peak_tier',
      )
      .eq('season_id', selectedSeasonId)
      .eq('member_id', memberId)
      .maybeSingle(),
    db
      .from('rank_match_history')
      .select('game_id, winner_id')
      .eq('season_id', selectedSeasonId)
      .or(`winner_id.eq.${memberId},loser_id.eq.${memberId}`),
    db
      .from('rank_match_history')
      .select(
        'id, game_log_id, winner_id, winner_tier, winner_rp_gain, winner_rp_after, winner_promoted, loser_id, loser_tier, loser_rp_loss, loser_rp_after, loser_demoted, game_id, is_forfeit, played_at',
      )
      .eq('winner_id', memberId)
      .order('played_at', { ascending: false })
      .limit(10),
    db
      .from('rank_match_history')
      .select(
        'id, game_log_id, winner_id, winner_tier, winner_rp_gain, winner_rp_after, winner_promoted, loser_id, loser_tier, loser_rp_loss, loser_rp_after, loser_demoted, game_id, is_forfeit, played_at',
      )
      .eq('loser_id', memberId)
      .order('played_at', { ascending: false })
      .limit(10),
    db.from('games').select('id, name'),
  ]);

  const stats = statsRes.data as StatsRow | null;

  // 선택 시즌 게임별 승률 집계
  const seasonMatches = (seasonMatchesRes.data ?? []) as { game_id: string; winner_id: string }[];
  const gameStats: Record<string, { wins: number; losses: number }> = {};
  for (const m of seasonMatches) {
    if (!gameStats[m.game_id]) gameStats[m.game_id] = { wins: 0, losses: 0 };
    if (m.winner_id === memberId) gameStats[m.game_id].wins++;
    else gameStats[m.game_id].losses++;
  }
  const gameSortedEntries = Object.entries(gameStats)
    .filter(([gameId]) => gameId !== 'ban-pick')
    .sort((a, b) => {
      const rateA = a[1].wins + a[1].losses > 0 ? a[1].wins / (a[1].wins + a[1].losses) : 0;
      const rateB = b[1].wins + b[1].losses > 0 ? b[1].wins / (b[1].wins + b[1].losses) : 0;
      return rateB - rateA;
    });

  // 최근 10게임 (전 시즌 통합)
  const recentMatches = [
    ...((wonRes.data ?? []) as MatchRow[]),
    ...((lostRes.data ?? []) as MatchRow[]),
  ]
    .sort((a, b) => new Date(b.played_at).getTime() - new Date(a.played_at).getTime())
    .slice(0, 10);

  // 상대 표시명 — 그 판의 참가자 스냅샷(game_log_participants) 기준.
  // 상대가 익명 물약을 쓴 판(또는 기록이 없어 알 수 없는 판)은 '???'.
  // 예전처럼 members 의 현재 닉네임을 붙이면 물약을 쓴 판에서도 실명이 보였다.
  const logIds = Array.from(
    new Set(recentMatches.map((m) => m.game_log_id).filter((id): id is string => Boolean(id))),
  );
  const { data: participantData } =
    logIds.length > 0
      ? await db
          .from('game_log_participants')
          .select('game_log_id, member_id, nickname_snapshot, anonymized')
          .in('game_log_id', logIds)
      : { data: [] };
  const participants = (participantData ?? []) as MatchParticipantRow[];
  const opponentNameOf = (m: MatchRow) =>
    rankOpponentName(
      m.game_log_id,
      m.winner_id === memberId ? m.loser_id : m.winner_id,
      participants,
    );

  const gameNameOf = (id: string) =>
    ((gamesRes.data ?? []) as { id: string; name: string }[]).find((g) => g.id === id)?.name ?? id;

  if (!stats && recentMatches.length === 0) {
    return <EmptyState title="아직 랭크 게임 기록이 없습니다" />;
  }

  const totalGames = stats ? stats.season_wins + stats.season_losses + stats.season_draws : 0;

  return (
    <div className="flex flex-col gap-4">
      {/* 시즌 전적 */}
      <Card variant="highlight" accent="accent">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <h2 className="text-sm font-semibold text-cdm-fg-muted">시즌 전적</h2>
          <RankSeasonSelect seasons={seasonList} selectedSeasonId={selectedSeasonId} />
        </div>

        {!stats ? (
          <p className="mt-3 text-sm text-cdm-fg-muted">{selectedSeason.name} 기록 없음</p>
        ) : !stats.placement_done ? (
          <div className="mt-3">
            <p className="text-sm text-cdm-fg">
              배치전 진행 중 ({Math.min(5, stats.placement_games)}/5) · 언랭
            </p>
            <p className="mt-1 text-xs text-cdm-fg-muted">
              {stats.season_wins}승 {stats.season_losses}패
              {stats.season_draws > 0 ? ` ${stats.season_draws}무` : ''}
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-col gap-1.5">
            <div className="flex items-baseline gap-2 flex-wrap">
              <span className="text-xl font-bold text-cdm-fg">
                {TIER_KO[stats.tier] ?? stats.tier}
              </span>
              <span className="text-sm text-cdm-fg-muted">{stats.rp} RP</span>
              {stats.win_streak > 1 && <Tag>{stats.win_streak}연승</Tag>}
              {stats.loss_streak > 1 && (
                <span className="text-xs text-cdm-fg-muted">{stats.loss_streak}연패 중</span>
              )}
            </div>
            <p className="text-xs text-cdm-fg-muted">
              {totalGames}전 {stats.season_wins}승 {stats.season_losses}패
              {stats.season_draws > 0 ? ` ${stats.season_draws}무` : ''} · 최고{' '}
              {TIER_KO[stats.season_peak_tier] ?? stats.season_peak_tier}
            </p>
          </div>
        )}
      </Card>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 md:items-start">
        {/* 게임별 승률 */}
        {gameSortedEntries.length > 0 && (
          <Card>
            <h3 className="mb-3 text-sm font-semibold text-cdm-fg-muted">
              게임별 승률 ({selectedSeason.name})
            </h3>
            <div className="flex flex-col gap-3">
              {gameSortedEntries.map(([gameId, { wins, losses }]) => {
                const total = wins + losses;
                const rate = total > 0 ? Math.round((wins / total) * 1000) / 10 : 0;
                return (
                  <div key={gameId} className="flex items-center justify-between text-sm">
                    <span className="text-cdm-fg">{gameNameOf(gameId)}</span>
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-cdm-fg">{rate}%</span>
                      <span className="text-cdm-fg-muted">{wins}승 {losses}패</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}

        {/* 최근 10게임 */}
        {recentMatches.length > 0 && (
          <div className="flex flex-col gap-2">
            <h3 className="text-sm font-semibold text-cdm-fg-muted">
              최근 {recentMatches.length}게임
            </h3>
            {recentMatches.map((m) => {
              const isWin = m.winner_id === memberId;
              const myTier = isWin ? m.winner_tier : m.loser_tier;
              const rpDelta = isWin ? m.winner_rp_gain : -m.loser_rp_loss;
              const rpAfter = isWin ? m.winner_rp_after : m.loser_rp_after;
              const promoted = isWin && m.winner_promoted;
              const demoted = !isWin && m.loser_demoted;

              return (
                <Card key={m.id}>
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-5 text-sm font-bold ${isWin ? 'text-cdm-accent' : 'text-cdm-fg-muted'}`}
                      >
                        {isWin ? '승' : '패'}
                      </span>
                      <span className="text-sm font-semibold text-cdm-fg">
                        {opponentNameOf(m)}
                      </span>
                      <Tag>{gameNameOf(m.game_id)}</Tag>
                      {m.is_forfeit && (
                        <span className="text-xs text-cdm-fg-subtle">기권</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-semibold ${rpDelta >= 0 ? 'text-cdm-accent' : 'text-cdm-fg-muted'}`}
                      >
                        {rpDelta >= 0 ? '+' : ''}
                        {rpDelta}
                      </span>
                      <span className="text-xs text-cdm-fg-muted">
                        {TIER_KO[myTier] ?? myTier} {rpAfter} RP
                      </span>
                      {promoted && <Tag>승급</Tag>}
                      {demoted && <span className="text-xs text-cdm-fg-subtle">강등</span>}
                    </div>
                  </div>
                  <p className="mt-1.5 text-xs text-cdm-fg-subtle">
                    {new Date(m.played_at).toLocaleString('ko-KR')}
                  </p>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
