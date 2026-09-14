import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  buildFtAdvisorKifu,
  ftAdvisorAsk,
  ftAdvisorSnapshot,
  ftInferredBand,
  ftIsKnownGift,
  ftSureCompleteTowers,
  type FtAdvisorPly,
  type FTTower,
} from '@shared/types/five-towers.js';
import { parseAdvisorHistory, pickFiveTowersAdvisor } from '../socket/games/five-towers/ai-super.js';

function meStack(tower: FTTower, count: 1 | 2 | 3, extra: Partial<FtAdvisorPly> = {}): FtAdvisorPly {
  return { by: 'me', me: { kind: 'stack', tower, count }, ...extra };
}

function oppStack(tower: FTTower, extra: Partial<FtAdvisorPly> = {}): FtAdvisorPly {
  return { by: 'opp', opp: { kind: 'stack', tower }, ...extra };
}

describe('5개의 탑 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.FIVE_TOWERS)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.FIVE_TOWERS)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.FIVE_TOWERS)).toBe('/super-ai/five-towers');
  });

  it('공개 탑에 height 필드가 없다', () => {
    const snap = ftAdvisorSnapshot(true, []);
    expect('height' in snap.towers.A).toBe(false);
    expect(ftAdvisorAsk(true, [])).toBe('my-turn');
    expect(ftAdvisorAsk(false, [])).toBe('opp-turn');
  });

  it('상대 스택이 없으면 높이 = 내 기여이고 하한 8이면 확정 완성', () => {
    const hist = [
      meStack('A', 3),
      oppStack('B'),
      meStack('A', 3),
      oppStack('B'),
      meStack('A', 2),
    ];
    const snap = ftAdvisorSnapshot(true, hist);
    expect(snap.myStacked.A).toBe(8);
    expect(snap.towers.A.milestonesReached.half).toBe(true);
    expect(ftInferredBand(snap, 'A')).toEqual({ lo: 8, hi: 8 });
    expect(ftSureCompleteTowers(snap)).toEqual(['A']);
    const pick = pickFiveTowersAdvisor(true, hist, 400);
    expect(pick.action).toEqual({ type: 'stack', tower: 'A', count: 3 });
    expect(pick.winRate).toBeGreaterThan(0.8);
  });

  it('확정 높이 7에 3칸을 두지 않는다', () => {
    const hist = [
      meStack('A', 3),
      oppStack('B'),
      meStack('A', 3),
      oppStack('B'),
      meStack('A', 1),
    ];
    const snap = ftAdvisorSnapshot(true, hist);
    expect(snap.myStacked.A).toBe(7);
    expect(ftIsKnownGift(snap, 'A', 3)).toBe(true);
    const pick = pickFiveTowersAdvisor(true, hist, 400);
    expect(pick.action).not.toEqual({ type: 'stack', tower: 'A', count: 3 });
    if (pick.action.type === 'stack' && pick.action.tower === 'A') {
      expect(pick.action.count).not.toBe(3);
    }
  });

  it('완성된 탑은 고르지 않는다', () => {
    const hist = [
      meStack('A', 1, { complete: 'A' }),
      oppStack('B'),
    ];
    const snap = ftAdvisorSnapshot(true, hist);
    expect(snap.towers.A.completed).toBe(true);
    expect(snap.myScore).toBe(1);
    const pick = pickFiveTowersAdvisor(true, hist, 400);
    if (pick.action.type === 'stack') expect(pick.action.tower).not.toBe('A');
    else if (pick.action.item === 'zero' || pick.action.item === 'secret') {
      expect(pick.action.target).not.toBe('A');
    } else {
      expect(pick.action.targets.includes('A')).toBe(false);
    }
  });

  it('height 가 있는 기록은 거절한다', () => {
    expect(parseAdvisorHistory([{ by: 'me', me: { kind: 'stack', tower: 'A', count: 1 }, height: 4 }])).toBeNull();
  });

  it('끝난 자문 판은 나/상대 기보다', () => {
    const hist = [
      meStack('A', 1, { complete: 'A' }),
      oppStack('D'),
      meStack('B', 1, { complete: 'B' }),
      oppStack('D'),
      meStack('C', 1, { complete: 'C' }),
    ];
    const snap = ftAdvisorSnapshot(true, hist);
    expect(snap.result.kind).toBe('win');
    const kifu = buildFtAdvisorKifu({
      history: hist,
      iAmFirst: true,
      myNickname: '나',
      result: snap.result,
      winType: snap.winType,
    });
    expect(kifu.actions[0]?.byAi).toBe(true);
    expect(kifu.players.me?.nickname).toBe('나');
    expect(kifu.finalScores.me).toBe(3);
  });
});
