import type { IO } from '../../types.js';
import type {
  BanTurn,
  BannedGame,
  BanPickStartPayload,
  BanPickUpdatePayload,
  BanPickLotteryPayload,
} from '@shared/types/ban-pick.js';
import type { Game } from '@shared/types/game.js';

export type { IO, Game };
export type { BanTurn, BannedGame, BanPickStartPayload, BanPickUpdatePayload, BanPickLotteryPayload };

export interface BanPickState {
  banCount: number;
  timeLimit: number;

  availableGames: Game[];

  phase: 'banning' | 'lottery' | 'done';
  sequence: BanTurn[];
  currentSequenceIdx: number;
  bansRemainingInTurn: number;
  bannedGames: BannedGame[];

  playerIds: [string, string];
  playMode: 'multi' | 'com';
  comIdx: number | null;

  timerHandle: NodeJS.Timeout | null;
  turnDeadline: number | null;
  comTimerHandle: NodeJS.Timeout | null;

  readyPlayers: Set<string>;

  pickedGameId: string | null;

  onGamePicked: (gameId: string, gameName: string) => void;
  onBanPickComplete?: (data: {
    bannedGames: BannedGame[];
    pickedGameId: string;
    playerIds: [string, string];
  }) => void;
}
