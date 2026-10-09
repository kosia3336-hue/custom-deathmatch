/**
 * 기간 한정 길드전 「링 더 벨」 — 단일 시스템 룸 매니저.
 *
 * 책임:
 * 1. 운영 창(기간 ∧ 요일 시간)에만 룸을 만들고, 닫히면 전원 로비로 보낸다.
 * 2. 좌석 8 / 최소 3 / 같은 길드 2 / 칩 1 이상. 입장은 관전, 빈칸 클릭 착석. FIFO 없음
 * 3. 서버 권위 엔진 구동 (턴 1분, 조합 1분, 세트 후 15초)
 * 4. 세트 종료 시 길드 단위 델타를 새 RPC 로 정산하고 잔액 0 길드를 내린다.
 * 5. 기간(10/1 00:00 KST)이 끝나면 남은 칩을 GP 로 자동 환전하고 룸을 지운다.
 *
 * 기존 길드 화면·RPC 16개는 건드리지 않는다.
 */

import { randomUUID } from 'node:crypto';
import type { IO, TypedSocket } from './types.js';
import { GAME_IDS } from '@shared/types/game.js';
import type { Player } from '@shared/types/room.js';
import {
  GUILD_WAR_GAME_NAME,
  GUILD_WAR_ROOM_ID,
  GUILD_WAR_ROOM_TITLE,
  type RtbKickedPayload,
  type RtbKickedReason,
  type RtbMetaPayload,
  type RtbRole,
  type RtbSeatBlock,
  type RtbStatePayload,
} from '@shared/types/ring-the-bell.js';
import {
  RTB_MAX_PER_GUILD,
  RTB_MAX_SEATS,
  RTB_MIN_PLAYERS,
  apply,
  available,
  createTable,
  drainKicks,
  dropBrokeGuilds,
  endSettleDisplay,
  isSetRunning,
  maskStateFor,
  readySeatCount,
  rearmCountdown,
  seatPlayer,
  seatedCountForGuild,
  setGuildBalance,
  startNextSet,
  syncWaitAfterRosterChange,
  unseatPlayer,
  type RtbAction,
  type RtbState,
} from '@shared/guild-war/index.js';
import { isGuildWarOpen, isGuildWarOver, isGuildWarPeriod } from '@shared/guild-war/kst.js';
import { sessions } from '../store/sessions.js';
import { roomStore } from '../store/rooms.js';
import { LOBBY_ROOM } from './types.js';
import { maskedClientRoomForSocket } from './utils.js';
import {
  expireGuildWarChips,
  getGuildWarBalances,
  getGuildWarContext,
  settleGuildWarSet,
} from '../db/guildWar.js';

const CHANNEL = `room:${GUILD_WAR_ROOM_ID}`;
const TICK_MS = 400;
const HOURS_POLL_MS = 20_000;
/** 대기 상태에서 좌석·잔액을 다시 보고 세트를 열어 보는 간격 (GW-16). */
const IDLE_RETRY_MS = 5_000;
/** 소켓 1개가 1초에 보낼 수 있는 행동 수. 넘으면 버린다. */
const ACTION_BURST = 12;

const KICK_MESSAGE: Record<RtbKickedReason, string> = {
  no_chips: '길드 칩이 모두 소진되어 퇴장했습니다. 상점에서 칩을 사고 다시 입장해 주세요.',
  ante: '길드 칩이 앤티 3개보다 적어 이번 세트에 참여할 수 없습니다. 칩을 채우고 다시 입장해 주세요.',
  turn_timeout: '시간 초과로 퇴장했습니다.',
  combo_timeout: '조합 제한 시간이 지나 퇴장했습니다.',
  closed: '길드전 운영 시간이 끝났습니다.',
  period_over: '길드전이 종료되었습니다. 남은 칩은 GP로 환전됩니다.',
};

interface Watcher {
  token: string;
  memberId: string;
  nickname: string;
  guildId: string | null;
  seatBlock: RtbSeatBlock;
}

function playingPhase(state: RtbState): boolean {
  return isSetRunning(state);
}

