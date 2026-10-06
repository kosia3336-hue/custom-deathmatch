import type { NumberFourGameData } from '@/shared/types/number4';

export function numberFourStatus(data: NumberFourGameData, myId: string, spectator: boolean) {
  if (data.tutorial) return '튜토리얼';
  if (data.phase === 'finished') return '종료';
  if (data.phase === 'reveal') return '제출 공개';
  if (data.currentSide)
    return `${data.currentSide === 'player1' ? '1P' : '2P'} 차례 · 타일 넘버 선택`;
  if (spectator) return '(공동 차례) 제출 대기';
  return data.players[myId]?.submitted
    ? '(공동 차례) 상대 제출 대기'
    : '(공동 차례) 타일 넘버 선택';
}

/** 모드별 소유자/조작자 선택과 표시 조건. React·소켓에 의존하지 않는다. */
export function buildNumberFourViewModel(
  data: NumberFourGameData,
  myId: string,
  spectator: boolean,
) {
  const entries = Object.entries(data.players);
  const player = data.players[data.currentSide === 'player2' ? `${myId}_p2` : myId];
  const tracked = spectator
    ? entries
    : entries.filter(([id]) => id !== myId && id !== `${myId}_p2`);
  const trackerEntries = tracked.length ? tracked : entries.filter(([id]) => id !== player?.id);
  return {
    player,
    trackerEntries,
    order: numberFourStatus(data, myId, spectator),
    canChoose:
      data.phase === 'submit' &&
      !spectator &&
      !!player &&
      !player.submitted &&
      (!data.tutorial || data.tutorial.step === 'choose'),
    waiting: data.phase === 'submit' && (spectator || !!player?.submitted),
    revealing: (data.phase === 'reveal' || data.phase === 'finished') && !!data.revealData,
  };
}
