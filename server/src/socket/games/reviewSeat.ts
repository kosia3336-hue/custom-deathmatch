import type { Player } from '@shared/types/room.js';

/** 복기 솔로 — 한 사람이 선·후 두 자리를 둔다. 후 자리 id 는 소켓 토큰이 아니다. */
export function soloReviewSeats(human: Player): [Player, Player] {
  return [
    { ...human, nickname: `${human.nickname} (선)` },
    {
      id: `${human.id}#review`,
      nickname: `${human.nickname} (후)`,
      isHost: false,
      isReady: true,
      joinedAt: human.joinedAt,
      memberId: null,
      displayedTitle: null,
    },
  ];
}