class GuildWarRoomManager {
  private io: IO | null = null;
  private initialized = false;
  private state: RtbState = createTable();
  /**
   * 테이블을 새로 만들 때마다 바뀌는 실행 id. 세트 번호(setIndex)는 테이블마다
   * 0 부터 다시 세므로, 이걸 붙이지 않으면 서버 재시작 뒤의 세트가 예전 세트와
   * 같은 정산 id 가 되어 DB 가 '이미 정산함' 으로 보고 결과를 버린다.
   */
  private tableRunId = randomUUID();
  private watchers = new Map<string, Watcher>();
  /** 이번 세트를 친 뒤 다음 세트 시작 직전에 관전으로 내릴 사람. */
  private spectateReserve = new Set<string>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private hoursTimer: ReturnType<typeof setInterval> | null = null;
  private roomLive = false;
  private settledSetIndex = 0;
  private settling = false;
  private refundDone = false;
  /** 세트 사이 정리(DB 동기화·강퇴·승격)가 도는 중. 중복 진입 방지. */
  private between = false;
  private lastIdleRetry = 0;
  private actionRate = new Map<string, { at: number; n: number }>();

  init(io: IO): void {
    if (this.initialized) return;
    this.io = io;
    this.initialized = true;
    this.refreshWindow();
    this.hoursTimer = setInterval(() => this.refreshWindow(), HOURS_POLL_MS);
    this.tickTimer = setInterval(() => this.tick(), TICK_MS);
    console.log('[guildWarRoom] initialized');
  }

  /* ────────────── 운영 창 ────────────── */

  /** 기간·요일 시간에 맞춰 룸을 만들고 지운다. */
  private refreshWindow(): void {
    const open = isGuildWarOpen();

    if (open) {
      if (!this.roomLive) {
        roomStore.createSystemRoom({
          id: GUILD_WAR_ROOM_ID,
          title: GUILD_WAR_ROOM_TITLE,
          gameId: GAME_IDS.RING_THE_BELL,
          gameName: GUILD_WAR_GAME_NAME,
          maxPlayers: RTB_MAX_SEATS,
          spectatorAllowed: true,
          lobbyVisible: true,
        });
        this.roomLive = true;
        console.log('[guildWarRoom] 방 열림');
        const summary = roomStore.getSummary(GUILD_WAR_ROOM_ID);
        if (summary) this.io?.to(LOBBY_ROOM).emit('lobby:room:created', summary);
        this.broadcastMeta();
      }
      return;
    }

    // 닫힘. 진행 중 세트는 끝까지 친다.
    if (playingPhase(this.state)) return;
    if (this.roomLive) this.closeRoom();
    if (isGuildWarOver()) void this.runPeriodRefund();
  }

  /** 전원 로비로 보내고 룸을 지운다. */
  private closeRoom(): void {
    const reason: RtbKickedReason = isGuildWarOver() ? 'period_over' : 'closed';

    for (const p of this.state.roster) this.evict(p.id, reason);
    for (const token of [...this.watchers.keys()]) this.evict(token, reason);

    this.state = createTable();
    this.tableRunId = randomUUID();
    this.watchers.clear();
    this.spectateReserve.clear();
    this.actionRate.clear();
    this.settledSetIndex = 0;
    roomStore.removeSystemRoom(GUILD_WAR_ROOM_ID);
    this.roomLive = false;
    console.log('[guildWarRoom] 방 닫힘');
    this.io?.to(LOBBY_ROOM).emit('lobby:room:removed', GUILD_WAR_ROOM_ID);
    this.broadcastMeta();
  }

  /** 소켓을 방 채널에서 떼고 로비로 돌려보낸다. 좌석·관전 정리는 부르는 쪽이 한다. */
  private evict(token: string, reason: RtbKickedReason): void {
    this.actionRate.delete(token);
    const socketId = sessions.getSocketByToken(token);
    if (!socketId || !this.io) return;
    const sock = this.io.sockets.sockets.get(socketId);
    if (!sock) return;
    const payload: RtbKickedPayload = { reason, message: KICK_MESSAGE[reason] };
    sock.emit('guildWar:kicked', payload);
    sock.leave(CHANNEL);
    if (sessions.getRoom(socketId) === GUILD_WAR_ROOM_ID) sessions.clearRoom(socketId);
  }

