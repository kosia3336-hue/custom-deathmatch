/**
 * 인디언홀덤 (이벤트) — 단일 영구 룸 매니저.
 *
 * 책임:
 * 1. 좌석 5개 + 관전자 + 대기열(FIFO) 관리
 * 2. 게임 엔진(state.ts) 의 라이프사이클 관리 (핸드 시작/종료, 자동 다음 핸드)
 * 3. 운영 시간 폴링 (분 단위) — 평일 01:00~21:00 KST / 주말 24h
 * 4. 핸드 종료 시 DB 정산 (settle_event_hand) + 칩 잔액 동기화 + 강퇴 처리
 * 5. 모든 클라이언트 상태 브로드캐스트 (event:state, event:meta:changed)
 *
 * 일반 roomStore 와 완전히 분리되어 있다.
 */

import type { IO, TypedSocket } from './types.js';
import type {
  IPEActionPayload,
  IPEMetaPayload,
  IPEParticipantRole,
  IPEStatePayload,
} from '@shared/types/indian-poker-event.js';
import { IPE_MAX_SEATS, IPE_TURN_TIME_LIMIT_SECONDS } from '@shared/types/indian-poker-event.js';
import { GAME_IDS } from '@shared/types/game.js';
import { isEventRoomOpen } from '@shared/event/kst.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { getEventChipSummary, settleEventHand } from '../db/eventChips.js';
import { socketRoom, maskedClientRoomForSocket } from './utils.js';
import type { Player } from '@shared/types/room.js';
import {
  createInitialState,
  addSeat,
  removeSeat,
  findEmptySeatIdx,
  findSeatIdxByPlayer,
  activeSeatIndices,
  startNewHand,
  handleAction as engineHandleAction,
  handleTimeout as engineHandleTimeout,
  buildGameDataFor,
  HAND_RESULT_DISPLAY_MS,
} from './games/indian-poker-event/state.js';
import type { InternalState, InternalSeat } from './games/indian-poker-event/state.js';

/* ────────────── participant maps ────────────── */

interface Spectator {
  playerId: string;
  memberId: string;
  nickname: string;
  /** 대기열에 들어가 있으면 true. 단순 관전(칩 0)이면 false. */
  inQueue: boolean;
}

/**
 * 단일 영구 이벤트 룸의 고정 roomStore ID.
 * URL 라우팅(`/room/{id}/play`)에 그대로 쓰이므로 URL-safe(영문/숫자/하이픈)여야 한다.
 */
const EVENT_ROOM_KEY = 'evt-indpkr';
/** 실제 socket.io 브로드캐스트 채널 이름 (일반 방과 동일한 `room:` prefix). */
const EVENT_SOCKET_CHANNEL = socketRoom(EVENT_ROOM_KEY);

class EventRoomManager {
  private state: InternalState = createInitialState();
  /** playerId → spectator (좌석에 없는 모든 입장자) */
  private spectators = new Map<string, Spectator>();
  /** FIFO 대기열 (playerId 순서) */
  private queue: string[] = [];
  private turnTimer: ReturnType<typeof setTimeout> | null = null;
  private nextHandTimer: ReturnType<typeof setTimeout> | null = null;
  private operatingHoursTimer: ReturnType<typeof setInterval> | null = null;
  private io: IO | null = null;
  private initialized = false;

  /** 서버 부팅 시 1회 호출. */
  init(io: IO): void {
    if (this.initialized) return;
    this.io = io;
    this.initialized = true;

    // roomStore 에 시스템 룸 1개 등록 (영구). 클라이언트는 이 ID 로 /room/{id}/play 진입.
    roomStore.createSystemRoom({
      id: EVENT_ROOM_KEY,
      title: '인디언 홀덤 (이벤트)',
      gameId: GAME_IDS.INDIAN_POKER_EVENT,
      gameName: '인디언 홀덤 (이벤트)',
      maxPlayers: IPE_MAX_SEATS,
      spectatorAllowed: true,
    });

    this.refreshOperatingHours();
    // 1분마다 운영 시간 폴링
    this.operatingHoursTimer = setInterval(() => {
      this.refreshOperatingHours();
    }, 60 * 1000);
    console.log('[eventRoom] initialized');
  }

  /* ────────────── roomStore 동기화 헬퍼 ────────────── */

  private makePlayerEntry(token: string, memberId: string, nickname: string): Player {
    return {
      id: token,
      nickname,
      isHost: false,
      isReady: true,
      joinedAt: Date.now(),
      memberId,
      displayedTitle: sessions.getDisplayedTitle(token),
    };
  }

