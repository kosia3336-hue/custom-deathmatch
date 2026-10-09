import type {
  SMS2GameData,
  SMS2PowderSubmission,
  SMS2ResolveStep,
  SMS2RoundRecord,
  SMS2Side,
} from '../shared/types/sun-moon-star-2';
import { MARK_IDS } from '../shared/types/sun-moon-star-2';

/** 제출 대기 중에는 아직 누적에 반영되지 않았다. 양측 제출 후에는 중복 합산하지 않는다. */
export function powderDisplayForRound(
  data: SMS2GameData | null | undefined,
  draft: SMS2PowderSubmission,
) {
  if (!data?.selfPrivate) return { preview: null, submitted: null };
  const self = data.selfPrivate;
  const isPowder = data.phase === 'powder';
  const submitted = isPowder
    ? data.players[self.side].submittedPowder
      ? self.pendingPowder
      : draft
    : self.pendingPowder;
  return { preview: isPowder ? submitted : null, submitted };
}

/** 재접속으로 resolve 스텝을 못 받은 경우에도 이번 라운드의 공개된 결과만으로 표시한다. */
export function resolveStepsForDisplay(data: SMS2GameData): SMS2ResolveStep[] | null {
  if (data.phase !== 'resolve' && data.phase !== 'roundEnd') return null;
  if (data.resolveSteps?.length) return data.resolveSteps;
  const record =
    data.roundResult?.round === data.round
      ? data.roundResult
      : data.history.find((r) => r.round === data.round);
  return record ? stepsFromRecord(record) : null;
}

function stepsFromRecord(record: SMS2RoundRecord): SMS2ResolveStep[] {
  const firstSide = record.firstPlayerSide;
  const secondSide = firstSide === 'p1' ? 'p2' : 'p1';
  const steps: SMS2ResolveStep[] = [
    {
      type: 'betReveal',
      firstSide,
      secondSide,
      firstBet: record.bets[firstSide],
      secondBet: record.bets[secondSide],
    },
    {
      type: 'litDecision',
      litMark: record.litMark,
      tieBreak: record.tieBreak,
      totals: record.markTotalsBefore,
    },
  ];
  for (const side of ['p1', 'p2'] as SMS2Side[]) {
    for (const mark of MARK_IDS) {
      const staked = record.bets[side][mark];
      if (staked <= 0) continue;
      steps.push(
        mark === record.litMark
          ? { type: 'payout', side, mark, staked, returned: staked * 2 }
          : { type: 'forfeit', side, mark, amount: staked },
      );
    }
  }
  steps.push(
    { type: 'powderBurn', mark: record.litMark, total: record.markTotalsBefore[record.litMark] },
    {
      type: 'roundSummary',
      chipAfter: record.chipAfter,
      chipDelta: record.chipDelta,
      stageBefore: record.stageBefore,
      stageAfter: record.stageAfter,
    },
  );
  return steps;
}