  /**
   * 좌석에서 내리고 **로비로 내보낸다** (§13.4).
   *
   * 좌석만 풀고 채널에 남겨 두면 좌석·관전 어디에도 없는 상태가 된다.
   * 그 상태는 다시 앉을 수도, 안내를 받을 수도 없어서 막힌다.
   */
  private kickToLobby(token: string, reason: RtbKickedReason): void {
    this.spectateReserve.delete(token);
    if (this.state.roster.some((p) => p.id === token)) {
      this.state = unseatPlayer(this.state, token);
      roomStore.systemRoomRemovePlayer(GUILD_WAR_ROOM_ID, token);
    }
    if (this.watchers.delete(token)) {
      roomStore.systemRoomRemoveSpectator(GUILD_WAR_ROOM_ID, token);
    }
    this.evict(token, reason);
  }

  /** 엔진이 적어 둔 강퇴 대상을 처리한다 (턴·조합 타임아웃, 앤티 미납). */
  private processKicks(): boolean {
    const { state, kicks } = drainKicks(this.state);
    if (kicks.length === 0) return false;
    this.state = state;
    for (const k of kicks) this.kickToLobby(k.playerId, k.reason);
    return true;
  }

  /** 기간 종료 자동 환전. 1회만. */
  private async runPeriodRefund(): Promise<void> {
    if (this.refundDone) return;
    this.refundDone = true;
    try {
      const n = await expireGuildWarChips();
      if (n > 0) console.log(`[guildWarRoom] 기간 종료 환전 ${n}개 길드`);
    } catch (err) {
      this.refundDone = false;
      console.error('[guildWarRoom] 환전 실패:', (err as Error).message);
    }
  }

  /* ────────────── 타이머 ────────────── */

  private tick(): void {
    if (!this.roomLive) return;
    const s = this.state;
    const now = Date.now();

    if (s.phase === 'countdown') {
      if (s.countdownEndsAt != null && now >= s.countdownEndsAt) {
        if (!isGuildWarOpen()) {
          this.refreshWindow();
          return;
        }
        void this.openNextSet();
      }
      return;
    }

    // 정산 결과 15초 노출이 끝났다. 인원이 모자라 다음 세트가 없는 경우다 (§8.5).
    if (s.phase === 'settle') {
      if (s.countdownEndsAt != null && now >= s.countdownEndsAt) {
        this.state = endSettleDisplay(this.state);
        this.broadcastAll();
      }
      return;
    }

    if (s.phase === 'combo') {
      // 조합 1분 초과. 강퇴 대상은 엔진이 pendingKick 에 적는다.
      if (s.comboEndsAt != null && now >= s.comboEndsAt) this.dispatchSystem({ type: 'timeout' });
      return;
    }

    if (s.phase === 'idle') {
      this.maybeRetryIdle(now);
      return;
    }

    if (s.turnEndsAt != null && now >= s.turnEndsAt) {
      // 턴 시간 초과. 벨 전이면 다이+강퇴, 벨 후 마지막 교환이면 랜덤 교환+강퇴.
      this.dispatchSystem({ type: 'timeout' });
    }
  }

  /**
   * 대기 상태에서 스스로 세트를 다시 연다 (GW-16).
   *
   * 앤티 롤백으로 대기로 돌아오면 아무도 재시작을 트리거하지 않아 방이 멈춘다.
   * 새 입장자를 기다리지 않고 좌석·잔액을 다시 보고 조건이 차면 연다.
   */
  private maybeRetryIdle(now: number): void {
    if (now - this.lastIdleRetry < IDLE_RETRY_MS) return;
    if (this.state.roster.length < RTB_MIN_PLAYERS) return;
    this.lastIdleRetry = now;
    void this.betweenSets();
  }

  /** 카운트다운이 끝났다. 세트 시작 직전 잔액을 맞추고 딜한다. */
  private async openNextSet(): Promise<void> {
    if (this.between) return;
    this.between = true;
    try {
      // 스냅샷은 「세트 시작 직전 DB 잔액」이다 (§6.9). 카운트다운 중 구매를 여기서 흡수한다.
      await this.syncBalances();
      if (!isGuildWarOpen()) {
        this.refreshWindow();
        return;
      }
      this.applySpectateReserves();
      this.state = startNextSet(this.state);
      // 앤티를 못 낸 좌석은 로비로 보낸다 (GW-22).
      this.processKicks();
      this.broadcastAll();
    } finally {
      this.between = false;
    }
  }

  private dispatchSystem(action: RtbAction): void {
    const res = apply(this.state, 'system', action);
    if (!res.ok) return;
    this.state = res.state;
    this.afterApply();
  }

