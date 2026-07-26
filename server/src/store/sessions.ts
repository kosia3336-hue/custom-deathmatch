import type { DisplayedTitle, GuildMark } from '@shared/types/room.js';
import type { EquippedSkin } from '@shared/types/skin.js';

// ── 소켓 ↔ 닉네임 (임시, 현재 연결된 소켓 기준) ─────────────────────────────
const socketToNickname = new Map<string, string>();
const nicknameToSocket = new Map<string, string>();

// ── 소켓 ↔ 방 (임시, 라우팅용) ───────────────────────────────────────────────
const socketToRoom = new Map<string, string>();

// ── 토큰 기반 세션 (영구, Player.id = token) ──────────────────────────────────
// token → 현재 연결된 socket.id (없으면 오프라인 상태)
const tokenToSocketId = new Map<string, string>();
// socket.id → token (이벤트 핸들러에서 발신자 token 조회)
const socketToToken = new Map<string, string>();
// token → nickname (O(1) 역탐색용, 오프라인 상태에서도 닉네임 조회 가능)
const tokenToNickname = new Map<string, string>();

// ── v2 — 회원 정보 (token 기준) ────────────────────────────────────────────
// token → memberId (Supabase auth.users.id). 회원 가입 안 된 익명/v1 호환의 경우 null
const tokenToMemberId = new Map<string, string | null>();
// token → 표시 칭호 (없으면 null)
const tokenToDisplayedTitle = new Map<string, DisplayedTitle | null>();
const tokenToGuildMark = new Map<string, GuildMark | null>();
// token → 소속 길드 ID (없으면 null) — 길드 채팅 소켓방 라우팅용
const tokenToGuildId = new Map<string, string | null>();
// token → 착용 스킨 목록 (없으면 [])
const tokenToEquippedSkins = new Map<string, EquippedSkin[]>();

// ── 재연결 유예 타이머 ────────────────────────────────────────────────────────
const pendingDisconnectTimers = new Map<string, ReturnType<typeof setTimeout>>();

// ── 강퇴 기록 (닉네임 기준, 재접속 후에도 유지) ───────────────────────────────
const kickedFromRoom = new Map<string, Set<string>>();

// ── 칭호 획득 모달 pending (인게임 중 부여 → 게임 종료 후 emit) ──────────────
export interface PendingTitlePayload {
  titleId: string;
  name: string;
  color: string;
  description: string | null;
}
const pendingTitles = new Map<string, PendingTitlePayload[]>();

// ── memberId → token 역탐색 (관리자 알림 emit 시 대상 소켓 탐색용) ────────────
const memberIdToToken = new Map<string, string>();

