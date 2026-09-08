import { supportsSuperAiMatch, SUPER_AI_GAMES } from '@shared/types/game.js';
import {
  nf4AdvisorSnapshot,
  nf4AdvisorWinnerFromResult,
} from '@shared/types/number4.js';
import {
  brpsAdvisorAsk,
  brpsAdvisorSnapshot,
  brpsAdvisorWinnerFromResult,
} from '@shared/types/betting-rps.js';
import {
  mbnwAdvisorAsk,
  mbnwAdvisorSnapshot,
  mbnwAdvisorWinnerFromResult,
} from '@shared/types/multiple-bnw.js';
import type { Player } from '@shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { getGameById } from '../routes/games.js';
import { startGame } from './game.js';
import { socketRoom, emitRoomStateToRoom } from './utils.js';
import type { IO, TypedSocket } from './types.js';
import { parseAdvisorHistory as parseNf4AdvisorHistory } from './games/number4/ai-super.js';
import {
  isNumberFourAdvisorBusy,
  runNumberFourAdvisor,
  terminateNumberFourSuperWorker,
} from './games/number4/super-run.js';
import {
  parseAdvisorHistory as parseBrpsAdvisorHistory,
  parsePending as parseBrpsPending,
} from './games/betting-rps/ai-super.js';
import {
  isBettingRpsAdvisorBusy,
  runBettingRpsAdvisor,
  terminateBettingRpsSuperWorker,
} from './games/betting-rps/super-run.js';
import {
  parseAdvisorHistory as parseMbnwAdvisorHistory,
  parsePending as parseMbnwPending,
} from './games/multiple-bnw/ai-super.js';
import {
  isMultipleBnwAdvisorBusy,
  runMultipleBnwAdvisor,
  terminateMultipleBnwSuperWorker,
} from './games/multiple-bnw/super-run.js';
import { persistBettingRpsAdvisorKifu, persistMultipleBnwAdvisorKifu, persistNumberFourAdvisorKifu } from './superAiPersist.js';

function fallbackName(gameId: string): string {
  return SUPER_AI_GAMES.find((game) => game.id === gameId)?.name ?? gameId;
}

function lookupGameName(gameId: string): string {
  try {
    return getGameById(gameId)?.name ?? fallbackName(gameId);
  } catch {
    return fallbackName(gameId);
  }
}

function buildHostPlayer(socket: TypedSocket): Player | null {
  const nickname = sessions.getNickname(socket.id);
  const token = sessions.getToken(socket.id);
  if (!nickname || !token) return null;
  return {
    id: token,
    nickname,
    isHost: true,
    isReady: true,
    joinedAt: Date.now(),
    memberId: sessions.getMemberId(token),
    displayedTitle: sessions.getDisplayedTitle(token),
    equippedSkins: sessions.getEquippedSkins(token),
  };
}

export function createSuperAiMatch(
  io: IO,
  socket: TypedSocket,
  gameId: string,
): { ok: true; roomId: string } | { ok: false; error: string } {
  const member = (socket.data as { member?: { id: string } }).member;
  if (!member?.id) {
    return { ok: false, error: '로그인이 필요합니다.' };
  }

  if (!supportsSuperAiMatch(gameId)) {
    return { ok: false, error: '슈퍼 AI 대국은 지금은 사중력 사목과 양면장기만 있습니다.' };
  }

  const host = buildHostPlayer(socket);
  if (!host) {
    return { ok: false, error: '소켓 세션이 아직 준비되지 않았습니다. 잠시 후 다시 시도하세요.' };
  }

  if (sessions.getRoom(socket.id) || roomStore.findByMemberId(member.id)) {
    return { ok: false, error: '이미 다른 방에 있습니다. 나온 뒤 다시 시작하세요.' };
  }

  const gameName = lookupGameName(gameId);
  const room = roomStore.create({
    title: `슈퍼 AI · ${gameName}`,
    gameId,
    gameName,
    playMode: 'solo',
    roomType: 'private',
    maxPlayers: 1,
    minPlayers: 1,
    timeLimitSeconds: null,
    gameOptions: { superAi: true },
    turnOrderMode: 'fixed',
    host,
    isRanked: false,
    spectatorAllowed: false,
  });

  socket.join(socketRoom(room.id));
  sessions.setRoom(socket.id, room.id);
  emitRoomStateToRoom(io, room.id);
  startGame(io, room.id);
  console.log(`[superAi] room=${room.id} game=${gameId}`);

  return { ok: true, roomId: room.id };
}