  /** 엔진이 세트를 끝냈으면 DB 정산으로 넘긴다. */
  private afterApply(): void {
    this.processKicks();
    this.broadcastAll();
    if (this.state.settle && this.state.setIndex !== this.settledSetIndex) {
      this.settledSetIndex = this.state.setIndex;
      void this.settleSet(this.state.settle.guildDeltas);
    }
  }

  /* ────────────── 정산 ────────────── */

  private async settleSet(deltas: Record<string, number>): Promise<void> {
    if (this.settling) return;
    this.settling = true;
    try {
      const setId = `${GUILD_WAR_ROOM_ID}:${this.tableRunId}:${this.state.setIndex}`;
      const entries = Object.entries(deltas).map(([guildId, delta]) => ({ guildId, delta }));
      if (entries.length > 0) await this.persistSettle(setId, entries);
      await this.betweenSets();
    } finally {
      this.settling = false;
    }
  }

  /**
   * 세트 델타를 DB 에 쓴다. RPC 가 `set_id` 기준 멱등이므로 재시도해도 이중 지급이 없다 (GW-29).
   * 두 번 다 실패하면 그 세트의 칩 이동이 사라진다 — 조용히 넘기지 않고 크게 남긴다.
   */
  private async persistSettle(
    setId: string,
    entries: Array<{ guildId: string; delta: number }>,
  ): Promise<void> {
    for (let attempt = 1; attempt <= 2; attempt++) {
      try {
        await settleGuildWarSet(setId, entries);
        return;
      } catch (err) {
        const msg = (err as Error).message;
        if (attempt === 1) {
          console.warn(`[guildWarRoom] 세트 정산 1차 실패, 재시도: ${msg}`);
          continue;
        }
        console.error(
          `[guildWarRoom] 세트 정산 최종 실패 set=${setId} entries=${JSON.stringify(entries)}: ${msg}`,
        );
      }
    }
  }

  /**
   * 세트 사이 정리. 정산 직후와 대기 재시도에서 부른다.
   * DB 잔액 반영 → 잔액 0 길드 강퇴 → 다음 세트 타이머.
   */
  private async betweenSets(): Promise<void> {
    if (this.between) return;
    if (isSetRunning(this.state)) return;
    this.between = true;
    try {
      await this.syncBalances();

      // 정산 후 잔액 0이면 다음 판에 앉을 수 없다 → 로비 강퇴 (§6.7·GW-26)
      const { state: next, dropped } = dropBrokeGuilds(this.state);
      this.state = next;
      for (const id of dropped) this.kickToLobby(id, 'no_chips');

      if (!isGuildWarOpen()) {
        this.refreshWindow();
        return;
      }
      // 잔액·좌석이 바뀌었으니 다음 세트 타이머를 다시 잡는다.
      this.state = rearmCountdown(this.state);
      this.broadcastAll();
    } finally {
      this.between = false;
    }
  }

  /** 착석자 길드 잔액을 DB 기준으로 맞춘다. 세트 사이에만 부른다. */
  private async syncBalances(): Promise<void> {
    const ids = [...new Set(this.state.roster.map((p) => p.guildId))];
    if (ids.length === 0) return;
    const balances = await getGuildWarBalances(ids);
    for (const [gid, bal] of balances) this.state = setGuildBalance(this.state, gid, bal);
  }

  /* ────────────── 좌석 · 관전 ────────────── */

  private makePlayer(token: string, nickname: string): Player {
    return {
      id: token,
      nickname,
      isHost: false,
      isReady: true,
      joinedAt: Date.now(),
      memberId: sessions.getMemberId(token) ?? undefined,
      displayedTitle: sessions.getDisplayedTitle(token),
    } as Player;
  }

  private sitBlockText(block: Exclude<RtbSeatBlock, null>): string {
    if (block === 'no_guild') return '길드에 소속되어 있는 유저만 플레이할 수 있습니다.';
    if (block === 'no_chips') return '길드 공유 칩이 없어 앉을 수 없습니다. 길드 상점에서 살 수 있습니다.';
    if (block === 'guild_full') return `같은 길드는 ${RTB_MAX_PER_GUILD}명까지 앉을 수 있습니다.`;
    if (block === 'room_full') return '자리가 모두 찼습니다. 빈자리가 나면 눌러 앉을 수 있습니다.';
    return '지금은 앉을 수 없습니다.';
  }

