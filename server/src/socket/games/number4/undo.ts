import type {
  InternalState,
  InternalRoundRecord,
  NF4PlayerInternal,
  NF4UndoSnapshot,
} from './types.js';

function snapshotPlayer(p: NF4PlayerInternal): NF4UndoSnapshot['player1'] {
  return {
    score: p.score,
    remainingWhite: p.remainingWhite,
    remainingBlack: p.remainingBlack,
    submitted: p.submitted,
    submittedWhite: p.submittedWhite,
    submittedBlack: p.submittedBlack,
    submittedNumber: p.submittedNumber,
  };
}

function restorePlayer(p: NF4PlayerInternal, snap: NF4UndoSnapshot['player1']) {
  p.score = snap.score;
  p.remainingWhite = snap.remainingWhite;
  p.remainingBlack = snap.remainingBlack;
  p.submitted = snap.submitted;
  p.submittedWhite = snap.submittedWhite;
  p.submittedBlack = snap.submittedBlack;
  p.submittedNumber = snap.submittedNumber;
}

export function pushUndoSnapshot(s: InternalState) {
  s.undoSnapshots.push({
    round: s.round,
    phase: s.phase,
    player1: snapshotPlayer(s.player1),
    player2: snapshotPlayer(s.player2),
    roundHistory: JSON.parse(JSON.stringify(s.roundHistory)) as InternalRoundRecord[],
    actionLog: JSON.parse(JSON.stringify(s.actionLog)) as InternalState['actionLog'],
    currentSide: s.currentSide,
    aiTargetNumber: s.aiTargetNumber,
  });
}

export function applyNF4UndoSnapshot(s: InternalState, snap: NF4UndoSnapshot) {
  s.round = snap.round;
  s.revealEndsAt = null;
  s.phase = snap.phase;
  restorePlayer(s.player1, snap.player1);
  restorePlayer(s.player2, snap.player2);
  s.roundHistory = JSON.parse(JSON.stringify(snap.roundHistory)) as InternalRoundRecord[];
  s.actionLog = JSON.parse(JSON.stringify(snap.actionLog)) as InternalState['actionLog'];
  s.currentSide = snap.currentSide;
  s.aiTargetNumber = snap.aiTargetNumber;
}

export function hasPartialRoundNF4(s: InternalState): boolean {
  if (s.phase !== 'submit') return true;
  return (
    s.player1.submitted ||
    s.player2.submitted ||
    s.player1.submittedWhite !== null ||
    s.player2.submittedWhite !== null
  );
}
