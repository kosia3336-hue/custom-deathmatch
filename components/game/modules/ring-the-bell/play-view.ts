import type { ReactNode } from 'react';
import {
  actionFlags,
  displaySeats,
  isSetRunning,
  type RtbAction,
  type RtbPlayer,
  type RtbState,
} from '@shared/guild-war';

export type ActionFlags = ReturnType<typeof actionFlags>;

/** 교환·다이·벨 가운데 알림. 데브·운영 동일. */
export const ACTION_FLASH_MS = 3000;

export function seatedInTurnOrder(state: RtbState): Array<RtbPlayer | null> {
  return displaySeats(state);
}

export function waitingNextSet(state: RtbState, playerId: string): boolean {
  if (state.players.length === 0) return false;
  if (state.phase === 'idle') return false;
  return (
    state.roster.some((p) => p.id === playerId) && !state.players.some((p) => p.id === playerId)
  );
}

export function isPlayingThisSet(state: RtbState, playerId: string): boolean {
  return isSetRunning(state) && state.players.some((p) => p.id === playerId);
}

/** 세트 중 `관전 예약` → 예약되면 `예약 취소`. 세트 사이는 `관전하기`. */
export function spectateToggleLabel(reserved: boolean, playingThisSet: boolean): string {
  if (reserved) return '예약 취소';
  if (playingThisSet) return '관전 예약';
  return '관전하기';
}

export type PlayViewProps = {
  /** 내 참가자 id. 데브는 'me', 운영은 세션 토큰. */
  meId: string;
  state: RtbState;
  flags: ActionFlags;
  selected: string[];
  prompt: string;
  comboOk: boolean;
  remaining: number | null;
  flash: string | null;
  /** 대기(idle) 중 펠트 가운데에 넣을 것. 데브는 시작 버튼, 운영은 안내. */
  idleSlot?: ReactNode;
  dispatch: (actorId: string, action: RtbAction) => void;
  toggleCard: (id: string) => void;
  /** 빈칸 클릭. 관전 중일 때만 넘긴다. */
  onSitEmpty?: () => void;
  spectateReserved?: boolean;
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
