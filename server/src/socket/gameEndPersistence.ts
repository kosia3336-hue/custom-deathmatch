/**
 * 게임 종료 시 record_game_end RPC + 히든 칭호 훅 (밴픽 제외).
 */
import type { GameResult } from '@shared/types/events.js';
import type { Player, Room } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import { getSupabaseAdmin, isSupabaseConfigured } from '../db/supabase.js';
import { roomStore } from '../store/rooms.js';
import { onGameEnd as hiddenOnGameEnd } from '../hidden-titles/hooks.js';
import type { IO } from './types.js';
import { getRoomShopState } from '../shop/roomShopState.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { isDummyPlayerId } from '@shared/dummy.js';

export async function persistGameEndLog(io: IO, room: Room, result: GameResult): Promise<string | null> {
  if (!isSupabaseConfigured()) return null;
  if (room.gameId === GAME_IDS.BAN_PICK) return null;
  if (room.players.some((p: Player) => isDummyPlayerId(p.id))) return null;
  if (room.players.some((p: Player) => p.nickname === 'Faker')) return null;

  if (
    (room.gameId === 'game-001' || room.gameId === 'game-002')
    && room.playMode === 'solo'
    && room.players.some((p: Player) => p.nickname === '천하')
  ) {
    return null;
  }

  const playedAt = new Date(Date.now()).toISOString();
  const nonAiRankings = result.rankings.filter((r) => r.playerId !== AI_PLAYER_ID);
  const isDraw = nonAiRankings.length > 1 && nonAiRankings.every((r) => r.rank === 1);
  const endedByForfeit = result.endedByForfeit === true;

  const shopState = getRoomShopState(room.id);
  const anonTokens = shopState?.anonymizedTokens ?? new Set<string>();

  const participants = room.players.map((p, i) => {
    const isAi = p.id === AI_PLAYER_ID;
    const ranking = result.rankings.find((r) => r.playerId === p.id);
    const position: 'first' | 'second' = i === 0 ? 'first' : 'second';
    const isWinner = isDraw ? false : (ranking ? ranking.rank === 1 : null);
    const resigned =
      endedByForfeit
      && room.playMode === 'multi'
      && !isAi
      && ranking != null
      && ranking.rank === 2;
    const anonymized = !isAi && anonTokens.has(p.id);
    return {
      member_id: isAi ? null : p.memberId ?? null,
      position,
      is_winner: isWinner,
      is_draw: isDraw && !isAi,
      is_resign: resigned,
      // 닉네임은 원본 보존 (관리자 감사 가능). 마스킹은 조회 시 적용.
      nickname: isAi ? 'COM' : p.nickname,
      title: p.displayedTitle ?? null,
      anonymized,
    };
  });

  const playMode = room.playMode;
  const sb = getSupabaseAdmin();

  const args = {
    p_game_id: room.gameId,
    p_mode: playMode,
    p_room_snapshot: {
      title: room.title,
      gameName: room.gameName,
      playMode,
      maxPlayers: room.maxPlayers,
      timeLimitSeconds: room.timeLimitSeconds,
      gameOptions: room.gameOptions,
    },
    p_result: {
      winner_position: participants.find((p) => p.is_winner)?.position ?? null,
      rankings: result.rankings,
      gameResultData: result.gameResultData,
    },
    p_play_time_seconds: Math.max(0, Math.floor(result.playTime / 1000)),
    p_total_turns: result.totalTurns ?? 0,
    p_game_record: result.gameResultData ?? {},
    p_played_at: playedAt,
    p_participants: participants,
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: gameLogId, error } = await (sb.rpc as any)('record_game_end', args);
  if (error) throw new Error(error.message);

  const winners = participants
    .filter((p) => p.is_winner === true && p.member_id)
    .map((p) => p.member_id as string);
  const losers = participants
    .filter((p) => p.is_winner === false && !p.is_draw && p.member_id)
    .map((p) => p.member_id as string);
  const drawMembers = participants
    .filter((p) => p.is_draw && p.member_id)
    .map((p) => p.member_id as string);

  const fromBanPick = roomStore.consumeFromBanPick(room.id);
  const anyParticipantResigned = participants.some((p) => p.is_resign);

  void hiddenOnGameEnd(io, {
    mode: playMode,
    playedAt,
    winners,
    losers,
    drawMembers,
    gameId: room.gameId,
    playTimeSeconds: Math.max(0, Math.floor(result.playTime / 1000)),
    fromBanPick,
    anyParticipantResigned,
    endedByForfeit: result.endedByForfeit === true,
  }).catch((err) => {
    console.warn('[game:ended] hidden-titles onGameEnd 실패:', (err as Error).message);
  });

  return typeof gameLogId === 'string' ? gameLogId : null;
}
