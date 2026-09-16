import type { ReactNode } from 'react';
import {
  RTB_MAX_SEATS,
  actionFlags,
  type RtbAction,
  type RtbPlayer,
  type RtbState,
} from '@shared/guild-war';

export type ActionFlags = ReturnType<typeof actionFlags>;

export function seatedInTurnOrder(state: RtbState): Array<RtbPlayer | null> {
  const list = state.players.length > 0 ? state.players : state.roster;
  return Array.from({ length: RTB_MAX_SEATS }, (_, i) => list[i] ?? null);
}

export type PlayViewProps = {
  /** 내 참가자 id. 데브는 'me', 운영은 세션 토큰. */
  meId: string;
  state: RtbState;
  flags: ActionFlags;
  selected: string[];
  mySeatLabel: string;
  prompt: string;
  comboOk: boolean;
  remaining: number | null;
  flash: string | null;
  /** 대기(idle) 중 펠트 가운데에 넣을 것. 데브는 시작 버튼, 운영은 안내. */
  idleSlot?: ReactNode;
  dispatch: (actorId: string, action: RtbAction) => void;
  toggleCard: (id: string) => void;
};

export function settlePayouts(state: RtbState): {
  playerId: string;
  guildName: string;
  nickname: string;
  amount: number;
}[] {
  const settle = state.settle;
  if (!settle) return [];
  return settle.winners.map((w) => {
    const p =
      state.roster.find((x) => x.id === w.playerId) ??
      state.players.find((x) => x.id === w.playerId);
    const g = state.guilds[w.guildId];
    return {
      playerId: w.playerId,
      guildName: g?.name ?? p?.guildName ?? '',
      nickname: p?.nickname ?? w.playerId,
      amount: w.amount,
    };
  });
}

/** 모바일 시트에 넣을 내 행동. 남 턴·다이·정산은 판만. */
export function needsActionSheet(flags: ActionFlags, phase: RtbState['phase']): boolean {
  if (!flags.alive) return false;
  if (flags.comboOpen) return true;
  if (!flags.isCurrent) return false;
  return (
    phase === 'turn' ||
    phase === 'pick_source' ||
    phase === 'discard' ||
    phase === 'last_swap' ||
    phase === 'four_choice'
  );
}