  private syncRoomAddPlayer(token: string, memberId: string, nickname: string): void {
    roomStore.systemRoomAddPlayer(EVENT_ROOM_KEY, this.makePlayerEntry(token, memberId, nickname));
    roomStore.systemRoomRemoveSpectator(EVENT_ROOM_KEY, token);
  }

  private syncRoomRemovePlayer(token: string): void {
    roomStore.systemRoomRemovePlayer(EVENT_ROOM_KEY, token);
  }

  private syncRoomAddSpectator(token: string, memberId: string, nickname: string): void {
    roomStore.systemRoomAddSpectator(
      EVENT_ROOM_KEY,
      this.makePlayerEntry(token, memberId, nickname),
    );
  }

  private syncRoomRemoveSpectator(token: string): void {
    roomStore.systemRoomRemoveSpectator(EVENT_ROOM_KEY, token);
  }

  /** room:state 를 채널 전원에게 시점별로 마스킹해 전송. (이벤트 룸은 마스킹 없음이지만 유틸 재사용) */
  private async broadcastRoomState(): Promise<void> {
    if (!this.io) return;
    const sockets = await this.io.in(EVENT_SOCKET_CHANNEL).fetchSockets();
    for (const sock of sockets) {
      const clientRoom = maskedClientRoomForSocket(EVENT_ROOM_KEY, sock as unknown as TypedSocket);
      if (clientRoom) sock.emit('room:state', clientRoom);
    }
  }

  /** 운영 시간 체크 → status 전이 + 필요 시 다음 핸드 시작 */
  private refreshOperatingHours(): void {
    const open = isEventRoomOpen();
    if (!open) {
      if (this.state.phase !== 'closed') {
        // 진행 중 핸드는 그대로 둠 (현재 핸드 완료 후 다음 핸드 미시작)
        if (this.state.phase === 'waiting') {
          this.state.phase = 'closed';
          this.state.closedReason = 'operating-hours';
          this.broadcastAll();
        } else {
          // betting/dealing 중에는 메모만 남기고 closed 전환은 핸드 종료 시
          this.state.closedReason = 'operating-hours';
        }
      }
      return;
    }

    // open
    if (this.state.phase === 'closed') {
      this.state.phase = 'waiting';
      this.state.closedReason = null;
      this.broadcastAll();
      this.maybeStartNextHand();
    } else if (this.state.closedReason !== null) {
      // 운영 시간 재개됨
      this.state.closedReason = null;
      this.broadcastAll();
    }
  }

  /* ────────────── socket → participant ────────────── */

