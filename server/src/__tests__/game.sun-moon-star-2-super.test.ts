import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  sms2AdvisorSnapshot,
  sms2ParseAdvisorRound,
  type Sms2AdvisorRound,
} from '@shared/types/sun-moon-star-2-advisor.js';
import {
  sms2PowderSoftCap,
  sms2StageKeepSpend,
  sumBet,
  sumPowder,
  zeroBet,
  zeroPowder,
} from '@shared/types/sun-moon-star-2.js';
import {
  parseAdvisorHistory,
  parsePending,
  pickSunMoonStar2Advisor,
} from '../socket/games/sun-moon-star-2/ai-super.js';

const z = zeroPowder();

function moonBoardHistory(): Sms2AdvisorRound[] {
  return [
    {
      myPowder: z,
      myBet: { sun: 0, moon: 4, star: 0 },
      oppBet: { sun: 8, moon: 0, star: 0 },
      litMark: 'sun',
      leftoverAfter: { sun: 0, moon: 50, star: 0 },
      oppStageAfter: 5,
    },
    {
      myPowder: z,
      myBet: { sun: 0, moon: 2, star: 0 },
      oppBet: { sun: 1, moon: 0, star: 0 },
      litMark: 'sun',
      leftoverAfter: { sun: 0, moon: 50, star: 0 },
      oppStageAfter: 5,
    },
  ];
}

describe('해달별2 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.SUN_MOON_STAR_2)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.SUN_MOON_STAR_2)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.SUN_MOON_STAR_2)).toBe('/super-ai/sun-moon-star-2');
  });

  it('초반 빛가루 상한은 27이고 단계는 19g까지 유지한다', () => {
    expect(sms2PowderSoftCap(100, 10)).toBe(27);
    expect(sms2StageKeepSpend(100)).toBe(19);
  });

  it('스냅샷·히스토리에 상대 정확 빛가루가 없다', () => {
    const snap = sms2AdvisorSnapshot(true, []);
    expect(snap.result.kind).toBe('playing');
    expect('powderRemain' in snap.opp).toBe(false);
    expect(JSON.stringify(snap)).not.toMatch(/oppPowder/);
    expect(sms2ParseAdvisorRound({
      myPowder: z,
      myBet: zeroBet(),
      oppBet: zeroBet(),
      litMark: 'sun',
      leftoverAfter: z,
      oppStageAfter: 5,
      oppPowder: { sun: 10, moon: 0, star: 0 },
    })).toBeNull();
    expect(parseAdvisorHistory([{
      myPowder: z,
      myBet: zeroBet(),
      oppBet: zeroBet(),
      litMark: 'sun',
      leftoverAfter: z,
      oppStageAfter: 5,
      oppPowderRemain: 80,
    }])).toBeNull();
    expect(parsePending({ oppPowder: z })).toBeNull();
  });

  it('1라운드 빛가루는 27g 이하이고 28g은 없다', () => {
    const pick = pickSunMoonStar2Advisor(true, [], undefined, 800);
    expect(pick.kind).toBe('powder');
    expect(sumPowder(pick.powder)).toBeLessThanOrEqual(27);
    expect(sumPowder(pick.powder)).not.toBe(28);
  });

  it('8대8 선 베팅은 0 또는 4칩이다', () => {
    const pick = pickSunMoonStar2Advisor(true, [], {
      myPowder: { sun: 19, moon: 0, star: 0 },
      oppStageAfter: 5,
    }, 800);
    expect(pick.kind).toBe('bet');
    const t = sumBet(pick.bet);
    expect(t === 0 || t === 4).toBe(true);
  });

  it('상대 선 4칩이면 후는 8칩 이상이다', () => {
    const pick = pickSunMoonStar2Advisor(false, [], {
      myPowder: { sun: 19, moon: 0, star: 0 },
      oppStageAfter: 5,
      oppFirstBet: { sun: 4, moon: 0, star: 0 },
    }, 800);
    expect(pick.kind).toBe('bet');
    expect(sumBet(pick.bet)).toBeGreaterThanOrEqual(8);
  });

  it('마지막 칩을 어두운 해에 올리지 않는다', () => {
    const history = moonBoardHistory();
    expect(parseAdvisorHistory(history, true)).not.toBeNull();
    const snap = sms2AdvisorSnapshot(true, history);
    expect(snap.result.kind).toBe('playing');
    expect(snap.my.chips).toBe(2);
    expect(snap.iAmFirst).toBe(true);
    expect(snap.leftover.moon).toBe(50);

    const pick = pickSunMoonStar2Advisor(true, history, {
      myPowder: z,
      oppStageAfter: 5,
    }, 800);
    expect(pick.kind).toBe('bet');
    expect(pick.bet.sun).toBe(0);
    expect(pick.bet.star).toBe(0);
  });
});
