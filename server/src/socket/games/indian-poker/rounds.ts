import type { InternalState } from './types.js';
import { deal, checkDeckReset } from './deck.js';
import { pushUndoSnapshot } from './snapshots.js';

export function checkGameEnd(s: InternalState): boolean {
  for (const player of Object.values(s.players)) {
    if (player.chips <= 0) {
      const winner = Object.values(s.players).find((p) => p.chips > 0)!;
      s.winner = winner.id;
      s.winType = 'chipOut';
      return true;
    }
  }
  return false;
}

/** 직전 라운드 결과를 바탕으로 다음 선 플레이어를 결정한다.
 *  - 승자 있음: 승자가 선
 *  - 무승부: 이전 선 플레이어 유지
 *  - 다이: 다이하지 않은 플레이어(승자)가 선
 */
function resolveNextFirstBettorId(s: InternalState): string {
  if (s.showdownData) {
    if (s.showdownData.isDraw) return s.firstBettorId;
    if (s.showdownData.winnerId) return s.showdownData.winnerId;
  }
  if (s.dieData) {
    return s.dieData.diedPlayerId === s.player1Id ? s.player2Id : s.player1Id;
  }
  // 폴백: 교대 (정상 흐름에서 도달하지 않음)
  return s.firstBettorId === s.player1Id ? s.player2Id : s.player1Id;
}

export function prepareNextRound(s: InternalState) {
  // 2. 덱 리셋 검사
  s.deckResetOccurred = checkDeckReset(s);

  // 3. 다음 선 플레이어 결정 (showdown/die 결과 참조, 리셋 전에 읽어야 함)
  const nextFirstBettorId = resolveNextFirstBettorId(s);

  // 4. 라운드 상태 리셋
  s.round += 1;
  s.pot = 0;
  s.currentBet = 0;
  s.bettingStarted = false;
  s.showdownData = null;
  s.dieData = null;
  s.currentRoundActions = [];
  s.firstBettorId = nextFirstBettorId;
  // deckResetOccurred는 위에서 이미 set, 다음 라운드 시작 브로드캐스트 후 해제됨

  // 5. 앤트 차감 — 숏스택 처리: 실효 앤티 = min(표준 앤티, 양쪽 칩 수)
  //    칩이 적은 플레이어는 전부 걸고, 상대도 같은 금액만 낸다
  const effectiveAnte = Math.min(s.ante, ...Object.values(s.players).map((p) => p.chips));
  s.roundAnte = effectiveAnte;
  for (const player of Object.values(s.players)) {
    player.chips -= effectiveAnte;
    player.roundBet = 0;
    s.pot += effectiveAnte;
  }

  // 7. 딜링
  deal(s);

  // 8. 베팅 시작 (phase·currentTurnId를 확정한 뒤 스냅샷을 찍어야
  //    무르기 복원 시 'betting' 상태로 정확히 돌아옴)
  s.phase = 'betting';
  s.currentTurnId = s.firstBettorId;

  // 9. 스냅샷
  pushUndoSnapshot(s);
}
