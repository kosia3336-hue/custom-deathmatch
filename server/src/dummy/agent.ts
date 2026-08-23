import { GAME_IDS } from '@shared/types/game.js';
import type { DummyAiTier } from '@shared/dummy.js';
import { isDummyPlayerId } from '@shared/dummy.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import type { IO } from '../socket/types.js';
import {
  handleBanPickBan,
  handleBanPickReady,
  handleBanPickUnbanSkip,
  getBanPickDummyView,
} from '../socket/games/ban-pick/index.js';
import {
  handleFourGravityAction,
  getFourGravityDummyView,
} from '../socket/games/four-gravity/index.js';
import {
  handleDoubleSidedChessAction,
  getDoubleSidedChessDummyView,
} from '../socket/games/double-sided-chess/index.js';
import {
  handleNumberFourAction,
  getNumberFourDummyView,
} from '../socket/games/number4/index.js';
import {
  handleIndianPokerAction,
  getIndianPokerDummyView,
} from '../socket/games/indian-poker/index.js';
import {
  handleInvestDonateAction,
  getInvestDonateDummyView,
} from '../socket/games/invest-donate/index.js';
import {
  handleBettingRpsAction,
  getBettingRpsDummyView,
} from '../socket/games/betting-rps/index.js';
import {
  handleMultipleBnwAction,
  getMultipleBnwDummyView,
} from '../socket/games/multiple-bnw/index.js';
import {
  handleWinningStreakAction,
  getWinningStreakDummyView,
} from '../socket/games/winning-streak/index.js';
import {
  handleBNW2Action,
  getBnw2DummyView,
} from '../socket/games/bnw2/index.js';
import {
  handleSilperBnwAction,
  getSilperBnwDummyView,
} from '../socket/games/silper-bnw/index.js';
import {
  handleFiveTowersAction,
  getFiveTowersDummyView,
} from '../socket/games/five-towers/index.js';
import {
  handleGrapeSugar2Action,
  getGrapeSugar2DummyView,
} from '../socket/games/grape-sugar-2/index.js';
import {
  handleSunMoonStar2Action,
  getSunMoonStar2DummyView,
} from '../socket/games/sun-moon-star-2/index.js';
import {
  handleBankGameAction,
  getBankGameDummyView,
} from '../socket/games/bank-game/index.js';
import {
  handleQuatroAction,
  getQuatroDummyView,
} from '../socket/games/quatro/index.js';
import { abortPlayingGame, clearAutoEnd, clearGameStartTime } from '../socket/game.js';
import { broadcastRoomRemoved } from '../socket/lobby.js';
import { cleanupRoomShopState } from '../shop/roomShopState.js';
import { clearActiveSkin } from '../socket/skins.js';
import { clearRoomStartCountdown } from '../socket/roomCountdown.js';
import { pickBan, thinkDelayMs } from './banpick.js';
import {
  boardGameThinkMs,
  boardGameFollowUpMs,
  psychologyThinkMs,
  indianPokerThinkMs,
  shortPsychologyThinkMs,
  hopelessThinkMs,
  quatroQuickThinkMs,
  capThinkToTurnLimit,
  turnTimeExpired,
} from './thinkTime.js';
import { getDummyRecords, recordDummyResult, forgetDummyRecords } from './records.js';
import { makeDummySocket } from './fakeSocket.js';
import { isDummyGameImplemented } from './ai/index.js';
import { pickFourGravityAction } from './ai/four-gravity.js';
import { pickDoubleSidedChessActionAsync } from './ai/double-sided-chess.js';
import { pickNumberFourActionAsync } from './ai/number4.js';
import { pickIndianPokerActionAsync } from './ai/indian-poker.js';
import { pickInvestDonateActionAsync } from './ai/invest-donate.js';
import { pickBettingRpsActionAsync } from './ai/betting-rps.js';
import { pickMultipleBnwActionAsync } from './ai/multiple-bnw.js';
import { pickWinningStreakActionAsync, isWinningStreakHopeless } from './ai/winning-streak.js';
import { pickBnw2ActionAsync } from './ai/bnw2.js';
import { pickSilperBnwActionAsync, isSilperBnwScoreDecided } from './ai/silper-bnw.js';
import { pickFiveTowersActionAsync, justUsedInfoThisTurn } from './ai/five-towers.js';
import { pickGrapeSugar2ActionAsync } from './ai/grape-sugar-2.js';
import { pickSunMoonStar2ActionAsync } from './ai/sun-moon-star-2.js';
import { pickBankGameActionAsync } from './ai/bank-game.js';
import { pickQuatroActionAsync } from './ai/quatro.js';
import type { AIMove } from '../socket/games/four-gravity/types.js';

