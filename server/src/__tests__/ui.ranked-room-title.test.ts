import { describe, expect, it } from 'vitest';
import { rankedLobbyMatchup, rankedRoomMatchup, rankTierLabel } from '../../../lib/rankedRoomTitle';

describe('랭크 방 제목', () => {
  const players = [
    { id: 'opp', nickname: '???', rankTier: 'unranked' as const },
    { id: 'me', nickname: '천하', rankTier: 'diamond' as const },
  ];

  it('방 안에서 플레이어는 본인을 앞에 두고 "닉[티어] VS 닉[티어]"', () => {
    expect(rankedRoomMatchup({ players }, 'me')).toBe('천하[다이아] VS ???[언랭]');
  });

  it('관전자는 자리 순서 그대로', () => {
    expect(rankedRoomMatchup({ players }, 'spectator')).toBe('???[언랭] VS 천하[다이아]');
  });

  it('로비는 이름을 모두 ??? 로, 가려진 티어도 ???', () => {
    expect(rankedLobbyMatchup({ rankTiers: ['diamond', 'unranked'] })).toBe('???[다이아] VS ???[언랭]');
    expect(rankedLobbyMatchup({ rankTiers: [null, 'gold'] })).toBe('???[???] VS ???[골드]');
    expect(rankedLobbyMatchup({ rankTiers: undefined })).toBe('???[???] VS ???[???]');
    expect(rankTierLabel('challenger')).toBe('챌린저');
  });
});