  /** 입장 요청 처리. 반환: 결과 상태. */
  async join(socket: TypedSocket): Promise<{
    success: boolean;
    error?: string;
    errorCode?: string;
  }> {
    const member = (socket.data as { member?: { id: string; nickname: string } | null }).member;
    if (!member?.id) {
      return { success: false, error: '회원 로그인이 필요합니다.', errorCode: 'NOT_LOGGED_IN' };
    }
    if (!isEventRoomOpen()) {
      return {
        success: false,
        error: '이벤트 게임 운영 시간이 아닙니다. (평일 01:00~21:00 / 주말 24시간)',
        errorCode: 'EVENT_CLOSED',
      };
    }
    const token = sessions.getToken(socket.id);
    if (!token) {
      return { success: false, error: '세션 토큰을 확인할 수 없습니다.', errorCode: 'NO_TOKEN' };
    }
    const nickname = sessions.getNickname(socket.id) ?? member.nickname;

    // 이미 들어와 있으면 재동기화만
    const existingSeat = findSeatIdxByPlayer(this.state, token);
    if (existingSeat >= 0) {
      socket.join(EVENT_SOCKET_CHANNEL);
      sessions.setRoom(socket.id, EVENT_ROOM_KEY);
      // 일반 게임룸 인프라(useRoom)에 맞춰 room:state 도 전송
      const clientRoom = maskedClientRoomForSocket(EVENT_ROOM_KEY, socket);
      if (clientRoom) socket.emit('room:state', clientRoom);
      await this.emitStateToSocket(socket, token);
      return { success: true };
    }
    if (this.spectators.has(token)) {
      socket.join(EVENT_SOCKET_CHANNEL);
      sessions.setRoom(socket.id, EVENT_ROOM_KEY);
      const clientRoom = maskedClientRoomForSocket(EVENT_ROOM_KEY, socket);
      if (clientRoom) socket.emit('room:state', clientRoom);
      await this.emitStateToSocket(socket, token);
      return { success: true };
    }

    // 칩 잔액 조회
    const summary = await getEventChipSummary(member.id);
    const chips = summary.balance;

    socket.join(EVENT_SOCKET_CHANNEL);
    sessions.setRoom(socket.id, EVENT_ROOM_KEY);

    const canSit = chips >= 1 && this.state.phase !== 'closed';
    const emptySeat = findEmptySeatIdx(this.state);
    const gameInProgress = this.state.phase === 'betting' || this.state.phase === 'dealing';

    if (canSit && emptySeat >= 0 && !gameInProgress) {
      addSeat(this.state, emptySeat, token, member.id, nickname, chips);
      this.syncRoomAddPlayer(token, member.id, nickname);
      console.log(
        `[eventRoom] seat add — seatIdx=${emptySeat} member=${member.id} chips=${chips}`,
      );
      const clientRoom = maskedClientRoomForSocket(EVENT_ROOM_KEY, socket);
      if (clientRoom) socket.emit('room:state', clientRoom);
      await this.emitStateToSocket(socket, token);
      this.broadcastAll();
      this.maybeStartNextHand();
      return { success: true };
    }

    // 좌석 못 앉음 → 관전 + 칩 1개 이상이면 큐에 등록
    const inQueue = chips >= 1;
    this.spectators.set(token, { playerId: token, memberId: member.id, nickname, inQueue });
    if (inQueue) this.queue.push(token);
    this.syncRoomAddSpectator(token, member.id, nickname);
    const clientRoom = maskedClientRoomForSocket(EVENT_ROOM_KEY, socket);
    if (clientRoom) socket.emit('room:state', clientRoom);
    await this.emitStateToSocket(socket, token);
    void this.broadcastRoomState();
    this.broadcastMeta();
    return { success: true };
  }

  /** 자발적 퇴장. */
  leave(socket: TypedSocket): void {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    socket.leave(EVENT_SOCKET_CHANNEL);
    sessions.clearRoom(socket.id);

    const seatIdx = findSeatIdxByPlayer(this.state, token);
    if (seatIdx >= 0) {
      // 핸드 중이라면 자동 다이 처리
      const inHand = this.state.phase === 'betting' || this.state.phase === 'dealing';
      if (inHand && this.state.currentTurnSeatIdx === seatIdx) {
        const res = engineHandleAction(this.state, token, { type: 'die' });
        if (res.handResolved) this.afterHandResolved();
      }
      removeSeat(this.state, seatIdx);
      this.syncRoomRemovePlayer(token);
      this.broadcastAll();
      void this.broadcastRoomState();
      // 활성이 부족하면 phase=waiting
      if (this.state.phase === 'waiting') this.maybeStartNextHand();
      return;
    }
    if (this.spectators.has(token)) {
      this.spectators.delete(token);
      this.removeFromQueue(token);
      this.syncRoomRemoveSpectator(token);
      void this.broadcastRoomState();
      this.broadcastMeta();
    }
  }

  /** disconnect 시 즉시 제거 (관전/대기 또는 게임 미진행 상황). */
  handleDisconnect(socket: TypedSocket): void {
    this.leave(socket);
  }

  /** 외부에서 좌석 보유 여부 확인용 (game:action 라우팅). */
  hasSeatForToken(token: string): boolean {
    return findSeatIdxByPlayer(this.state, token) >= 0;
  }

  /**
   * 해당 토큰이 좌석에 앉아 있고 핸드가 진행 중인지 확인.
   * disconnect 30초 유예 적용 여부 판단에 사용.
   */
  isSeatedAndInGame(token: string): boolean {
    if (findSeatIdxByPlayer(this.state, token) < 0) return false;
    return this.state.phase === 'betting' || this.state.phase === 'dealing';
  }