interface AgentCtx {
  dummyId: string;
  tier: DummyAiTier;
  /** 있으면 그 게임만 기본 등급을 덮어씀. 운영 타이탄 사목 하 등. */
  tierForGame?: (gameId: string) => DummyAiTier;
  timer: ReturnType<typeof setInterval>;
  busy: boolean;
  pendingFg: AIMove | null;
  skipStarted: boolean;
  recorded: boolean;
  keepSession: boolean;
  endedNotified: boolean;
  onGameOver?: () => void;
}

function effectiveTier(ctx: AgentCtx, gameId: string): DummyAiTier {
  return ctx.tierForGame?.(gameId) ?? ctx.tier;
}

const agents = new Map<string, AgentCtx>();

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function stopDummyAgent(roomId: string): void {
  const ctx = agents.get(roomId);
  if (!ctx) return;
  clearInterval(ctx.timer);
  agents.delete(roomId);
  forgetDummyRecords(ctx.dummyId);
  if (!ctx.keepSession) {
    sessions.removeSession(ctx.dummyId);
  }
}

export function startDummyAgent(
  io: IO,
  roomId: string,
  dummyId: string,
  tier: DummyAiTier,
  opts?: {
    keepSession?: boolean;
    onGameOver?: () => void;
    tierForGame?: (gameId: string) => DummyAiTier;
  },
): void {
  const prev = agents.get(roomId);
  if (prev) {
    clearInterval(prev.timer);
    agents.delete(roomId);
  }
  const sock = makeDummySocket(dummyId);
  const ctx: AgentCtx = {
    dummyId,
    tier,
    tierForGame: opts?.tierForGame,
    busy: false,
    pendingFg: null,
    skipStarted: false,
    recorded: false,
    keepSession: opts?.keepSession === true,
    endedNotified: false,
    onGameOver: opts?.onGameOver,
    timer: setInterval(() => {
      void tick(io, roomId, ctx, sock);
    }, 400),
  };
  agents.set(roomId, ctx);
}

