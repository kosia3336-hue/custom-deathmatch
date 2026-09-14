import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  sbnwAdvisorAsk,
  sbnwAdvisorHopeless,
  sbnwAdvisorSnapshot,
  sbnwCheapestFold,
  sbnwEmptyPool,
  sbnwMinExtraDigits,
  sbnwScoreRace,
  buildSbnwAdvisorKifu,
  type SbnwAdvisorRound,
  type SBNWTile,
} from '@shared/types/silper-bnw.js';
import { pickSilperBnwAdvisor } from '../socket/games/silper-bnw/ai-super.js';

function r(
  iWasFirst: boolean,
  myTiles: SBNWTile[],
  oppTiles: SBNWTile[],
  rematchIndex = 0,
): SbnwAdvisorRound {
  return { rematchIndex, iWasFirst, myTiles, oppTiles };
}

describe('실퍼의 흑과백 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.SILPER_BNW)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.SILPER_BNW)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.SILPER_BNW)).toBe('/super-ai/silper-bnw');
  });

  it('후플은 선플 자릿수가 없으면 수를 안 고른다', () => {
    expect(sbnwAdvisorAsk(false, [], {})).toBe('need-first-digits');
    expect(sbnwAdvisorAsk(false, [], { firstDigits: 2 })).toBe('second-bid');
    expect(sbnwAdvisorAsk(true, [], {})).toBe('first-bid');
  });

  it('선이 3자리면 접기는 [0], COM처럼 숨은 값에 맞춘 최소승이 아니다', () => {
    const pool = sbnwEmptyPool();
    const comMinWin = sbnwMinExtraDigits(pool, 4);
    expect(comMinWin).toEqual([1, 0, 0, 0]);
    const pick = pickSilperBnwAdvisor(false, [], { firstDigits: 3 }, 400);
    expect(pick.tiles).toEqual([0]);
    expect(pick.tiles).not.toEqual(comMinWin);
  });

  it('선이 2자리면 짧은 수에 4를 쓰지 않는다', () => {
    const pick = pickSilperBnwAdvisor(false, [], { firstDigits: 2 }, 400);
    if (pick.tiles.length < 2) {
      expect(pick.tiles.includes(4)).toBe(false);
    }
  });

  it('점수 레이스가 끝나면 싼 1장이고 승률은 0에 가깝다', () => {
    const hist: SbnwAdvisorRound[] = [
      r(false, [0], [1]),
      r(false, [0], [1]),
      r(false, [0], [1]),
      r(false, [0], [1]),
      r(false, [0], [1]),
      r(false, [2], [2]),
      r(false, [2], [2]),
      r(false, [2], [2]),
      r(false, [2], [2]),
    ];
    const snap = sbnwAdvisorSnapshot(false, hist);
    expect(snap.my.score).toBe(0);
    expect(snap.opp.score).toBe(5);
    expect(sbnwScoreRace(snap.my.score, snap.opp.score, snap.roundsLeft)).toBe('lost');
    expect(sbnwAdvisorHopeless(snap, 'my')).toBe(true);

    const pick = pickSilperBnwAdvisor(false, hist, { firstDigits: 1 }, 400);
    expect(pick.tiles).toEqual(sbnwCheapestFold(snap.my.tiles));
    expect(pick.tiles.length).toBe(1);
    expect(pick.winRate).toBe(0);
  });

  it('필승 레이스면 싼 1장이고 올인하지 않는다', () => {
    const hist: SbnwAdvisorRound[] = [
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [2], [2]),
      r(true, [2], [2]),
      r(true, [2], [2]),
      r(true, [2], [2]),
    ];
    const snap = sbnwAdvisorSnapshot(true, hist);
    expect(snap.my.score).toBe(5);
    expect(snap.opp.score).toBe(0);
    expect(sbnwScoreRace(snap.my.score, snap.opp.score, snap.roundsLeft)).toBe('won');

    const pick = pickSilperBnwAdvisor(true, hist, {}, 400);
    expect(pick.tiles).toEqual(sbnwCheapestFold(snap.my.tiles));
    expect(pick.tiles.length).toBe(1);
    expect(pick.winRate).toBe(1);
  });

  it('1라운드 선플은 19장을 쏟지 않는다', () => {
    const pick = pickSilperBnwAdvisor(true, [], {}, 400);
    expect(pick.tiles.length).toBeGreaterThanOrEqual(1);
    expect(pick.tiles.length).toBeLessThanOrEqual(3);
    expect(pick.tiles).not.toContain(4);
  });

  it('끝난 자문 판은 나/상대 기보다', () => {
    const hist = [
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [1], [0]),
      r(true, [2], [0]),
    ];
    const snap = sbnwAdvisorSnapshot(true, hist);
    expect(snap.result.kind).toBe('win');
    const kifu = buildSbnwAdvisorKifu({
      history: hist,
      iAmFirstStart: true,
      myNickname: '나',
      result: snap.result,
      winType: snap.winType,
    });
    expect(kifu.actions[0]?.players.me?.tilesUsed).toEqual([1]);
    expect(kifu.actions[0]?.players.me?.byAi).toBe(true);
    expect(kifu.players.me?.nickname).toBe('나');
    expect(kifu.finalScores.me).toBe(6);
  });
});