  /** 다음 세트 시작 직전에 관전 예약을 적용한다. 정산 15초는 건드리지 않는다. */
  private applySpectateReserves(): void {
    for (const token of [...this.spectateReserve]) {
      this.spectateReserve.delete(token);
      if (this.state.roster.some((p) => p.id === token)) this.moveRosterToWatcher(token);
    }
  }

  private moveRosterToWatcher(token: string): void {
    this.spectateReserve.delete(token);
    const seated = this.state.roster.find((p) => p.id === token);
    if (!seated) return;
    this.state = unseatPlayer(this.state, token);
    roomStore.systemRoomRemovePlayer(GUILD_WAR_ROOM_ID, token);
    const memberId = sessions.getMemberId(token);
    this.watchers.set(token, {
      token,
      memberId: memberId ?? '',
      nickname: seated.nickname,
      guildId: seated.guildId,
      seatBlock: null,
    });
    roomStore.systemRoomAddSpectator(GUILD_WAR_ROOM_ID, this.makePlayer(token, seated.nickname));
  }

  private afterRosterChanged(): void {
    this.state = syncWaitAfterRosterChange(this.state);
    this.maybeStart();
    this.broadcastAll();
  }

  /* ────────────── 소켓 진입 ────────────── */

  async join(socket: TypedSocket): Promise<{ success: boolean; error?: string; errorCode?: string }> {
    const member = (socket.data as { member?: { id: string; nickname: string } | null }).member;
    if (!member?.id) {
      return { success: false, error: '로그인이 필요합니다.', errorCode: 'NOT_LOGGED_IN' };
    }
    if (!isGuildWarPeriod()) {
      return { success: false, error: '길드전 기간이 아닙니다.', errorCode: 'GUILD_WAR_OVER' };
    }
    if (!isGuildWarOpen()) {
      return {
        success: false,
        error: '길드전 운영 시간이 아닙니다. (평일 01:00~21:00 / 주말·공휴일 24시간)',
        errorCode: 'GUILD_WAR_CLOSED',
      };
    }
    this.refreshWindow();

    const token = sessions.getToken(socket.id);
    if (!token) return { success: false, error: '세션을 확인할 수 없습니다.', errorCode: 'NO_TOKEN' };
    const nickname = sessions.getNickname(socket.id) ?? member.nickname;

    socket.join(CHANNEL);
    sessions.setRoom(socket.id, GUILD_WAR_ROOM_ID);

    // 이미 들어와 있으면 재동기화만
    if (this.state.roster.some((p) => p.id === token) || this.watchers.has(token)) {
      this.emitRoomState(socket);
      this.emitStateTo(socket, token);
      return { success: true };
    }

    const ctx = await getGuildWarContext(member.id);
    let block: RtbSeatBlock = null;
    if (!ctx) block = 'no_guild';
    else if (ctx.balance < 1) block = 'no_chips';

    this.watchers.set(token, {
      token,
      memberId: member.id,
      nickname,
      guildId: ctx?.guildId ?? null,
      seatBlock: block,
    });
    roomStore.systemRoomAddSpectator(GUILD_WAR_ROOM_ID, this.makePlayer(token, nickname));
    this.emitRoomState(socket);
    this.broadcastAll();
    return { success: true };
  }