async function tick(io: IO, roomId: string, ctx: AgentCtx, sock: ReturnType<typeof makeDummySocket>): Promise<void> {
  if (ctx.busy) return;
  if (!agents.has(roomId)) return;

  const room = roomStore.get(roomId);
  if (!room) {
    if (ctx.keepSession && !ctx.endedNotified) {
      ctx.endedNotified = true;
      ctx.onGameOver?.();
    }
    stopDummyAgent(roomId);
    return;
  }
  if (room.status === 'finished') {
    if (ctx.keepSession && !ctx.endedNotified) {
      ctx.endedNotified = true;
      ctx.onGameOver?.();
    }
    stopDummyAgent(roomId);
    return;
  }
  if (room.status !== 'playing') return;

  ctx.busy = true;
  try {
    if (room.gameId === GAME_IDS.BAN_PICK) {
      await actBanPick(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.FOUR_GRAVITY) {
      await actFourGravity(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.DOUBLE_SIDED_CHESS) {
      await actDoubleSidedChess(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.NUMBER_FOUR) {
      await actNumberFour(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.INDIAN_POKER) {
      await actIndianPoker(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.INVEST_DONATE) {
      await actInvestDonate(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.BETTING_RPS) {
      await actBettingRps(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.MULTIPLE_BNW) {
      await actMultipleBnw(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.WINNING_STREAK) {
      await actWinningStreak(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.BNW2) {
      await actBnw2(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.SILPER_BNW) {
      await actSilperBnw(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.FIVE_TOWERS) {
      await actFiveTowers(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.GRAPE_SUGAR_2) {
      await actGrapeSugar2(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.SUN_MOON_STAR_2) {
      await actSunMoonStar2(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.BANK_GAME) {
      await actBankGame(io, roomId, ctx, sock);
      return;
    }
    if (room.gameId === GAME_IDS.QUATRO) {
      await actQuatro(io, roomId, ctx, sock);
      return;
    }
    if (!isDummyGameImplemented(room.gameId) && !ctx.skipStarted) {
      ctx.skipStarted = true;
      await sleep(1500);
      if (!agents.has(roomId)) return;
      const still = roomStore.get(roomId);
      if (!still || still.status !== 'playing') return;
      const rankings = still.players.map((p) => ({
        playerId: p.id,
        nickname: p.nickname,
        rank: 1,
        score: 0,
      }));
      abortPlayingGame(io, roomId, {
        rankings,
        totalTurns: 0,
        gameResultData: { dummySkip: true, reason: 'unimplemented', gameId: still.gameId },
      });
    }
  } catch (err) {
    console.warn('[dummyAgent]', roomId, room.gameId, (err as Error).message);
  } finally {
    ctx.busy = false;
  }
}

async function actBanPick(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getBanPickDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.myBanTurn) {
    await sleep(thinkDelayMs(ctx.tier, 'ban'));
    if (!agents.has(roomId)) return;
    const again = getBanPickDummyView(roomId, ctx.dummyId);
    if (!again?.myBanTurn) return;
    const banned = new Set(again.bannedGameIds);
    const pool = again.availableGameIds.filter((id) => !banned.has(id));
    const gameId = pickBan(pool, getDummyRecords(ctx.dummyId));
    if (!gameId) return;
    handleBanPickBan(io, sock, roomId, gameId);
    return;
  }

  if (view.myUnbanTurn) {
    await sleep(thinkDelayMs(ctx.tier, 'short'));
    if (!agents.has(roomId)) return;
    handleBanPickUnbanSkip(sock, roomId, io);
    return;
  }

  if (view.lotteryReady) {
    await sleep(thinkDelayMs(ctx.tier, 'short'));
    if (!agents.has(roomId)) return;
    handleBanPickReady(io, roomId, ctx.dummyId);
  }
}

async function actFourGravity(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getFourGravityDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.data.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.FOUR_GRAVITY, 'win');
      } else if (view.data.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.FOUR_GRAVITY, 'loss');
      }
    }
    return;
  }

  const picked = pickFourGravityAction(
    view,
    ctx.dummyId,
    effectiveTier(ctx, GAME_IDS.FOUR_GRAVITY),
    ctx.pendingFg,
  );
  if (!picked) {
    ctx.pendingFg = null;
    return;
  }

  const waitMs = picked.action.type === 'place'
    ? capThinkToTurnLimit(
      boardGameThinkMs(view.turnNumber),
      view.turnStartedAt,
      view.timeLimitSeconds,
    )
    : boardGameFollowUpMs();
  if (waitMs > 0) await sleep(waitMs);
  if (!agents.has(roomId)) return;

  const latest = getFourGravityDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver || latest.data.currentPlayer !== ctx.dummyId) return;
  if (latest.data.phase !== picked.action.type) return;

  ctx.pendingFg = picked.pending;
  handleFourGravityAction(io, sock, roomId, picked.action as unknown as Record<string, unknown>);
}

async function actDoubleSidedChess(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getDoubleSidedChessDummyView(roomId, ctx.dummyId);
  if (!view) {
    console.warn('[dummy:dsc] no view', roomId);
    return;
  }

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.data.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.DOUBLE_SIDED_CHESS, 'win');
      } else if (view.data.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.DOUBLE_SIDED_CHESS, 'loss');
      }
    }
    return;
  }

  if (view.data.currentPlayer !== ctx.dummyId) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  // 사고 시간은 sleep. 탐색은 워커(중·상)라 그동안 턴 타임아웃이 살아 있다.
  const waitMs = capThinkToTurnLimit(
    boardGameThinkMs(view.turnNumber),
    view.turnStartedAt,
    view.timeLimitSeconds,
    3000,
  );
  if (waitMs > 0) await sleep(waitMs);
  if (!agents.has(roomId)) return;

  const latest = getDoubleSidedChessDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver || latest.data.currentPlayer !== ctx.dummyId) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;

  const action = await pickDoubleSidedChessActionAsync(latest, ctx.dummyId, ctx.tier, roomId);
  if (!agents.has(roomId)) return;

  const after = getDoubleSidedChessDummyView(roomId, ctx.dummyId);
  if (!after || after.gameOver || after.data.currentPlayer !== ctx.dummyId) return;
  if (turnTimeExpired(after.turnStartedAt, after.timeLimitSeconds)) return;

  if (!action) {
    console.warn(
      '[dummy:dsc] pick null',
      `turn=${latest.turnNumber}`,
      `player=${latest.data.currentPlayer.slice(0, 20)}`,
      `dummy=${ctx.dummyId.slice(0, 20)}`,
      `owner=${latest.data.currentOwner}`,
    );
    return;
  }

  handleDoubleSidedChessAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actNumberFour(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getNumberFourDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.NUMBER_FOUR, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.NUMBER_FOUR, 'loss');
      }
    }
    return;
  }

  if (view.phase !== 'submit' || view.my.submitted) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  // 심리 공통: 5~90초는 sleep 이 아니라 탐색 예산
  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickNumberFourActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getNumberFourDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver || latest.phase !== 'submit' || latest.my.submitted) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  handleNumberFourAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actIndianPoker(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getIndianPokerDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.INDIAN_POKER, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.INDIAN_POKER, 'loss');
      }
    }
    return;
  }

  if (view.phase !== 'betting' || view.currentTurnId !== ctx.dummyId) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    indianPokerThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickIndianPokerActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getIndianPokerDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver || latest.phase !== 'betting') return;
  if (latest.currentTurnId !== ctx.dummyId) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  handleIndianPokerAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actInvestDonate(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getInvestDonateDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.INVEST_DONATE, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.INVEST_DONATE, 'loss');
      }
    }
    return;
  }

  if (view.phase !== 'submit' || view.my.submitted) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickInvestDonateActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getInvestDonateDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver || latest.phase !== 'submit' || latest.my.submitted) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  handleInvestDonateAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actBettingRps(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getBettingRpsDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.BETTING_RPS, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.BETTING_RPS, 'loss');
      }
    }
    return;
  }

  const myTurn =
    (view.phase === 'roleSelect' && view.my.hasChoiceRight)
    || (view.phase === 'submit' && !!view.my.role && !view.my.submitted);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickBettingRpsActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getBettingRpsDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;

  if (latest.phase === 'roleSelect') {
    if (!latest.my.hasChoiceRight || !action || action.type !== 'selectRole') return;
  } else if (latest.phase === 'submit') {
    if (latest.my.submitted || !action) return;
    if (action.type !== 'submitMatch' && action.type !== 'submitBet') return;
  } else {
    return;
  }

  handleBettingRpsAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actMultipleBnw(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getMultipleBnwDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.MULTIPLE_BNW, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.MULTIPLE_BNW, 'loss');
      }
    }
    return;
  }

  const myTurn =
    (view.phase === 'tileSubmit' && view.my.isFirst && !view.my.submitted)
    || (view.phase === 'tileRespond' && !view.my.isFirst && !view.my.submitted)
    || (view.phase === 'suspectFirst' && view.my.isFirst)
    || (view.phase === 'suspectSecond' && !view.my.isFirst);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const isSuspect =
    view.phase === 'suspectFirst' || view.phase === 'suspectSecond';
  const budgetMs = capThinkToTurnLimit(
    isSuspect ? shortPsychologyThinkMs() : psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickMultipleBnwActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getMultipleBnwDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  if (latest.phase === 'tileSubmit') {
    if (!latest.my.isFirst || latest.my.submitted || action.type !== 'submitTile') return;
  } else if (latest.phase === 'tileRespond') {
    if (latest.my.isFirst || latest.my.submitted || action.type !== 'respondTile') return;
  } else if (latest.phase === 'suspectFirst') {
    if (!latest.my.isFirst || action.type !== 'suspectFirst') return;
  } else if (latest.phase === 'suspectSecond') {
    if (latest.my.isFirst || action.type !== 'suspectSecond') return;
  } else {
    return;
  }

  handleMultipleBnwAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actWinningStreak(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getWinningStreakDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.WINNING_STREAK, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.WINNING_STREAK, 'loss');
      }
    }
    return;
  }

  if (view.phase !== 'cardSelect' || view.my.submitted) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    isWinningStreakHopeless(view) ? hopelessThinkMs() : psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickWinningStreakActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getWinningStreakDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver || latest.phase !== 'cardSelect' || latest.my.submitted) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action || action.type !== 'selectCard') return;

  handleWinningStreakAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actBnw2(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getBnw2DummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.BNW2, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.BNW2, 'loss');
      }
    }
    return;
  }

  const myTurn =
    (view.phase === 'firstSubmit' && view.firstPlayerId === ctx.dummyId && !view.my.submitted)
    || (view.phase === 'secondSubmit' && view.firstPlayerId !== ctx.dummyId && !view.my.submitted);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickBnw2ActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getBnw2DummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  if (latest.phase === 'firstSubmit') {
    if (latest.firstPlayerId !== ctx.dummyId || latest.my.submitted || action.type !== 'submitFirst') return;
  } else if (latest.phase === 'secondSubmit') {
    if (latest.firstPlayerId === ctx.dummyId || latest.my.submitted || action.type !== 'submitSecond') return;
  } else {
    return;
  }

  handleBNW2Action(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actSilperBnw(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getSilperBnwDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.SILPER_BNW, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.SILPER_BNW, 'loss');
      }
    }
    return;
  }

  const myTurn =
    (view.phase === 'firstSubmit' && view.firstPlayerId === ctx.dummyId && !view.my.submitted)
    || (view.phase === 'secondSubmit' && view.firstPlayerId !== ctx.dummyId && !view.my.submitted);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    isSilperBnwScoreDecided(view) ? hopelessThinkMs() : psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickSilperBnwActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getSilperBnwDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  if (latest.phase === 'firstSubmit') {
    if (latest.firstPlayerId !== ctx.dummyId || latest.my.submitted || action.type !== 'submitFirst') return;
  } else if (latest.phase === 'secondSubmit') {
    if (latest.firstPlayerId === ctx.dummyId || latest.my.submitted || action.type !== 'submitSecond') return;
  } else {
    return;
  }

  handleSilperBnwAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actFiveTowers(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getFiveTowersDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.FIVE_TOWERS, 'win');
      } else if (view.winner) {
        recordDummyResult(ctx.dummyId, GAME_IDS.FIVE_TOWERS, 'loss');
      }
    }
    return;
  }

  if (view.phase !== 'turn' || view.currentPlayerId !== ctx.dummyId) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const thinkMs = justUsedInfoThisTurn(view) ? shortPsychologyThinkMs() : psychologyThinkMs();
  const budgetMs = capThinkToTurnLimit(thinkMs, view.turnStartedAt, view.timeLimitSeconds);
  const action = await pickFiveTowersActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getFiveTowersDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (latest.phase !== 'turn' || latest.currentPlayerId !== ctx.dummyId) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  handleFiveTowersAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actGrapeSugar2(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getGrapeSugar2DummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.GRAPE_SUGAR_2, 'win');
      } else if (view.winner && view.winner !== 'tie') {
        recordDummyResult(ctx.dummyId, GAME_IDS.GRAPE_SUGAR_2, 'loss');
      }
    }
    return;
  }

  if (view.phase !== 'input' || view.my.submitted) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickGrapeSugar2ActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getGrapeSugar2DummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (latest.phase !== 'input' || latest.my.submitted) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  handleGrapeSugar2Action(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actSunMoonStar2(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getSunMoonStar2DummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.SUN_MOON_STAR_2, 'win');
      } else if (view.winner && view.winner !== 'draw') {
        recordDummyResult(ctx.dummyId, GAME_IDS.SUN_MOON_STAR_2, 'loss');
      }
    }
    return;
  }

  const myFirst = view.firstPlayerSide === view.mySide;
  const myTurn =
    (view.phase === 'powder' && !view.my.submittedPowder)
    || (view.phase === 'betFirst' && myFirst && !view.my.betConfirmed)
    || (view.phase === 'betSecond' && !myFirst && !view.my.betConfirmed);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickSunMoonStar2ActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getSunMoonStar2DummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  const stillFirst = latest.firstPlayerSide === latest.mySide;
  if (latest.phase === 'powder') {
    if (latest.my.submittedPowder || action.type !== 'submitPowder') return;
  } else if (latest.phase === 'betFirst') {
    if (!stillFirst || latest.my.betConfirmed || action.type !== 'submitBet') return;
  } else if (latest.phase === 'betSecond') {
    if (stillFirst || latest.my.betConfirmed || action.type !== 'submitBet') return;
  } else {
    return;
  }

  handleSunMoonStar2Action(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actBankGame(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getBankGameDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.BANK_GAME, 'win');
      } else if (view.winner && view.winner !== 'draw') {
        recordDummyResult(ctx.dummyId, GAME_IDS.BANK_GAME, 'loss');
      }
    }
    return;
  }

  const myFirst = view.firstSide === view.mySide;
  const myTurn =
    (view.phase === 'firstSubmit' && myFirst && !view.my.betConfirmed)
    || (view.phase === 'secondSubmit' && !myFirst && !view.my.betConfirmed);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const budgetMs = capThinkToTurnLimit(
    psychologyThinkMs(),
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickBankGameActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getBankGameDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  const stillFirst = latest.firstSide === latest.mySide;
  if (latest.phase === 'firstSubmit') {
    if (!stillFirst || latest.my.betConfirmed || action.type !== 'submitBet') return;
  } else if (latest.phase === 'secondSubmit') {
    if (stillFirst || latest.my.betConfirmed || action.type !== 'submitBet') return;
  } else {
    return;
  }

  handleBankGameAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

async function actQuatro(
  io: IO,
  roomId: string,
  ctx: AgentCtx,
  sock: ReturnType<typeof makeDummySocket>,
): Promise<void> {
  const view = getQuatroDummyView(roomId, ctx.dummyId);
  if (!view) return;

  if (view.gameOver) {
    if (!ctx.recorded) {
      ctx.recorded = true;
      if (view.winner === ctx.dummyId) {
        recordDummyResult(ctx.dummyId, GAME_IDS.QUATRO, 'win');
      } else if (view.winner && view.winner !== 'draw') {
        recordDummyResult(ctx.dummyId, GAME_IDS.QUATRO, 'loss');
      }
    }
    return;
  }

  const myTurn =
    (view.phase === 'mulligan' && view.currentTurnId === ctx.dummyId)
    || (view.phase === 'open' && !view.iOpened)
    || (view.phase === 'exchange' && view.currentTurnId === ctx.dummyId && !view.my.stopped);
  if (!myTurn) return;
  if (turnTimeExpired(view.turnStartedAt, view.timeLimitSeconds)) return;

  const thinkMs =
    view.phase === 'mulligan' || view.phase === 'open'
      ? quatroQuickThinkMs()
      : psychologyThinkMs();
  const budgetMs = capThinkToTurnLimit(
    thinkMs,
    view.turnStartedAt,
    view.timeLimitSeconds,
  );
  const action = await pickQuatroActionAsync(view, ctx.dummyId, ctx.tier, budgetMs);
  if (!agents.has(roomId)) return;

  const latest = getQuatroDummyView(roomId, ctx.dummyId);
  if (!latest || latest.gameOver) return;
  if (turnTimeExpired(latest.turnStartedAt, latest.timeLimitSeconds)) return;
  if (!action) return;

  if (latest.phase === 'mulligan') {
    if (latest.currentTurnId !== ctx.dummyId || action.type !== 'mulligan') return;
  } else if (latest.phase === 'open') {
    if (latest.iOpened || action.type !== 'open') return;
  } else if (latest.phase === 'exchange') {
    if (latest.currentTurnId !== ctx.dummyId || latest.my.stopped) return;
    if (action.type !== 'exchange' && action.type !== 'stop') return;
  } else {
    return;
  }

  handleQuatroAction(io, sock, roomId, action as unknown as Record<string, unknown>);
}

export function destroyOrphanedDummyRoom(io: IO, roomId: string): void {
  const room = roomStore.get(roomId);
  if (!room) {
    stopDummyAgent(roomId);
    return;
  }
  const hasDummy = room.players.some((p) => isDummyPlayerId(p.id));
  const hasHuman = room.players.some((p) => !isDummyPlayerId(p.id) && p.id !== AI_PLAYER_ID);
  if (!hasDummy || hasHuman) return;

  stopDummyAgent(roomId);
  abortPlayingGame(io, roomId);
  clearAutoEnd(roomId);
  clearGameStartTime(roomId);
  clearRoomStartCountdown(roomId);
  cleanupRoomShopState(roomId);
  clearActiveSkin(roomId);
  roomStore.delete(roomId);
  broadcastRoomRemoved(io, roomId);
}
