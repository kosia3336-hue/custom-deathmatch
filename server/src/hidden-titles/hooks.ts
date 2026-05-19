/**
 * 히든 칭호 판정 훅.
 *
 * 훅은 fire-and-forget 이며, 실패해도 본 흐름에 영향 없다.
 */
import type { PlayMode } from '@shared/types/room.js';
import type { IO } from '../socket/types.js';
import { incrementBanPickMultiWin, getBanPickMultiWinTotal } from './ban-pick-stats.js';
import { grantHiddenTitle } from './grant.js';
import {
  countMultiLossesAll,
  getDistinctWinGameIdsPostUpdate,
  getActiveGameCount,
  countDistinctMultiOpponentsPostUpdate,
  countActiveTitlesAll,
  countInquiriesPostUpdate,
  countTotalMultiGamesAll,
  countComWinsSince,
  maxMultiPlaysSingleGameSince,
  isNicknameChangedSinceV2Cutoff,
  countConsecutiveRankGamesInTier,
  wasDefeatedByOpponentLastGame,
  isStreakInMulti,
  getTotalCdpSpent,
} from './conditions.js';
import {
  HIDDEN_TITLES_POST_UPDATE_START_AT,
  HIDDEN_TITLES_V2_START_AT,
  HIDDEN_TITLES_V3_START_AT,
} from './constants.js';

const EUREKA_NOTICE_ID = process.env.HIDDEN_EUREKA_NOTICE_ID?.trim() ?? '';

export interface GameEndHookInput {
  mode: PlayMode;
  playedAt: string;
  winners: string[];
  losers: string[];
  drawMembers: string[];
  /** 종료 시점 방의 실제 게임 ID (밴픽 후 추첨된 게임) */
  gameId: string;
  playTimeSeconds: number;
  /** 멀티 밴픽에서 추첨된 실게임의 종료인 경우 true */
  fromBanPick: boolean;
  /** 참가자 중 탈주/기권 플래그가 있는 판 */
  anyParticipantResigned: boolean;
  endedByForfeit: boolean;
}

/** KST(UTC+9) 기준 04:00:00 ~ 04:59:59 승리인지 */
function isDawnKst(iso: string): boolean {
  const d = new Date(iso);
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  return kst.getUTCHours() === 4;
}

/**
 * record_game_end 성공 직후 호출.
 */
