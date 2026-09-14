import { describe, expect, it } from 'vitest';
import {
  applyExchange,
  applyMulligan,
  beginExchangePhase,
  buildGameData,
  commitOpens,
  createState,
  endExchangePhase,
  startRounds,
} from '../socket/games/quatro/state.js';

function fresh() {
  const players = [
    { id: 'a', nickname: '선' },
    { id: 'b', nickname: '후' },
  ];
  return createState('room', players as never, 'multi', Date.now(), null, () => {});
}

function playToFirstExchange() {
  const s = fresh();
  applyMulligan(s, 0, true);
  applyMulligan(s, 1, false);
  startRounds(s);
  for (const p of s.players) p.openChoice = p.hand[0].id;
  commitOpens(s);
  beginExchangePhase(s);
  const giveId = s.players[0].hand.find((c) => !s.players[0].openIds.has(c.id))!.id;
  expect(applyExchange(s, 0, 0, giveId)).toBeNull();
  return { s, giveId };
}

describe('콰트로 메모 기록', () => {
  it('멀리건·오픈·교환이 순서대로 기록되고 선/후가 라운드마다 남는다', () => {
    const { s } = playToFirstExchange();
    const data = buildGameData(s, 'a');
    expect(data.log.map((e) => e.type)).toEqual(['mulligan', 'mulligan', 'open', 'open', 'exchange']);
    expect(data.firstByRound).toEqual({ 0: 'a', 1: 'a' });
  });

  it('교환으로 받은 카드는 받은 사람에게만 보이고 상대·관전자에게는 가린다', () => {
    const { s, giveId } = playToFirstExchange();
    const mine = buildGameData(s, 'a').log.find((e) => e.type === 'exchange');
    const opp = buildGameData(s, 'b').log.find((e) => e.type === 'exchange');
    const spectator = buildGameData(s, null).log.find((e) => e.type === 'exchange');
    expect(mine?.type === 'exchange' && mine.received).not.toBeNull();
    expect(opp?.type === 'exchange' && opp.received).toBeNull();
    expect(spectator?.type === 'exchange' && spectator.received).toBeNull();
    // 넘긴 카드는 공개 정보라 모두에게 보인다
    expect(opp?.type === 'exchange' && opp.gave.id).toBe(giveId);
    // 원본 로그(게임 기록 저장용)는 가리지 않는다
    expect(s.log.find((e) => e.type === 'exchange')).toMatchObject({ received: expect.any(Object) });
  });

  it('먼저 스탑한 사람이 다음 라운드 후공이 되면 기록의 선도 바뀐다', () => {
    const { s } = playToFirstExchange();
    s.firstStopperId = 'a';
    endExchangePhase(s);
    expect(buildGameData(s, 'b').firstByRound).toEqual({ 0: 'a', 1: 'a', 2: 'b' });
  });

  it('최종 공개 뒤에는 받은 카드도 모두에게 보인다', () => {
    const { s } = playToFirstExchange();
    s.phase = 'reveal';
    const opp = buildGameData(s, 'b').log.find((e) => e.type === 'exchange');
    expect(opp?.type === 'exchange' && opp.received).not.toBeNull();
  });
});
