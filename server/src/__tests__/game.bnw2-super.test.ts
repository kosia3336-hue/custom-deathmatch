import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  BNW2_INITIAL_POINTS,
  bnw2AdvisorAsk,
  bnw2AdvisorHopeless,
  bnw2AdvisorSnapshot,
  bnw2LegalSecondBids,
  bnw2PWinGame,
  bnw2StageRange,
  buildBnw2AdvisorKifu,
  calcBNW2Color,
  calcBNW2Stage,
  type Bnw2AdvisorRound,
} from '@shared/types/bnw2.js';
import { kifuOpenWeight, kifuSecondWeight } from '../socket/games/bnw2/kifu-prior.js';
import {
  bnw2ComSecondCheat,
  lastBnw2SuperStats,
  parseAdvisorHistory,
  pickBnw2Advisor,
} from '../socket/games/bnw2/ai-super.js';

const THINK = 90;

/** 테스트만: 숨은 정수 쌍 → 실전 공개 필드. 제품 경로는 숫자를 받지 않는다. */
function hist(rounds: Array<readonly [boolean, number, number]>): Bnw2AdvisorRound[] {
  let oppRem = BNW2_INITIAL_POINTS;
  return rounds.map(([iWasFirst, myPoints, oppPoints]) => {
    oppRem = Math.max(0, oppRem - oppPoints);
    const winner: Bnw2AdvisorRound['winner'] =
      myPoints > oppPoints ? 'me' : oppPoints > myPoints ? 'opp' : 'draw';
    return {
      iWasFirst,
      myPoints,
      oppColor: calcBNW2Color(oppPoints),
      oppStageAfter: calcBNW2Stage(oppRem),
      winner,
    };
  });
}

function many(n: number, iWasFirst: boolean, myPoints: number, oppPoints: number): Bnw2AdvisorRound[] {
  return hist(Array.from({ length: n }, () => [iWasFirst, myPoints, oppPoints] as const));
}

