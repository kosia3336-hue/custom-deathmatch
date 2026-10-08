import type { IPBettingAction, IPHand, IPPlayerInfo, IPWinType } from '@/shared/types/indian-poker';

/** 마지막으로 해당 플레이어가 한 베팅 액션 (없으면 undefined) */
export function getLastActionByPlayer(
  actions: IPBettingAction[],
  playerId: string,
): IPBettingAction | undefined {
  for (let i = actions.length - 1; i >= 0; i--) {
    if (actions[i].playerId === playerId) return actions[i];
  }
  return undefined;
}

export function formatBettingVerb(action: IPBettingAction | undefined): string {
  if (!action) return '—';
  switch (action.action) {
    case 'check':
      return '체크';
    case 'call':
      return '콜';
    case 'raise':
      return `레이즈 → ${action.amount ?? '?'}`;
    case 'die':
      return '폴드';
    default:
      return '—';
  }
}

export function formatSpectatorLastLine(
  actions: IPBettingAction[],
  players: Record<string, IPPlayerInfo>,
): string {
  const last = actions[actions.length - 1];
  if (!last) return '—';
  const nick = players[last.playerId]?.nickname ?? '?';
  return `${nick} · ${formatBettingVerb(last)}`;
}

export const HAND_LABELS: Record<IPHand, string> = {
  noPair: '노페어',
  double: '더블',
  straight: '스트레이트',
  triple: '트리플',
};

export const HAND_COLORS: Record<IPHand, string> = {
  noPair: '#6b7280',
  double: '#3b82f6',
  straight: '#f59e0b',
  triple: '#ef4444',
};

export const WIN_TYPE_LABELS: Record<IPWinType, string> = {
  chipOut: '상대 칩 소진',
  anteLack: '앤티 지불 불가',
  timeout: '시간 초과',
  leave: '상대 이탈',
};