export async function onGameEnd(io: IO | null, input: GameEndHookInput): Promise<void> {
  try {
    const v2 = HIDDEN_TITLES_V2_START_AT;

    // ── COM — 인류의 희망 ────────────────────────────────────────────────
    if (input.mode === 'com') {
      if (input.playedAt >= v2) {
        for (const mid of input.winners) {
          try {
            const n = await countComWinsSince(mid, v2);
            if (n >= 15) {
              await grantHiddenTitle(io, 'hope_of_humanity', mid);
            }
          } catch (err) {
            console.warn('[hidden-titles] hope_of_humanity check 실패:', (err as Error).message);
          }
        }
      }
      return;
    }

    if (input.mode !== 'multi') return;

    // 패자 — 불굴의 전사 (scope: all) + 강철의 투지 (scope: v3)
    for (const mid of input.losers) {
      try {
        const n = await countMultiLossesAll(mid);
        if (n >= 100) {
          await grantHiddenTitle(io, 'unbreakable_warrior', mid);
        }
      } catch (err) {
        console.warn('[hidden-titles] unbreakable_warrior check 실패:', (err as Error).message);
      }

      // 강철의 투지 — v3 이후 멀티 8연패
      if (input.playedAt >= HIDDEN_TITLES_V3_START_AT) {
        try {
          const streak = await isStreakInMulti(mid, 8, false, HIDDEN_TITLES_V3_START_AT);
          if (streak) {
            await grantHiddenTitle(io, 'iron_will', mid);
          }
        } catch (err) {
          console.warn('[hidden-titles] iron_will check 실패:', (err as Error).message);
        }
      }
    }

    const touchedMembers = new Set<string>([
      ...input.winners,
      ...input.losers,
      ...input.drawMembers,
    ]);

    // v2 전부 참가자 — 같은 게임 30판 (멀티)
    if (input.playedAt >= v2) {
      for (const mid of touchedMembers) {
        try {
          const maxPlays = await maxMultiPlaysSingleGameSince(mid, v2);
          if (maxPlays >= 30) {
            await grantHiddenTitle(io, 'one_strike_master', mid);
          }
        } catch (err) {
          console.warn('[hidden-titles] one_strike_master check 실패:', (err as Error).message);
        }
      }
    }

    // 승자 전용 — 파죽지세·결자해지 (scope: v3)
    if (input.playedAt >= HIDDEN_TITLES_V3_START_AT) {
      for (const mid of input.winners) {
        // 파죽지세 — v3 이후 멀티 8연승
        try {
          const streak = await isStreakInMulti(mid, 8, true, HIDDEN_TITLES_V3_START_AT);
          if (streak) {
            await grantHiddenTitle(io, 'winning_spree', mid);
          }
        } catch (err) {
          console.warn('[hidden-titles] winning_spree check 실패:', (err as Error).message);
        }

        // 결자해지 — 직전 게임에서 나에게 패배를 안긴 상대를 이번 게임에서 꺾음
        const losers = input.losers.filter((l) => l !== mid);
        for (const opponentId of losers) {
          try {
            const isRevenge = await wasDefeatedByOpponentLastGame(
              mid,
              opponentId,
              HIDDEN_TITLES_V3_START_AT,
            );
            if (isRevenge) {
              await grantHiddenTitle(io, 'karmic_resolve', mid);
            }
          } catch (err) {
            console.warn('[hidden-titles] karmic_resolve check 실패:', (err as Error).message);
          }
        }
      }
    }

    // 승자 전용
    for (const mid of input.winners) {
      // 전장 정복자 — post_update 기간 내 활성 게임 전 종 승리
      try {
        const [wins, totalGames] = await Promise.all([
          getDistinctWinGameIdsPostUpdate(mid),
          getActiveGameCount(),
        ]);
        if (totalGames > 0 && wins.size >= totalGames) {
          await grantHiddenTitle(io, 'field_conqueror', mid);
        }
      } catch (err) {
        console.warn('[hidden-titles] field_conqueror check 실패:', (err as Error).message);
      }

      // 새벽의 별 — post_update + KST 04:00대 승리
      try {
        if (
          input.playedAt >= HIDDEN_TITLES_POST_UPDATE_START_AT &&
          isDawnKst(input.playedAt)
        ) {
          await grantHiddenTitle(io, 'dawn_star', mid);
        }
      } catch (err) {
        console.warn('[hidden-titles] dawn_star check 실패:', (err as Error).message);
      }

      // 천명 — 통산 1,000번째 게임의 승자
      try {
        const total = await countTotalMultiGamesAll();
        if (total >= 1000) {
          await grantHiddenTitle(io, 'thousand_fate', mid);
        }
      } catch (err) {
        console.warn('[hidden-titles] thousand_fate check 실패:', (err as Error).message);
      }

      // 북두칠성 — post_update 기준 서로 다른 상대 7명
      try {
        const oppCnt = await countDistinctMultiOpponentsPostUpdate(mid);
        if (oppCnt >= 7) {
          await grantHiddenTitle(io, 'big_dipper', mid);
        }
      } catch (err) {
        console.warn('[hidden-titles] big_dipper check 실패:', (err as Error).message);
      }

      // ── v2 멀티 승자 전용 ────────────────────────────────────────────
      if (input.playedAt >= v2) {
        // 전략가 — 멀티 밴픽 추첨 게임 승리 누적 5
        if (input.fromBanPick) {
          try {
            await incrementBanPickMultiWin(mid);
            const wins = await getBanPickMultiWinTotal(mid);
            if (wins >= 5) {
              await grantHiddenTitle(io, 'strategist', mid);
            }
          } catch (err) {
            console.warn('[hidden-titles] strategist check 실패:', (err as Error).message);
          }
        }

        // 인고의 시간 — 1시간 이상 승리
        try {
          if (input.playTimeSeconds >= 3600) {
            await grantHiddenTitle(io, 'trial_of_patience', mid);
          }
        } catch (err) {
          console.warn('[hidden-titles] trial_of_patience check 실패:', (err as Error).message);
        }

        // 전광석화 — 3분 이내 승리, 탈주/즉시종료 제외
        try {
          if (
            input.playTimeSeconds <= 180 &&
            !input.anyParticipantResigned &&
            !input.endedByForfeit
          ) {
            await grantHiddenTitle(io, 'blitz_victor', mid);
          }
        } catch (err) {
          console.warn('[hidden-titles] blitz_victor check 실패:', (err as Error).message);
        }
      }
    }
  } catch (err) {
    console.warn('[hidden-titles] onGameEnd 전체 실패:', (err as Error).message);
  }
}

