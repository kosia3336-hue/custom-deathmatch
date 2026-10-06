/** 기존 호출부/AI의 진입점. 구현은 책임별 모듈에서 관리한다. */
export { gameStates } from './store.js';
export { broadcastState, emitStateToSocket } from './broadcast.js';
export { clearRoundTimer, clearGameTimers } from './timers.js';
export { startRoundTimer, processRound, advanceRound, performNumberFourUndo } from './round.js';
export { getNumberFourResultData } from './result.js';
