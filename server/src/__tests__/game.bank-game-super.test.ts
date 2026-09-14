import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  bankAdvisorSnapshot,
  bankParseAdvisorRound,
  type BankAdvisorRound,
} from '@shared/types/bank-game-advisor.js';
import {
  bankAmountSoftCap,
  sumBetAmount,
  sumBetCount,
  zeroBet,
} from '@shared/types/bank-game.js';
import {
  parseAdvisorHistory,
  parsePending,
  pickBankGameAdvisor,
} from '../socket/games/bank-game/ai-super.js';

const cheap: BankAdvisorRound = {
  myBet: { 1000: 1, 3000: 0, 5000: 0, 10000: 0 },
  oppCount: 0,
  outcome: 'win',
  oppAmount: 0,
};

describe('은행놀이 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.BANK_GAME)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.BANK_GAME)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.BANK_GAME)).toBe('/super-ai/bank-game');
  });

  it('초반 금액 상한은 2.4만이고 마지막은 잔여 전부다', () => {
    expect(bankAmountSoftCap(100_000, 9, 0)).toBeLessThanOrEqual(24000);
    expect(bankAmountSoftCap(100_000, 1, 0)).toBe(100_000);
  });

  it('스냅샷·히스토리에 상대 권종·승자 금액이 없다', () => {
    const snap = bankAdvisorSnapshot(true, []);
    expect(snap.result.kind).toBe('playing');
    expect('inventory' in snap.opp).toBe(false);
    expect('inventoryAmount' in snap.opp).toBe(false);
    expect(JSON.stringify(snap)).not.toMatch(/oppInventory/);
    expect(bankParseAdvisorRound({
      myBet: zeroBet(),
      oppCount: 0,
      outcome: 'loss',
      oppAmount: 10000,
    })).toBeNull();
    expect(parseAdvisorHistory([{
      myBet: zeroBet(),
      oppCount: 1,
      outcome: 'win',
      oppAmount: 1000,
      oppInventory: { 1000: 19, 3000: 10, 5000: 6, 10000: 2 },
    }])).toBeNull();
    expect(parsePending({ oppBet: zeroBet() })).toBeNull();
  });

  it('1라운드 선은 2.4만 이하이고 1장 올인은 없다', () => {
    const pick = pickBankGameAdvisor(true, [], undefined, 800);
    expect(sumBetAmount(pick.bet)).toBeGreaterThan(0);
    expect(sumBetAmount(pick.bet)).toBeLessThanOrEqual(24000);
    expect(sumBetCount(pick.bet)).toBeGreaterThanOrEqual(2);
    expect(sumBetCount(pick.bet)).toBeLessThanOrEqual(6);
  });

  it('후는 선 0장에 최소 1장으로 이긴다', () => {
    const pick = pickBankGameAdvisor(false, [], { firstCount: 0 }, 800);
    expect(sumBetCount(pick.bet)).toBe(1);
    expect(sumBetAmount(pick.bet)).toBe(1000);
  });

  it('이미 따라올 수 없으면 0장을 낸다', () => {
    const history = Array.from({ length: 6 }, () => cheap);
    expect(parseAdvisorHistory(history, true)).not.toBeNull();
    const snap = bankAdvisorSnapshot(true, history);
    expect(snap.my.score).toBe(6);
    expect(snap.opp.score).toBe(0);
    expect(snap.iAmFirst).toBe(true);
    const pick = pickBankGameAdvisor(true, history, undefined, 800);
    expect(sumBetCount(pick.bet)).toBe(0);
    expect(sumBetAmount(pick.bet)).toBe(0);
  });
});
