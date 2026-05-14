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
} from './conditions.js';
import { HIDDEN_TITLES_POST_UPDATE_START_AT, HIDDEN_TITLES_V2_START_AT } from './constants.js';

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

    // 패자 — 불굴의 전사 (scope: all)
    for (const mid of input.losers) {
      try {
        const n = await countMultiLossesAll(mid);
        if (n >= 100) {
          await grantHiddenTitle(io, 'unbreakable_warrior', mid);
        }
      } catch (err) {
        console.warn('[hidden-titles] unbreakable_warrior check 실패:', (err as Error).message);
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

/** 특정 공지 조회 후 — 유레카 */
export async function onNoticeReadForHidden(io: IO | null, memberId: string, noticeId: string): Promise<void> {
  try {
    if (!EUREKA_NOTICE_ID || noticeId !== EUREKA_NOTICE_ID) return;
    await grantHiddenTitle(io, 'eureka', memberId);
  } catch (err) {
    console.warn('[hidden-titles] onNoticeReadForHidden 실패:', (err as Error).message);
  }
}