  async sit(socket: TypedSocket): Promise<{ success: boolean; error?: string; errorCode?: string }> {
    const token = sessions.getToken(socket.id);
    if (!token) return { success: false, error: '세션을 확인할 수 없습니다.', errorCode: 'NO_TOKEN' };
    if (this.state.roster.some((p) => p.id === token)) return { success: true };
    const w = this.watchers.get(token);
    if (!w) return { success: false, error: '방에 입장한 뒤 앉아 주세요.', errorCode: 'NOT_IN_ROOM' };

    const ctx = await getGuildWarContext(w.memberId);
    if (!ctx) {
      w.seatBlock = 'no_guild';
      this.broadcastAll();
      return { success: false, error: this.sitBlockText('no_guild'), errorCode: 'no_guild' };
    }
    if (ctx.balance < 1) {
      w.seatBlock = 'no_chips';
      w.guildId = ctx.guildId;
      this.broadcastAll();
      return { success: false, error: this.sitBlockText('no_chips'), errorCode: 'no_chips' };
    }
    if (this.state.roster.length >= RTB_MAX_SEATS) {
      return { success: false, error: this.sitBlockText('room_full'), errorCode: 'room_full' };
    }
    if (seatedCountForGuild(this.state, ctx.guildId) >= RTB_MAX_PER_GUILD) {
      return { success: false, error: this.sitBlockText('guild_full'), errorCode: 'guild_full' };
    }

    w.nickname = sessions.getNickname(socket.id) ?? w.nickname;
    this.state = seatPlayer(
      this.state,
      {
        id: token,
        nickname: w.nickname,
        guildId: ctx.guildId,
        guildName: ctx.guildName,
        guildMarkUrl: ctx.guildMarkUrl,
        isBot: false,
      },
      ctx.balance,
    );
    this.state = setGuildBalance(this.state, ctx.guildId, ctx.balance);
    this.watchers.delete(token);
    roomStore.systemRoomRemoveSpectator(GUILD_WAR_ROOM_ID, token);
    roomStore.systemRoomAddPlayer(GUILD_WAR_ROOM_ID, this.makePlayer(token, w.nickname));
    this.afterRosterChanged();
    return { success: true };
  }

  spectate(socket: TypedSocket): { success: boolean; error?: string; reserved?: boolean } {
    const token = sessions.getToken(socket.id);
    if (!token) return { success: false, error: '세션을 확인할 수 없습니다.' };
    if (this.watchers.has(token)) {
      if (this.spectateReserve.delete(token)) this.broadcastAll();
      return { success: true, reserved: false };
    }
    if (!this.state.roster.some((p) => p.id === token)) {
      return { success: false, error: '앉아 있지 않습니다.' };
    }

    const playingThisSet =
      isSetRunning(this.state) && this.state.players.some((p) => p.id === token);
    if (playingThisSet) {
      if (this.spectateReserve.has(token)) {
        this.spectateReserve.delete(token);
        this.broadcastAll();
        return { success: true, reserved: false };
      }
      this.spectateReserve.add(token);
      this.broadcastAll();
      return { success: true, reserved: true };
    }

    if (this.spectateReserve.delete(token)) {
      this.broadcastAll();
      return { success: true, reserved: false };
    }

    this.moveRosterToWatcher(token);
    this.afterRosterChanged();
    return { success: true, reserved: false };
  }

  leave(socket: TypedSocket): void {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    socket.leave(CHANNEL);
    if (sessions.getRoom(socket.id) === GUILD_WAR_ROOM_ID) sessions.clearRoom(socket.id);
    this.forceLeaveByToken(token);
  }

  handleDisconnect(socket: TypedSocket): void {
    this.leave(socket);
  }

  forceLeaveByToken(token: string): void {
    this.actionRate.delete(token);
    this.spectateReserve.delete(token);
    if (this.state.roster.some((p) => p.id === token)) {
      this.state = unseatPlayer(this.state, token);
      roomStore.systemRoomRemovePlayer(GUILD_WAR_ROOM_ID, token);
      this.afterApply();
      if (!isSetRunning(this.state)) this.afterRosterChanged();
      return;
    }
    if (this.watchers.delete(token)) {
      roomStore.systemRoomRemoveSpectator(GUILD_WAR_ROOM_ID, token);
      this.broadcastAll();
    }
  }

  /** 좌석에 앉아 세트를 치는 중인가. disconnect 30초 유예 판단. */
  isSeatedAndInGame(token: string): boolean {
    if (!this.state.players.some((p) => p.id === token)) return false;
    return playingPhase(this.state) && this.state.alive[token] === true;
  }

  hasParticipant(token: string): boolean {
    return this.state.roster.some((p) => p.id === token) || this.watchers.has(token);
  }

  rejoinSocket(socket: TypedSocket, token: string): void {
    if (!this.hasParticipant(token)) return;
    socket.join(CHANNEL);
    sessions.setRoom(socket.id, GUILD_WAR_ROOM_ID);
    this.emitRoomState(socket);
    this.emitStateTo(socket, token);
  }

  /** 소켓당 1초 ACTION_BURST 회. apply 는 상태를 통째로 복제하므로 연타를 그냥 받지 않는다. */
  private allowAction(token: string): boolean {
    const now = Date.now();
    const seen = this.actionRate.get(token);
    if (!seen || now - seen.at >= 1_000) {
      this.actionRate.set(token, { at: now, n: 1 });
      return true;
    }
    if (seen.n >= ACTION_BURST) return false;
    seen.n += 1;
    return true;
  }

