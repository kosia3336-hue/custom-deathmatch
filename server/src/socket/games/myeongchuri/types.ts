import type {
  MyeongchuriDeclarationResult,
  MyeongchuriLetter,
  MyeongchuriPhase,
  MyeongchuriRoundResult,
  MyeongchuriTile,
} from '@shared/types/myeongchuri.js';
import type { Player, PlayMode } from '@shared/types/room.js';
import type { IO } from '../../types.js';

export type MyeongchuriEndGameFn = (
  io: IO,
  roomId: string,
  data: {
    rankings?: { playerId: string; nickname: string; rank: number; score: number }[];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

export interface MyeongchuriState {
  roomId: string;
  playMode: PlayMode;
  players: [Player, Player];
  tiles: Record<MyeongchuriLetter, MyeongchuriTile>;
  phase: MyeongchuriPhase;
  round: number;
  /** 1라운드 선 — 기록용 */
  startingPlayerId: string;
  /** 이번 라운드 선. 라운드마다 바뀐다 */
  firstPlayerId: string;
  currentPlayerId: string | null;
  picks: MyeongchuriLetter[];
  /** 이번 라운드 선이 시간이 다 돼 무작위로 놓였는지 */
  randomFirst: boolean;
  rounds: MyeongchuriRoundResult[];
  warnings: Record<string, number>;
  /** 알파벳 고르기 시간(방 시간 제한). null 이면 무제한 */
  pickSeconds: number | null;
  thinkEnabled: boolean;
  thinkSeconds: number;
  thinkSkips: Set<string>;
  /** 지금 흐르는 진행 시간(고르기·생각). 명추리를 선언하면 phaseSeconds 에 10초를 더한다 */
  phaseStartedAt: number | null;
  phaseSeconds: number | null;
  phaseTimer: ReturnType<typeof setTimeout> | null;
  /** 진행 시간이 끝나면 할 일 — 10초를 더해 다시 걸 때 쓴다 */
  phaseExpire: (() => void) | null;
  declaration: { playerId: string; deadline: number } | null;
  declarationTimer: ReturnType<typeof setTimeout> | null;
  declarations: MyeongchuriDeclarationResult[];
  winnerId: string | null;
  finishReason: string | null;
  gameOver: boolean;
  startedAt: number;
  finishTimer: ReturnType<typeof setTimeout> | null;
  /** COM 이 잠시 뒤 행동하도록 걸어 두는 타이머 */
  aiTimer: ReturnType<typeof setTimeout> | null;
  /** COM 이 판을 하나로 굳힌 라운드. 여기서 두 라운드 뒤에 명추리를 외친다 */
  aiSolvedAtRound: number | null;
  endGameCallback: MyeongchuriEndGameFn;
}
