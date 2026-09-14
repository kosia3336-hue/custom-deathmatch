import { describe, expect, it } from 'vitest';
import { GAME_IDS, superAiAdvisorHref, supportsSuperAi, supportsSuperAiMatch } from '@shared/types/game.js';
import {
  WS_INITIAL_CARDS,
  buildWsAdvisorKifu,
  wsAdvisorHopeless,
  wsAdvisorSnapshot,
  wsGetMatchup,
  wsIsWinResult,
  type WsAdvisorRound,
} from '@shared/types/winning-streak.js';
import {
  pickWinningStreakAdvisor,
  wsRoundWinRate,
} from '../socket/games/winning-streak/ai-super.js';

function r(myCard: WsAdvisorRound['myCard'], oppCard: WsAdvisorRound['oppCard']): WsAdvisorRound {
  return { myCard, oppCard };
}

describe('연승게임 슈퍼 AI 자문', () => {
  it('슈퍼 AI 목록에만 있고 대국 방은 아니다', () => {
    expect(supportsSuperAi(GAME_IDS.WINNING_STREAK)).toBe(true);
    expect(supportsSuperAiMatch(GAME_IDS.WINNING_STREAK)).toBe(false);
    expect(superAiAdvisorHref(GAME_IDS.WINNING_STREAK)).toBe('/super-ai/winning-streak');
  });

  it('10라운드 최대연승이 많으면 이긴다', () => {
    const hist = [
      r('club', 'blackJoker'),
      r('diamond', 'spade'),
      r('club', 'heart'),
      r('diamond', 'spade'),
      r('heart', 'diamond'),
      r('spade', 'club'),
      r('heart', 'diamond'),
      r('spade', 'club'),
      r('blackJoker', 'heart'),
      r('colorJoker', 'colorJoker'),
    ];
    const snap = wsAdvisorSnapshot(hist);
    expect(snap.result.kind).not.toBe('playing');
    expect(snap.my.maxStreak).toBeGreaterThanOrEqual(snap.opp.maxStreak);
  });

  it('직전 종류만 남으면 다음 라운드 전에 고갈패다', () => {
    const hist = [
      r('heart', 'spade'),
      r('heart', 'diamond'),
    ];
    const mid = wsAdvisorSnapshot(hist);
    expect(mid.result.kind).toBe('playing');
    const more: WsAdvisorRound[] = [
      ...hist,
      r('spade', 'club'),
      r('spade', 'club'),
      r('diamond', 'heart'),
      r('diamond', 'heart'),
      r('club', 'blackJoker'),
      r('club', 'spade'),
      r('blackJoker', 'diamond'),
    ];
    const stuckish = wsAdvisorSnapshot(more);
    expect(stuckish.left).toBe(1);
  });

  it('1라운드는 컬러조커로 라운드 승률을 사지 않는다', () => {
    const pick = pickWinningStreakAdvisor([], 1200);
    const colorRound = wsRoundWinRate('colorJoker', WS_INITIAL_CARDS, null);
    const pickedRound = wsRoundWinRate(pick.card, WS_INITIAL_CARDS, null);
    expect(colorRound).toBeGreaterThan(0.9);
    expect(pick.card).not.toBe('colorJoker');
    expect(pickedRound).toBeLessThan(colorRound);
  });

  it('필승이면 컬러를 아끼고 흑백을 버린다', () => {
    const hist = [
      r('club', 'blackJoker'),
      r('diamond', 'spade'),
      r('club', 'heart'),
      r('diamond', 'spade'),
      r('heart', 'diamond'),
      r('spade', 'club'),
      r('heart', 'diamond'),
      r('spade', 'club'),
    ];
    const snap = wsAdvisorSnapshot(hist);
    expect(snap.result.kind).toBe('playing');
    expect(snap.my.maxStreak).toBeGreaterThanOrEqual(5);
    expect(wsAdvisorHopeless(snap, 'opp')).toBe(true);
    expect(snap.my.remaining.blackJoker).toBe(1);
    expect(snap.my.remaining.colorJoker).toBe(1);

    const pick = pickWinningStreakAdvisor(hist, 800);
    expect(pick.card).toBe('blackJoker');
    expect(pick.winRate).toBeGreaterThan(0.99);
    expect(wsIsWinResult(wsGetMatchup('colorJoker', 'heart'))).toBe(true);
  });

  it('끝난 자문 판은 나/상대 기보다', () => {
    const hist = [
      r('club', 'blackJoker'),
      r('diamond', 'spade'),
      r('club', 'heart'),
      r('diamond', 'spade'),
      r('heart', 'diamond'),
      r('spade', 'club'),
      r('heart', 'diamond'),
      r('spade', 'club'),
      r('blackJoker', 'heart'),
      r('colorJoker', 'colorJoker'),
    ];
    const snap = wsAdvisorSnapshot(hist);
    expect(snap.result.kind).not.toBe('playing');
    const kifu = buildWsAdvisorKifu({
      history: hist,
      myNickname: '나',
      result: snap.result,
      winType: snap.winType,
    });
    expect(kifu.actions[0]?.players.me?.card).toBe('club');
    expect(kifu.actions[0]?.players.me?.byAi).toBe(true);
    expect(kifu.players.me?.nickname).toBe('나');
  });
});