  handleAction(socket: TypedSocket, action: RtbAction): void {
    const token = sessions.getToken(socket.id);
    if (!token) return;
    if (!this.state.roster.some((p) => p.id === token)) return;
    // 클라가 보낼 수 있는 행동만 받는다. 세트 시작·리필·공개는 서버만.
    if (
      action.type === 'start_set' ||
      action.type === 'begin_countdown' ||
      action.type === 'refill' ||
      action.type === 'toggle_reveal' ||
      action.type === 'timeout'
    ) {
      return;
    }
    if (!this.allowAction(token)) return;
    const res = apply(this.state, token, action);
    if (!res.ok) {
      socket.emit('error', { message: res.error });
      return;
    }
    this.state = res.state;
    this.afterApply();
  }

  /** 비어 있던 방에 착석이 3이 되는 순간 바로 시작한다 (§5.8). */
  private maybeStart(): void {
    if (this.state.phase !== 'idle') return;
    if (!isGuildWarOpen()) return;
    this.applySpectateReserves();
    if (readySeatCount(this.state) < RTB_MIN_PLAYERS) return;
    this.state = startNextSet(this.state);
    this.processKicks();
  }

  /* ────────────── 브로드캐스트 ────────────── */

  getMeta(): RtbMetaPayload {
    return {
      seated: this.state.roster.length,
      spectatorCount: this.watchers.size,
      isOpen: isGuildWarOpen(),
      isPeriod: isGuildWarPeriod(),
    };
  }

  private buildPayload(token: string): RtbStatePayload {
    const seated = this.state.roster.find((p) => p.id === token);
    const watcher = this.watchers.get(token);
    const role: RtbRole = seated ? 'player' : 'spectator';
    const guildId = seated?.guildId ?? watcher?.guildId ?? null;
    const guild = guildId ? this.state.guilds[guildId] : null;
    return {
      meId: token,
      role,
      seatBlock: seated ? null : (watcher?.seatBlock ?? null),
      state: maskStateFor(this.state, token),
      queuePosition: null,
      queueLength: 0,
      spectatorCount: this.watchers.size,
      // 같은 길드원 지출이 실시간으로 빠진 값. 화면 하단 「길드 공용칩」과 같은 정의여야 한다.
      myGuildChips: seated ? available(this.state, token) : (guild?.balance ?? 0),
      myGuildName: seated?.guildName ?? guild?.name ?? null,
      isOpen: isGuildWarOpen(),
      spectateReserved: this.spectateReserve.has(token),
    };
  }

  private emitStateTo(socket: TypedSocket, token: string): void {
    socket.emit('guildWar:state', this.buildPayload(token));
  }

  private emitRoomState(socket: TypedSocket): void {
    const clientRoom = maskedClientRoomForSocket(GUILD_WAR_ROOM_ID, socket);
    if (clientRoom) socket.emit('room:state', clientRoom);
  }

  private broadcastAll(): void {
    if (!this.io) return;
    void (async () => {
      const sockets = await this.io!.in(CHANNEL).fetchSockets();
      for (const sock of sockets) {
        const token = sessions.getToken(sock.id);
        if (!token) continue;
        sock.emit('guildWar:state', this.buildPayload(token));
        const clientRoom = maskedClientRoomForSocket(
          GUILD_WAR_ROOM_ID,
          sock as unknown as TypedSocket,
        );
        if (clientRoom) sock.emit('room:state', clientRoom);
      }
      this.broadcastMeta();
    })();
  }

  private broadcastMeta(): void {
    if (!this.io) return;
    // 방 안 클라만 쓰는 값이다. 전역으로 쏘면 접속자 전원이 액션마다 받는다.
    this.io.to(CHANNEL).emit('guildWar:meta:changed', this.getMeta());
    // 로비 카드의 인원·관전 수를 같이 갱신한다.
    if (!this.roomLive) return;
    const summary = roomStore.getSummary(GUILD_WAR_ROOM_ID);
    if (summary) this.io.to(LOBBY_ROOM).emit('lobby:room:updated', summary);
  }
}

export const guildWarRoom = new GuildWarRoomManager();
export { GUILD_WAR_ROOM_ID, CHANNEL as GUILD_WAR_CHANNEL };