describe('흑과백2 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.BNW2)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.BNW2)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.BNW2)).toBe('/super-ai/bnw2');
  });

  it('10점이면 이긴다', () => {
    const h = many(10, true, 11, 10);
    const snap = bnw2AdvisorSnapshot(true, h);
    expect(snap.result.kind).toBe('win');
    expect(snap.my.score).toBe(10);
  });

  it('후플은 선플 색·단계가 없으면 수를 안 고른다', () => {
    expect(bnw2AdvisorAsk(false, [], {})).toBe('need-first-color');
    expect(bnw2AdvisorAsk(false, [], { firstColor: 'black', firstStageAfter: 10 })).toBe('second-bid');
    expect(bnw2AdvisorAsk(true, [], {})).toBe('first-bid');
  });

  it('기보는 흑 유지에 9·10, 백 1칸에 접기를 더 준다', () => {
    expect(kifuSecondWeight('black', 0, 9)).toBeGreaterThan(kifuSecondWeight('black', 0, 6));
    expect(kifuSecondWeight('white', 1, 0)).toBeGreaterThan(kifuSecondWeight('white', 1, 40));
    expect(kifuOpenWeight(10)).toBeGreaterThan(kifuOpenWeight(40));
    expect(kifuOpenWeight(19)).toBeGreaterThan(kifuOpenWeight(7));
  });

  it('선이 백이면 1~9는 후보가 아니다', () => {
    const cands = bnw2LegalSecondBids(200, 'white', { lo: 10, hi: 19 });
    expect(cands).toContain(0);
    expect(cands.some((b) => b >= 1 && b <= 9)).toBe(false);
    const pick = pickBnw2Advisor(false, [], { firstColor: 'white', firstStageAfter: 10 }, THINK);
    expect(pick.points === 0 || pick.points >= 10).toBe(true);
    expect(pick.points >= 1 && pick.points <= 9).toBe(false);
  });

  it('불 2칸 백은 접는다 (40으로 확정승 아님)', () => {
    const pick = pickBnw2Advisor(false, [], { firstColor: 'white', firstStageAfter: 8 }, THINK);
    expect(pick.points).toBe(0);
    expect(pick.points).not.toBe(bnw2ComSecondCheat(40, 200));
  });

  it('COM 후플 firstPoints+1을 쓰지 않는다', () => {
    const pick = pickBnw2Advisor(false, [], { firstColor: 'black', firstStageAfter: 10 }, THINK);
    expect(pick.points).not.toBe(bnw2ComSecondCheat(5, 200));
    expect(pick.points === 0 || pick.points >= 1).toBe(true);
    expect(pick.points).toBeLessThanOrEqual(10);
  });

  it('필승이면 올인하지 않는다', () => {
    const h = many(9, true, 1, 0);
    const snap = bnw2AdvisorSnapshot(true, h);
    expect(snap.my.score).toBe(9);
    expect(snap.opp.score).toBe(0);
    expect(bnw2AdvisorHopeless(snap, 'opp') || bnw2PWinGame(9, 0, snap.my.remaining, snap.opp.remaining, true) > 0.9).toBe(true);

    const pick = pickBnw2Advisor(true, h, {}, THINK);
    expect(pick.points).toBeLessThan(40);
    expect(pick.winRate).toBeGreaterThan(0.9);
  });

  it('매치포인트 후플은 빈손을 피한다', () => {
    const h = many(9, false, 0, 1);
    const snap = bnw2AdvisorSnapshot(false, h);
    expect(snap.opp.score).toBe(9);
    expect(snap.my.score).toBe(0);
    const pick = pickBnw2Advisor(false, h, { firstColor: 'black', firstStageAfter: 10 }, THINK);
    expect(pick.points).toBeGreaterThan(0);
  });

  it('1라운드 선플은 잔여를 쏟지 않고 기보 쪽에 붙는다', () => {
    const pick = pickBnw2Advisor(true, [], {}, THINK);
    expect(pick.points).toBeLessThan(40);
    expect(pick.points).toBeGreaterThanOrEqual(0);
    expect([0, 9, 10, 12, 13, 15, 16, 19, 20]).toContain(pick.points);
  });

  it('받은 시간을 롤아웃에 쓴다', () => {
    pickBnw2Advisor(true, [], {}, 280);
    const st = lastBnw2SuperStats();
    expect(st.usedMs).toBeGreaterThanOrEqual(200);
    expect(st.sims).toBeGreaterThan(0);
    expect(st.nodes).toBeGreaterThan(50);
  });

  it('끝난 자문 판은 나/상대 기보다. 상대 숫자는 없다', () => {
    const h = many(10, true, 11, 10);
    const snap = bnw2AdvisorSnapshot(true, h);
    expect(snap.result.kind).not.toBe('playing');
    const kifu = buildBnw2AdvisorKifu({
      history: h,
      iAmFirstStart: true,
      myNickname: '나',
      result: snap.result,
      winType: snap.winType,
    });
    expect(kifu.actions[0]?.players.me?.points).toBe(11);
    expect(kifu.actions[0]?.players.me?.byAi).toBe(true);
    expect(kifu.actions[0]?.players.opp?.points).toBeNull();
    expect(kifu.players.me?.nickname).toBe('나');
    expect(kifu.finalScores.me).toBe(10);
  });

  it('상대 잔여는 불 구간이지 정확한 수가 아니다', () => {
    const h = hist([[true, 20, 11]]);
    const snap = bnw2AdvisorSnapshot(true, h);
    const band = bnw2StageRange(snap.opp.stage);
    expect(snap.my.score).toBe(1);
    expect(snap.opp.remaining).toBeGreaterThanOrEqual(band.lo);
    expect(snap.opp.remaining).toBeLessThanOrEqual(band.hi);
    expect(h[0]).not.toHaveProperty('oppPoints');
  });

  it('옛 상대 숫자 기록은 받지 않는다', () => {
    expect(parseAdvisorHistory([{ iWasFirst: true, myPoints: 10, oppPoints: 9 }])).toBeNull();
    expect(
      parseAdvisorHistory([
        { iWasFirst: true, myPoints: 10, oppColor: 'white', oppStageAfter: 8, winner: 'me' },
        { iWasFirst: true, myPoints: 10, oppColor: 'white', oppStageAfter: 9, winner: 'me' },
      ]),
    ).toBeNull();
  });
});