/** submit_inquiry 성공 직후 — 민원인 */
export async function onInquirySubmit(io: IO | null, memberId: string): Promise<void> {
  try {
    const n = await countInquiriesPostUpdate(memberId);
    if (n >= 3) {
      await grantHiddenTitle(io, 'complainant', memberId);
    }
  } catch (err) {
    console.warn('[hidden-titles] onInquirySubmit 실패:', (err as Error).message);
  }
}

/** 칭호 부여 직후 — 수집가 */
export async function onTitleGranted(io: IO | null, memberId: string): Promise<void> {
  try {
    const n = await countActiveTitlesAll(memberId);
    if (n >= 5) {
      await grantHiddenTitle(io, 'collector', memberId);
    }
  } catch (err) {
    console.warn('[hidden-titles] onTitleGranted 실패:', (err as Error).message);
  }
}

/** 닉네임 변경 RPC 성공 직후 — 둔갑술 */
export async function onNicknameChanged(io: IO | null, memberId: string): Promise<void> {
  try {
    const ok = await isNicknameChangedSinceV2Cutoff(memberId);
    if (!ok) return;
    await grantHiddenTitle(io, 'name_changer', memberId);
  } catch (err) {
    console.warn('[hidden-titles] onNicknameChanged 실패:', (err as Error).message);
  }
}

/** shop purchase 후 — 플렉스 (Next.js API → 소켓 서버 내부 라우트 경유) */
export async function onShopPurchase(io: IO | null, memberId: string): Promise<void> {
  try {
    const spent = await getTotalCdpSpent(memberId);
    if (spent >= 3500) {
      await grantHiddenTitle(io, 'flex', memberId);
    }
  } catch (err) {
    console.warn('[hidden-titles] onShopPurchase 실패:', (err as Error).message);
  }
}

export interface RankedGameEndHookInput {
  /** 이번 게임에서 승리한 회원 ID (무승부이면 비어 있음) */
  winnerId: string | null;
  /** 이번 게임에서 패배한 회원 ID (무승부이면 비어 있음) */
  loserId: string | null;
  /** rank_match_history 저장 완료 후 호출되므로 이번 판도 포함됨 */
  winnerTierAfter: string;
  loserTierAfter: string;
}

/**
 * rank_match_history 저장 완료 직후 호출 (processRankedGameEnd Phase 2 끝).
 * 천공의 주인 · 심연의 수문장 판정.
 */
export async function onRankedGameEnd(
  io: IO | null,
  input: RankedGameEndHookInput,
): Promise<void> {
  try {
    const { winnerId, loserId, winnerTierAfter, loserTierAfter } = input;

    const pairs: Array<{ memberId: string; tier: string; targetKey: 'lord_of_sky' | 'sentinel_of_abyss'; needed: number }> = [];

    if (winnerId) {
      if (winnerTierAfter === 'challenger') pairs.push({ memberId: winnerId, tier: 'challenger', targetKey: 'lord_of_sky', needed: 70 });
      if (winnerTierAfter === 'bronze')     pairs.push({ memberId: winnerId, tier: 'bronze',     targetKey: 'sentinel_of_abyss', needed: 30 });
    }
    if (loserId) {
      if (loserTierAfter === 'challenger') pairs.push({ memberId: loserId, tier: 'challenger', targetKey: 'lord_of_sky', needed: 70 });
      if (loserTierAfter === 'bronze')     pairs.push({ memberId: loserId, tier: 'bronze',     targetKey: 'sentinel_of_abyss', needed: 30 });
    }

    for (const { memberId, tier, targetKey, needed } of pairs) {
      try {
        const streak = await countConsecutiveRankGamesInTier(memberId, tier, needed);
        if (streak >= needed) {
          await grantHiddenTitle(io, targetKey, memberId);
        }
      } catch (err) {
        console.warn(`[hidden-titles] ${targetKey} check 실패:`, (err as Error).message);
      }
    }
  } catch (err) {
    console.warn('[hidden-titles] onRankedGameEnd 전체 실패:', (err as Error).message);
  }
}

/** 특정 공지 조회 후 — 유레카 */
export async function onNoticeReadForHidden(io: IO | null, memberId: string, noticeId: string): Promise<void> {
  try {
    if (!EUREKA_NOTICE_ID || noticeId !== EUREKA_NOTICE_ID) return;
    await grantHiddenTitle(io, 'eureka', memberId);
  } catch (err) {
    console.warn('[hidden-titles] onNoticeReadForHidden 실패:', (err as Error).message);
  }
}