export function registerSuperAiHandlers(io: IO, socket: TypedSocket): void {
  socket.on('superAi:start', (data, callback) => {
    if (typeof callback !== 'function') return;
    const gameId = typeof data?.gameId === 'string' ? data.gameId : '';
    const result = createSuperAiMatch(io, socket, gameId);
    if (!result.ok) {
      callback({ success: false, error: result.error });
      return;
    }
    callback({ success: true, roomId: result.roomId });
  });

  socket.on('superAi:number4:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    const history = parseNf4AdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = nf4AdvisorSnapshot(history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (isNumberFourAdvisorBusy(socket.id) || isBettingRpsAdvisorBusy(socket.id) || isMultipleBnwAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runNumberFourAdvisor(socket.id, history).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        white: pick.white,
        black: pick.black,
        number: pick.number,
        worlds: pick.worlds,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:number4:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    const history = parseNf4AdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = nf4AdvisorSnapshot(history);
    const winner = nf4AdvisorWinnerFromResult(
      snap.result,
      data?.winner === 'me' || data?.winner === 'opp' ? data.winner : null,
    );
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistNumberFourAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      history,
      winner,
      result: snap.result,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[NF4 advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:bettingRps:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '선공을 먼저 고르세요.' });
      return;
    }
    const history = parseBrpsAdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const pending = parseBrpsPending(data?.pending);
    const snap = brpsAdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = brpsAdvisorAsk(data.iAmFirst, history, pending);
    if (ask === 'need-opp-role') {
      callback({ success: false, error: '상대가 고른 역할을 먼저 넣으세요.' });
      return;
    }
    if (ask === 'finished') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (isBettingRpsAdvisorBusy(socket.id) || isNumberFourAdvisorBusy(socket.id) || isMultipleBnwAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runBettingRpsAdvisor(socket.id, data.iAmFirst, history, pending).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        kind: pick.kind,
        role: pick.kind === 'role' ? pick.role : undefined,
        result: pick.kind === 'match' ? pick.result : undefined,
        prediction: pick.kind === 'bet' ? pick.prediction : undefined,
        chips: pick.kind === 'bet' ? pick.chips : undefined,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:bettingRps:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '선공을 먼저 고르세요.' });
      return;
    }
    const history = parseBrpsAdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = brpsAdvisorSnapshot(data.iAmFirst, history);
    const winner = brpsAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistBettingRpsAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[BRPS advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:multipleBnw:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '선플을 먼저 고르세요.' });
      return;
    }
    const history = parseMbnwAdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const pending = parseMbnwPending(data?.pending);
    const snap = mbnwAdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = mbnwAdvisorAsk(data.iAmFirst, history, pending);
    if (ask === 'need-opp-color') {
      callback({ success: false, error: '상대 타일 색을 먼저 넣으세요.' });
      return;
    }
    if (ask === 'need-first-suspect') {
      callback({ success: false, error: '선플 의심 결과를 먼저 넣으세요.' });
      return;
    }
    if (ask === 'finished') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (
      isBettingRpsAdvisorBusy(socket.id)
      || isNumberFourAdvisorBusy(socket.id)
      || isMultipleBnwAdvisorBusy(socket.id)
    ) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runMultipleBnwAdvisor(socket.id, data.iAmFirst, history, pending).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        kind: pick.kind,
        tile: pick.kind === 'tile' ? pick.tile : undefined,
        suspect: pick.kind === 'suspect' ? pick.suspect : undefined,
        worlds: pick.worlds,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:multipleBnw:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '선플을 먼저 고르세요.' });
      return;
    }
    const history = parseMbnwAdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = mbnwAdvisorSnapshot(data.iAmFirst, history);
    const winner = mbnwAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistMultipleBnwAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[MBNW advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('disconnect', () => {
    terminateNumberFourSuperWorker(socket.id);
    terminateBettingRpsSuperWorker(socket.id);
    terminateMultipleBnwSuperWorker(socket.id);
  });
}
