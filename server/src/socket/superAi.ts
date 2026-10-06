import { supportsSuperAiMatch, SUPER_AI_GAMES } from '@shared/types/game.js';
import {
  nf4AdvisorSnapshot,
  nf4AdvisorWinnerFromResult,
} from '@shared/numberFourAdvisor.js';
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
import {
  parseAdvisorHistory as parseWsAdvisorHistory,
} from './games/winning-streak/ai-super.js';
import {
  isWinningStreakAdvisorBusy,
  runWinningStreakAdvisor,
  terminateWinningStreakSuperWorker,
} from './games/winning-streak/super-run.js';
import {
  parseAdvisorHistory as parseBnw2AdvisorHistory,
  parsePending as parseBnw2Pending,
} from './games/bnw2/ai-super.js';
import {
  isBnw2AdvisorBusy,
  runBnw2Advisor,
  terminateBnw2SuperWorker,
} from './games/bnw2/super-run.js';
import {
  parseAdvisorHistory as parseSbnwAdvisorHistory,
  parsePending as parseSbnwPending,
} from './games/silper-bnw/ai-super.js';
import {
  isSilperBnwAdvisorBusy,
  runSilperBnwAdvisor,
  terminateSilperBnwSuperWorker,
} from './games/silper-bnw/super-run.js';
import { parseAdvisorHistory as parseFtAdvisorHistory } from './games/five-towers/ai-super.js';
import {
  isFiveTowersAdvisorBusy,
  runFiveTowersAdvisor,
  terminateFiveTowersSuperWorker,
} from './games/five-towers/super-run.js';
import { parseAdvisorHistory as parseGs2AdvisorHistory } from './games/grape-sugar-2/ai-super.js';
import {
  isGrapeSugar2AdvisorBusy,
  runGrapeSugar2Advisor,
  terminateGrapeSugar2SuperWorker,
} from './games/grape-sugar-2/super-run.js';
import {
  parseAdvisorHistory as parseSms2AdvisorHistory,
  parsePending as parseSms2Pending,
} from './games/sun-moon-star-2/ai-super.js';
import {
  isSunMoonStar2AdvisorBusy,
  runSunMoonStar2Advisor,
  terminateSunMoonStar2SuperWorker,
} from './games/sun-moon-star-2/super-run.js';
import {
  parseAdvisorHistory as parseBankAdvisorHistory,
  parsePending as parseBankPending,
} from './games/bank-game/ai-super.js';
import {
  isBankGameAdvisorBusy,
  runBankGameAdvisor,
  terminateBankGameSuperWorker,
} from './games/bank-game/super-run.js';
import { parseAdvisorHistory as parseQuatroAdvisorHistory } from './games/quatro/ai-super.js';
import {
  isQuatroAdvisorBusy,
  runQuatroAdvisor,
  terminateQuatroSuperWorker,
} from './games/quatro/super-run.js';
import { persistBankGameAdvisorKifu, persistBettingRpsAdvisorKifu, persistBnw2AdvisorKifu, persistFiveTowersAdvisorKifu, persistGrapeSugar2AdvisorKifu, persistMultipleBnwAdvisorKifu, persistNumberFourAdvisorKifu, persistQuatroAdvisorKifu, persistSilperBnwAdvisorKifu, persistSunMoonStar2AdvisorKifu, persistWinningStreakAdvisorKifu } from './superAiPersist.js';
import {
  wsAdvisorSnapshot,
  wsAdvisorWinnerFromResult,
} from '@shared/types/winning-streak.js';
import {
  bnw2AdvisorAsk,
  bnw2AdvisorSnapshot,
  bnw2AdvisorWinnerFromResult,
} from '@shared/types/bnw2.js';
import {
  sbnwAdvisorAsk,
  sbnwAdvisorSnapshot,
  sbnwAdvisorWinnerFromResult,
} from '@shared/types/silper-bnw.js';
import {
  ftAdvisorAsk,
  ftAdvisorSnapshot,
  ftAdvisorWinnerFromResult,
} from '@shared/types/five-towers.js';
import {
  gs2AdvisorAsk,
  gs2AdvisorSnapshot,
  gs2AdvisorWinnerFromResult,
} from '@shared/types/grape-sugar-2-advisor.js';
import {
  sms2AdvisorAsk,
  sms2AdvisorSnapshot,
  sms2AdvisorWinnerFromResult,
} from '@shared/types/sun-moon-star-2-advisor.js';
import {
  bankAdvisorAsk,
  bankAdvisorSnapshot,
  bankAdvisorWinnerFromResult,
} from '@shared/types/bank-game-advisor.js';
import {
  quatroAdvisorAsk,
  quatroAdvisorSnapshot,
  quatroAdvisorWinnerFromResult,
} from '@shared/types/quatro-advisor.js';

