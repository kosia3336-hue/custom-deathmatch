/**
 * 해달별 (이벤트) — 단일 영구 룸 매니저.
 */

import type { IO, TypedSocket } from './types.js';
import type {
  SmsMarkId,
  SmsMetaPayload,
  SmsParticipantRole,
  SmsPickAction,
  SmsStatePayload,
} from '@shared/types/sun-moon-star-event.js';
import {
  SMSE_INTER_ROUND_WAIT_MS,
  SMSE_LIT_REVEAL_MS,
  SMSE_MAX_SEATS,
  SMSE_MIN_PLAYERS,
  SMSE_REVEAL_STEP_MS,
  SMSE_ROUND_RESULT_DISPLAY_MS,
} from '@shared/types/sun-moon-star-event.js';
import { GAME_IDS } from '@shared/types/game.js';
import { isEventRoomOpen } from '@shared/event/kst.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { insertEventRound, loadActiveSeasonId, settleEventRound } from '../db/eventScores.js';
import { socketRoom, maskedClientRoomForSocket } from './utils.js';
import type { Player } from '@shared/types/room.js';
import {
  PICK_TIMEOUT_MS,
  activeSeatIndices,
  addSeat,
  advanceReveal,
  afterRevealDone,
  allPicksSubmitted,
  beginReveal,
  buildGameData,
  createInitialState,
  detachPlayerMidRound,
  findEmptySeatIdx,
  findSeatIdxByPlayer,
  isInActiveRound,
  removeSeat,
  startNewRound,
  submitPick,
  type InternalState,
} from './games/sun-moon-star-event/state.js';
export const EVENT_SMS_ROOM_KEY = process.env.EVENT_SMS_ROOM_KEY ?? 'evt-sms';
export const EVENT_SMS_SOCKET_CHANNEL = socketRoom(EVENT_SMS_ROOM_KEY);

const SMS_ENABLED = process.env.EVENT_SMS_ENABLED !== 'false';

interface Spectator {
  playerId: string;
  memberId: string;
  nickname: string;
  inQueue: boolean;
}

class SmsEventRoomManager {
  private state: InternalState = createInitialState();
  private spectators = new Map<string, Spectator>();
  private queue: string[] = [];
  private pickTimer: ReturnType<typeof setTimeout> | null = null;
  private revealTimer: ReturnType<typeof setTimeout> | null = null;
  private nextRoundTimer: ReturnType<typeof setTimeout> | null = null;
  private hoursTimer: ReturnType<typeof setInterval> | null = null;
  private seasonTimer: ReturnType<typeof setInterval> | null = null;
  private io: IO | null = null;
  private initialized = false;
  private seasonId: string | null = null;

  init(io: IO): void {
    if (this.initialized) return;
    this.io = io;
    this.initialized = true;

    roomStore.createSystemRoom({
      id: EVENT_SMS_ROOM_KEY,
      title: '해달별 (이벤트)',
      gameId: GAME_IDS.SUN_MOON_STAR_EVENT,
      gameName: '해달별 (이벤트)',
      maxPlayers: SMSE_MAX_SEATS,
      spectatorAllowed: true,
    });

    void this.refreshSeason();
    this.seasonTimer = setInterval(() => void this.refreshSeason(), 5 * 60 * 1000);
    this.refreshHours();
    this.hoursTimer = setInterval(() => this.refreshHours(), 60 * 1000);
    console.log('[smsEventRoom] initialized');
  }

  isEnabled(): boolean {
    return SMS_ENABLED;
  }

  private async refreshSeason(): Promise<void> {
    this.seasonId = await loadActiveSeasonId(GAME_IDS.SUN_MOON_STAR_EVENT);
  }

  private isOpen(): boolean {
    if (!SMS_ENABLED) return false;
    return isEventRoomOpen();
  }

