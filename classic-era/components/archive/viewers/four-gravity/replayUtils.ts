import type { CellType, Direction, Position } from '@/classic-era/shared/types/four-gravity';
import type { FourGravityTurnAction } from '@/classic-era/shared/types/archive';
import { applyGravity, findMovedPosition } from '@/classic-era/components/game/modules/four-gravity/boardUtils';

const BOARD_SIZE = 9;

function createEmptyBoard(): CellType[][] {
  return Array.from({ length: BOARD_SIZE }, () =>
    Array.from({ length: BOARD_SIZE }, () => 'empty' as CellType),
  );
}

export type StepType = 'start' | 'place' | 'gravity' | 'neutral';

export interface ReplayFrame {
  board: CellType[][];
  placedPosition: Position | null;
  gravityDirection: Direction | null;
  stepType: StepType;
  turnNumber: number;
  color: 'black' | 'white' | null;
  nickname: string | null;
}

export interface ComputeResult {
  frames: ReplayFrame[];
  /** 턴 번호(1부터) → 해당 턴의 첫 번째 프레임 인덱스 */
  turnFirstFrame: number[];
}

export function computeFrames(actions: FourGravityTurnAction[]): ComputeResult {
  const frames: ReplayFrame[] = [];
  const turnFirstFrame: number[] = [];
  let board = createEmptyBoard();

  // Frame 0: empty board (start)
  frames.push({
    board: board.map((r) => [...r]),
    placedPosition: null,
    gravityDirection: null,
    stepType: 'start',
    turnNumber: 0,
    color: null,
    nickname: null,
  });

  for (const action of actions) {
    let placePos: Position | null = null;
    let movedPos: Position | null = null;

    // 이 턴의 첫 프레임 인덱스 기록 (place 단계)
    turnFirstFrame.push(frames.length);

    for (const step of action.steps) {
      if (step.type === 'place') {
        board[step.row][step.col] = action.color;
        placePos = { row: step.row, col: step.col };
        movedPos = placePos;

        frames.push({
          board: board.map((r) => [...r]),
          placedPosition: placePos,
          gravityDirection: null,
          stepType: 'place',
          turnNumber: action.turnNumber,
          color: action.color,
          nickname: action.nickname,
        });
      } else if (step.type === 'gravity') {
        if (step.direction !== 'none' && placePos) {
          const boardBefore = board.map((r) => [...r]);
          board = applyGravity(board, step.direction);
          movedPos = findMovedPosition(placePos, step.direction, boardBefore, board);
        }

        frames.push({
          board: board.map((r) => [...r]),
          placedPosition: movedPos,
          gravityDirection: step.direction,
          stepType: 'gravity',
          turnNumber: action.turnNumber,
          color: action.color,
          nickname: action.nickname,
        });
      } else if (step.type === 'neutral') {
        board[step.row][step.col] = 'neutral';

        frames.push({
          board: board.map((r) => [...r]),
          placedPosition: { row: step.row, col: step.col },
          gravityDirection: null,
          stepType: 'neutral',
          turnNumber: action.turnNumber,
          color: action.color,
          nickname: action.nickname,
        });
      }
    }
  }

  return { frames, turnFirstFrame };
}