export const sessions = {
  // ── 닉네임 ─────────────────────────────────────────────────────────────────

  /**
   * 닉네임 세팅. force=true 면 이미 점유 중인 닉네임이라도 빼앗는다 (회원 닉네임 동기화용).
   */
  setNickname(socketId: string, nickname: string, force = false): boolean {
    const occupant = nicknameToSocket.get(nickname);
    if (occupant && occupant !== socketId && !force) return false;
    const old = socketToNickname.get(socketId);
    if (old && old !== nickname) nicknameToSocket.delete(old);
    if (occupant && occupant !== socketId && force) {
      socketToNickname.delete(occupant);
    }
    socketToNickname.set(socketId, nickname);
    nicknameToSocket.set(nickname, socketId);
    // tokenToNickname 동기화
    const token = socketToToken.get(socketId);
    if (token) tokenToNickname.set(token, nickname);
    return true;
  },

  getNickname(socketId: string): string | undefined {
    return socketToNickname.get(socketId);
  },

  getSocketByNickname(nickname: string): string | undefined {
    return nicknameToSocket.get(nickname);
  },

  isNicknameTaken(nickname: string): boolean {
    return nicknameToSocket.has(nickname);
  },

  // ── 방 ─────────────────────────────────────────────────────────────────────

  setRoom(socketId: string, roomId: string) {
    socketToRoom.set(socketId, roomId);
  },

  getRoom(socketId: string): string | undefined {
    return socketToRoom.get(socketId);
  },

  clearRoom(socketId: string) {
    socketToRoom.delete(socketId);
  },

  // ── 강퇴 ───────────────────────────────────────────────────────────────────

  addKick(nickname: string, roomId: string) {
    if (!kickedFromRoom.has(nickname)) kickedFromRoom.set(nickname, new Set());
    kickedFromRoom.get(nickname)!.add(roomId);
  },

  isKicked(nickname: string, roomId: string): boolean {
    return kickedFromRoom.get(nickname)?.has(roomId) ?? false;
  },

  clearRoomFromAllKicks(roomId: string) {
    kickedFromRoom.forEach((rooms) => rooms.delete(roomId));
  },

  // ── 세션 정리 ──────────────────────────────────────────────────────────────

  /** 소켓 연결 종료 시 소켓 기반 데이터만 제거 (토큰 세션·닉네임은 유지) */
  removeSession(socketId: string) {
    const nickname = socketToNickname.get(socketId);
    if (nickname) nicknameToSocket.delete(nickname);
    socketToNickname.delete(socketId);
    socketToRoom.delete(socketId);
    // 토큰 → 소켓 매핑도 정리 (이 소켓이 현재 활성 소켓인 경우)
    const token = socketToToken.get(socketId);
    if (token && tokenToSocketId.get(token) === socketId) {
      tokenToSocketId.delete(token);
      // tokenToNickname은 재연결 후 닉네임 복원에 사용하므로 유지
    }
    socketToToken.delete(socketId);
  },

  // ── 토큰 기반 세션 관리 (Player.id = token) ───────────────────────────────

  /**
   * 소켓과 토큰을 연결한다.
   * - 기존 세션 있으면: 닉네임·방을 새 소켓으로 이전하고 'restored' 반환
   * - 없으면: 신규 토큰 등록 후 'new' 반환
   */
  linkToken(socketId: string, token: string): 'restored' | 'new' {
    const prevSocketId = tokenToSocketId.get(token);

    // 이미 다른 소켓이 이 토큰 사용 중이면 교체
    if (prevSocketId && prevSocketId !== socketId) {
      socketToToken.delete(prevSocketId);
    }

    socketToToken.set(socketId, token);
    tokenToSocketId.set(token, socketId);

    // 기존 닉네임이 있으면 새 소켓으로 이전
    const prevNickname = tokenToNickname.get(token);
    if (prevNickname) {
      // 기존 소켓의 닉네임 매핑 제거
      if (prevSocketId && prevSocketId !== socketId) {
        socketToNickname.delete(prevSocketId);
      }
      // 이 소켓에 이미 다른 닉네임이 있으면 nicknameToSocket에서 정리 (stale 방지)
      const currentNickname = socketToNickname.get(socketId);
      if (currentNickname && currentNickname !== prevNickname) {
        nicknameToSocket.delete(currentNickname);
      }
      socketToNickname.set(socketId, prevNickname);
      nicknameToSocket.set(prevNickname, socketId);
      tokenToNickname.set(token, prevNickname);

      // 방 매핑도 이전
      const prevRoom = socketToRoom.get(prevSocketId ?? '');
      if (prevRoom && prevSocketId && prevSocketId !== socketId) {
        socketToRoom.delete(prevSocketId);
        socketToRoom.set(socketId, prevRoom);
      }

      return 'restored';
    }

    return 'new';
  },

  /** 소켓의 토큰 반환 (이벤트 핸들러에서 Player.id 조회용) */
  getToken(socketId: string): string | undefined {
    return socketToToken.get(socketId);
  },

  /** 토큰의 현재 활성 socket.id 반환 (특정 플레이어에게 emit 할 때 사용) */
  getSocketByToken(token: string): string | undefined {
    return tokenToSocketId.get(token);
  },

  /** 토큰으로 닉네임 조회 (O(1)) */
  getNicknameByToken(token: string): string | undefined {
    return tokenToNickname.get(token);
  },

  /** 토큰의 활성 socket.id가 있는지 여부 (온라인 상태 확인) */
  isTokenOnline(token: string): boolean {
    return tokenToSocketId.has(token);
  },

  // ── v2 — 회원 정보 ─────────────────────────────────────────────────────

  /** 토큰에 회원 정보(id, displayedTitle, equippedSkins) 를 바인딩 */
  setMemberInfo(
    token: string,
    memberId: string | null,
    displayedTitle: DisplayedTitle | null,
    equippedSkins: EquippedSkin[] = [],
    guildMark: GuildMark | null = null,
    guildId: string | null = null,
  ) {
    tokenToMemberId.set(token, memberId);
    tokenToDisplayedTitle.set(token, displayedTitle);
    tokenToEquippedSkins.set(token, equippedSkins);
    tokenToGuildMark.set(token, guildMark);
    tokenToGuildId.set(token, guildId);
    if (memberId) memberIdToToken.set(memberId, token);
  },

  getMemberId(token: string): string | null {
    return tokenToMemberId.get(token) ?? null;
  },

  getDisplayedTitle(token: string): DisplayedTitle | null {
    return tokenToDisplayedTitle.get(token) ?? null;
  },

  getGuildMark(token: string): GuildMark | null {
    return tokenToGuildMark.get(token) ?? null;
  },

  getEquippedSkins(token: string): EquippedSkin[] {
    return tokenToEquippedSkins.get(token) ?? [];
  },

  getMemberIdBySocket(socketId: string): string | null {
    const t = socketToToken.get(socketId);
    return t ? tokenToMemberId.get(t) ?? null : null;
  },

  getDisplayedTitleBySocket(socketId: string): DisplayedTitle | null {
    const t = socketToToken.get(socketId);
    return t ? tokenToDisplayedTitle.get(t) ?? null : null;
  },

  getGuildMarkBySocket(socketId: string): GuildMark | null {
    const t = socketToToken.get(socketId);
    return t ? tokenToGuildMark.get(t) ?? null : null;
  },

  getGuildId(token: string): string | null {
    return tokenToGuildId.get(token) ?? null;
  },

  /** 길드 가입/탈퇴/추방 등으로 소속이 바뀔 때 캐시만 갱신(내부 알림 엔드포인트용) */
  setGuildId(token: string, guildId: string | null) {
    tokenToGuildId.set(token, guildId);
  },

  getGuildIdBySocket(socketId: string): string | null {
    const t = socketToToken.get(socketId);
    return t ? tokenToGuildId.get(t) ?? null : null;
  },

  getEquippedSkinsBySocket(socketId: string): EquippedSkin[] {
    const t = socketToToken.get(socketId);
    return t ? tokenToEquippedSkins.get(t) ?? [] : [];
  },

  // ── 재연결 유예 타이머 ────────────────────────────────────────────────────

  setPendingDisconnect(token: string, timer: ReturnType<typeof setTimeout>) {
    pendingDisconnectTimers.set(token, timer);
  },

  clearPendingDisconnect(token: string) {
    const timer = pendingDisconnectTimers.get(token);
    if (timer) {
      clearTimeout(timer);
      pendingDisconnectTimers.delete(token);
    }
  },

  hasPendingDisconnect(token: string): boolean {
    return pendingDisconnectTimers.has(token);
  },

  // ── 칭호 획득 pending (인게임 부여 → 종료 후 전달) ───────────────────────

  addPendingTitle(token: string, payload: PendingTitlePayload) {
    const list = pendingTitles.get(token) ?? [];
    list.push(payload);
    pendingTitles.set(token, list);
  },

  takePendingTitles(token: string): PendingTitlePayload[] {
    const list = pendingTitles.get(token) ?? [];
    pendingTitles.delete(token);
    return list;
  },

  hasPendingTitles(token: string): boolean {
    return (pendingTitles.get(token)?.length ?? 0) > 0;
  },

  // ── memberId 역탐색 ────────────────────────────────────────────────────────

  getTokenByMemberId(memberId: string): string | undefined {
    return memberIdToToken.get(memberId);
  },
};
