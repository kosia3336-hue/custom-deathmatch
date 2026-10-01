import type { Game } from './game';
import type { GameWinRate } from './ban-pick';

export type { Game, GameWinRate };

export type CounterBanPhase =
  | 'picking'
  | 'reveal'
  | 'burning'
  | 'overlap'
  | 'last'
  | 'forfeit'
  | 'empty';

export interface CounterBanViewPayload {
  games: Game[];
  remainingIds: string[];
  goneIds: string[];
  burningIds: string[];
  round: number;
  phase: CounterBanPhase;
  deadline: number | null;
  myPick: string | null;
  oppPick: string | null;
  keepId: string | null;
  revealedPicks: Record<string, string> | null;
  players: [{ id: string; nickname: string }, { id: string; nickname: string }];
  opponentGameStats?: GameWinRate[];
}
