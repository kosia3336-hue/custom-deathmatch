import type {
  Player,
  Room,
  RoomSummary,
  RoomType,
  PlayMode,
  DisplayedTitle,
  GuildMark,
  TurnOrderMode,
} from './room';
import type { RankMatchedPayload, RankTier } from './rank';
import type {
  BanPickStartPayload,
  BanPickUpdatePayload,
  BanPickLotteryPayload,
  BanPickUnbanTurnPayload,
  BanPickUnbanUpdatePayload,
} from './ban-pick';
import type { NF4Number, Nf4AdvisorRound } from './number4';
import type {
  BRPSResult,
  BrpsAdvisorPending,
  BrpsAdvisorRound,
  BrpsAdvisorWinner,
} from './betting-rps';
import type {
  MBNWTile,
  MbnwAdvisorPending,
  MbnwAdvisorRound,
  MbnwAdvisorWinner,
} from './multiple-bnw';
import type { WSCardType, WsAdvisorRound } from './winning-streak';
import type { Bnw2AdvisorPending, Bnw2AdvisorRound } from './bnw2';
import type { SBNWTile, SbnwAdvisorPending, SbnwAdvisorRound } from './silper-bnw';
import type { FTAction, FtAdvisorPly } from './five-towers';
import type { GS2CardId, Gs2AdvisorRound } from './grape-sugar-2';
import type { SMS2ChipBet, SMS2PowderSubmission } from './sun-moon-star-2';
import type { Sms2AdvisorPending, Sms2AdvisorRound } from './sun-moon-star-2-advisor';
import type { BankBet } from './bank-game';
import type { BankAdvisorPending, BankAdvisorRound } from './bank-game-advisor';
import type { QuatroAction } from './quatro';
import type { QuatroAdvisorPly } from './quatro-advisor';

export interface CreateRoomData {
  gameId: string;
  title: string;
  playMode: PlayMode;
  roomType: RoomType;
  password?: string;
  maxPlayers: number;
  timeLimitSeconds?: number | null;
  /** 게임별 커스텀 옵션 (e.g. { initialChips: 25 }) */
  gameOptions?: Record<string, unknown>;
}

export interface JoinRoomData {
  roomId: string;
  password?: string;
  inviteToken?: string;
}

/** 대기실에서 방장이 보내는 설정 변경 페이로드 */
export interface UpdateRoomSettings {
  title?: string;
  gameId?: string;
  playMode?: PlayMode;
  maxPlayers?: number;
  roomType?: RoomType;
  /** 새로 설정할 비밀번호 (미전송 시 기존 값 유지) */
  password?: string;
  /** true면 비밀번호 제거 (공개 전환) */
  clearPassword?: boolean;
  timeLimitSeconds?: number | null;
  /** 게임별 커스텀 옵션 */
  gameOptions?: Record<string, unknown>;
}

export interface UpdateRoomSettingsResult {
  success: boolean;
  error?: string;
}

export type ChatScope = 'lobby' | 'room' | 'game' | 'guild';

export interface ChatMessage {
  id: string;
  sender: string;
  senderNickname: string;
  message: string;
  scope: ChatScope;
  isSystem: boolean;
  timestamp: number;
  /** v2 — 발신자의 표시 칭호 (보유자만) */
  senderTitle?: DisplayedTitle | null;
  /** 발신자의 길드 마크 (길드 가입 + 마크 등록자만) */
  senderGuildMark?: GuildMark | null;
  /** v2.2 — 발신자의 소속 길드명 (마크 등록 여부 무관, 길드 가입자만). 채팅에서
   *  "닉네임 [길드명]" 형태로 표시할 때 사용 — 마크 아이콘 대신 텍스트로 노출 */
  senderGuildName?: string | null;
  /** v2 — 발신자가 관전자면 true (👁️ 마크 표시용) */
  isSpectator?: boolean;
  /** v2 — 신고용 발신자 회원 ID (AI/익명은 null) */
  senderMemberId?: string | null;
}

export interface GameState {
  roomId: string;
  message: string;
  currentTurn: string | null;
  turnNumber: number;
  startedAt: number;
  turnStartedAt: number | null;
  gameData?: unknown;
  /** v3 — 이 게임 인스턴스에 적용된 스킨 ID (없으면 null/미정의). 게임 시작 시 1회 확정 */
  activeSkin?: string | null;
}

