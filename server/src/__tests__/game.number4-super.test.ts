import { describe, expect, it } from 'vitest';
import { GAME_IDS, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  buildNf4AdvisorKifu,
  nf4AdvisorFinished,
  nf4AdvisorSnapshot,
  nf4AdvisorWinnerFromResult,
} from '@shared/types/number4.js';
import {
  legalSplits,
  pickNumberFourAdvisorNumber,
  stocksAfter,
} from '../socket/games/number4/ai-super.js';
import { flowNextCount, kifuWeight, replyWeight, scoreBucket } from '../socket/games/number4/kifu-prior.js';

describe('넘버4 슈퍼 자문', () => {
  it('합법 타일 배분은 백 장수 8가지다', () => {
    expect(legalSplits(22, 20).length).toBe(8);
    expect(legalSplits(22, 20).some((s) => s.w === 4 && s.b === 3)).toBe(true);
  });

  it('양쪽 넘버1 성공이면 남은 장수가 대칭이다', () => {
    const worlds = stocksAfter([
      { myNumber: 1, oppNumber: 1, mySuccess: true, oppSuccess: true },
    ]);
    expect(worlds.length).toBeGreaterThan(0);
    expect(worlds.every((w) => w.stock.myW === w.stock.opW && w.stock.myB === w.stock.opB)).toBe(
      true,
    );
  });

  it('내가 낸 타일을 알면 내 남은 장수가 고정된다', () => {
    const worlds = stocksAfter([
      {
        myWhite: 4,
        myBlack: 3,
        myNumber: 1,
        oppNumber: 1,
        mySuccess: true,
        oppSuccess: true,
      },
    ]);
    expect(worlds.length).toBeGreaterThan(0);
    expect(worlds.every((w) => w.stock.myW === 18 && w.stock.myB === 17)).toBe(true);
    expect(worlds.every((w) => w.stock.opW === 18 && w.stock.opB === 17)).toBe(true);
  });

  it('백·흑·넘버를 같이 고른다', () => {
    const pick = pickNumberFourAdvisorNumber([], 400, { skipFictitious: true });
    expect(pick.white + pick.black).toBe(7);
    expect(pick.white).toBeGreaterThanOrEqual(0);
    expect(pick.black).toBeGreaterThanOrEqual(0);
    expect(pick.number).toBeGreaterThanOrEqual(0);
    expect(pick.number).toBeLessThanOrEqual(4);
    expect(pick.worlds).toBe(1);
  });

  it('양쪽 넘버2 성공은 불가능해서 시작 세계를 유지한다', () => {
    const after = stocksAfter([
      { myNumber: 2, oppNumber: 2, mySuccess: true, oppSuccess: true },
    ]);
    expect(after).toHaveLength(1);
    expect(after[0]?.stock).toEqual({ myW: 22, myB: 20, opW: 22, opB: 20 });
  });

  it('불가능한 관측이어도 내가 낸 타일은 차감한다', () => {
    const after = stocksAfter([
      {
        myWhite: 4,
        myBlack: 3,
        myNumber: 2,
        oppNumber: 2,
        mySuccess: true,
        oppSuccess: true,
      },
    ]);
    expect(after.every((w) => w.stock.myW === 18 && w.stock.myB === 17)).toBe(true);
    expect(after.every((w) => w.stock.opW === 22 && w.stock.opB === 20)).toBe(true);
  });

  it('기보는 내가 낸 수에 대한 상대 응답이다', () => {
    expect(replyWeight(7, 4, 4, 1)).toBeGreaterThan(replyWeight(7, 4, 0, 0));
    expect(kifuWeight(1, 3, 3, 4, 1)).toBeGreaterThan(kifuWeight(1, 3, 3, 0, 4));
    expect(scoreBucket(3, 3)).toBe(1);
  });

  it('704가 넘버1에 성공한 뒤 승자는 704를 더 낸다', () => {
    const hist = [
      {
        myWhite: 7,
        myBlack: 0,
        myNumber: 4 as const,
        oppNumber: 1 as const,
        mySuccess: true,
        oppSuccess: false,
      },
    ];
    expect(flowNextCount(hist, 7, 4)).toBeGreaterThan(flowNextCount(hist, 5, 3));
  });

  it('오프닝에서 704를 기본으로 고르지 않는다', () => {
    const pick = pickNumberFourAdvisorNumber([], 800);
    expect(pick.white === 7 && pick.number === 4).toBe(false);
  });

  it('양쪽 실패로 0점이면 넘버 합으로 가린다', () => {
    const snap = nf4AdvisorSnapshot([
      { myNumber: 0, oppNumber: 4, mySuccess: false, oppSuccess: false },
      { myNumber: 0, oppNumber: 4, mySuccess: false, oppSuccess: false },
      { myNumber: 0, oppNumber: 4, mySuccess: false, oppSuccess: false },
    ]);
    expect(snap.myScore).toBe(0);
    expect(snap.oppScore).toBe(0);
    expect(snap.result.kind).toBe('win');
  });

  it('슈퍼 대국 방은 사목·양면만이고 넘버4는 허브에만 있다', () => {
    expect(supportsSuperAi(GAME_IDS.NUMBER_FOUR)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.BETTING_RPS)).toBe(true);
    expect(supportsSuperAi(GAME_IDS.MULTIPLE_BNW)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.NUMBER_FOUR)).toBe(false);
    expect(supportsSuperAiMatch(GAME_IDS.FOUR_GRAVITY)).toBe(true);
  });

  it('끝난 자문 판은 나/상대 기보가 된다', () => {
    const hist = [
      {
        myWhite: 4,
        myBlack: 3,
        myNumber: 1 as const,
        oppNumber: 0 as const,
        mySuccess: true,
        oppSuccess: false,
      },
    ];
    const snap = nf4AdvisorSnapshot(hist);
    expect(nf4AdvisorFinished(snap.result, null)).toBe(false);
    const kifu = buildNf4AdvisorKifu({
      history: hist,
      myNickname: '갑',
      winner: 'me',
      result: { kind: 'win', reason: '상대 승점 0 탈락' },
    });
    expect(kifu.advisor).toBe(true);
    expect(kifu.players.me?.nickname).toBe('갑');
    expect(kifu.actions[0]?.players.me?.white).toBe(4);
    expect(kifu.actions[0]?.players.opp?.white).toBeUndefined();
    expect(nf4AdvisorWinnerFromResult({ kind: 'loss', reason: '승점 0 탈락' }, 'me')).toBe('opp');
  });
});
