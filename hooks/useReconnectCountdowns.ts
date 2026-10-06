import { useEffect, useState } from 'react';

interface ReconnectingPlayer {
  playerId: string;
  secondsLeft: number;
}
function mergeCountdowns(players: ReconnectingPlayer[], previous: Record<string, number>) {
  return Object.fromEntries(
    players.map((player) => [player.playerId, previous[player.playerId] ?? player.secondsLeft]),
  );
}

/** 기존 접속자 카운트다운은 유지하고 새 접속자만 초기화한다. 구독 수명은 활성 목록에 묶는다. */
export function useReconnectCountdowns(players: ReconnectingPlayer[]) {
  const [state, setState] = useState(() => ({ players, remaining: mergeCountdowns(players, {}) }));
  if (state.players !== players)
    setState({ players, remaining: mergeCountdowns(players, state.remaining) });
  const active = players.length > 0;
  useEffect(() => {
    if (!active) return;
    const timer = setInterval(() => {
      setState((previous) => ({
        ...previous,
        remaining: Object.fromEntries(
          Object.entries(previous.remaining).map(([id, seconds]) => [id, Math.max(0, seconds - 1)]),
        ),
      }));
    }, 1000);
    return () => clearInterval(timer);
  }, [active]);
  return state.remaining;
}
