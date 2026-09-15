/**
 * 명추리 — 3×3 타일(A~I) 뒤에 숨은 숫자 5개·기호 4개를, 4칸 수식의 계산 결과로 추리하는 1:1 게임.
 * 계산·타일 규칙은 shared/logic/myeongchuri.ts, 진행은 server/src/socket/games/myeongchuri.
 */

export const MYEONGCHURI_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'] as const;
export type MyeongchuriLetter = (typeof MYEONGCHURI_LETTERS)[number];

/** 쓰이는 기호 7개. '/' 는 나눗셈의 몫. */
export const MYEONGCHURI_SYMBOLS = ['+', '×', '-', 'Max', 'Min', '^', '/'] as const;
export type MyeongchuriSymbol = (typeof MYEONGCHURI_SYMBOLS)[number];

/** 타일 뒤 숫자(1~9, 서로 다름) 개수 */
export const MYEONGCHURI_NUMBER_COUNT = 5;
/** 타일 뒤 기호(7개 중, 서로 다름) 개수 */
export const MYEONGCHURI_SYMBOL_COUNT = 4;
export const MYEONGCHURI_EXPRESSION_LENGTH = 4;
/** 한 사람이 한 라운드에 고르는 알파벳 수 */
export const MYEONGCHURI_LETTERS_PER_PICK = 2;
/** 명추리 실패 경고가 이만큼 쌓이면 상대가 이긴다 */
export const MYEONGCHURI_MAX_WARNINGS = 2;
/** 알파벳 고르기 기본 시간(방 시간 제한 기본값). 넘기면 남은 알파벳에서 무작위로 놓는다. */
export const MYEONGCHURI_DEFAULT_PICK_SECONDS = 180;
/** 생각 시간 기본값 — 결과가 나온 뒤 다음 라운드 전 */
export const MYEONGCHURI_DEFAULT_THINK_SECONDS = 120;
export const MYEONGCHURI_MIN_THINK_SECONDS = 10;
export const MYEONGCHURI_MAX_THINK_SECONDS = 600;
/** 명추리를 선언한 뒤 답을 내는 시간. 넘기면 오답. */
export const MYEONGCHURI_DECLARE_SECONDS = 60;
/** 명추리를 선언하면 흐르던 진행 시간(고르기·생각)에 더해 주는 시간 */
export const MYEONGCHURI_DECLARE_BONUS_SECONDS = 10;

export type MyeongchuriTile =
  | { kind: 'number'; value: number }
  | { kind: 'symbol'; value: MyeongchuriSymbol };

export type MyeongchuriPhase = 'pick-first' | 'pick-second' | 'thinking' | 'finished';

/** 결과 비공개 사유 — 숫자 3개 이상 / 기호 3개 이상이 붙음 */
export type MyeongchuriHiddenReason = 'numbers' | 'symbols';

export interface MyeongchuriRoundResult {
  round: number;
  firstPlayerId: string;
  secondPlayerId: string;
  /** 수식 4칸의 알파벳 — 앞 두 칸은 선, 뒤 두 칸은 후 */
  letters: MyeongchuriLetter[];
  /** 계산 결과(정수 문자열, 음수 가능). 비공개면 null */
  value: string | null;
  hidden: MyeongchuriHiddenReason | null;
  /** 시간이 다 돼 무작위로 놓인 쪽 */
  randomFirst: boolean;
  randomSecond: boolean;
}

export interface MyeongchuriDeclarationResult {
  round: number;
  playerId: string;
  success: boolean;
  /** 제출 시간 안에 답을 내지 않아 오답 처리 */
  timedOut: boolean;
}

export interface MyeongchuriGameOptions {
  thinkEnabled: boolean;
  thinkSeconds: number;
}

export interface MyeongchuriGameData {
  phase: MyeongchuriPhase;
  round: number;
  players: Record<string, { nickname: string }>;
  /** 이번 라운드 선 */
  firstPlayerId: string;
  /** 지금 알파벳을 골라야 하는 사람. 생각 시간·종료면 null */
  currentPlayerId: string | null;
  /** 이번 라운드에 놓인 알파벳(0~2개 — 선이 고른 뒤 후가 고르는 중) */
  picks: MyeongchuriLetter[];
  rounds: MyeongchuriRoundResult[];
  warnings: Record<string, number>;
  thinkEnabled: boolean;
  thinkSeconds: number;
  /** 생각 시간 건너뛰기를 누른 사람 */
  thinkSkips: string[];
  /** 상단 바 타이머 — 지금 흐르는 진행 시간(고르기·생각). null 이면 무제한 */
  turnSeconds: number | null;
  turnStartedAt: number | null;
  /** 진행 중인 명추리 — 선언한 사람과 답 제출 마감 */
  declaration: { playerId: string; deadline: number } | null;
  declarations: MyeongchuriDeclarationResult[];
  winnerId: string | null;
  finishReason: string | null;
  /** 게임이 끝나야 공개 */
  tiles: Record<MyeongchuriLetter, MyeongchuriTile> | null;
}

export type MyeongchuriAction =
  | { type: 'pick'; letters: MyeongchuriLetter[] }
  | { type: 'skip-think' }
  | { type: 'declare' }
  | { type: 'answer'; answer: Record<string, string> };

export interface MyeongchuriArchiveRecord {
  tiles: Record<MyeongchuriLetter, MyeongchuriTile>;
  rounds: MyeongchuriRoundResult[];
  declarations: MyeongchuriDeclarationResult[];
  warnings: Record<string, number>;
  players: Record<string, { nickname: string }>;
  /** 1라운드 선 */
  firstPlayerId: string;
  winnerId: string | null;
  finishReason: string;
  thinkEnabled: boolean;
  thinkSeconds: number;
}