function anyAdvisorBusy(socketId: string): boolean {
  return (
    isNumberFourAdvisorBusy(socketId)
    || isBettingRpsAdvisorBusy(socketId)
    || isMultipleBnwAdvisorBusy(socketId)
    || isWinningStreakAdvisorBusy(socketId)
    || isBnw2AdvisorBusy(socketId)
    || isSilperBnwAdvisorBusy(socketId)
    || isFiveTowersAdvisorBusy(socketId)
    || isGrapeSugar2AdvisorBusy(socketId)
    || isSunMoonStar2AdvisorBusy(socketId)
    || isBankGameAdvisorBusy(socketId)
    || isQuatroAdvisorBusy(socketId)
  );
}

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
    if (anyAdvisorBusy(socket.id)) {
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
    if (anyAdvisorBusy(socket.id)) {
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
    if (anyAdvisorBusy(socket.id)) {
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

  socket.on('superAi:winningStreak:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    const history = parseWsAdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = wsAdvisorSnapshot(history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runWinningStreakAdvisor(socket.id, history).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        card: pick.card,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:winningStreak:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    const history = parseWsAdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = wsAdvisorSnapshot(history);
    const winner = wsAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistWinningStreakAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[WS advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:bnw2:recommend', (data, callback) => {
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
    const history = parseBnw2AdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const pending = parseBnw2Pending(data?.pending);
    const snap = bnw2AdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = bnw2AdvisorAsk(data.iAmFirst, history, pending);
    if (ask === 'need-first-color') {
      callback({ success: false, error: '선플 색과 제시 후 단계를 먼저 넣으세요.' });
      return;
    }
    if (ask === 'finished') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runBnw2Advisor(socket.id, data.iAmFirst, history, pending).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        points: pick.points,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:bnw2:save', (data, callback) => {
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
    const history = parseBnw2AdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = bnw2AdvisorSnapshot(data.iAmFirst, history);
    const winner = bnw2AdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistBnw2AdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[BNW2 advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:silperBnw:recommend', (data, callback) => {
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
    const history = parseSbnwAdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const pending = parseSbnwPending(data?.pending);
    const snap = sbnwAdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = sbnwAdvisorAsk(data.iAmFirst, history, pending);
    if (ask === 'need-first-digits') {
      callback({ success: false, error: '선플 자릿수를 먼저 넣으세요.' });
      return;
    }
    if (ask === 'finished') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runSilperBnwAdvisor(socket.id, data.iAmFirst, history, pending).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        tiles: pick.tiles,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:silperBnw:save', (data, callback) => {
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
    const history = parseSbnwAdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = sbnwAdvisorSnapshot(data.iAmFirst, history);
    const winner = sbnwAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistSilperBnwAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[SBNW advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:fiveTowers:recommend', (data, callback) => {
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
    const history = parseFtAdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '수순이 올바르지 않습니다.' });
      return;
    }
    const snap = ftAdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = ftAdvisorAsk(data.iAmFirst, history);
    if (ask !== 'my-turn') {
      callback({ success: false, error: '내 차례가 아닙니다. 상대 공개 수를 먼저 넣으세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runFiveTowersAdvisor(socket.id, data.iAmFirst, history).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        action: pick.action,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:fiveTowers:save', (data, callback) => {
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
    const history = parseFtAdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '수순이 올바르지 않습니다.' });
      return;
    }
    const snap = ftAdvisorSnapshot(data.iAmFirst, history);
    const winner = ftAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistFiveTowersAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[FT advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:grapeSugar2:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    const history = parseGs2AdvisorHistory(data?.history);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = gs2AdvisorSnapshot(history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (gs2AdvisorAsk(history) !== 'submit') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runGrapeSugar2Advisor(socket.id, history).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({
        success: true,
        card: pick.card,
        sugar: pick.sugar,
        winRate: pick.winRate,
      });
    });
  });

  socket.on('superAi:grapeSugar2:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    const history = parseGs2AdvisorHistory(data?.history);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = gs2AdvisorSnapshot(history);
    const winner = gs2AdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistGrapeSugar2AdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[GS2 advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:sunMoonStar2:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '1라운드 선을 먼저 고르세요.' });
      return;
    }
    const history = parseSms2AdvisorHistory(data?.history, data.iAmFirst);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const pending = parseSms2Pending(data?.pending);
    if (!pending) {
      callback({ success: false, error: '진행 중인 수가 올바르지 않습니다.' });
      return;
    }
    const snap = sms2AdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = sms2AdvisorAsk(data.iAmFirst, history, pending);
    if (ask !== 'powder' && ask !== 'betFirst' && ask !== 'betSecond') {
      callback({ success: false, error: '지금은 수를 받을 차례가 아닙니다. 공개된 값을 먼저 넣으세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runSunMoonStar2Advisor(socket.id, data.iAmFirst, history, pending).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      if (pick.kind === 'powder') {
        callback({ success: true, kind: 'powder', powder: pick.powder, winRate: pick.winRate });
        return;
      }
      callback({ success: true, kind: 'bet', bet: pick.bet, winRate: pick.winRate });
    });
  });

  socket.on('superAi:sunMoonStar2:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '1라운드 선을 먼저 고르세요.' });
      return;
    }
    const history = parseSms2AdvisorHistory(data?.history, data.iAmFirst);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = sms2AdvisorSnapshot(data.iAmFirst, history);
    const winner = sms2AdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistSunMoonStar2AdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[SMS2 advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:bankGame:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '1라운드 선을 먼저 고르세요.' });
      return;
    }
    const history = parseBankAdvisorHistory(data?.history, data.iAmFirst);
    if (!history) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const pending = parseBankPending(data?.pending);
    if (!pending) {
      callback({ success: false, error: '진행 중인 수가 올바르지 않습니다.' });
      return;
    }
    const snap = bankAdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = bankAdvisorAsk(data.iAmFirst, history, pending);
    if (ask !== 'betFirst' && ask !== 'betSecond') {
      callback({ success: false, error: '지금은 수를 받을 차례가 아닙니다. 공개된 값을 먼저 넣으세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runBankGameAdvisor(socket.id, data.iAmFirst, history, pending).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({ success: true, bet: pick.bet, winRate: pick.winRate });
    });
  });

  socket.on('superAi:quatro:recommend', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '1라운드 선을 먼저 고르세요.' });
      return;
    }
    const history = parseQuatroAdvisorHistory(data?.history, data.iAmFirst);
    if (!history) {
      callback({ success: false, error: '수순 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = quatroAdvisorSnapshot(data.iAmFirst, history);
    if (snap.result.kind !== 'playing') {
      callback({ success: false, error: '이미 끝난 판입니다. 결과를 확인하세요.' });
      return;
    }
    const ask = quatroAdvisorAsk(data.iAmFirst, history);
    if (ask !== 'mulligan' && ask !== 'open' && ask !== 'exchange') {
      callback({ success: false, error: '지금은 수를 받을 차례가 아닙니다. 공개된 값을 먼저 넣으세요.' });
      return;
    }
    if (anyAdvisorBusy(socket.id)) {
      callback({ success: false, error: '이미 수를 계산하는 중입니다.' });
      return;
    }

    void runQuatroAdvisor(socket.id, data.iAmFirst, history).then((pick) => {
      if (!pick) {
        callback({ success: false, error: '수를 고르지 못했습니다. 잠시 후 다시 시도하세요.' });
        return;
      }
      callback({ success: true, action: pick.action, winRate: pick.winRate });
    });
  });

  socket.on('superAi:quatro:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '1라운드 선을 먼저 고르세요.' });
      return;
    }
    const history = parseQuatroAdvisorHistory(data?.history, data.iAmFirst);
    if (!history || history.length === 0) {
      callback({ success: false, error: '수순 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = quatroAdvisorSnapshot(data.iAmFirst, history);
    const winner = quatroAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistQuatroAdvisorKifu({
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
        console.error('[QUATRO advisor save]', err);
        callback({
          success: false,
          error: err instanceof Error ? err.message : '기보를 저장하지 못했습니다.',
        });
      });
  });

  socket.on('superAi:bankGame:save', (data, callback) => {
    if (typeof callback !== 'function') return;
    const member = (socket.data as { member?: { id: string; nickname: string } }).member;
    if (!member?.id) {
      callback({ success: false, error: '로그인이 필요합니다.' });
      return;
    }
    if (typeof data?.iAmFirst !== 'boolean') {
      callback({ success: false, error: '1라운드 선을 먼저 고르세요.' });
      return;
    }
    const history = parseBankAdvisorHistory(data?.history, data.iAmFirst);
    if (!history || history.length === 0) {
      callback({ success: false, error: '라운드 기록이 올바르지 않습니다.' });
      return;
    }
    const snap = bankAdvisorSnapshot(data.iAmFirst, history);
    const winner = bankAdvisorWinnerFromResult(snap.result);
    if (!winner) {
      callback({ success: false, error: '아직 끝나지 않은 판입니다.' });
      return;
    }

    void persistBankGameAdvisorKifu({
      memberId: member.id,
      nickname: member.nickname,
      iAmFirst: data.iAmFirst,
      history,
      result: snap.result,
      winType: snap.winType,
    })
      .then((id) => {
        if (!id) {
          callback({ success: false, error: '기보를 저장하지 못했습니다.' });
          return;
        }
        callback({ success: true, id });
      })
      .catch((err: unknown) => {
        console.error('[BANK advisor save]', err);
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
    terminateWinningStreakSuperWorker(socket.id);
    terminateBnw2SuperWorker(socket.id);
    terminateSilperBnwSuperWorker(socket.id);
    terminateFiveTowersSuperWorker(socket.id);
    terminateGrapeSugar2SuperWorker(socket.id);
    terminateSunMoonStar2SuperWorker(socket.id);
    terminateBankGameSuperWorker(socket.id);
    terminateQuatroSuperWorker(socket.id);
  });
}
