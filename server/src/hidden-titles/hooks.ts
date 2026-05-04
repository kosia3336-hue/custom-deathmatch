/**
 * 히든 칭호 판정 훅.
 *
 *  - onGameEnd     : record_game_end 성공 직후. 5종 체크.
 *      · 불굴의 전사 (패자 관점, scope: all)
 *      · 전장 정복자 (승자 관점, scope: post_update)
 *      · 새벽의 별  (승자 관점, scope: post_update, KST 04:00~04:59)
 *      · 천명       (승자 관점, scope: all, 통산 1,000번째 게임)
 *      · 북두칠성   (승자 관점, scope: post_update)
 *  - onInquirySubmit : submit_inquiry 성공 직후. 민원인(post_update) 체크.
 *  - onTitleGranted  : member_titles 에 새 부여가 들어간 직후. 수집가(all) 체크.
 *
 * 훅은 fire-and-forget 이며, 실패해도 본 흐름에 영향 없다.
 */
import type { IO } from '../socket/types.js';
import { grantHiddenTitle } from './grant.js';
import {
  countMultiLossesAll,
  getDistinctWinGameIdsPostUpdate,
  getActiveGameCount,
  countDistinctMultiOpponentsPostUpdate,
  countActiveTitlesAll,
  countInquiriesPostUpdate,
  countTotalMultiGamesAll,
} from './conditions.js';
import { HIDDEN_TITLES_POST_UPDATE_START_AT } from './constants.js';

export interface GameEndHookInput {
  /** playMode === 'multi' 여부 (멀티만 통계/히든 칭호 판정 대상) */
  isMulti: boolean;
  playedAt: string; // ISO
  winners: string[]; // memberId[] (AI / null 제외)
  losers: string[]; // memberId[]
  drawMembers: string[]; // memberId[] (승/패 아님)
}

/** KST(UTC+9) 기준 04:00:00 ~ 04:59:59 승리인지 */
function isDawnKst(iso: string): boolean {
  const d = new Date(iso);
  const kstMs = d.getTime() + 9 * 60 * 60 * 1000;
  const kst = new Date(kstMs);
  return kst.getUTCHours() === 4;
}

/**
 * record_game_end 직후 호출.
 * 실패해도 throw 하지 않는다 (fire-and-forget).
 */
export async function onGameEnd(io: IO | null, input: GameEndHookInput): Promise<void> {
  try {
    if (!input.isMulti) return; // 멀티만 판정

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

    // 승자 — 여러 조건
    for (const mid of input.winners) {
      // 전장 정복자 — post_update 기간 내 14종 모두 승리
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
    }
  } catch (err) {
    console.warn('[hidden-titles] onGameEnd 전체 실패:', (err as Error).message);
  }
}

/**
 * submit_inquiry 성공 직후 — 민원인 칭호 체크.
 */
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

/**
 * 칭호 부여(일반·히든 포함) 직후 — 수집가 체크.
 * 방금 부여된 칭호까지 포함한 활성 보유 수 기준.
 */
export async function onTitleGranted(io: IO | null, memberId: string): Promise<void> {
  try {
    const n = await countActiveTitlesAll(memberId);
    if (n >= 5) {
      const r = await grantHiddenTitle(io, 'collector', memberId);
      // 수집가 자체가 부여되면 총 6개 — 다시 재귀 호출은 필요 없음.
      void r;
    }
  } catch (err) {
    console.warn('[hidden-titles] onTitleGranted 실패:', (err as Error).message);
  }
}