  /**
   * 소켓 없이 토큰만으로 퇴장 처리.
   * 재연결 유예 타이머 만료 시 index.ts에서 호출.
   */
  forceLeaveByToken(token: string): void {
    const seatIdx = findSeatIdxByPlayer(this.state, token);
    if (seatIdx >= 0) {
      const inHand = this.state.phase === 'betting' || this.state.phase === 'dealing';
      if (inHand && this.state.currentTurnSeatIdx === seatIdx) {
        const res = engineHandleAction(this.state, token, { type: 'die' });
        if (res.handResolved) void this.afterHandResolved();
      }
      removeSeat(this.state, seatIdx);
      this.syncRoomRemovePlayer(token);
      void this.broadcastAll();
      void this.broadcastRoomState();
      if (this.state.phase === 'waiting') this.maybeStartNextHand();
      return;
    }
    if (this.spectators.has(token)) {
      this.spectators.delete(token);
      this.removeFromQueue(token);
      this.syncRoomRemoveSpectator(token);
      void this.broadcastRoomState();
      this.broadcastMeta();
    }
  }

  /**
   * 재연결된 소켓에 현재 상태를 다시 전송.
   * session:restore 핸들러에서 호출.
   */
  async rejoinSocket(socket: TypedSocket, token: string): Promise<void> {
    const clientRoom = maskedClientRoomForSocket(EVENT_ROOM_KEY, socket);
    if (clientRoom) socket.emit('room:state', clientRoom);
    await this.emitStateToSocket(socket, token);
  }

  /** 게임 액션. */
  handleAction(socket: TypedSocket, payload: IPEActionPayload): void {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    const res = engineHandleAction(this.state, token, payload);
    if (!res.ok) {
      socket.emit('error', { message: `action: ${res.error ?? 'unknown'}` });
      return;
    }
    this.clearTurnTimer();
    if (res.handResolved) {
      this.afterHandResolved();
    } else {
      this.armTurnTimer();
    }
    this.broadcastAll();
  }

  /* ────────────── meta ────────────── */

  getMeta(): IPEMetaPayload {
    const active = activeSeatIndices(this.state).length;
    return {
      activePlayers: active,
      spectatorCount: this.spectators.size,
      isOpen: isEventRoomOpen(),
      status:
        this.state.phase === 'closed'
          ? 'closed'
          : this.state.phase === 'waiting'
            ? 'waiting'
            : 'playing',
    };
  }

  /* ────────────── hand lifecycle ────────────── */

  private maybeStartNextHand(): void {
    if (this.state.phase !== 'waiting') return;
    if (!isEventRoomOpen()) {
      this.state.phase = 'closed';
      this.state.closedReason = 'operating-hours';
      this.broadcastAll();
      return;
    }
    // 대기열에서 빈 좌석을 채움
    this.promoteFromQueue();

    const res = startNewHand(this.state);
    if (res.started) {
      this.armTurnTimer();
      this.broadcastAll();
    }
  }

  private async afterHandResolved(): Promise<void> {
    this.clearTurnTimer();
    const result = this.state.handResult;
    if (!result) return;

    // DB 정산: 핸드 시작 대비 칩 변동 (chipsAtHandStart → chips)
    const entries: { memberId: string; delta: number; metadata: Record<string, unknown> }[] = [];
    for (let i = 0; i < IPE_MAX_SEATS; i++) {
      const seat = this.state.seats[i];
      if (!seat) continue;
      const delta = seat.chips - seat.chipsAtHandStart;
      if (delta === 0) continue;
      entries.push({
        memberId: seat.memberId,
        delta,
        metadata: {
          handId: result.handId,
          seatIdx: i,
          kind: result.kind,
          wasDie: seat.hasDied,
        },
      });
    }

    if (entries.length > 0) {
      try {
        const rows = await settleEventHand(result.handId, entries);
        // 잔액을 RPC 결과로 동기화 (DB 가 canonical)
        const balanceMap = new Map(rows.map((r) => [r.memberId, r.newBalance]));
        for (const seat of this.state.seats) {
          if (!seat) continue;
          const bal = balanceMap.get(seat.memberId);
          if (typeof bal === 'number') seat.chips = bal;
        }
        // 본인 chip:changed emit
        for (const e of entries) {
          const bal = balanceMap.get(e.memberId);
          if (typeof bal !== 'number') continue;
          this.emitChipChangedToMember(e.memberId, {
            newBalance: bal,
            delta: e.delta,
            reason: 'event_hand',
          });
        }
      } catch (err) {
        console.error('[eventRoom] settleEventHand 실패:', (err as Error).message);
        // 실패해도 게임은 계속 — 다음 핸드부터 잔액 재동기화
      }
    }

    // 핸드 결과 broadcast
    if (this.io) {
      this.io.to(EVENT_SOCKET_CHANNEL).emit('event:hand:result', { result });
    }

    // HAND_RESULT_DISPLAY_MS 후 다음 핸드 준비
    this.scheduleNextHand();
  }