export interface GameResult {
  roomId: string;
  rankings: Array<{
    playerId: string;
    /** v2 — 신고용 회원 ID (AI/익명은 null) */
    memberId?: string | null;
    nickname: string;
    rank: number;
    score: number;
  }>;
  playTime: number;
  totalTurns: number;
  gameResultData?: unknown;
  /** 멀티에서 상대 이탈 등으로 즉시 종료된 판 (히든 전광석화 등 제외용) */
  endedByForfeit?: boolean;

  /** 랭크 멀티(밴픽 이후 실게임) 종료 시만 */
  isRanked?: boolean;
  rankOutcome?: GameRankOutcome;
}

/** 클라이언트가 memberId 로 자신의 행을 고름 */
export interface RankPlayerOutcome {
  memberId: string;
  nickname: string;
  rpDelta: number;
  tierBefore: RankTier;
  tierAfter: RankTier;
  rpBefore: number;
  rpAfter: number;
  promoted: boolean;
  demoted: boolean;
  /** 이번 판으로 배치전이 끝났을 때만 true */
  placementJustFinished?: boolean;
  /** 배치전 구간에서 치른 판이면 true (RP 변동 없음, 카운트만) */
  placementMatch?: boolean;
  /** 정식 랭크 판 RP 표시용 (동티어 ±20 기준 분해) */
  rpBreakdown?: {
    parityReference: number;
    tierVersusParity: number;
    streakVersusParity: number;
  };
}

export interface GameRankOutcome {
  players: RankPlayerOutcome[];
}

/** 서버→클라 `rank:game:ended` (매치 참가자별 개별 emit, 관전자 미수신) */
export interface RankGameEndedRpDetail {
  baseRp: number;
  tierDiffBonus: number;
  streakBonus: number;
  total: number;
}

export interface RankGameEndedPayload {
  roomId: string;
  myRpChange: number;
  detail: RankGameEndedRpDetail | null;
  tierBefore: RankTier;
  tierAfter: RankTier;
  rpBefore: number;
  rpAfter: number;
  promoted: boolean;
  demoted: boolean;
  placementJustFinished?: boolean;
  placementMatch?: boolean;
}

export interface GameUndoProposal {
  requestId: string;
  requesterId: string;
  requesterNickname: string;
}

export interface NicknameResult {
  success: boolean;
  nickname?: string;
  error?: string;
}

export interface CreateRoomResult {
  success: boolean;
  roomId?: string;
  error?: string;
}

export type JoinRoomErrorCode =
  | 'GAME_IN_PROGRESS'
  | 'ROOM_FULL'
  | 'KICKED'
  | 'WRONG_PASSWORD'
  | 'NOT_FOUND'
  | 'ALREADY_IN_ROOM'
  | 'NO_NICKNAME'
  | 'INVALID_INVITE';

export interface JoinRoomResult {
  success: boolean;
  room?: Room;
  /** Present on successful `room:quickjoin` */
  roomId?: string;
  error?: string;
  errorCode?: JoinRoomErrorCode;
  /** 방이 가득 찼거나 게임 진행 중일 때 비번방 여부 */
  isPrivate?: boolean;
}

export interface ClientToServerEvents {
  'nickname:set': (data: { nickname: string }, callback: (res: NicknameResult) => void) => void;

  'lobby:join': () => void;
  'lobby:leave': () => void;

  'room:create': (data: CreateRoomData, callback: (res: CreateRoomResult) => void) => void;
  'room:join': (data: JoinRoomData, callback: (res: JoinRoomResult) => void) => void;
  'room:quickjoin': (callback: (res: JoinRoomResult) => void) => void;
  'room:leave': () => void;
  'room:ready': () => void;
  'room:unready': () => void;
  'room:kick': (data: { targetId: string }) => void;
  'room:delegate': (data: { targetId: string }) => void;
  'room:start': () => void;
  'room:settings:update': (
    data: UpdateRoomSettings,
    callback?: (res: UpdateRoomSettingsResult) => void,
  ) => void;
  'room:swap:colors': () => void;
  'room:set:turn-order': (data: { mode: 'first' | 'second' | 'random' }) => void;
  'room:invite:create': (callback: (res: { success: boolean; token?: string }) => void) => void;

