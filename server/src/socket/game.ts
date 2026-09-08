import { v4 as uuid } from 'uuid';
import { randomUUID } from 'node:crypto';
import type { GameState, GameResult } from '@shared/types/events.js';
import type { Player, PlayMode, Room } from '@shared/types/room.js';
import { AI_PLAYER_ID } from '@shared/types/room.js';
import { GAME_IDS } from '@shared/types/game.js';
import { roomStore } from '../store/rooms.js';
import { sessions } from '../store/sessions.js';
import { broadcastRoomUpdated, broadcastRoomRemoved } from './lobby.js';
import { clearRoomStartCountdown } from './roomCountdown.js';
import config from '../config.js';
import { socketRoom, maskedClientRoomForSocket, emitRoomStateToRoom } from './utils.js';
import {
  getRoomShopState,
  cleanupRoomShopState,
} from '../shop/roomShopState.js';
import {
  maskRankingForViewer,
  maskGameResultDataForViewer,
} from '../shop/maskNicknames.js';
import type { IO, TypedSocket } from './types.js';
import { finalizeRankedMultiGameEnd } from '../rank/processRankedGameEnd.js';
import { nicknameForViewer, rankedRoomTitle } from '../rank/maskRankIdentity.js';
import { persistGameEndLog } from './gameEndPersistence.js';
import {
  clearPendingUndo,
  peekPendingUndo,
  setPendingUndo,
  takePendingUndo,
} from './gameUndoPending.js';
import { applyGameTurnOrder } from './gameTurnOrder.js';
import {
  initFourGravity,
  handleFourGravityAction,
  cleanupFourGravity,
  getFourGravityState,
  emitFourGravityStateToSocket,
  performFourGravityUndo,
  canFourGravityUndo,
  handleFourGravityToggleAI,
  getFourGravityResultData,
} from './games/four-gravity/index.js';
import {
  initDoubleSidedChess,
  handleDoubleSidedChessAction,
  cleanupDoubleSidedChess,
  getDoubleSidedChessState,
  emitDoubleSidedChessStateToSocket,
  performDoubleSidedChessUndo,
  canDoubleSidedChessUndo,
  handleDoubleSidedChessToggleAI,
  getDoubleSidedChessResultData,
} from './games/double-sided-chess/index.js';
import {
  initNumberFour,
  handleNumberFourAction,
  cleanupNumberFour,
  getNumberFourState,
  emitNumberFourStateToSocket,
  performNumberFourUndo,
  canNumberFourUndo,
  getNumberFourResultData,
} from './games/number4/index.js';
import {
  initIndianPoker,
  handleIndianPokerAction,
  cleanupIndianPoker,
  getIndianPokerState,
  emitIndianPokerStateToSocket,
  performIndianPokerUndo,
  canIndianPokerUndo,
  getIndianPokerResultData,
} from './games/indian-poker/index.js';
import {
  initInvestDonate,
  handleInvestDonateAction,
  cleanupInvestDonate,
  getInvestDonateState,
  emitInvestDonateStateToSocket,
  performInvestDonateUndo,
  canInvestDonateUndo,
  getInvestDonateResultData,
} from './games/invest-donate/index.js';
import {
  initBettingRps,
  handleBettingRpsAction,
  cleanupBettingRps,
  getBettingRpsState,
  emitBettingRpsStateToSocket,
  performBettingRpsUndo,
  canBettingRpsUndo,
  getBettingRpsResultData,
} from './games/betting-rps/index.js';
import {
  initMultipleBnw,
  handleMultipleBnwAction,
  cleanupMultipleBnw,
  getMultipleBnwState,
  emitMultipleBnwStateToSocket,
  performMultipleBnwUndo,
  canMultipleBnwUndo,
  getMultipleBnwResultData,
} from './games/multiple-bnw/index.js';
import {
  initWinningStreak,
  handleWinningStreakAction,
  cleanupWinningStreak,
  getWinningStreakState,
  emitWinningStreakStateToSocket,
  performWinningStreakUndo,
  canWinningStreakUndo,
  getWinningStreakResultData,
} from './games/winning-streak/index.js';
import {
  initBNW2,
  handleBNW2Action,
  cleanupBNW2,
  getBNW2State,
  emitBNW2StateToSocket,
  performBNW2Undo,
  canBNW2Undo,
  getBNW2ResultData,
} from './games/bnw2/index.js';
import {
  initSilperBnw,
  handleSilperBnwAction,
  cleanupSilperBnw,
  getSilperBnwState,
  emitSilperBnwStateToSocket,
  performSilperBnwUndo,
  canSilperBnwUndo,
  getSilperBnwResultData,
} from './games/silper-bnw/index.js';
import {
  initFiveTowers,
  handleFiveTowersAction,
  cleanupFiveTowers,
  getFiveTowersState,
  emitFiveTowersStateToSocket,
  performFiveTowersUndo,
  canFiveTowersUndo,
  getFiveTowersResultData,
} from './games/five-towers/index.js';
import {
  initGrapeSugar2,
  handleGrapeSugar2Action,
  cleanupGrapeSugar2,
  getGrapeSugar2State,
  emitGrapeSugar2StateToSocket,
  performGS2Undo,
  canGrapeSugar2Undo,
  getGrapeSugar2ResultData,
} from './games/grape-sugar-2/index.js';
import {
  initSunMoonStar2,
  handleSunMoonStar2Action,
  cleanupSunMoonStar2,
  getSunMoonStar2State,
  emitSunMoonStar2StateToSocket,
  performSunMoonStar2Undo,
  canSunMoonStar2Undo,
  getSunMoonStar2ResultData,
} from './games/sun-moon-star-2/index.js';
import {
  initBankGame,
  handleBankGameAction,
  cleanupBankGame,
  getBankGameState,
  emitBankGameStateToSocket,
  performBankGameUndo,
  canBankGameUndo,
  getBankGameResultData,
} from './games/bank-game/index.js';
import {
  initBanPick,
  handleBanPickBan,
  handleBanPickNoBan,
  handleBanPickReady,
  handleBanPickUnban,
  handleBanPickUnbanSkip,
  cleanupBanPick,
  getBanPickState,
  emitBanPickStateToSocket,
  canBanPickUndo,
  performBanPickUndo,
} from './games/ban-pick/index.js';
import { saveRankBanPickLog } from '../db/rankBanLog.js';
import { setActiveSkinForRoom, clearActiveSkin } from './skins.js';

