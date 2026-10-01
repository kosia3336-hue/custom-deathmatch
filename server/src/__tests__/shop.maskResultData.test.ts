import { describe, expect, it, afterEach } from 'vitest';
import { maskGameResultDataForViewer } from '../shop/maskNicknames.js';
import { ensureRoomShopState, cleanupRoomShopState } from '../shop/roomShopState.js';

const ROOM = 'mask-probe';
const ME = 'me-token';
const FOE = 'foe-token';

afterEach(() => cleanupRoomShopState(ROOM));

function anonymize(token: string) {
  ensureRoomShopState(ROOM).anonymizedTokens.add(token);
}

describe('익명 물약 — 결과 데이터 마스킹', () => {
  /*
    연승게임의 결과 데이터는 actions[].players[token].nickname 에 실명을 담는다.
    최상위 players 만 가리면 이 깊은 자리가 그대로 나간다.
  */
  it('중첩된 곳의 실명도 가린다', () => {
    anonymize(FOE);
    const data = {
      players: {
        [ME]: { nickname: '나' },
        [FOE]: { nickname: '홍길동' },
      },
      actions: [
        {
          round: 1,
          players: {
            [ME]: { nickname: '나', card: 'spade' },
            [FOE]: { nickname: '홍길동', card: 'heart' },
          },
          matchDescription: '홍길동 님이 스페이드로 이겼습니다',
        },
      ],
      finishReason: '홍길동 님의 승리',
    };

    const masked = maskGameResultDataForViewer(ROOM, data, ME, ['홍길동']) as typeof data;

    // 최상위 — 예전부터 가려지던 자리
    expect(masked.players[FOE].nickname).toBe('???');
    expect(masked.finishReason).not.toContain('홍길동');

    // 중첩 — 여기가 새던 자리
    expect(masked.actions[0].players[FOE].nickname).toBe('???');
    expect(masked.actions[0].matchDescription).not.toContain('홍길동');

    // 본인 이름은 그대로 둔다
    expect(masked.players[ME].nickname).toBe('나');
  });

  it('가릴 사람이 없으면 원본을 그대로 돌려준다', () => {
    const data = { players: { [ME]: { nickname: '나' } } };
    expect(maskGameResultDataForViewer(ROOM, data, ME, [])).toBe(data);
  });
});
