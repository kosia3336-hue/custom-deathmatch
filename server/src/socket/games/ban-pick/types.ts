import type { IO } from '../../types.js';
import type {
  BanTurn,
  BannedGame,
  BanPickStartPayload,
  BanPickUpdatePayload,
  BanPickLotteryPayload,
  BanPickUnbanTurnPayload,
  BanPickUnbanUpdatePayload,
  GameWinRate,
} from '@shared/types/ban-pick.js';
import type { Game } from '@shared/types/game.js';

export type { IO, Game };
export type {
  BanTurn, BannedGame,
  BanPickStartPayload, BanPickUpdatePayload, BanPickLotteryPayload,
  BanPickUnbanTurnPayload, BanPickUnbanUpdatePayload,
  GameWinRate,
};

export interface BanPickState {
  banCount: number;
  timeLimit: number;

  availableGames: Game[];

  phase: 'banning' | 'lottery' | 'unban' | 'done';
  sequence: BanTurn[];
  currentSequenceIdx: number;
  bansRemainingInTurn: number;
  bannedGames: BannedGame[];

  playerIds: [string, string];
  /** 돋보기·밴 삭제 DB 조회용 memberId. COM은 null */
  playerMemberIds: [string | null, string | null];
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

  /** 돋보기 사용자별 상대 전적 캐시. key = viewer token */
  magnifierStatsMap: Map<string, GameWinRate[]>;

  /** 밴 삭제 phase 상태 */
  unbanQueue: Array<'first' | 'second'>;
  unbanQueueIdx: number;
  unbanTimerHandle: NodeJS.Timeout | null;
  unbanTurnDeadline: number | null;
}