  private refreshHours(): void {
    const open = this.isOpen();
    if (!open && this.state.phase === 'waiting') {
      this.state.phase = 'closed';
      this.state.closedReason = 'operating-hours';
      this.broadcastAll();
    } else if (open && this.state.phase === 'closed' && this.state.closedReason === 'operating-hours') {
      this.state.phase = 'waiting';
      this.state.closedReason = null;
      this.broadcastAll();
      this.maybeStartNextRound();
    }
  }

  private makePlayer(token: string, memberId: string, nickname: string): Player {
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
    roomStore.systemRoomAddPlayer(EVENT_SMS_ROOM_KEY, this.makePlayer(token, memberId, nickname));
    roomStore.systemRoomRemoveSpectator(EVENT_SMS_ROOM_KEY, token);
  }

  private syncRoomRemovePlayer(token: string): void {
    roomStore.systemRoomRemovePlayer(EVENT_SMS_ROOM_KEY, token);
  }

  private syncRoomAddSpectator(token: string, memberId: string, nickname: string): void {
    roomStore.systemRoomAddSpectator(EVENT_SMS_ROOM_KEY, this.makePlayer(token, memberId, nickname));
  }

  private syncRoomRemoveSpectator(token: string): void {
    roomStore.systemRoomRemoveSpectator(EVENT_SMS_ROOM_KEY, token);
  }