function launchPickedGame(
  io: IO,
  roomId: string,
  pickedGameId: string,
  pickedGameName: string,
  players: Player[],
  playMode: PlayMode,
  endGameCallback: EndGameCallback,
) {
  const room = roomStore.get(roomId);
  if (!room) return;

  roomStore.setGameId(roomId, pickedGameId, pickedGameName);
  roomStore.markFromBanPick(roomId);
  if (room.isRanked) {
    roomStore.updateSettings(roomId, { title: rankedRoomTitle(pickedGameName) });
    broadcastRoomUpdated(io, roomId);
  }

  // 스킨 확정 (OR 규칙) — 게임 모듈 init 이전에 세팅해야 첫 game:state 에 반영됨
  setActiveSkinForRoom(roomId, players, pickedGameId);

  // Initialise the real game first so game:state arrives before room:state
  const gameModule = gameModules[pickedGameId];
  if (gameModule) {
    gameModule.init(
      io,
      roomId,
      players,
      playMode,
      Date.now(),
      room.timeLimitSeconds,
      endGameCallback,
      {},
    );
  }

  emitRoomStateToRoom(io, roomId);
}

type EndGameCallback = (
  io: IO,
  roomId: string,
  data: {
    rankings?: GameResult['rankings'];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) => void;

interface GameModuleHandlers {
  init: (
    io: IO,
    roomId: string,
    players: Player[],
    playMode: PlayMode,
    startedAt: number,
    timeLimitSeconds: number | null,
    endGameCallback: EndGameCallback,
    gameOptions?: Record<string, unknown>,
  ) => void;
  handleAction: (
    io: IO,
    socket: TypedSocket,
    roomId: string,
    data: Record<string, unknown>,
  ) => void;
  cleanup: (roomId: string) => void;
  getState: (roomId: string) => { gameOver: boolean; totalTurns: number } | undefined;
  emitStateToSocket: (socket: TypedSocket, roomId: string) => void;
  performUndo: (io: IO, roomId: string) => boolean;
  canUndo: (roomId: string) => boolean;
  getResultData?: (roomId: string) => unknown;
}

import {
  initWordPuzzle,
  handleWordPuzzleAction,
  cleanupWordPuzzle,
  getWordPuzzleState,
  emitWordPuzzleStateToSocket,
  performWordPuzzleUndo,
  canWordPuzzleUndo,
  getWordPuzzleResultData,
} from './games/word-puzzle/index.js';
import {
  initTransletter,
  handleTransletterAction,
  cleanupTransletter,
  getTransletterState,
  emitTransletterStateToSocket,
  performTransletterUndo,
  canTransletterUndo,
  getTransletterResultData,
} from './games/transletter/index.js';
import {
  initFormulaCompletion,
  handleFormulaCompletionAction,
  cleanupFormulaCompletion,
  getFormulaCompletionState,
  emitFormulaCompletionStateToSocket,
  performFormulaCompletionUndo,
  canFormulaCompletionUndo,
  getFormulaCompletionResultData,
} from './games/formula-completion/index.js';
import {
  initCompleteHap,
  handleCompleteHapAction,
  cleanupCompleteHap,
  getCompleteHapState,
  emitCompleteHapStateToSocket,
  performCompleteHapUndo,
  canCompleteHapUndo,
  getCompleteHapResultData,
} from './games/complete-hap/index.js';
import {
  initKnightTour,
  handleKnightTourAction,
  cleanupKnightTour,
  getKnightTourState,
  emitKnightTourStateToSocket,
  performKnightTourUndo,
  canKnightTourUndo,
  getKnightTourResultData,
} from './games/knights-tour/index.js';
import {
  initKingmaking,
  handleKingmakingAction,
  cleanupKingmaking,
  getKingmakingState,
  emitKingmakingStateToSocket,
  performKingmakingUndo,
  canKingmakingUndo,
  getKingmakingResultData,
} from './games/kingmaking/index.js';
import {
  initTripleGomoku,
  handleTripleGomokuAction,
  cleanupTripleGomoku,
  getTripleGomokuState,
  emitTripleGomokuStateToSocket,
  performTripleGomokuUndo,
  canTripleGomokuUndo,
  getTripleGomokuResultData,
} from './games/triple-gomoku/index.js';
import {
  initChoiceHoldem,
  handleChoiceHoldemAction,
  cleanupChoiceHoldem,
  getChoiceHoldemState,
  emitChoiceHoldemStateToSocket,
  performChoiceHoldemUndo,
  canChoiceHoldemUndo,
  getChoiceHoldemResultData,
} from './games/choice-holdem/index.js';
import {
  initSeedSeotda,
  handleSeedSeotdaAction,
  cleanupSeedSeotda,
  getSeedSeotdaState,
  emitSeedSeotdaStateToSocket,
  performSeedSeotdaUndo,
  canSeedSeotdaUndo,
  getSeedSeotdaResultData,
} from './games/seed-seotda/index.js';
import {
  initDoubleSidedPoker,
  handleDoubleSidedPokerAction,
  cleanupDoubleSidedPoker,
  getDoubleSidedPokerState,
  emitDoubleSidedPokerStateToSocket,
  performDoubleSidedPokerUndo,
  canDoubleSidedPokerUndo,
  getDoubleSidedPokerResultData,
} from './games/double-sided-poker/index.js';
import {
  initQuatro,
  handleQuatroAction,
  cleanupQuatro,
  getQuatroState,
  emitQuatroStateToSocket,
  performQuatroUndo,
  canQuatroUndo,
  getQuatroResultData,
} from './games/quatro/index.js';

/*
  화면 확인용 도구(scripts/game-fixtures)가 게임별 초기 상태를 뽑을 때 쓴다.
  런타임 동작에는 영향이 없다.
*/
export const gameModules: Record<string, GameModuleHandlers> = {
  [GAME_IDS.TRIPLE_GOMOKU]: {
    init: initTripleGomoku,
    handleAction: handleTripleGomokuAction,
    cleanup: cleanupTripleGomoku,
    getState: getTripleGomokuState,
    emitStateToSocket: emitTripleGomokuStateToSocket,
    performUndo: performTripleGomokuUndo,
    canUndo: canTripleGomokuUndo,
    getResultData: getTripleGomokuResultData,
  },
  [GAME_IDS.CHOICE_HOLDEM]: {
    init: initChoiceHoldem,
    handleAction: handleChoiceHoldemAction,
    cleanup: cleanupChoiceHoldem,
    getState: getChoiceHoldemState,
    emitStateToSocket: emitChoiceHoldemStateToSocket,
    performUndo: performChoiceHoldemUndo,
    canUndo: canChoiceHoldemUndo,
    getResultData: getChoiceHoldemResultData,
  },
  [GAME_IDS.SEED_SEOTDA]: {
    init: initSeedSeotda,
    handleAction: handleSeedSeotdaAction,
    cleanup: cleanupSeedSeotda,
    getState: getSeedSeotdaState,
    emitStateToSocket: emitSeedSeotdaStateToSocket,
    performUndo: performSeedSeotdaUndo,
    canUndo: canSeedSeotdaUndo,
    getResultData: getSeedSeotdaResultData,
  },
  [GAME_IDS.DOUBLE_SIDED_POKER]: {
    init: initDoubleSidedPoker,
    handleAction: handleDoubleSidedPokerAction,
    cleanup: cleanupDoubleSidedPoker,
    getState: getDoubleSidedPokerState,
    emitStateToSocket: emitDoubleSidedPokerStateToSocket,
    performUndo: performDoubleSidedPokerUndo,
    canUndo: canDoubleSidedPokerUndo,
    getResultData: getDoubleSidedPokerResultData,
  },
  [GAME_IDS.KNIGHTS_TOUR]: {
    init: initKnightTour,
    handleAction: handleKnightTourAction,
    cleanup: cleanupKnightTour,
    getState: getKnightTourState,
    emitStateToSocket: emitKnightTourStateToSocket,
    performUndo: performKnightTourUndo,
    canUndo: canKnightTourUndo,
    getResultData: getKnightTourResultData,
  },
  [GAME_IDS.KINGMAKING]: {
    init: initKingmaking,
    handleAction: handleKingmakingAction,
    cleanup: cleanupKingmaking,
    getState: getKingmakingState,
    emitStateToSocket: emitKingmakingStateToSocket,
    performUndo: performKingmakingUndo,
    canUndo: canKingmakingUndo,
    getResultData: getKingmakingResultData,
  },
  [GAME_IDS.COMPLETE_HAP]: {
    init: initCompleteHap,
    handleAction: handleCompleteHapAction,
    cleanup: cleanupCompleteHap,
    getState: getCompleteHapState,
    emitStateToSocket: emitCompleteHapStateToSocket,
    performUndo: performCompleteHapUndo,
    canUndo: canCompleteHapUndo,
    getResultData: getCompleteHapResultData,
  },
  [GAME_IDS.FORMULA_COMPLETION]: {
    init: initFormulaCompletion,
    handleAction: handleFormulaCompletionAction,
    cleanup: cleanupFormulaCompletion,
    getState: getFormulaCompletionState,
    emitStateToSocket: emitFormulaCompletionStateToSocket,
    performUndo: performFormulaCompletionUndo,
    canUndo: canFormulaCompletionUndo,
    getResultData: getFormulaCompletionResultData,
  },
  [GAME_IDS.WORD_PUZZLE]: {
    init: initWordPuzzle,
    handleAction: handleWordPuzzleAction,
    cleanup: cleanupWordPuzzle,
    getState: getWordPuzzleState,
    emitStateToSocket: emitWordPuzzleStateToSocket,
    performUndo: performWordPuzzleUndo,
    canUndo: canWordPuzzleUndo,
    getResultData: getWordPuzzleResultData,
  },
  [GAME_IDS.TRANSLETTER]: {
    init: initTransletter,
    handleAction: handleTransletterAction,
    cleanup: cleanupTransletter,
    getState: getTransletterState,
    emitStateToSocket: emitTransletterStateToSocket,
    performUndo: performTransletterUndo,
    canUndo: canTransletterUndo,
    getResultData: getTransletterResultData,
  },
  [GAME_IDS.QUATRO]: {
    init: initQuatro,
    handleAction: handleQuatroAction,
    cleanup: cleanupQuatro,
    getState: getQuatroState,
    emitStateToSocket: emitQuatroStateToSocket,
    performUndo: performQuatroUndo,
    canUndo: canQuatroUndo,
    getResultData: getQuatroResultData,
  },
  [GAME_IDS.FOUR_GRAVITY]: {
    init: initFourGravity,
    handleAction: handleFourGravityAction,
    cleanup: cleanupFourGravity,
    getState: (roomId) => {
      const s = getFourGravityState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.turnNumber } : undefined;
    },
    emitStateToSocket: emitFourGravityStateToSocket,
    performUndo: performFourGravityUndo,
    canUndo: canFourGravityUndo,
    getResultData: getFourGravityResultData,
  },
  [GAME_IDS.DOUBLE_SIDED_CHESS]: {
    init: initDoubleSidedChess,
    handleAction: handleDoubleSidedChessAction,
    cleanup: cleanupDoubleSidedChess,
    getState: (roomId) => {
      const s = getDoubleSidedChessState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.turnNumber } : undefined;
    },
    emitStateToSocket: emitDoubleSidedChessStateToSocket,
    performUndo: performDoubleSidedChessUndo,
    canUndo: canDoubleSidedChessUndo,
    getResultData: getDoubleSidedChessResultData,
  },
  [GAME_IDS.NUMBER_FOUR]: {
    init: initNumberFour,
    handleAction: handleNumberFourAction,
    cleanup: cleanupNumberFour,
    getState: (roomId) => {
      const s = getNumberFourState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitNumberFourStateToSocket,
    performUndo: performNumberFourUndo,
    canUndo: canNumberFourUndo,
    getResultData: getNumberFourResultData,
  },
  [GAME_IDS.INDIAN_POKER]: {
    init: initIndianPoker,
    handleAction: handleIndianPokerAction,
    cleanup: cleanupIndianPoker,
    getState: (roomId) => {
      const s = getIndianPokerState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.totalBettingActions } : undefined;
    },
    emitStateToSocket: emitIndianPokerStateToSocket,
    performUndo: performIndianPokerUndo,
    canUndo: canIndianPokerUndo,
    getResultData: getIndianPokerResultData,
  },
  [GAME_IDS.INVEST_DONATE]: {
    init: initInvestDonate,
    handleAction: handleInvestDonateAction,
    cleanup: cleanupInvestDonate,
    getState: (roomId) => {
      const s = getInvestDonateState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitInvestDonateStateToSocket,
    performUndo: performInvestDonateUndo,
    canUndo: canInvestDonateUndo,
    getResultData: getInvestDonateResultData,
  },
  [GAME_IDS.BETTING_RPS]: {
    init: initBettingRps,
    handleAction: handleBettingRpsAction,
    cleanup: cleanupBettingRps,
    getState: (roomId) => {
      const s = getBettingRpsState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitBettingRpsStateToSocket,
    performUndo: performBettingRpsUndo,
    canUndo: canBettingRpsUndo,
    getResultData: getBettingRpsResultData,
  },
  [GAME_IDS.MULTIPLE_BNW]: {
    init: initMultipleBnw,
    handleAction: handleMultipleBnwAction,
    cleanup: cleanupMultipleBnw,
    getState: (roomId) => {
      const s = getMultipleBnwState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitMultipleBnwStateToSocket,
    performUndo: performMultipleBnwUndo,
    canUndo: canMultipleBnwUndo,
    getResultData: getMultipleBnwResultData,
  },
  [GAME_IDS.WINNING_STREAK]: {
    init: initWinningStreak,
    handleAction: handleWinningStreakAction,
    cleanup: cleanupWinningStreak,
    getState: (roomId) => {
      const s = getWinningStreakState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitWinningStreakStateToSocket,
    performUndo: performWinningStreakUndo,
    canUndo: canWinningStreakUndo,
    getResultData: getWinningStreakResultData,
  },
  [GAME_IDS.BNW2]: {
    init: initBNW2,
    handleAction: handleBNW2Action,
    cleanup: cleanupBNW2,
    getState: (roomId) => {
      const s = getBNW2State(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.round } : undefined;
    },
    emitStateToSocket: emitBNW2StateToSocket,
    performUndo: performBNW2Undo,
    canUndo: canBNW2Undo,
    getResultData: getBNW2ResultData,
  },
  [GAME_IDS.SILPER_BNW]: {
    init: initSilperBnw,
    handleAction: handleSilperBnwAction,
    cleanup: cleanupSilperBnw,
    getState: (roomId) => {
      const s = getSilperBnwState(roomId);
      if (!s) return undefined;
      const totalRounds =
        s.segmentsHistory.reduce((sum, seg) => sum + seg.rounds.length, 0) + s.actionLog.length;
      return { gameOver: s.gameOver, totalTurns: totalRounds };
    },
    emitStateToSocket: emitSilperBnwStateToSocket,
    performUndo: performSilperBnwUndo,
    canUndo: canSilperBnwUndo,
    getResultData: getSilperBnwResultData,
  },
  [GAME_IDS.FIVE_TOWERS]: {
    init: initFiveTowers,
    handleAction: handleFiveTowersAction,
    cleanup: cleanupFiveTowers,
    getState: (roomId) => {
      const s = getFiveTowersState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.turn } : undefined;
    },
    emitStateToSocket: emitFiveTowersStateToSocket,
    performUndo: performFiveTowersUndo,
    canUndo: canFiveTowersUndo,
    getResultData: getFiveTowersResultData,
  },
  [GAME_IDS.GRAPE_SUGAR_2]: {
    init: initGrapeSugar2,
    handleAction: handleGrapeSugar2Action,
    cleanup: cleanupGrapeSugar2,
    getState: (roomId) => {
      const s = getGrapeSugar2State(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
    },
    emitStateToSocket: emitGrapeSugar2StateToSocket,
    performUndo: performGS2Undo,
    canUndo: canGrapeSugar2Undo,
    getResultData: getGrapeSugar2ResultData,
  },
  [GAME_IDS.SUN_MOON_STAR_2]: {
    init: initSunMoonStar2,
    handleAction: handleSunMoonStar2Action,
    cleanup: cleanupSunMoonStar2,
    getState: (roomId) => {
      const s = getSunMoonStar2State(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
    },
    emitStateToSocket: emitSunMoonStar2StateToSocket,
    performUndo: performSunMoonStar2Undo,
    canUndo: canSunMoonStar2Undo,
    getResultData: getSunMoonStar2ResultData,
  },
  [GAME_IDS.BANK_GAME]: {
    init: initBankGame,
    handleAction: handleBankGameAction,
    cleanup: cleanupBankGame,
    getState: (roomId) => {
      const s = getBankGameState(roomId);
      return s ? { gameOver: s.gameOver, totalTurns: s.history.length } : undefined;
    },
    emitStateToSocket: emitBankGameStateToSocket,
    performUndo: performBankGameUndo,
    canUndo: canBankGameUndo,
    getResultData: getBankGameResultData,
  },
  [GAME_IDS.BAN_PICK]: {
    init: (
      io,
      roomId,
      players,
      playMode,
      startedAt,
      timeLimitSeconds,
      endGameCallback,
      gameOptions,
    ) => {
      void initBanPick(
        io,
        roomId,
        players,
        playMode,
        startedAt,
        timeLimitSeconds,
        endGameCallback,
        gameOptions,
        (pickedGameId, pickedGameName) => {
          launchPickedGame(
            io,
            roomId,
            pickedGameId,
            pickedGameName,
            players,
            playMode,
            endGameCallback,
          );
        },
        (banData) => {
          const room = roomStore.get(roomId);
          if (!room?.isRanked || room.rankSeasonId == null) return;
          const firstPlayer = players[0];
          const secondPlayer = players[1];
          saveRankBanPickLog({
            seasonId: room.rankSeasonId,
            firstMemberId: firstPlayer?.memberId ?? null,
            secondMemberId: secondPlayer?.memberId ?? null,
            pickedGameId: banData.pickedGameId,
            bannedGames: banData.bannedGames,
          }).catch((err) => {
            console.warn('[rankBanLog] 저장 실패:', (err as Error).message);
          });
        },
      );
    },
    handleAction: () => {},
    cleanup: cleanupBanPick,
    getState: getBanPickState,
    emitStateToSocket: emitBanPickStateToSocket,
    performUndo: performBanPickUndo,
    canUndo: canBanPickUndo,
  },
};

const autoEndTimers = new Map<string, NodeJS.Timeout>();
const gameStartTimes = new Map<string, number>();

/** 소켓의 Player.id (= localStorage 토큰)를 반환. 토큰 없으면 socket.id를 폴백으로 사용 */
function getPlayerId(socket: TypedSocket): string {
  return sessions.getToken(socket.id) ?? socket.id;
}

export function startGame(io: IO, roomId: string) {
  const room = roomStore.get(roomId);
  if (!room) return;

  clearPendingUndo(roomId);

  // 확정된 선후공을 방에도 반영해야 결과·기록의 first/second가 실제 게임과 일치한다.
  const playersForGame = applyGameTurnOrder(room);

  const startedAt = Date.now();
  gameStartTimes.set(roomId, startedAt);

  roomStore.setStatus(roomId, 'playing');

  emitRoomStateToRoom(io, roomId);

  io.to(socketRoom(roomId)).emit('room:game:started');

  const gameModule = gameModules[room.gameId];
  if (gameModule) {
    try {
      // 랜덤 선후공: 결과를 두 플레이어 모두에게 시스템 메시지로 알림
      if (room.turnOrderMode === 'random' && playersForGame.length === 2) {
        io.to(socketRoom(roomId)).emit('chat:message', {
          id: uuid(),
          sender: 'system',
          senderNickname: '시스템',
          message: room.isRanked
            ? '선후공이 랜덤으로 정해졌습니다.'
            : `선후공 랜덤 결과 — ${playersForGame[0].nickname} 님이 선공, ${playersForGame[1].nickname} 님이 후공입니다.`,
          scope: 'game',
          isSystem: true,
          timestamp: Date.now(),
        });
      }
      // 스킨 확정 (OR 규칙) — init 이전에 세팅해야 첫 game:state 에 반영됨
      setActiveSkinForRoom(roomId, playersForGame, room.gameId);
      gameModule.init(
        io,
        roomId,
        playersForGame,
        room.playMode,
        startedAt,
        room.timeLimitSeconds,
        (cbIo, cbRoomId, data) => {
          endGame(cbIo, cbRoomId, data);
        },
        room.gameOptions,
      );
    } catch (err) {
      console.error('[startGame] 게임 초기화 예외', { roomId, gameId: room.gameId }, err);
      io.to(socketRoom(roomId)).emit('room:disbanded', {
        reason: '게임을 시작하는 중 오류가 발생했습니다.',
      });
      roomStore.delete(roomId);
      broadcastRoomRemoved(io, roomId);
      return;
    }
  } else {
    const state: GameState = {
      roomId,
      message: '게임이 시작되었습니다! (게임 모듈 플레이스홀더)',
      currentTurn: room.players[0]?.id ?? null,
      turnNumber: 1,
      startedAt,
      turnStartedAt: null,
    };
    io.to(socketRoom(roomId)).emit('game:state', state);
  }
  broadcastRoomUpdated(io, roomId);
}

/** 게임 진행 중 플레이어가 나갈 때 멀티 포기 처리. playerId = Player.id(token) */
export function handleGameForfeit(io: IO, roomId: string, playerId: string) {
  const room = roomStore.get(roomId);
  if (!room || room.status !== 'playing') return;

  const isPlayer = room.players.some((p: Player) => p.id === playerId);
  if (!isPlayer) return;

  const gameModule = gameModules[room.gameId];
  if (!gameModule) return;

  const state = gameModule.getState(roomId);

  // 이미 승부가 난 뒤(결과 연출 중)라면 손대지 않고 그대로 둔다.
  // 대부분의 게임은 gameOver 를 세운 직후가 아니라 3~8초 뒤에 endGameCallback 을
  // 부르는데(결과 공개 연출), 그 사이에 여기서 cleanup 해 버리면 예약된 타이머가
  // 게임 상태를 못 찾고 그냥 반환한다. 그러면 endGame 이 영영 불리지 않아
  // 방이 'playing' 인 채로 멈추고, 남은 사람 화면이 결과로 넘어가지 못한다.
  // 이 경우 타이머가 알아서 정상 종료시키므로 기권 처리로 덮어쓸 필요도 없다.
  if (state?.gameOver) return;

  const gameResultData = gameModule.getResultData?.(roomId);
  clearPendingUndo(roomId);
  gameModule.cleanup(roomId);

  if (state && room.playMode === 'multi') {
    const other = room.players.find((p: Player) => p.id !== playerId);
    const leaverNickname =
      room.players.find((p: Player) => p.id === playerId)?.nickname ??
      sessions.getNicknameByToken(playerId) ??
      '???';
    if (other) {
      endGame(io, roomId, {
        rankings: [
          { playerId: other.id, nickname: other.nickname, rank: 1, score: 1 },
          { playerId, nickname: leaverNickname, rank: 2, score: 0 },
        ],
        totalTurns: state.totalTurns,
        endedByForfeit: true,
        gameResultData,
      });
    }
  }
}

/** session:restore 시 index.ts에서 game:state를 재전송하는 데 사용 */
export function emitGameStateToSocket(socket: TypedSocket, roomId: string, gameId: string) {
  gameModules[gameId]?.emitStateToSocket(socket, roomId);
}

export function registerGameHandlers(io: IO, socket: TypedSocket) {
  socket.on('game:sync', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;

    // room:state는 시스템 룸도 전송해야 클라이언트의 gameId가 세팅되어 게임 모듈이 렌더됨
    const clientRoom = maskedClientRoomForSocket(roomId, socket);
    if (clientRoom) socket.emit('room:state', clientRoom);

    // 시스템 룸의 game:state는 event:join 시점에 eventRoomHandlers 가 전송한다.
    if (roomStore.isSystemRoom(roomId)) return;

    gameModules[room.gameId]?.emitStateToSocket(socket, roomId);
  });

  socket.on('game:action', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    // 시스템 룸은 eventRoomHandlers 의 'game:action' 핸들러가 처리
    if (roomStore.isSystemRoom(roomId)) return;

    // 게임 모듈은 대부분 data 를 자기 액션 타입으로 캐스팅한 뒤 곧바로 .type 을
    // 읽는다. 클라이언트가 null 이나 문자열을 보내면 거기서 TypeError 가 나고,
    // socket.io 는 리스너 예외를 잡지 않아(process.nextTick 안에서 던진다)
    // 서버 프로세스가 통째로 죽는다 — 메모리에 있던 모든 방의 게임이 사라진다.
    // 모듈마다 막는 대신 이 길목에서 한 번에 막는다.
    if (!data || typeof data !== 'object' || Array.isArray(data)) return;

    try {
      gameModules[room.gameId]?.handleAction(io, socket, roomId, data);
    } catch (err) {
      console.error('[game:action] 게임 모듈 예외', { roomId, gameId: room.gameId }, err);
      socket.emit('error', { message: '행동을 처리하지 못했습니다.' });
    }
  });

  socket.on('game:undo:request', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;
    if (roomStore.isSystemRoom(roomId)) return; // 이벤트 룸: 무르기 미지원

    const myId = getPlayerId(socket);

    const isSpecialPostGame =
      room.status === 'finished' &&
      (room.gameId === 'game-001' || room.gameId === 'game-002') &&
      room.playMode === 'solo' &&
      room.players.some((p: Player) => p.nickname === '천하');

    if (!isSpecialPostGame && room.status !== 'playing') return;

    if (!room.players.some((p: Player) => p.id === myId)) {
      socket.emit('error', { message: '플레이어만 무르기를 요청할 수 있습니다.' });
      return;
    }

    if (peekPendingUndo(roomId)) {
      socket.emit('error', { message: '이미 처리 중인 무르기 요청이 있습니다.' });
      return;
    }

    const gameModule = gameModules[room.gameId];
    if (!gameModule?.canUndo(roomId)) {
      socket.emit('error', { message: '지금은 무르기를 요청할 수 없습니다.' });
      return;
    }

    if (room.playMode === 'multi') {
      const opponent = room.players.find((p: Player) => p.id !== myId);
      if (!opponent) return;
      const requestId = randomUUID();
      setPendingUndo(roomId, {
        requestId,
        requesterId: myId,
        gameId: room.gameId,
      });
      // opponent.id = token → 실제 소켓으로 라우팅
      const opponentSocketId = sessions.getSocketByToken(opponent.id) ?? opponent.id;
      io.to(opponentSocketId).emit('game:undo:proposal', {
        requestId,
        requesterId: myId,
        requesterNickname: nicknameForViewer(
          roomId,
          myId,
          sessions.getNickname(socket.id) ?? '플레이어',
          opponent.id,
        ),
      });
      return;
    }

    const ok = gameModule.performUndo(io, roomId);
    if (ok && isSpecialPostGame) {
      clearAutoEnd(roomId);
      roomStore.setStatus(roomId, 'playing');
      emitRoomStateToRoom(io, roomId);
    }
    if (!ok) {
      socket.emit('error', { message: '지금은 무를 수 있는 수가 없습니다.' });
    }
  });

  socket.on('banpick:ban', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;
    handleBanPickBan(io, socket, roomId, data.gameId);
  });

  socket.on('banpick:noban', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;
    handleBanPickNoBan(io, socket, roomId);
  });

  socket.on('banpick:ready', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;
    handleBanPickReady(io, roomId, getPlayerId(socket));
  });

  socket.on('banpick:unban', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;
    const gameId = typeof data?.gameId === 'string' ? data.gameId : null;
    if (!gameId) return;
    handleBanPickUnban(io, socket, roomId, gameId);
  });

  socket.on('banpick:unban_skip', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;
    handleBanPickUnbanSkip(socket, roomId, io);
  });

  socket.on('game:four-gravity:toggle-ai', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleFourGravityToggleAI(io, socket, roomId, data as Record<string, unknown>);
  });

  socket.on('game:double-sided-chess:toggle-ai', (data) => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    handleDoubleSidedChessToggleAI(io, socket, roomId, data as Record<string, unknown>);
  });

  socket.on('game:undo:accept', (data) => {
    const requestId = data?.requestId;
    if (typeof requestId !== 'string') return;
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;

    const myId = getPlayerId(socket);
    const pending = peekPendingUndo(roomId);
    if (!pending || pending.requestId !== requestId) return;
    if (myId === pending.requesterId) return;

    const isOpponent = room.players.some(
      (p: Player) => p.id === myId && p.id !== pending.requesterId,
    );
    if (!isOpponent) return;

    takePendingUndo(roomId, requestId);

    const ok = gameModules[room.gameId]?.performUndo(io, roomId) ?? false;
    if (!ok) {
      socket.emit('error', { message: '무르기에 실패했습니다.' });
    }
  });

  socket.on('game:undo:decline', (data) => {
    const requestId = data?.requestId;
    if (typeof requestId !== 'string') return;
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room || room.status !== 'playing') return;
    if (roomStore.isSystemRoom(roomId)) return;

    const myId = getPlayerId(socket);
    const pending = peekPendingUndo(roomId);
    if (!pending || pending.requestId !== requestId) return;
    if (myId === pending.requesterId) return;

    const isOpponent = room.players.some(
      (p: Player) => p.id === myId && p.id !== pending.requesterId,
    );
    if (!isOpponent) return;

    clearPendingUndo(roomId);
    // pending.requesterId = token → 실제 소켓으로 라우팅
    const requesterSocketId = sessions.getSocketByToken(pending.requesterId) ?? pending.requesterId;
    io.to(requesterSocketId).emit('game:undo:declined');
  });

  socket.on('game:end', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    const myId = getPlayerId(socket);
    if (!room || room.hostId !== myId) return;
    if (roomStore.isSystemRoom(roomId)) return; // 이벤트 룸: 종료 미지원

    clearPendingUndo(roomId);
    gameModules[room.gameId]?.cleanup(roomId);
    endGame(io, roomId);
  });

  socket.on('game:resign', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    // 랭크방 + 일반 1:1(multi) 방 모두 항복 가능 (forfeit 처리는 multi에서만 승패 부여)
    if (!room || room.status !== 'playing' || room.playMode !== 'multi') return;
    if (roomStore.isSystemRoom(roomId)) return; // 이벤트 룸: 항복 미지원
    const myId = getPlayerId(socket);
    if (!room.players.some((p: Player) => p.id === myId)) return;
    // forfeit 처리(game:ended 방송)만 하고 소켓 방은 유지 — 결과화면을 보여주기 위함
    handleGameForfeit(io, roomId, myId);
  });

  socket.on('game:rematch', () => {
    const roomId = sessions.getRoom(socket.id);
    if (!roomId) return;
    const room = roomStore.get(roomId);
    if (!room) return;
    if (roomStore.isSystemRoom(roomId)) return; // 이벤트 룸: 재시작 미지원

    // 재대결은 결과 화면에서만 누를 수 있다. 가드가 없으면 관전자나 상대가
    // 진행 중인 게임을 'waiting' 으로 되돌려 판을 깨뜨릴 수 있다.
    if (room.status === 'playing') return;
    const myId = getPlayerId(socket);
    if (!room.players.some((p: Player) => p.id === myId)) return;

    clearAutoEnd(roomId);

    if (room.playMode === 'multi') {
      roomStore.resetForRematch(roomId);
      emitRoomStateToRoom(io, roomId);
      broadcastRoomUpdated(io, roomId);
    } else {
      startGame(io, roomId);
    }
  });
}

