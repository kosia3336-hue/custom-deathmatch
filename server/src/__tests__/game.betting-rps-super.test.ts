import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  brpsAdvisorAsk,
  brpsAdvisorFinished,
  brpsAdvisorSnapshot,
  brpsAdvisorWinnerFromResult,
  brpsApplyRound,
  brpsHasChoiceRight,
  brpsJudgeBet,
  buildBrpsAdvisorKifu,
} from '@shared/types/betting-rps.js';
import { pickBettingRpsAdvisor, brpsAdvisorTargetBet, brpsAdvisorLeadLocks } from '../socket/games/betting-rps/ai-super.js';
import { flowNextCount, gapBucket, kifuBetFraction, replyWeight, roleWeight } from '../socket/games/betting-rps/kifu-prior.js';

describe('베팅 가위바위보 슈퍼 자문', () => {
  it('선공은 홀수 라운드 선택권이다', () => {
    expect(brpsHasChoiceRight(true, 1)).toBe(true);
    expect(brpsHasChoiceRight(true, 2)).toBe(false);
    expect(brpsHasChoiceRight(false, 1)).toBe(false);
    expect(brpsHasChoiceRight(false, 2)).toBe(true);
  });

  it('승부 승 + 상대 승 예측 성공이면 보너스와 칩이 같이 오른다', () => {
    const next = brpsApplyRound(1, 'match', 'win', 'win', 1, 2, 2);
    expect(next.myChips).toBe(3);
    expect(next.oppChips).toBe(3);
    expect(next.outcome).toBe('success');
    expect(brpsJudgeBet('draw', 'win')).toBe('refund');
  });

  it('10라운드 칩이 많으면 이긴다', () => {
    const hist = Array.from({ length: 10 }, () => ({
      myRole: 'match' as const,
      matchResult: 'win' as const,
      prediction: 'lose' as const,
      betChips: 1,
    }));
    const snap = brpsAdvisorSnapshot(true, hist);
    expect(brpsAdvisorFinished(snap.result)).toBe(true);
    expect(brpsAdvisorWinnerFromResult(snap.result)).toBe('me');
    expect(snap.myChips).toBeGreaterThan(snap.oppChips);
  });

  it('내 선택권이면 먼저 역할을 묻는다', () => {
    expect(brpsAdvisorAsk(true, [], {})).toBe('role');
    expect(brpsAdvisorAsk(true, [], { myRole: 'match' })).toBe('match');
    expect(brpsAdvisorAsk(false, [], {})).toBe('need-opp-role');
    expect(brpsAdvisorAsk(false, [], { oppRole: 'match' })).toBe('bet');
  });

  it('승자들은 선택권에서 승부를 더 많이 고른다', () => {
    expect(roleWeight(1, 'match', false)).toBeGreaterThan(roleWeight(1, 'bet', false));
  });

  it('승자가 승부 패를 내면 상대는 승 예측이 많다', () => {
    expect(replyWeight('match', 'lose', 'win')).toBeGreaterThan(replyWeight('match', 'lose', 'lose'));
  });

  it('승 베팅 뒤에 선택권이 돌아오면 승부 승을 더 낸다', () => {
    const hist = [
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 1 },
    ];
    expect(flowNextCount(hist, 'match', 'win', true)).toBeGreaterThan(
      flowNextCount(hist, 'match', 'lose', true),
    );
  });

  it('1라운드 선공은 승부를 고른다', () => {
    const pick = pickBettingRpsAdvisor(true, [], {}, 90);
    expect(pick.kind).toBe('role');
    if (pick.kind === 'role') expect(pick.role).toBe('match');
  });

  it('1라운드 승부는 패 올인에 터지는 패를 내지 않는다', () => {
    const pick = pickBettingRpsAdvisor(true, [], { myRole: 'match' }, 90);
    expect(pick.kind).toBe('match');
    if (pick.kind === 'match') expect(pick.result).toBe('win');
  });

  it('칩이 없으면 베팅을 고르지 않는다', () => {
    const hist = [
      { myRole: 'bet' as const, matchResult: 'lose' as const, prediction: 'win' as const, betChips: 2 },
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 0 },
    ];
    const snap = brpsAdvisorSnapshot(true, hist);
    expect(snap.round).toBe(3);
    expect(snap.myChips).toBe(0);
    expect(snap.myChoiceRight).toBe(true);
    const pick = pickBettingRpsAdvisor(true, hist, {}, 90);
    expect(pick.kind).toBe('role');
    if (pick.kind === 'role') expect(pick.role).toBe('match');
  });

  it('끝난 자문 판은 나/상대 기보가 된다', () => {
    const hist = [
      { myRole: 'match' as const, matchResult: 'win' as const, prediction: 'lose' as const, betChips: 1 },
    ];
    const snap = brpsAdvisorSnapshot(true, hist);
    const kifu = buildBrpsAdvisorKifu({
      history: hist,
      iAmFirst: true,
      myNickname: '갑',
      result: snap.result.kind === 'playing' ? { kind: 'win', reason: '테스트' } : snap.result,
    });
    expect(kifu.advisor).toBe(true);
    expect(kifu.players.me?.nickname).toBe('갑');
    expect(kifu.actions[0]?.choiceRightPlayerId).toBe('me');
    expect(kifu.actions[0]?.players.me?.role).toBe('match');
    expect(kifu.actions[0]?.players.opp?.role).toBe('bet');
    expect(kifu.actions[0]?.players.me?.byAi).toBe(true);
  });

  it('슈퍼 대국 방은 사목·양면만이고 베팅 가위바위보는 자문 허브다', () => {
    expect(supportsSuperAi(GAME_IDS.BETTING_RPS)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.BETTING_RPS)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.BETTING_RPS)).toBe('/super-ai/betting-rps');
    expect(superAiAdvisorHref(GAME_IDS.FOUR_GRAVITY)).toBeNull();
  });

  it('크게 진 칸의 기보 올인 비율은 있어도 엔진은 읽기 없이 승 올인하지 않는다', () => {
    expect(gapBucket(2, 8)).toBe(0);
    expect(kifuBetFraction(9, 0)).toBeGreaterThanOrEqual(0.9);
    expect(brpsAdvisorTargetBet(9, 4, 10, 'win', [])).toBeLessThan(4);
    expect(brpsAdvisorTargetBet(9, 4, 10, 'win', [])).toBeGreaterThanOrEqual(1);
  });

  it('칩이 쌓이고 상대가 승을 반복하면 1칩만 걸지 않는다', () => {
    const hist = [
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 2 },
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 2 },
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 2 },
    ];
    const snap = brpsAdvisorSnapshot(true, hist);
    expect(snap.round).toBe(4);
    expect(snap.myChips).toBe(8);
    expect(brpsAdvisorTargetBet(snap.round, snap.myChips, snap.oppChips, 'win', hist)).toBeGreaterThanOrEqual(3);
    const pick = pickBettingRpsAdvisor(true, hist, { oppRole: 'match' }, 90);
    expect(pick.kind).toBe('bet');
    if (pick.kind === 'bet') {
      expect(pick.chips).toBeGreaterThanOrEqual(3);
      expect(pick.prediction).toBe('win');
    }
  });

  it('상대가 승부로 패를 내면 다음 예측은 승을 반복하지 않는다', () => {
    const hist = [
      { myRole: 'bet' as const, matchResult: 'lose' as const, prediction: 'win' as const, betChips: 1 },
    ];
    const pick = pickBettingRpsAdvisor(true, hist, { oppRole: 'match' }, 90);
    expect(pick.kind).toBe('bet');
    if (pick.kind === 'bet') expect(pick.prediction).toBe('lose');
  });

  it('상대가 승에 걸면 승부는 패를 내 베팅을 부순다', () => {
    const hist = [
      { myRole: 'match' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 1 },
    ];
    const pick = pickBettingRpsAdvisor(true, hist, { oppRole: 'bet' }, 90);
    expect(pick.kind).toBe('match');
    if (pick.kind === 'match') expect(pick.result).toBe('lose');
  });

  it('후반 상대 승부면 직전 패를 따라가지 않고 보너스 승에 건다', () => {
    const hist: Array<{
      myRole: 'match' | 'bet';
      matchResult: 'win' | 'draw' | 'lose';
      prediction: 'win' | 'draw' | 'lose';
      betChips: number;
    }> = [];
    for (let r = 1; r <= 7; r++) {
      if (brpsHasChoiceRight(true, r)) {
        hist.push({ myRole: 'match', matchResult: 'draw', prediction: 'win', betChips: 0 });
      } else {
        hist.push({ myRole: 'bet', matchResult: 'lose', prediction: 'win', betChips: 0 });
      }
    }
    const snap = brpsAdvisorSnapshot(true, hist);
    expect(snap.round).toBe(8);
    const pick = pickBettingRpsAdvisor(true, hist, { oppRole: 'match' }, 90);
    expect(pick.kind).toBe('bet');
    if (pick.kind === 'bet') expect(pick.prediction).toBe('win');
  });

  it('10라운드 3칩 vs 5칩 승부면 승 베팅을 패로 부순다', () => {
    const iAmFirst = false;
    const hist: Array<{
      myRole: 'match' | 'bet';
      matchResult: 'win' | 'draw' | 'lose';
      prediction: 'win' | 'draw' | 'lose';
      betChips: number;
    }> = [];
    for (let r = 1; r <= 9; r++) {
      if (brpsHasChoiceRight(iAmFirst, r)) {
        hist.push({ myRole: 'match', matchResult: 'draw', prediction: 'win', betChips: r === 8 ? 2 : 0 });
      } else {
        hist.push({ myRole: 'bet', matchResult: 'draw', prediction: 'win', betChips: 0 });
      }
    }
    const snap = brpsAdvisorSnapshot(iAmFirst, hist);
    expect(snap.round).toBe(10);
    const pick = pickBettingRpsAdvisor(iAmFirst, hist, { myRole: 'match' }, 90, { my: 3, opp: 5 });
    expect(pick.kind).toBe('match');
    if (pick.kind === 'match') expect(pick.result).toBe('lose');
  });

  it('10라운드 3칩 vs 5칩이면 베팅 역할은 필패라 승부를 고른다', () => {
    const iAmFirst = false;
    const hist: Array<{
      myRole: 'match' | 'bet';
      matchResult: 'win' | 'draw' | 'lose';
      prediction: 'win' | 'draw' | 'lose';
      betChips: number;
    }> = [];
    for (let r = 1; r <= 9; r++) {
      if (brpsHasChoiceRight(iAmFirst, r)) {
        hist.push({ myRole: 'match', matchResult: 'draw', prediction: 'win', betChips: r === 8 ? 2 : 0 });
      } else {
        hist.push({ myRole: 'bet', matchResult: 'draw', prediction: 'win', betChips: 0 });
      }
    }
    const pick = pickBettingRpsAdvisor(iAmFirst, hist, {}, 90, { my: 3, opp: 5 });
    expect(pick.kind).toBe('role');
    if (pick.kind === 'role') expect(pick.role).toBe('match');
  });

  it('남은 보너스로 뒤집히지 않으면 베팅 없이 승부로 굳힌다', () => {
    expect(brpsAdvisorLeadLocks(10, 8, 3)).toBe(true);
    expect(brpsAdvisorLeadLocks(10, 6, 3)).toBe(false);
    expect(brpsAdvisorLeadLocks(2, 4, 2)).toBe(false);

    const iAmFirst = false;
    const hist: Array<{
      myRole: 'match' | 'bet';
      matchResult: 'win' | 'draw' | 'lose';
      prediction: 'win' | 'draw' | 'lose';
      betChips: number;
    }> = [];
    for (let r = 1; r <= 9; r++) {
      if (brpsHasChoiceRight(iAmFirst, r)) {
        hist.push({ myRole: 'match', matchResult: 'win', prediction: 'lose', betChips: 0 });
      } else {
        hist.push({ myRole: 'bet', matchResult: 'draw', prediction: 'win', betChips: 0 });
      }
    }
    const snap = brpsAdvisorSnapshot(iAmFirst, hist);
    expect(snap.round).toBe(10);
    expect(brpsAdvisorLeadLocks(snap.round, snap.myChips, snap.oppChips)).toBe(true);
    const pick = pickBettingRpsAdvisor(iAmFirst, hist, {}, 90);
    expect(pick.kind).toBe('role');
    if (pick.kind === 'role') expect(pick.role).toBe('match');
  });

  it('리드를 잠글 수 있으면 상대 승 베팅에 승을 내주지 않는다', () => {
    const iAmFirst = false;
    const hist: Array<{
      myRole: 'match' | 'bet';
      matchResult: 'win' | 'draw' | 'lose';
      prediction: 'win' | 'draw' | 'lose';
      betChips: number;
    }> = [];
    for (let r = 1; r <= 9; r++) {
      if (brpsHasChoiceRight(iAmFirst, r)) {
        hist.push({ myRole: 'match', matchResult: 'win', prediction: 'win', betChips: 0 });
      } else {
        hist.push({ myRole: 'bet', matchResult: 'draw', prediction: 'win', betChips: 0 });
      }
    }
    const snap = brpsAdvisorSnapshot(iAmFirst, hist);
    expect(brpsAdvisorLeadLocks(snap.round, snap.myChips, snap.oppChips)).toBe(true);
    const pick = pickBettingRpsAdvisor(iAmFirst, hist, { myRole: 'match' }, 90);
    expect(pick.kind).toBe('match');
    if (pick.kind === 'match') expect(pick.result).toBe('lose');
  });

  it('저장된 진 판 8라운드처럼 패 베팅으로 승 보너스에 맞지 않는다', () => {
    const hist = [
      { myRole: 'match' as const, matchResult: 'lose' as const, prediction: 'lose' as const, betChips: 2 },
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 1 },
      { myRole: 'match' as const, matchResult: 'win' as const, prediction: 'lose' as const, betChips: 2 },
      { myRole: 'bet' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 2 },
      { myRole: 'match' as const, matchResult: 'win' as const, prediction: 'win' as const, betChips: 2 },
      { myRole: 'bet' as const, matchResult: 'lose' as const, prediction: 'win' as const, betChips: 3 },
      { myRole: 'match' as const, matchResult: 'lose' as const, prediction: 'win' as const, betChips: 3 },
    ];
    const snap = brpsAdvisorSnapshot(true, hist);
    expect(snap.round).toBe(8);
    expect(snap.myChips).toBe(5);
    expect(snap.oppChips).toBe(4);
    const pick = pickBettingRpsAdvisor(true, hist, { oppRole: 'match' }, 90);
    expect(pick.kind).toBe('bet');
    if (pick.kind === 'bet') expect(pick.prediction).toBe('win');
  });

  it('받은 생각 시간을 거의 다 쓴다', () => {
    const t0 = Date.now();
    pickBettingRpsAdvisor(true, [], {}, 400);
    expect(Date.now() - t0).toBeGreaterThanOrEqual(300);
  });
});
