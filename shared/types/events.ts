import type {
  Player,
  Room,
  RoomSummary,
  RoomType,
  PlayMode,
  DisplayedTitle,
  TurnOrderMode,
} from './room';
import type { RankTier } from './rank';
import type {
  BanPickStartPayload, BanPickUpdatePayload, BanPickLotteryPayload,
  BanPickUnbanTurnPayload, BanPickUnbanUpdatePayload,
} from './ban-pick';

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

export type ChatScope = 'lobby' | 'room' | 'game';

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
  'nickname:set': (
    data: { nickname: string },
    callback: (res: NicknameResult) => void,
  ) => void;

  'lobby:join': () => void;
  'lobby:leave': () => void;

  'room:create': (
    data: CreateRoomData,
    callback: (res: CreateRoomResult) => void,
  ) => void;
  'room:join': (
    data: JoinRoomData,
    callback: (res: JoinRoomResult) => void,
  ) => void;
  'room:quickjoin': (callback: (res: JoinRoomResult) => void) => void;
  'room:leave': () => void;
  'room:ready': () => void;
  'room:unready': () => void;
  'room:kick': (data: { targetId: string }) => void;
  'room:delegate': (data: { targetId: string }) => void;
  'room:start': () => void;
  'room:settings:update': (data: UpdateRoomSettings) => void;
  'room:swap:colors': () => void;
  'room:set:turn-order': (data: { mode: 'first' | 'second' | 'random' }) => void;
  'room:invite:create': (
    callback: (res: { success: boolean; token?: string }) => void,
  ) => void;

  'chat:send': (data: { message: string; scope: ChatScope }) => void;

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

  'spectate:join': (
    data: { roomId: string; password?: string },
    callback: (res: JoinRoomResult) => void,
  ) => void;
  'spectate:leave': () => void;
  'room:to:spectate': (
    callback: (res: { success: boolean; error?: string }) => void,
  ) => void;
  'spectate:to:player': (
    callback: (res: { success: boolean; error?: string }) => void,
  ) => void;

  /** 랭크 큐 진입 (회원 전용, 운영 시간·시즌 검증은 서버) */
  'rank:queue:join': (callback: (res: { success: boolean; error?: string }) => void) => void;
  'rank:queue:leave': () => void;
}

/** CDP 적립 — 랭크 게임 종료 시 본인에게만 emit */
export interface CdpGrantedPayload {
  rankMatchId: string;
  amount: number;
  newBalance: number;
  reason: 'rank_win' | 'rank_loss' | 'rank_draw' | 'rank_win_forfeit';
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
  kind: 'nickname_change' | 'rank_reset' | 'spectator_lock' | 'anonymity' | 'magnifier' | 'ban_eraser';
  countAfter: number;
  reason?: 'purchase' | 'auto_use' | 'manual_use' | 'admin_adjust';
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
  'lobby:users:online': (data: { users: OnlineUser[] }) => void;

  'room:state': (room: Room) => void;
  'room:player:joined': (player: Player) => void;
  'room:player:left': (data: {
    playerId: string;
    nickname: string;
    newHostId?: string;
  }) => void;
  'room:player:ready': (data: { playerId: string }) => void;
  'room:player:unready': (data: { playerId: string }) => void;
  'room:player:kicked': (data: { playerId: string }) => void;
  'room:host:changed': (data: { newHostId: string }) => void;
  'room:countdown': (data: { count: number }) => void;
  'room:game:started': () => void;
  'room:settings:updated': (room: Room) => void;
  'room:disbanded': (data: { reason: string }) => void;

  'chat:message': (msg: ChatMessage) => void;

  'game:state': (state: GameState) => void;
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

  'session:new': (data: { nickname: string }) => void;
  'session:exists': (data: { nickname: string; roomId?: string }) => void;
  'session:replaced': () => void;
  'session:restored': (data: { nickname: string; roomId?: string }) => void;
  'player:reconnecting': (data: { playerId: string; nickname: string; secondsLeft: number }) => void;
  'player:reconnected': (data: { playerId: string; nickname: string }) => void;

  /** 관리자가 칭호 부여 시 대상 유저에게 emit. 게임 중이면 게임 종료 후, 미접속이면 다음 접속 시 */
  'title:granted': (data: {
    titleId: string;
    name: string;
    color: string;
    description: string | null;
  }) => void;

  /** 운영자가 공지를 발행할 때 접속 중인 모든 사용자에게 broadcast */
  'notice:published': (data: {
    noticeId: string;
    title: string;
    category: string;
  }) => void;

  /** 랭크 매칭 성사 → VS 오버레이 후 방 입장 */
  'rank:queue:matched': (data: {
    roomId: string;
    opponentNickname: string;
    opponentDisplayedTitle: DisplayedTitle | null;
    /** 익명 물약 적용 시 null */
    opponentTier: RankTier | null;
    opponentRp: number | null;
    opponentIsPlacement: boolean | null;
    selfTier: RankTier;
    selfRp: number;
    selfIsPlacement: boolean;
  }) => void;
  /** 큐 상태 (재연결 시 등) */
  'rank:queue:status': (data: { inQueue: boolean; waitSeconds: number }) => void;
}