export function endGame(
  io: IO,
  roomId: string,
  data?: {
    rankings?: GameResult['rankings'];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) {
  const room = roomStore.get(roomId);
  if (!room) return;

  clearAutoEnd(roomId);

  roomStore.setStatus(roomId, 'finished');

  const startedAt = gameStartTimes.get(roomId) ?? room.createdAt;
  const playTime = Date.now() - startedAt;
  gameStartTimes.delete(roomId);

  const baseRankings =
    data?.rankings ??
    room.players.map((p: Player, i: number) => ({
      playerId: p.id,
      nickname: p.nickname,
      rank: i + 1,
      score: 0,
    }));
  const result: GameResult = {
    roomId,
    rankings: baseRankings.map((r) => ({
      ...r,
      memberId: room.players.find((p: Player) => p.id === r.playerId)?.memberId ?? null,
    })),
    playTime,
    totalTurns: data?.totalTurns ?? 0,
    ...(data?.gameResultData != null && { gameResultData: data.gameResultData }),
    ...(data?.endedByForfeit === true && { endedByForfeit: true }),
  };

  const emitEndedAndGrants = (payload: GameResult) => {
    const shopState = getRoomShopState(roomId);
    if (shopState && shopState.anonymizedTokens.size > 0) {
      // viewer 시점별 마스킹: 본인은 원본, 다른 사람은 닉네임 ??? 처리
      const sockets = io.sockets.adapter.rooms.get(socketRoom(roomId));
      if (sockets) {
        for (const sid of sockets) {
          const viewerToken = sessions.getToken(sid) ?? null;
          const anonNicknames = room.players
            .filter((p) => shopState.anonymizedTokens.has(p.id) && p.id !== viewerToken)
            .map((p) => p.nickname);
          const masked: GameResult = {
            ...payload,
            rankings: maskRankingForViewer(roomId, payload.rankings, viewerToken),
            ...(payload.gameResultData != null
              ? {
                  gameResultData: maskGameResultDataForViewer(
                    roomId,
                    payload.gameResultData,
                    viewerToken,
                    anonNicknames,
                  ),
                }
              : {}),
          };
          io.sockets.sockets.get(sid)?.emit('game:ended', masked);
        }
      } else {
        io.to(socketRoom(roomId)).emit('game:ended', payload);
      }
    } else {
      io.to(socketRoom(roomId)).emit('game:ended', payload);
    }

    broadcastRoomUpdated(io, roomId);
    for (const player of room.players) {
      if (player.id === AI_PLAYER_ID) continue;
      if (!sessions.hasPendingTitles(player.id)) continue;
      const sid = sessions.getSocketByToken(player.id);
      if (!sid) continue;
      const sock = io.sockets.sockets.get(sid);
      if (!sock) continue;
      for (const notif of sessions.takePendingTitles(player.id)) {
        sock.emit('title:granted', notif);
      }
    }
  };

  const shouldRankFinalize =
    room.isRanked === true &&
    room.rankSeasonId != null &&
    room.playMode === 'multi' &&
    room.players.filter((p: Player) => p.memberId && p.id !== AI_PLAYER_ID).length === 2;

  console.log(
    `[endGame] roomId=${roomId} gameId=${room.gameId} isRanked=${room.isRanked} seasonId=${room.rankSeasonId} playMode=${room.playMode} memberedPlayers=${room.players.filter((p: Player) => p.memberId && p.id !== AI_PLAYER_ID).length} shouldRankFinalize=${shouldRankFinalize}`,
  );

  if (shouldRankFinalize) {
    const roomSnapshot = { ...room, players: [...room.players] };
    void finalizeRankedMultiGameEnd(io, roomSnapshot, result)
      .then((final) => emitEndedAndGrants(final))
      .catch((err) => {
        console.warn('[rank] finalizeRankedMultiGameEnd 실패:', (err as Error).message);
        emitEndedAndGrants(result);
        // Phase 1 실패 시에도 게임 로그는 저장 시도
        recordGameEndAsync(io, room, result).catch((e) => {
          console.warn('[rank:fallback] 게임로그 저장 실패:', (e as Error).message);
        });
      });
  } else {
    emitEndedAndGrants(result);
    recordGameEndAsync(io, room, result).catch((err) => {
      console.warn('[game:ended] record_game_end 실패:', (err as Error).message);
    });
  }

  const timer = setTimeout(() => {
    const r = roomStore.get(roomId);
    if (r && r.status === 'finished') {
      io.to(socketRoom(roomId)).emit('room:disbanded', {
        reason: '시간 초과로 방이 종료되었습니다.',
      });
      // p.id = token → 소켓 ID를 역조회해서 clearRoom
      r.players.forEach((p: Player) => {
        const sid = sessions.getSocketByToken(p.id) ?? p.id;
        sessions.clearRoom(sid);
      });
      r.spectators.forEach((p: Player) => {
        const sid = sessions.getSocketByToken(p.id) ?? p.id;
        sessions.clearRoom(sid);
      });
      clearRoomStartCountdown(roomId);
      sessions.clearRoomFromAllKicks(roomId);
      cleanupRoomShopState(roomId);
      clearActiveSkin(roomId);
      roomStore.delete(roomId);
      broadcastRoomRemoved(io, roomId);
    }
    autoEndTimers.delete(roomId);
  }, config.roomAutoDestroyDelay);

  autoEndTimers.set(roomId, timer);
}

/** 진행 중 모듈을 정리하고 종료. 더미가 아직 없는 게임이 걸렸을 때 쓴다. */
export function abortPlayingGame(
  io: IO,
  roomId: string,
  data?: {
    rankings?: GameResult['rankings'];
    totalTurns?: number;
    gameResultData?: unknown;
    endedByForfeit?: boolean;
  },
) {
  const room = roomStore.get(roomId);
  if (!room || room.status !== 'playing') return;
  clearPendingUndo(roomId);
  gameModules[room.gameId]?.cleanup(roomId);
  endGame(io, roomId, data);
}

export function clearAutoEnd(roomId: string) {
  const timer = autoEndTimers.get(roomId);
  if (timer) {
    clearTimeout(timer);
    autoEndTimers.delete(roomId);
  }
}

export function clearGameStartTime(roomId: string) {
  gameStartTimes.delete(roomId);
}

async function recordGameEndAsync(io: IO, room: Room, result: GameResult): Promise<void> {
  try {
    await persistGameEndLog(io, room, result);
  } catch (err) {
    console.warn('[game:ended] record_game_end 실패:', (err as Error).message);
  }
}
