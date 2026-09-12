import { afterEach, describe, expect, it } from 'vitest';
import type { ChatMessage } from '@shared/types/events.js';
import type { Player } from '@shared/types/room.js';
import {
  applyViewerRoomMask,
  maskRankChatForViewer,
  maskRankRoomForViewer,
  nicknameForViewer,
  rankedRoomTitle,
} from '../rank/maskRankIdentity.js';
import { ANONYMOUS_NICKNAME } from '../shop/maskNicknames.js';
import { cleanupRoomShopState, ensureRoomShopState } from '../shop/roomShopState.js';
import { roomStore } from '../store/rooms.js';

const TITLE = { id: 't1', name: '고수', color: 'gold', effect: null };

function player(id: string, nick: string, memberId: string): Player {
  return {
    id,
    nickname: nick,
    isHost: id === 'p1',
    isReady: true,
    joinedAt: Date.now(),
    memberId,
    displayedTitle: TITLE,
  };
}

function createRankedRoom() {
  const room = roomStore.create({
    title: rankedRoomTitle('밴픽'),
    gameId: 'ban-pick',
    gameName: '밴픽',
    playMode: 'multi',
    roomType: 'rank',
    maxPlayers: 2,
    minPlayers: 2,
    host: player('p1', '알파', 'm1'),
    isRanked: true,
  });
  roomStore.addPlayer(room.id, player('p2', '베타', 'm2'));
  roomStore.addSpectator(room.id, player('spec', '구경꾼', 'm3'));
  return roomStore.get(room.id)!;
}

afterEach(() => {
  for (const r of roomStore.getAll()) {
    cleanupRoomShopState(r.id);
    roomStore.delete(r.id);
  }
});

describe('rankedRoomTitle', () => {
  it('종목명만 붙인다', () => {
    expect(rankedRoomTitle('밴픽')).toBe('[랭크] 밴픽');
    expect(rankedRoomTitle('넘버4')).toBe('[랭크] 넘버4');
  });
});

describe('nicknameForViewer', () => {
  it('랭크 플레이어 닉은 본인 외(상대·관전자·미상) 모두 ???, 관전자 닉은 실명', () => {
    const room = createRankedRoom();
    expect(nicknameForViewer(room.id, 'p2', '베타', 'p1')).toBe(ANONYMOUS_NICKNAME);
    expect(nicknameForViewer(room.id, 'p1', '알파', 'p1')).toBe('알파');
    expect(nicknameForViewer(room.id, 'p2', '베타', 'spec')).toBe(ANONYMOUS_NICKNAME);
    expect(nicknameForViewer(room.id, 'p2', '베타', null)).toBe(ANONYMOUS_NICKNAME);
    expect(nicknameForViewer(room.id, 'spec', '구경꾼', 'p1')).toBe('구경꾼');
  });

  it('비랭크는 실명', () => {
    const room = roomStore.create({
      title: '일반',
      gameId: 'four-gravity',
      gameName: '사목',
      playMode: 'multi',
      roomType: 'public',
      maxPlayers: 2,
      minPlayers: 2,
      host: player('p1', '알파', 'm1'),
    });
    roomStore.addPlayer(room.id, player('p2', '베타', 'm2'));
    expect(nicknameForViewer(room.id, 'p2', '베타', 'p1')).toBe('베타');
  });

  it('익명 물약이 있으면 관전자에게도 ???', () => {
    const room = createRankedRoom();
    ensureRoomShopState(room.id).anonymizedTokens.add('p2');
    expect(nicknameForViewer(room.id, 'p2', '베타', 'spec')).toBe(ANONYMOUS_NICKNAME);
    expect(nicknameForViewer(room.id, 'p2', '베타', 'p2')).toBe('베타');
  });
});

describe('maskRankRoomForViewer', () => {
  it('플레이어 viewer 에게 상대 닉만 가리고 칭호는 남긴다', () => {
    const room = createRankedRoom();
    const masked = maskRankRoomForViewer(room, 'p1');
    const opp = masked.players.find((p) => p.id === 'p2')!;
    expect(opp.nickname).toBe(ANONYMOUS_NICKNAME);
    expect(opp.displayedTitle).toEqual(TITLE);
    expect(opp.memberId).toBe('m2');
    expect(masked.spectators[0]?.nickname).toBe('구경꾼');
  });

  it('관전자 viewer 에게도 플레이어 닉을 가리고, 관전자 목록은 실명', () => {
    const room = createRankedRoom();
    const masked = maskRankRoomForViewer(room, 'spec');
    expect(masked.players.map((p) => p.nickname)).toEqual([ANONYMOUS_NICKNAME, ANONYMOUS_NICKNAME]);
    expect(masked.players.find((p) => p.id === 'p2')?.displayedTitle).toEqual(TITLE);
    expect(masked.spectators[0]?.nickname).toBe('구경꾼');
  });
});

describe('applyViewerRoomMask', () => {
  it('물약이 있으면 칭호도 가린다', () => {
    const room = createRankedRoom();
    const state = ensureRoomShopState(room.id);
    state.anonymizedTokens.add('p2');
    const masked = applyViewerRoomMask(room, 'p1');
    const opp = masked.players.find((p) => p.id === 'p2')!;
    expect(opp.nickname).toBe(ANONYMOUS_NICKNAME);
    expect(opp.displayedTitle).toBeNull();
    expect(opp.memberId).toBeNull();
  });
});

describe('maskRankChatForViewer', () => {
  function msg(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
      id: 'c1',
      sender: 'sock-p2',
      senderNickname: '베타',
      message: 'hi',
      scope: 'room',
      isSystem: false,
      timestamp: 1,
      senderTitle: TITLE,
      senderGuildName: '길드A',
      senderMemberId: 'm2',
      isSpectator: false,
      ...overrides,
    };
  }

  it('상대 플레이어에게 닉만 ???, 칭호·memberId 유지', () => {
    const room = createRankedRoom();
    const out = maskRankChatForViewer(room, msg(), 'p1');
    expect(out.senderNickname).toBe(ANONYMOUS_NICKNAME);
    expect(out.senderTitle).toEqual(TITLE);
    expect(out.senderGuildName).toBe('길드A');
    expect(out.senderMemberId).toBe('m2');
  });

  it('관전자에게도 플레이어 발신 닉은 ???', () => {
    const room = createRankedRoom();
    expect(maskRankChatForViewer(room, msg(), 'spec').senderNickname).toBe(ANONYMOUS_NICKNAME);
  });

  it('본인·관전 채팅은 실명', () => {
    const room = createRankedRoom();
    expect(maskRankChatForViewer(room, msg({ senderMemberId: 'm1', senderNickname: '알파' }), 'p1').senderNickname).toBe('알파');
    expect(
      maskRankChatForViewer(room, msg({ isSpectator: true, senderNickname: '구경꾼', senderMemberId: 'm3' }), 'p1')
        .senderNickname,
    ).toBe('구경꾼');
  });
});