  /** 좌석 해제 후 관전(또는 대기열)으로 전환 */
  private demoteSeatToSpectator(seatIdx: number, reason: 'timeout'): void {
    const seat = this.state.seats[seatIdx];
    if (!seat) return;
    const { playerId: token, memberId, nickname } = seat;
    removeSeat(this.state, seatIdx);
    this.syncRoomRemovePlayer(token);

    const roundActive = isInActiveRound(this.state);
    const roomFull = findEmptySeatIdx(this.state) < 0;
    const inQueue = roundActive || roomFull;

    this.spectators.set(token, { playerId: token, memberId, nickname, inQueue });
    if (inQueue && !this.queue.includes(token)) this.queue.push(token);
    this.syncRoomAddSpectator(token, memberId, nickname);

    const sid = sessions.getSocketByToken(token);
    if (sid && this.io) {
      const sock = this.io.sockets.sockets.get(sid);
      if (sock) {
        sock.emit('smsEvent:kicked', {
          reason,
          message: '선택 시간 초과로 좌석에서 내려졌습니다. 관전으로 전환됩니다.',
        });
        this.emitStateToSocket(sock as unknown as TypedSocket, token);
        const clientRoom = maskedClientRoomForSocket(EVENT_SMS_ROOM_KEY, sock as unknown as TypedSocket);
        if (clientRoom) sock.emit('room:state', clientRoom);
      }
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private async broadcastRoomState(): Promise<void> {
    if (!this.io) return;
    const sockets = await this.io.in(EVENT_SMS_SOCKET_CHANNEL).fetchSockets();
    for (const sock of sockets) {
      const clientRoom = maskedClientRoomForSocket(EVENT_SMS_ROOM_KEY, sock as unknown as TypedSocket);
      if (clientRoom) sock.emit('room:state', clientRoom);
    }
  }

  async join(socket: TypedSocket): Promise<{ success: boolean; error?: string; errorCode?: string }> {
    if (!SMS_ENABLED) {
      return { success: false, error: '이벤트가 비활성화되어 있습니다.', errorCode: 'EVENT_NOT_ACTIVE' };
    }
    const member = (socket.data as { member?: { id: string; nickname: string } | null }).member;
    if (!member?.id) {
      return { success: false, error: '회원 로그인이 필요합니다.', errorCode: 'NOT_LOGGED_IN' };
    }
    if (!this.isOpen()) {
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

    const existingSeat = findSeatIdxByPlayer(this.state, token);
    if (existingSeat >= 0 || this.spectators.has(token)) {
      socket.join(EVENT_SMS_SOCKET_CHANNEL);
      sessions.setRoom(socket.id, EVENT_SMS_ROOM_KEY);
      const clientRoom = maskedClientRoomForSocket(EVENT_SMS_ROOM_KEY, socket);
      if (clientRoom) socket.emit('room:state', clientRoom);
      this.emitStateToSocket(socket, token);
      return { success: true };
    }

    socket.join(EVENT_SMS_SOCKET_CHANNEL);
    sessions.setRoom(socket.id, EVENT_SMS_ROOM_KEY);

    const emptySeat = findEmptySeatIdx(this.state);
    const roundActive = isInActiveRound(this.state);

    if (emptySeat >= 0 && !roundActive && this.state.phase !== 'closed') {
      addSeat(this.state, emptySeat, token, member.id, nickname);
      this.syncRoomAddPlayer(token, member.id, nickname);
      const clientRoom = maskedClientRoomForSocket(EVENT_SMS_ROOM_KEY, socket);
      if (clientRoom) socket.emit('room:state', clientRoom);
      this.emitStateToSocket(socket, token);
      void this.broadcastAll();
      void this.broadcastRoomState();
      this.syncWaitingOnRosterChange();
      this.maybeStartNextRound();
      return { success: true };
    }

    const inQueue = true;
    this.spectators.set(token, { playerId: token, memberId: member.id, nickname, inQueue });
    this.queue.push(token);
    this.syncRoomAddSpectator(token, member.id, nickname);
    const clientRoom = maskedClientRoomForSocket(EVENT_SMS_ROOM_KEY, socket);
    if (clientRoom) socket.emit('room:state', clientRoom);
    this.emitStateToSocket(socket, token);
    this.broadcastMeta();
    return { success: true };
  }

  leave(socket: TypedSocket): void {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    socket.leave(EVENT_SMS_SOCKET_CHANNEL);
    if (sessions.getRoom(socket.id) === EVENT_SMS_ROOM_KEY) {
      sessions.clearRoom(socket.id);
    }

    const seatIdx = findSeatIdxByPlayer(this.state, token);
    if (seatIdx >= 0) {
      if (isInActiveRound(this.state)) {
        detachPlayerMidRound(this.state, seatIdx);
      } else {
        removeSeat(this.state, seatIdx);
      }
      this.syncRoomRemovePlayer(token);
      void this.broadcastAll();
      void this.broadcastRoomState();
      if (this.state.phase === 'waiting') {
        this.syncWaitingOnRosterChange();
        this.maybeStartNextRound();
      }
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

  handleDisconnect(socket: TypedSocket): void {
    this.leave(socket);
  }

  hasSeatForToken(token: string): boolean {
    return findSeatIdxByPlayer(this.state, token) >= 0;
  }

  isSeatedAndInRound(token: string): boolean {
    if (findSeatIdxByPlayer(this.state, token) < 0) return false;
    return isInActiveRound(this.state);
  }

  forceLeaveByToken(token: string): void {
    const seatIdx = findSeatIdxByPlayer(this.state, token);
    if (seatIdx >= 0) {
      if (isInActiveRound(this.state)) {
        detachPlayerMidRound(this.state, seatIdx);
      } else {
        removeSeat(this.state, seatIdx);
      }
      this.syncRoomRemovePlayer(token);
      void this.broadcastAll();
      void this.broadcastRoomState();
      if (this.state.phase === 'waiting') {
        this.syncWaitingOnRosterChange();
        this.maybeStartNextRound();
      }
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

  rejoinSocket(socket: TypedSocket, token: string): void {
    const clientRoom = maskedClientRoomForSocket(EVENT_SMS_ROOM_KEY, socket);
    if (clientRoom) socket.emit('room:state', clientRoom);
    this.emitStateToSocket(socket, token);
  }

  handlePick(socket: TypedSocket, mark: SmsMarkId): void {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    const res = this.applyPick(token, mark);
    if (!res.ok) {
      socket.emit('error', { message: res.error ?? '선택 실패' });
    }
  }

  private applyPick(token: string, mark: SmsMarkId): { ok: boolean; error?: string } {
    const res = submitPick(this.state, token, mark);
    if (!res.ok) return res;
    if (res.advanced) {
      this.clearPickTimer();
      const which = this.state.phase === 'pickFirst' ? 'first' : 'second';
      beginReveal(this.state, which);
      this.armRevealTimer();
    }
    void this.broadcastAll();
    return res;
  }

  getMeta(): SmsMetaPayload {
    return {
      activePlayers: activeSeatIndices(this.state).length,
      spectatorCount: this.spectators.size,
      isOpen: this.isOpen(),
      status:
        this.state.phase === 'closed'
          ? 'closed'
          : isInActiveRound(this.state)
            ? 'playing'
            : 'waiting',
    };
  }

  private maybeStartNextRound(): void {
    if (this.state.phase !== 'waiting') return;
    if (this.state.nextRoundStartsAt != null && Date.now() < this.state.nextRoundStartsAt) return;
    if (!this.isOpen()) {
      this.state.phase = 'closed';
      this.state.closedReason = 'operating-hours';
      void this.broadcastAll();
      return;
    }
    if (activeSeatIndices(this.state).length < SMSE_MIN_PLAYERS) return;

    this.promoteFromQueue();
    const res = startNewRound(this.state);
    if (res.started) {
      this.armPickTimer('first');
      void this.broadcastAll();
      void this.broadcastRoomState();
    }
  }

  /** waiting 중 인원 변동 — 4인 미만이면 카운트다운 취소, 판 종료 후 4인 회복 시 10초 대기 재시작 */
  private syncWaitingOnRosterChange(): void {
    if (this.state.phase !== 'waiting') return;
    const active = activeSeatIndices(this.state).length;

    if (active < SMSE_MIN_PLAYERS) {
      this.clearInterRoundTimer();
      this.state.nextRoundStartsAt = null;
      void this.broadcastAll();
      return;
    }

    if (
      this.state.roundNumber > 0 &&
      this.state.nextRoundStartsAt == null &&
      this.nextRoundTimer == null
    ) {
      this.state.nextRoundStartsAt = Date.now() + SMSE_INTER_ROUND_WAIT_MS;
      this.armInterRoundTimer();
      void this.broadcastAll();
    }
  }

  private beginInterRoundWait(): void {
    this.state.phase = 'waiting';
    this.state.roundResult = null;
    this.state.litResult = null;
    this.state.secondCounts = null;
    this.state.pickDeadlineAt = null;

    const active = activeSeatIndices(this.state).length;
    if (active >= SMSE_MIN_PLAYERS) {
      this.state.nextRoundStartsAt = Date.now() + SMSE_INTER_ROUND_WAIT_MS;
      this.armInterRoundTimer();
    } else {
      this.state.nextRoundStartsAt = null;
      this.clearInterRoundTimer();
    }

    void this.broadcastAll();
    void this.broadcastRoomState();
  }

  private armInterRoundTimer(): void {
    this.clearInterRoundTimer();
    const deadline = this.state.nextRoundStartsAt;
    if (!deadline) return;
    const ms = Math.max(0, deadline - Date.now());
    this.nextRoundTimer = setTimeout(() => {
      this.nextRoundTimer = null;
      this.state.nextRoundStartsAt = null;
      if (!this.isOpen()) {
        this.state.phase = 'closed';
        this.state.closedReason = 'operating-hours';
        void this.broadcastAll();
        return;
      }
      this.maybeStartNextRound();
    }, ms);
  }

  private clearInterRoundTimer(): void {
    if (this.nextRoundTimer) {
      clearTimeout(this.nextRoundTimer);
      this.nextRoundTimer = null;
    }
  }

  private async afterFirstResolved(): Promise<void> {
    await this.sleep(SMSE_LIT_REVEAL_MS);
    if (this.state.phase !== 'resolveFirst') return;

    this.state.phase = 'pickSecond';
    this.state.pickDeadlineAt = Date.now() + PICK_TIMEOUT_MS;
    this.armPickTimer('second');
    void this.broadcastAll();
  }

  private async afterRoundResolved(): Promise<void> {
    const result = this.state.roundResult;
    const roundId = this.state.roundId;
    if (!result || !roundId) return;

    const lit = this.state.litResult;
    const seasonId = this.seasonId;

    if (seasonId) {
      const dbRoundId =
        (await insertEventRound({
          seasonId,
          roundNumber: result.roundNumber,
          playerCount: result.scorers.length,
          countsSecond: result.counts,
          litMark: result.litMark,
          litReason: lit?.kind === 'lit' ? lit.reason : lit?.kind === 'void' ? 'triple_tie' : null,
          voidRound: result.void,
        })) ?? roundId;

      const entries: { memberId: string; delta: number; metadata: Record<string, unknown> }[] = [];
      for (const [seatIdx, score] of this.state.roundScores) {
        if (score === 0) continue;
        const seat = this.state.seats[seatIdx];
        const ghost = this.state.roundGhosts.find((g) => g.seatIdx === seatIdx);
        const memberId = seat?.memberId ?? ghost?.memberId;
        if (!memberId) continue;
        entries.push({
          memberId,
          delta: score,
          metadata: {
            roundNumber: result.roundNumber,
            seatIdx,
            firstPick: seat?.firstPick ?? ghost?.firstPick,
            secondPick: seat?.secondPick ?? ghost?.secondPick,
            litMark: result.litMark,
            roundScore: score,
            autoPickFirst: seat?.autoPickFirst ?? false,
            autoPickSecond: seat?.autoPickSecond ?? false,
            departed: !seat && !!ghost,
          },
        });
      }
      if (entries.length > 0) {
        try {
          await settleEventRound(seasonId, dbRoundId, entries);
        } catch (err) {
          console.error('[smsEventRoom] settle 실패:', (err as Error).message);
        }
      }
    }

    void this.broadcastAll();

    await this.sleep(SMSE_LIT_REVEAL_MS);

    if (this.io) {
      this.io.to(EVENT_SMS_SOCKET_CHANNEL).emit('smsEvent:round:result', { result });
    }

    await this.sleep(SMSE_ROUND_RESULT_DISPLAY_MS);
    this.beginInterRoundWait();
  }

  private promoteFromQueue(): void {
    while (this.queue.length > 0) {
      const empty = findEmptySeatIdx(this.state);
      if (empty < 0) break;
      const token = this.queue.shift()!;
      const spec = this.spectators.get(token);
      if (!spec) continue;
      if (findEmptySeatIdx(this.state) < 0) {
        this.queue.unshift(token);
        break;
      }
      const idx = findEmptySeatIdx(this.state);
      if (idx < 0) break;
      addSeat(this.state, idx, token, spec.memberId, spec.nickname);
      this.spectators.delete(token);
      this.syncRoomAddPlayer(token, spec.memberId, spec.nickname);
      void this.broadcastRoomState();
      const sid = sessions.getSocketByToken(token);
      if (sid && this.io) {
        const sock = this.io.sockets.sockets.get(sid);
        sock?.emit('smsEvent:promoted', {
          seatIdx: idx,
          message: '대기열에서 좌석으로 이동했습니다. 곧 게임이 시작됩니다!',
        });
      }
    }
  }

  private removeFromQueue(token: string): void {
    const i = this.queue.indexOf(token);
    if (i >= 0) this.queue.splice(i, 1);
  }

  private armPickTimer(which: 'first' | 'second'): void {
    this.clearPickTimer();
    this.pickTimer = setTimeout(() => {
      this.pickTimer = null;
      this.handlePickTimeout(which);
    }, PICK_TIMEOUT_MS);
  }

  private handlePickTimeout(which: 'first' | 'second'): void {
    const toKick: number[] = [];
    for (const idx of activeSeatIndices(this.state)) {
      const seat = this.state.seats[idx]!;
      const missing = which === 'first' ? seat.firstPick === null : seat.secondPick === null;
      if (!missing) continue;
      toKick.push(idx);
    }

    for (const seatIdx of toKick) {
      this.demoteSeatToSpectator(seatIdx, 'timeout');
    }

    void this.broadcastRoomState();
    this.broadcastMeta();

    if (activeSeatIndices(this.state).length === 0) {
      this.clearPickTimer();
      this.beginInterRoundWait();
      return;
    }

    if (allPicksSubmitted(this.state, which)) {
      beginReveal(this.state, which);
      this.armRevealTimer();
    } else {
      this.armPickTimer(which);
    }
    void this.broadcastAll();
  }

  private armRevealTimer(): void {
    this.clearRevealTimer();
    this.revealTimer = setTimeout(() => this.onRevealTick(), SMSE_REVEAL_STEP_MS);
  }

  private onRevealTick(): void {
    const { done } = advanceReveal(this.state);
    if (!done) {
      this.armRevealTimer();
      this.broadcastAll();
      return;
    }
    if (this.state.phase === 'revealFirst') {
      afterRevealDone(this.state);
      this.broadcastAll();
      void this.afterFirstResolved();
      return;
    }
    if (this.state.phase === 'revealSecond') {
      afterRevealDone(this.state);
      this.broadcastAll();
      void this.afterRoundResolved();
    }
  }

  private clearPickTimer(): void {
    if (this.pickTimer) {
      clearTimeout(this.pickTimer);
      this.pickTimer = null;
    }
  }

  private clearRevealTimer(): void {
    if (this.revealTimer) {
      clearTimeout(this.revealTimer);
      this.revealTimer = null;
    }
  }

  private async broadcastAll(): Promise<void> {
    if (!this.io) return;
    const sockets = await this.io.in(EVENT_SMS_SOCKET_CHANNEL).fetchSockets();
    for (const sock of sockets) {
      const token = sessions.getToken(sock.id);
      if (!token) continue;
      const payload = this.buildStatePayload(token);
      sock.emit('smsEvent:state', payload);
    }
    this.broadcastMeta();
  }

  private broadcastMeta(): void {
    if (!this.io) return;
    this.io.emit('smsEvent:meta:changed', this.getMeta());
  }

  private emitStateToSocket(socket: TypedSocket, viewerToken: string): void {
    socket.emit('smsEvent:state', this.buildStatePayload(viewerToken));
  }

  private buildStatePayload(viewerToken: string): SmsStatePayload {
    const role = this.resolveRole(viewerToken);
    const mySeatIdx = role === 'player' ? findSeatIdxByPlayer(this.state, viewerToken) : null;
    let myQueuePosition: number | null = null;
    if (role === 'queued') {
      const idx = this.queue.indexOf(viewerToken);
      myQueuePosition = idx >= 0 ? idx + 1 : null;
    }
    return {
      role,
      mySeatIdx: mySeatIdx !== null && mySeatIdx >= 0 ? mySeatIdx : null,
      myQueuePosition,
      queueLength: this.queue.length,
      spectatorCount: this.spectators.size,
      isOpen: this.isOpen(),
      gameData: buildGameData(this.state),
    };
  }

  private resolveRole(token: string): SmsParticipantRole | null {
    if (findSeatIdxByPlayer(this.state, token) >= 0) return 'player';
    const spec = this.spectators.get(token);
    if (!spec) return null;
    if (spec.inQueue && this.queue.includes(token)) return 'queued';
    return 'spectator';
  }
}

export const smsEventRoom = new SmsEventRoomManager();