  'chat:send': (data: { message: string; scope: ChatScope }) => void;
  /** 길드 채팅 히스토리 요청 — 응답은 'guild:chat:history' (본인에게만) */
  'guild:chat:load': () => void;

  'game:action': (data: Record<string, unknown>) => void;
  'game:undo:request': () => void;
  'banpick:ban': (data: { gameId: string }) => void;
  'banpick:ready': () => void;
  'banpick:noban': () => void;
  'banpick:unban': (data: { gameId: string }) => void;
  'banpick:unban_skip': () => void;
  'game:undo:accept': (data: { requestId: string }) => void;
  'game:undo:decline': (data: { requestId: string }) => void;
  'game:four-gravity:toggle-ai': (data: { ai: boolean }) => void;
  'game:double-sided-chess:toggle-ai': (data: { ai: boolean }) => void;
  'game:sync': () => void;
  'game:leave': () => void;
  'game:resign': () => void;
  'game:rematch': () => void;
  'game:end': () => void;

  'session:restore': (data: { token: string; confirmed?: boolean }) => void;

  /** 스킨 착용/해제 후 서버 세션의 equippedSkins 를 즉시 갱신한다 */
  'skin:sync': (callback: (res: { ok: boolean }) => void) => void;

  'spectate:join': (
    data: { roomId: string; password?: string },
    callback: (res: JoinRoomResult) => void,
  ) => void;
  'spectate:leave': () => void;
  'room:to:spectate': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'spectate:to:player': (callback: (res: { success: boolean; error?: string }) => void) => void;

  /** 랭크 큐 진입 (회원 전용, 운영 시간·시즌 검증은 서버) */
  'rank:queue:join': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'rank:queue:leave': () => void;

  /** 로컬 `/dev` 전용. 프로덕션 서버는 핸들러를 등록하지 않는다. */
  'dev:rankDummy:start': (
    data: { tier: '상' | '중' | '하'; skipBanPick?: boolean; skipGameId?: string },
    callback: (res: { success: boolean; roomId?: string; error?: string }) => void,
  ) => void;

  /** `/super-ai` — 사중력 사목·양면장기 솔로 방. 넘버4·흑과백2 등은 자문 이벤트. */
  'superAi:start': (
    data: { gameId: string },
    callback: (res: { success: boolean; roomId?: string; error?: string }) => void,
  ) => void;

