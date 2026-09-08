import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  MBNW_TILE_COLOR,
  MBNW_TILE_SET,
  buildMbnwAdvisorKifu,
  mbnwAdvisorAsk,
  mbnwAdvisorSnapshot,
  mbnwSettleAdvisorRound,
  type MbnwAdvisorRound,
} from '@shared/types/multiple-bnw.js';
import { pickMultipleBnwAdvisor, worldsAfter } from '../socket/games/multiple-bnw/ai-super.js';

function r(p: Partial<MbnwAdvisorRound> & Pick<MbnwAdvisorRound, 'myTile' | 'iWasFirst' | 'oppColor'>): MbnwAdvisorRound {
  return {
    mySuspected: false,
    mySuccess: null,
    oppSuspected: false,
    oppSuccess: null,
    secondSkipped: false,
    cmp: null,
    ...p,
  };
}

describe('배수 흑과 백 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.MULTIPLE_BNW)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.MULTIPLE_BNW)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.MULTIPLE_BNW)).toBe('/super-ai/multiple-bnw');
  });

  it('선플 의심 성공이면 후플은 스킵하고 선플이 1점', () => {
    const s = mbnwSettleAdvisorRound(
      r({
        iWasFirst: true,
        myTile: 6,
        oppColor: 'black',
        mySuspected: true,
        mySuccess: true,
        secondSkipped: true,
      }),
    );
    expect(s.myDelta).toBe(1);
    expect(s.oppDelta).toBe(0);
    expect(s.mySuspectWin).toBe(true);
    expect(s.nextIAmFirst).toBe(true);
  });

  it('후플이 선플 의심 성공을 넣으면 후플 의심은 묻지 않는다', () => {
    expect(mbnwAdvisorAsk(true, [], {})).toBe('tile');
    expect(mbnwAdvisorAsk(false, [], {})).toBe('need-opp-color');
    expect(mbnwAdvisorAsk(false, [], { oppColor: 'white' })).toBe('tile');
    expect(mbnwAdvisorAsk(false, [], { oppColor: 'white', myTile: 5 })).toBe('need-first-suspect');
    expect(mbnwAdvisorAsk(false, [], { oppColor: 'white', myTile: 5, firstSuspect: 'fail' })).toBe('suspect');
  });

  it('후플 기준 선플 의심 성공은 상대가 선플을 유지한다', () => {
    const s = mbnwSettleAdvisorRound(
      r({
        iWasFirst: false,
        myTile: 5,
        oppColor: 'black',
        oppSuspected: true,
        oppSuccess: true,
        secondSkipped: true,
      }),
    );
    expect(s.myDelta).toBe(0);
    expect(s.oppDelta).toBe(1);
    expect(s.nextIAmFirst).toBe(false);
  });

  it('의심 성공자가 없으면 큰 쪽이 +1이다', () => {
    const s = mbnwSettleAdvisorRound(
      r({
        iWasFirst: true,
        myTile: 12,
        oppColor: 'black',
        cmp: 'me',
      }),
    );
    expect(s.myDelta).toBe(1);
    expect(s.oppDelta).toBe(0);
    expect(s.nextIAmFirst).toBe(true);
  });

  it('색·배수로 상대 세계를 좁힌다', () => {
    const w0 = worldsAfter([]);
    expect(w0).toHaveLength(1);
    const w1 = worldsAfter([
      r({
        iWasFirst: true,
        myTile: 6,
        oppColor: 'black',
        mySuspected: true,
        mySuccess: true,
        secondSkipped: true,
      }),
    ]);
    expect(w1).toHaveLength(2);
    const used = w1.flatMap((world) => MBNW_TILE_SET.filter((_, i) => (world.mask & (1 << i)) === 0));
    expect(used.sort((a, b) => a - b)).toEqual([6, 12]);
    for (const t of used) {
      expect(MBNW_TILE_COLOR[t]).toBe('black');
      expect(t % 6).toBe(0);
    }
  });

  it('1라운드 선플 타일은 세트 안이고 후플은 상대 색을 보고 고른다', () => {
    const open = pickMultipleBnwAdvisor(true, [], {}, 400);
    expect(open.kind).toBe('tile');
    if (open.kind === 'tile') {
      expect(MBNW_TILE_SET).toContain(open.tile);
    }

    const resp = pickMultipleBnwAdvisor(false, [], { oppColor: 'white' }, 400);
    expect(resp.kind).toBe('tile');
    if (resp.kind === 'tile') {
      expect(MBNW_TILE_SET).toContain(resp.tile);
    }
  });

  it('상대 흑이 내 5의 배수가 될 수 없으면 의심하지 않는다', () => {
    const no = pickMultipleBnwAdvisor(true, [], { myTile: 5, oppColor: 'black' }, 400);
    expect(no.kind).toBe('suspect');
    if (no.kind === 'suspect') expect(no.suspect).toBe(false);
  });

  it('상대가 12로 확정되면 세계가 하나다', () => {
    const w = worldsAfter([
      r({
        iWasFirst: true,
        myTile: 12,
        oppColor: 'black',
        mySuspected: true,
        mySuccess: true,
        secondSkipped: true,
      }),
    ]);
    expect(w).toHaveLength(1);
    const used = MBNW_TILE_SET.filter((_, i) => (w[0]!.mask & (1 << i)) === 0);
    expect(used).toEqual([12]);
  });

  it('끝난 자문 판은 나/상대 기보가 되고 상대 숫자는 0이다', () => {
    const hist = [
      r({
        iWasFirst: true,
        myTile: 6,
        oppColor: 'black',
        mySuspected: true,
        mySuccess: true,
        secondSkipped: true,
      }),
    ];
    const kifu = buildMbnwAdvisorKifu({
      history: hist,
      iAmFirstStart: true,
      myNickname: '나',
      result: { kind: 'win', reason: '점수 1 vs 0' },
    });
    expect(kifu.actions[0]?.players.me?.tile).toBe(6);
    expect(kifu.actions[0]?.players.opp?.tile).toBe(0);
    expect(kifu.actions[0]?.players.opp?.tileColor).toBe('black');
    expect(kifu.actions[0]?.players.me?.suspected).toBe(true);
    expect(kifu.actions[0]?.players.me?.suspectSuccess).toBe(true);
    expect(mbnwAdvisorSnapshot(true, hist).myScore).toBe(1);
  });
});