  private scheduleNextHand(): void {
    if (this.nextHandTimer) clearTimeout(this.nextHandTimer);
    this.nextHandTimer = setTimeout(() => {
      this.nextHandTimer = null;
      // 강퇴: 칩 0 인 좌석 제거
      this.kickZeroChipSeats();

      // 운영 시간 종료 체크
      if (!isEventRoomOpen()) {
        this.state.phase = 'closed';
        this.state.closedReason = 'operating-hours';
        this.state.handResult = null;
        this.broadcastAll();
        return;
      }
      this.state.phase = 'waiting';
      this.state.handResult = null;
      this.state.currentTurnSeatIdx = null;
      this.broadcastAll();
      this.maybeStartNextHand();
    }, HAND_RESULT_DISPLAY_MS);
  }

  private kickZeroChipSeats(): void {
    for (let i = 0; i < IPE_MAX_SEATS; i++) {
      const seat = this.state.seats[i];
      if (!seat) continue;
      if (seat.chips <= 0) {
        console.log(`[eventRoom] kick seatIdx=${i} member=${seat.memberId} (0 chips)`);
        // 강퇴 알림
        const seatToken = seat.playerId;
        const socketId = sessions.getSocketByToken(seatToken);
        if (socketId && this.io) {
          const sock = this.io.sockets.sockets.get(socketId);
          if (sock) {
            sock.emit('event:kicked', {
              reason: 'no_chips',
              message: '칩이 모두 소진되어 좌석에서 내려갑니다. 상점에서 칩을 구매해주세요.',
            });
            sock.leave(EVENT_SOCKET_CHANNEL);
            sessions.clearRoom(socketId);
          }
        }
        removeSeat(this.state, i);
        this.syncRoomRemovePlayer(seatToken);
        void this.broadcastRoomState();
      }
    }
  }

  private promoteFromQueue(): void {
    while (this.queue.length > 0) {
      const empty = findEmptySeatIdx(this.state);
      if (empty < 0) break;
      const token = this.queue.shift()!;
      const spec = this.spectators.get(token);
      if (!spec) continue;
      // 칩 잔액 재확인
      void (async () => {
        const sum = await getEventChipSummary(spec.memberId);
        if (sum.balance < 1) {
          // 칩 0 이면 좌석 못 앉음 → spectator로 유지 (queue에서만 빠짐)
          spec.inQueue = false;
          return;
        }
        if (findEmptySeatIdx(this.state) < 0) {
          // 도중에 좌석 다 참 → 큐 맨 앞에 다시 넣음
          this.queue.unshift(token);
          spec.inQueue = true;
          return;
        }
        const idx = findEmptySeatIdx(this.state);
        if (idx < 0) return;
        addSeat(this.state, idx, token, spec.memberId, spec.nickname, sum.balance);
        this.spectators.delete(token);
        // roomStore 동기화: 관전 → 좌석
        this.syncRoomAddPlayer(token, spec.memberId, spec.nickname);
        void this.broadcastRoomState();
        // 본인에게 promoted 알림
        const sid = sessions.getSocketByToken(token);
        if (sid && this.io) {
          const sock = this.io.sockets.sockets.get(sid);
          sock?.emit('event:promoted', {
            seatIdx: idx,
            message: '대기열에서 좌석으로 이동했습니다. 곧 게임이 시작됩니다!',
          });
        }
      })();
    }
  }

  private removeFromQueue(token: string): void {
    const idx = this.queue.indexOf(token);
    if (idx >= 0) this.queue.splice(idx, 1);
  }

  /* ────────────── turn timer ────────────── */

  private armTurnTimer(): void {
    this.clearTurnTimer();
    if (this.state.phase !== 'betting') return;
    this.state.turnStartedAt = Date.now();
    this.turnTimer = setTimeout(() => {
      this.turnTimer = null;
      // 타임아웃 대상 플레이어 토큰 기록 (die + 강퇴)
      const timedOutToken =
        this.state.currentTurnSeatIdx !== null
          ? (this.state.seats[this.state.currentTurnSeatIdx]?.playerId ?? null)
          : null;
      const res = engineHandleTimeout(this.state);
      if (res.handResolved) {
        this.afterHandResolved();
      } else if (this.state.phase === 'betting') {
        this.armTurnTimer();
      }
      void this.broadcastAll();
      // 다이 처리 후 강퇴 (다음 핸드 시작 전 큐 1번 자동 착석)
      if (timedOutToken) this.forceLeaveByToken(timedOutToken);
    }, IPE_TURN_TIME_LIMIT_SECONDS * 1000);
  }