  /** 넘버4 자문. 히스토리를 보내고 백·흑·넘버를 받는다. 최대 90초. */
  'superAi:number4:recommend': (
    data: { history: Nf4AdvisorRound[] },
    callback: (res: {
      success: boolean;
      white?: number;
      black?: number;
      number?: NF4Number;
      worlds?: number;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 넘버4 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:number4:save': (
    data: { history: Nf4AdvisorRound[]; winner?: 'me' | 'opp' },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 베팅 가위바위보 자문. 역할·승부·베팅 중 한 수를 받는다. 최대 90초. */
  'superAi:bettingRps:recommend': (
    data: { iAmFirst: boolean; history: BrpsAdvisorRound[]; pending?: BrpsAdvisorPending },
    callback: (res: {
      success: boolean;
      kind?: 'role' | 'match' | 'bet';
      role?: 'match' | 'bet';
      result?: BRPSResult;
      prediction?: BRPSResult;
      chips?: number;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 베팅 가위바위보 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:bettingRps:save': (
    data: { iAmFirst: boolean; history: BrpsAdvisorRound[]; winner?: BrpsAdvisorWinner },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 배수 흑과 백 자문. 타일 또는 의심을 받는다. 최대 90초. */
  'superAi:multipleBnw:recommend': (
    data: { iAmFirst: boolean; history: MbnwAdvisorRound[]; pending?: MbnwAdvisorPending },
    callback: (res: {
      success: boolean;
      kind?: 'tile' | 'suspect';
      tile?: MBNWTile;
      suspect?: boolean;
      worlds?: number;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 배수 흑과 백 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:multipleBnw:save': (
    data: { iAmFirst: boolean; history: MbnwAdvisorRound[]; winner?: MbnwAdvisorWinner },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 연승 자문. 카드를 받는다. 최대 90초. */
  'superAi:winningStreak:recommend': (
    data: { history: WsAdvisorRound[] },
    callback: (res: {
      success: boolean;
      card?: WSCardType;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 연승 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:winningStreak:save': (
    data: { history: WsAdvisorRound[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 흑과백2 자문. 포인트. 후플은 색+단계만. 기보 상대 모형 + 90초 롤아웃. */
  'superAi:bnw2:recommend': (
    data: { iAmFirst: boolean; history: Bnw2AdvisorRound[]; pending?: Bnw2AdvisorPending },
    callback: (res: {
      success: boolean;
      points?: number;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 흑과백2 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:bnw2:save': (
    data: { iAmFirst: boolean; history: Bnw2AdvisorRound[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 실퍼의 흑과백 자문. 타일 배열을 받는다. 후플은 자릿수만. 최대 90초. */
  'superAi:silperBnw:recommend': (
    data: { iAmFirst: boolean; history: SbnwAdvisorRound[]; pending?: SbnwAdvisorPending },
    callback: (res: {
      success: boolean;
      tiles?: SBNWTile[];
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 실퍼의 흑과백 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:silperBnw:save': (
    data: { iAmFirst: boolean; history: SbnwAdvisorRound[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 5개의 탑 자문. 행동을 받는다. 진짜 높이는 안 넣는다. 최대 90초. */
  'superAi:fiveTowers:recommend': (
    data: { iAmFirst: boolean; history: FtAdvisorPly[] },
    callback: (res: {
      success: boolean;
      action?: FTAction;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 5개의 탑 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:fiveTowers:save': (
    data: { iAmFirst: boolean; history: FtAdvisorPly[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 포도설탕2 자문. 카드+설탕을 받는다. 이번 pending은 안 넣는다. 최대 90초. */
  'superAi:grapeSugar2:recommend': (
    data: { history: Gs2AdvisorRound[] },
    callback: (res: {
      success: boolean;
      card?: GS2CardId;
      sugar?: number;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 포도설탕2 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:grapeSugar2:save': (
    data: { history: Gs2AdvisorRound[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 해달별2 자문. 빛가루 또는 칩. 정확 빛가루·이번 분배는 안 넣는다. 최대 90초. */
  'superAi:sunMoonStar2:recommend': (
    data: { iAmFirst: boolean; history: Sms2AdvisorRound[]; pending?: Sms2AdvisorPending },
    callback: (res: {
      success: boolean;
      kind?: 'powder' | 'bet';
      powder?: SMS2PowderSubmission;
      bet?: SMS2ChipBet;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 해달별2 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:sunMoonStar2:save': (
    data: { iAmFirst: boolean; history: Sms2AdvisorRound[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 은행놀이 자문. 베팅. 상대 권종·승자 금액은 안 넣는다. 최대 90초. */
  'superAi:bankGame:recommend': (
    data: { iAmFirst: boolean; history: BankAdvisorRound[]; pending?: BankAdvisorPending },
    callback: (res: {
      success: boolean;
      bet?: BankBet;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 은행놀이 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:bankGame:save': (
    data: { iAmFirst: boolean; history: BankAdvisorRound[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 콰트로 자문. 멀리건·오픈·교환. 상대 미오픈·VP 숨은 패는 안 넣는다. 최대 90초. */
  'superAi:quatro:recommend': (
    data: { iAmFirst: boolean; history: QuatroAdvisorPly[] },
    callback: (res: {
      success: boolean;
      action?: QuatroAction;
      winRate?: number;
      error?: string;
    }) => void,
  ) => void;

  /** 콰트로 자문 종료 판을 슈퍼 AI 기보로 저장. */
  'superAi:quatro:save': (
    data: { iAmFirst: boolean; history: QuatroAdvisorPly[] },
    callback: (res: { success: boolean; id?: string; error?: string }) => void,
  ) => void;

  /** 인디언홀덤 (이벤트) — 입장. 칩 1개 이상 보유 시 좌석/관전, 칩 0 또는 게임 중이면 대기열. */
  'event:join': (
    callback: (res: { success: boolean; error?: string; errorCode?: string }) => void,
  ) => void;
  /** 인디언홀덤 (이벤트) — 퇴장 (자발적). */
  'event:leave': () => void;
  /** 인디언홀덤 (이벤트) — 메타 정보 조회 (로비에서 호출). */
  'event:meta:get': (
    callback: (res: import('./indian-poker-event').IPEMetaPayload) => void,
  ) => void;

  /** 해달별 (이벤트) — 입장 */
  'smsEvent:join': (
    callback: (res: { success: boolean; error?: string; errorCode?: string }) => void,
  ) => void;
  /** 해달별 (이벤트) — 퇴장 */
  'smsEvent:leave': () => void;
  /** 해달별 (이벤트) — 메타 조회 */
  'smsEvent:meta:get': (
    callback: (res: import('./sun-moon-star-event').SmsMetaPayload) => void,
  ) => void;
}

/** CDP 적립 — 랭크 게임 종료 시 본인에게만 emit */
export interface CdpGrantedPayload {
  rankMatchId: string;
  amount: number;
  newBalance: number;
  reason: 'rank_win' | 'rank_loss' | 'rank_draw' | 'rank_win_forfeit' | 'daily_rank_win';
  breakdown: {
    base: number;
    tierBonus: number;
    tierAtGrant: RankTier;
  };
}

/** CDP 잔액 변동 — 구매/어드민 조정 시 본인에게만 emit */
export interface CdpAdjustedPayload {
  newBalance: number;
  delta: number;
  reason: 'shop_purchase' | 'admin_adjust';
  ref?: { kind: string; id: string };
}

/** 상점 아이템 변경 (재고/활성) — 전체 broadcast */
export interface ShopItemChangedPayload {
  itemId: string;
  stock: number | null;
  isActive: boolean;
}

/** 인벤토리(소모성) 변동 — 본인 전용 emit */
export interface InventoryUpdatedPayload {
  kind:
    | 'nickname_change'
    | 'rank_reset'
    | 'spectator_lock'
    | 'anonymity'
    | 'magnifier'
    | 'ban_eraser'
    | 'gacha_box'
    | 'gacha_ticket'
    | 'guild_charter'
    | 'word_search';
  countAfter: number;
  reason?:
    | 'purchase'
    | 'sell'
    | 'auto_use'
    | 'manual_use'
    | 'admin_adjust'
    | 'daily_reward'
    | 'gacha_box_open';
  ref?: { kind: string; id: string };
}

/** 랭크 통계 초기화 — 본인 전용 emit (랭크 초기화권 사용 후) */
export interface RankStatsResetPayload {
  seasonId: number;
  ticketCountAfter: number;
}

export interface OnlineUser {
  memberId: string;
  nickname: string;
  status: 'playing' | 'waiting' | 'lobby';
}

export interface ServerToClientEvents {
  'lobby:rooms': (rooms: RoomSummary[]) => void;
  'lobby:room:created': (room: RoomSummary) => void;
  'lobby:room:updated': (room: RoomSummary) => void;
  'lobby:room:removed': (roomId: string) => void;
  'lobby:users:online': (data: { users: OnlineUser[]; count: number }) => void;

  'room:state': (room: Room) => void;
  'room:player:joined': (player: Player) => void;
  'room:player:left': (data: { playerId: string; nickname: string; newHostId?: string }) => void;
  'room:player:ready': (data: { playerId: string }) => void;
  'room:player:unready': (data: { playerId: string }) => void;
  'room:player:kicked': (data: { playerId: string }) => void;
  'room:host:changed': (data: { newHostId: string }) => void;
  'room:countdown': (data: { count: number }) => void;
  'room:game:started': () => void;
  'room:settings:updated': (room: Room) => void;
  'room:disbanded': (data: { reason: string }) => void;

  'chat:message': (msg: ChatMessage) => void;
  /** 길드 채팅 히스토리 응답 (본인 전용) — 'guild:chat:load' 요청에 대한 응답 */
  'guild:chat:history': (payload: { messages: ChatMessage[] }) => void;

  'game:state': (state: GameState) => void;
  /** 단어조합 '검색 찬스' 조회 결과 — 조회한 본인에게만 emit */
  'wordpuzzle:searchResult': (payload: { word: string; exists: boolean }) => void;
  'game:undo:proposal': (data: GameUndoProposal) => void;
  'banpick:start': (payload: BanPickStartPayload) => void;
  'banpick:update': (payload: BanPickUpdatePayload) => void;
  'banpick:lottery': (payload: BanPickLotteryPayload) => void;
  'banpick:unban_turn': (payload: BanPickUnbanTurnPayload) => void;
  'banpick:unban_update': (payload: BanPickUnbanUpdatePayload) => void;
  'game:undo:declined': () => void;
  'game:ended': (result: GameResult) => void;
  /** 랭크 멀티 종료 시 참가자에게만 (RP 분해·챌린저 여부 등 본인 전용) */
  'rank:game:ended': (payload: RankGameEndedPayload) => void;

  /** CDP 적립 — 본인 전용 emit */
  'cdp:granted': (payload: CdpGrantedPayload) => void;
  /** CDP 잔액 변동 (구매/어드민 조정) — 본인 전용 emit */
  'cdp:adjusted': (payload: CdpAdjustedPayload) => void;
  /** 상점 아이템 변경 (재고/활성) — 전체 broadcast */
  'shop:item_changed': (payload: ShopItemChangedPayload) => void;
  /** 소모성 인벤토리 변동 — 본인 전용 emit */
  'inventory:updated': (payload: InventoryUpdatedPayload) => void;
  /** 랭크 시즌 통계 초기화 알림 — 본인 전용 emit */
  'rank:stats:reset': (payload: RankStatsResetPayload) => void;

  'ext:data': (data: unknown) => void;
  error: (data: { message: string }) => void;
  kicked: (data: { reason: string }) => void;
  'connection:duplicate': () => void;

  /** token 이 실려 오면 서버가 세션 토큰을 재발급한 것 — 클라이언트는 저장된 토큰을 교체해야 한다. */
  'session:new': (data: { nickname: string; token?: string }) => void;
  'session:exists': (data: { nickname: string; roomId?: string }) => void;
  'session:replaced': () => void;
  'session:restored': (data: { nickname: string; roomId?: string }) => void;
  'player:reconnecting': (data: {
    playerId: string;
    nickname: string;
    secondsLeft: number;
  }) => void;
  'player:reconnected': (data: { playerId: string; nickname: string }) => void;

  /** 길드 스카우트 초대 — 대상 본인 */
  'guild:scout-invite': (data: {
    inviteId: string;
    guildId: string;
    guildName: string;
    fromNickname: string;
    targetHadGuild: boolean;
    targetGuildName: string | null;
  }) => void;

  /** 관리자가 칭호 부여 시 대상 유저에게 emit. 게임 중이면 게임 종료 후, 미접속이면 다음 접속 시 */
  'title:granted': (data: {
    titleId: string;
    name: string;
    color: string;
    description: string | null;
  }) => void;

  /** 운영자가 공지를 발행할 때 접속 중인 모든 사용자에게 broadcast */
  'notice:published': (data: { noticeId: string; title: string; category: string }) => void;

  /** 랭크 매칭 성사 → VS 오버레이 후 방 입장 */
  'rank:queue:matched': (data: RankMatchedPayload) => void;
  /** 큐 상태 (재연결 시 등) */
  'rank:queue:status': (data: { inQueue: boolean; waitSeconds: number }) => void;

  /** 인디언홀덤 (이벤트) 상태 — 본인 전용. role/좌석/게임데이터 포함. */
  'event:state': (payload: import('./indian-poker-event').IPEStatePayload) => void;
  /** 메타 변동 — 로비 등 connected 전체 broadcast. */
  'event:meta:changed': (payload: import('./indian-poker-event').IPEMetaPayload) => void;
  /** 칩 잔액 변동 — 본인 전용 emit. */
  'event:chip:changed': (payload: import('./indian-poker-event').IPEChipChangedPayload) => void;
  /** 대기열 → 좌석으로 승격됨. */
  'event:promoted': (payload: import('./indian-poker-event').IPEPromotedPayload) => void;
  /** 강퇴 (칩 0 등). */
  'event:kicked': (payload: import('./indian-poker-event').IPEKickedPayload) => void;
  /** 핸드 종료 결과 (참여자/관전자 모두 수신). */
  'event:hand:result': (payload: import('./indian-poker-event').IPEHandResultPayload) => void;

  /** 해달별 (이벤트) 상태 */
  'smsEvent:state': (payload: import('./sun-moon-star-event').SmsStatePayload) => void;
  'smsEvent:meta:changed': (payload: import('./sun-moon-star-event').SmsMetaPayload) => void;
  'smsEvent:promoted': (payload: import('./sun-moon-star-event').SmsPromotedPayload) => void;
  'smsEvent:kicked': (payload: import('./sun-moon-star-event').SmsKickedPayload) => void;
  'smsEvent:round:result': (payload: {
    result: import('./sun-moon-star-event').SmsRoundResultPayload;
  }) => void;
}
