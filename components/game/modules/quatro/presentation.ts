import { type QuatroGameData, type QuatroSuit } from '@/shared/types/quatro';
export const SUIT_INFO: Record<QuatroSuit, { symbol: string; cls: string; label: string }> = {
  spade: { symbol: '♠', cls: 'text-blue-600 border-blue-300 bg-blue-50', label: '스페이드' },
  diamond: { symbol: '♦', cls: 'text-yellow-600 border-yellow-300 bg-yellow-50', label: '다이아' },
  heart: { symbol: '♥', cls: 'text-red-600 border-red-300 bg-red-50', label: '하트' },
  club: { symbol: '♣', cls: 'text-green-600 border-green-300 bg-green-50', label: '클로버' },
  black: { symbol: '●', cls: 'text-white border-gray-700 bg-gray-900', label: '검정' },
};

/** 상단 바에 표시하는 단계별 행동 안내. */
export function quatroPlayGuide(gameData: QuatroGameData, myId: string): string {
  const phase = gameData.phase;
  const me = gameData.me;
  const isMyTurn = gameData.currentTurnId === myId;
  const actorSubject = me
    ? '상대가'
    : `${gameData.currentTurnId ? (gameData.players[gameData.currentTurnId]?.nickname ?? '???') : ''} 님이`;

  let statusText = '';
  if (phase === 'mulligan') {
    statusText = isMyTurn
      ? '멀리건을 사용하면 지금 카드 4장을 모두 버리고 새 카드 4장을 받습니다. 사용할지 선택해야 합니다.'
      : `${actorSubject} 멀리건을 쓸지 고르는 중입니다.`;
  } else if (phase === 'open') {
    statusText = !me
      ? `두 사람이 ${gameData.round}번째로 공개할 카드를 고르는 중입니다.`
      : !gameData.iOpened
        ? `${gameData.round}번째로 공개할 카드를 1장 골라야 합니다. 상대도 동시에 고릅니다.`
        : '상대가 공개할 카드를 고르는 중입니다.';
  } else if (phase === 'exchange') {
    statusText = !gameData.currentTurnId
      ? '교환이 끝났습니다.'
      : !isMyTurn
        ? `${actorSubject} 교환하는 중입니다.`
        : gameData.mustExchangeRemaining > 0
          ? `마지막 교환 라운드입니다. 이번 턴에 가상 플레이어 1명과 교환해야 합니다. 라운드가 끝나기 전까지 남은 ${gameData.mustExchangeRemaining}명과 모두 교환해야 해서 스탑할 수 없습니다.`
          : '이번 턴에 가상 플레이어 1명과 카드 1장을 교환하거나, 스탑해야 합니다.';
  } else if (phase === 'reveal' || phase === 'finished') {
    statusText = '최종 공개!';
  }

  return statusText;
}