  private clearTurnTimer(): void {
    if (this.turnTimer) {
      clearTimeout(this.turnTimer);
      this.turnTimer = null;
    }
    this.state.turnStartedAt = null;
  }

  /* ────────────── broadcasting ────────────── */

  private async broadcastAll(): Promise<void> {
    if (!this.io) return;
    const sockets = await this.io.in(EVENT_SOCKET_CHANNEL).fetchSockets();
    for (const sock of sockets) {
      const token = sessions.getToken(sock.id);
      await this.emitStateToFetchedSocket(sock, token ?? null);
    }
    this.broadcastMeta();
  }

  private broadcastMeta(): void {
    if (!this.io) return;
    // connected 전체에게 (로비 등). 이벤트 채널 안 들어와도 받아야 함.
    this.io.emit('event:meta:changed', this.getMeta());
  }

  private async emitStateToSocket(socket: TypedSocket, viewerToken: string): Promise<void> {
    const payload = await this.buildStatePayload(viewerToken);
    socket.emit('event:state', payload);
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private async emitStateToFetchedSocket(sock: any, viewerToken: string | null): Promise<void> {
    if (!viewerToken) {
      // anon / 게스트엔 보내지 않음
      return;
    }
    const payload = await this.buildStatePayload(viewerToken);
    sock.emit('event:state', payload);
  }

  private async buildStatePayload(viewerToken: string): Promise<IPEStatePayload> {
    const role: IPEParticipantRole | null = this.resolveRole(viewerToken);
    const mySeatIdx = role === 'player' ? findSeatIdxByPlayer(this.state, viewerToken) : null;

    let myQueuePosition: number | null = null;
    if (role === 'queued') {
      const idx = this.queue.indexOf(viewerToken);
      myQueuePosition = idx >= 0 ? idx + 1 : null;
    }

    // 본인 칩 잔액
    let myChipBalance = 0;
    const seat = mySeatIdx !== null && mySeatIdx >= 0 ? this.state.seats[mySeatIdx] : null;
    if (seat) {
      myChipBalance = seat.chips;
    } else {
      const spec = this.spectators.get(viewerToken);
      if (spec) {
        try {
          const sum = await getEventChipSummary(spec.memberId);
          myChipBalance = sum.balance;
        } catch {
          myChipBalance = 0;
        }
      }
    }

    return {
      role,
      mySeatIdx: mySeatIdx !== null && mySeatIdx >= 0 ? mySeatIdx : null,
      myQueuePosition,
      gameData: buildGameDataFor(this.state, viewerToken),
      myChipBalance,
      queueLength: this.queue.length,
      spectatorCount: this.spectators.size,
      isOpen: isEventRoomOpen(),
    };
  }

  private resolveRole(token: string): IPEParticipantRole | null {
    if (findSeatIdxByPlayer(this.state, token) >= 0) return 'player';
    const spec = this.spectators.get(token);
    if (!spec) return null;
    if (spec.inQueue && this.queue.includes(token)) return 'queued';
    return 'spectator';
  }

  private emitChipChangedToMember(
    memberId: string,
    payload: { newBalance: number; delta: number; reason: 'event_hand' },
  ): void {
    if (!this.io) return;
    const token = sessions.getTokenByMemberId(memberId);
    if (!token) return;
    const socketId = sessions.getSocketByToken(token);
    if (!socketId) return;
    const sock = this.io.sockets.sockets.get(socketId);
    sock?.emit('event:chip:changed', payload);
  }

  /** 칩 외부 변동 (상점 구매·환전·어드민) 시 좌석 잔액 동기화. */
  async syncSeatChipsFromMember(memberId: string): Promise<void> {
    const seat = this.findSeatByMemberId(memberId);
    if (!seat) return;
    const sum = await getEventChipSummary(memberId);
    seat.chips = sum.balance;
    seat.chipsAtHandStart = sum.balance; // 핸드 시작 전 동기화 시점이라고 가정
    this.broadcastAll();
  }

  private findSeatByMemberId(memberId: string): InternalSeat | null {
    for (const s of this.state.seats) {
      if (s?.memberId === memberId) return s;
    }
    return null;
  }
}

export const eventRoom = new EventRoomManager();

export { EVENT_ROOM_KEY, EVENT_SOCKET_CHANNEL };
