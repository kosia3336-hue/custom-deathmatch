import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  buildGs2AdvisorKifu,
  gs2AdvisorSnapshot,
} from '@shared/types/grape-sugar-2-advisor.js';
import {
  gs2IsFatalChicken,
  gs2IsInstantExecute,
  gs2IsWastedBreath,
  gs2SugarSoftCap,
  type GS2CardId,
  type Gs2AdvisorRound,
  type Gs2AdvisorSnapshot,
} from '@shared/types/grape-sugar-2.js';
import {
  parseAdvisorHistory,
  pickGrapeSugar2Advisor,
  pickGrapeSugar2AdvisorSnap,
} from '../socket/games/grape-sugar-2/ai-super.js';

function playingSnap(over: {
  round?: number;
  maxRound?: 8 | 9;
  breathAvailable?: boolean;
  my?: Partial<Gs2AdvisorSnapshot['my']>;
  opp?: Partial<Gs2AdvisorSnapshot['opp']>;
}): Gs2AdvisorSnapshot {
  return {
    round: over.round ?? 1,
    maxRound: over.maxRound ?? 8,
    breathAvailable: over.breathAvailable ?? true,
    my: {
      score: 0,
      sugarRemain: 35,
      hand: ['minus3', 'plus5', 'copy', 'grapeBless', 'earthCrush', 'dice', 'breath', 'highRisk', 'spaceCrush', 'noAction'],
      ...over.my,
    },
    opp: {
      score: 0,
      sugarRemain: 35,
      hand: ['minus3', 'plus5', 'copy', 'grapeBless', 'earthCrush', 'dice', 'breath', 'highRisk', 'spaceCrush', 'noAction'],
      ...over.opp,
    },
    result: { kind: 'playing' },
    winType: null,
  };
}

describe('포도설탕2 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.GRAPE_SUGAR_2)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.GRAPE_SUGAR_2)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.GRAPE_SUGAR_2)).toBe('/super-ai/grape-sugar-2');
  });

  it('스냅샷·히스토리에 pending 이 없다', () => {
    const snap = gs2AdvisorSnapshot([]);
    expect(snap.result.kind).toBe('playing');
    expect('pendingCard' in snap.my).toBe(false);
    expect('pendingSugar' in snap.my).toBe(false);
    expect('pendingCard' in snap.opp).toBe(false);
    expect(parseAdvisorHistory([{
      myCard: 'plus5',
      mySugar: 1,
      oppCard: 'minus3',
      oppSugar: 1,
      pendingCard: 'copy',
    }])).toBeNull();
  });

  it('상대 잔여가 무행동뿐이면 우주뿌셔를 안 낸다', () => {
    const my: GS2CardId[] = ['spaceCrush', 'plus5'];
    const opp: GS2CardId[] = ['noAction'];
    expect(gs2IsFatalChicken(my, opp, 'spaceCrush')).toBe(true);
    const pick = pickGrapeSugar2AdvisorSnap(playingSnap({
      my: { score: 0, sugarRemain: 20, hand: my },
      opp: { score: 0, sugarRemain: 20, hand: opp },
    }), 800);
    expect(pick.card).not.toBe('spaceCrush');
    expect(pick.card).toBe('plus5');
  });

  it('상대 잔여가 우주뿌셔뿐이면 무행동으로 즉시승한다', () => {
    const my: GS2CardId[] = ['noAction', 'plus5'];
    const opp: GS2CardId[] = ['spaceCrush'];
    expect(gs2IsFatalChicken(my, opp, 'noAction')).toBe(false);
    expect(gs2IsInstantExecute(my, opp)).toBe(true);
    const pick = pickGrapeSugar2AdvisorSnap(playingSnap({
      my: { score: 0, sugarRemain: 20, hand: my },
      opp: { score: 0, sugarRemain: 20, hand: opp },
    }), 800);
    expect(pick.card).toBe('noAction');
  });

  it('상대 손에 무행동이 있으면 우주뿌셔를 안 낸다', () => {
    const my: GS2CardId[] = ['spaceCrush', 'plus5'];
    const opp: GS2CardId[] = ['noAction', 'plus5'];
    expect(gs2IsFatalChicken(my, opp, 'spaceCrush')).toBe(true);
    const pick = pickGrapeSugar2AdvisorSnap(playingSnap({
      my: { score: 0, sugarRemain: 20, hand: my },
      opp: { score: 0, sugarRemain: 20, hand: opp },
    }), 800);
    expect(pick.card).toBe('plus5');
  });

  it('따라올 수 없는 리드면 싼 카드를 낸다', () => {
    const pick = pickGrapeSugar2AdvisorSnap(playingSnap({
      round: 8,
      maxRound: 8,
      breathAvailable: false,
      my: { score: 5, sugarRemain: 20, hand: ['copy', 'noAction'] },
      opp: { score: 0, sugarRemain: 10, hand: ['plus5'] },
    }), 800);
    expect(pick.card).toBe('noAction');
    expect(pick.sugar).toBeLessThanOrEqual(1);
  });

  it('리드인 마지막 예정 라운드에서 숨고르기로 연장하지 않는다', () => {
    expect(gs2IsWastedBreath({
      card: 'breath',
      handLen: 2,
      breathAvailable: true,
      myScore: 3,
      oppScore: 1,
      round: 8,
      maxRound: 8,
    })).toBe(true);
    const pick = pickGrapeSugar2AdvisorSnap(playingSnap({
      round: 8,
      maxRound: 8,
      breathAvailable: true,
      my: { score: 3, sugarRemain: 8, hand: ['breath', 'plus5'] },
      opp: { score: 0, sugarRemain: 8, hand: ['minus3'] },
    }), 800);
    expect(pick.card).toBe('plus5');
  });

  it('1라운드 선플은 설탕 20을 쓰지 않는다', () => {
    expect(gs2SugarSoftCap('grapeBless', 35, 8, false, 0)).toBeLessThanOrEqual(13);
    const pick = pickGrapeSugar2Advisor([], 1500);
    expect(pick.sugar).toBeLessThanOrEqual(13);
  });

  it('마지막 라운드 복사만 있으면 잔여를 충분히 쓴다', () => {
    const pick = pickGrapeSugar2AdvisorSnap(playingSnap({
      round: 8,
      maxRound: 8,
      breathAvailable: false,
      my: { score: 1, sugarRemain: 10, hand: ['copy'] },
      opp: { score: 1, sugarRemain: 4, hand: ['plus5'] },
    }), 800);
    expect(pick.card).toBe('copy');
    expect(pick.sugar).toBeGreaterThanOrEqual(9);
    expect(pick.sugar).toBeLessThanOrEqual(10);
  });

  it('끝난 자문 판은 나/상대 기보다', () => {
    const hist: Gs2AdvisorRound[] = [
      { myCard: 'noAction', mySugar: 1, oppCard: 'spaceCrush', oppSugar: 1 },
    ];
    const snap = gs2AdvisorSnapshot(hist);
    expect(snap.result.kind).toBe('win');
    const kifu = buildGs2AdvisorKifu({
      history: hist,
      myNickname: '나',
      result: snap.result,
      winType: snap.winType,
    });
    expect(kifu.actions[0]?.players.me?.card).toBe('noAction');
    expect(kifu.actions[0]?.players.me?.byAi).toBe(true);
    expect(kifu.players.me?.nickname).toBe('나');
    expect(kifu.players.opp?.nickname).toBe('상대');
  });
});
