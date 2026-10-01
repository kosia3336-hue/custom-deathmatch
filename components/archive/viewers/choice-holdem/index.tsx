'use client';

import { Card } from '@/components/cdm/Card';
import CardTile from '@/components/game/modules/choice-holdem/CardTile';
import type { GameRecordFile } from '@/shared/types/archive';
import type {
  ChoiceHoldemArchiveRecord,
  ChoiceHoldemEvaluation,
  ChoiceHoldemHandCategory,
} from '@/shared/types/choice-holdem';

const CATEGORY_LABEL: Record<ChoiceHoldemHandCategory, string> = {
  'high-card': '하이 카드',
  'one-pair': '원 페어',
  'two-pair': '투 페어',
  triple: '트리플',
  straight: '스트레이트',
  'full-house': '풀하우스',
  'four-kind': '포 카드',
};

function handLabel(evaluation: ChoiceHoldemEvaluation | undefined) {
  if (!evaluation) return '';
  return `${CATEGORY_LABEL[evaluation.category]}${evaluation.primaryValues.length ? ` · ${evaluation.primaryValues.join('/')}` : ''}`;
}

export default function ChoiceHoldemViewer({ record }: { record: GameRecordFile }) {
  const data = record.gameRecord as ChoiceHoldemArchiveRecord | null;
  if (!data || !Array.isArray(data.rounds)) {
    return <p className="text-cdm-fg-muted text-sm">초이스 홀덤 기록을 읽을 수 없습니다.</p>;
  }
  const playerEntries = Object.entries(data.players);
  const winnerName = data.winnerId ? data.players[data.winnerId]?.nickname : null;

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-cdm-fg-subtle text-xs font-bold tracking-[0.14em]">
              CHOICE HOLD&apos;EM
            </p>
            <p className="text-cdm-fg mt-1 text-sm font-semibold">{data.finishReason}</p>
          </div>
          <div className="flex gap-5">
            {playerEntries.map(([playerId, player]) => (
              <div key={playerId} className="text-right">
                <p className="text-cdm-fg-muted text-xs font-semibold">{player.nickname}</p>
                <p className="text-cdm-primary text-2xl font-black tabular-nums">
                  {data.finalChips[playerId] ?? 0}칩
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="text-cdm-highlight mt-2 text-sm font-black">
          {winnerName ? `${winnerName} 승리` : '무승부'}
        </p>
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        {data.rounds.map((round) => {
          const winner = round.winnerId ? data.players[round.winnerId]?.nickname : null;
          /* 다이는 던진 사람을 부른다 — 인게임 문구와 같게 맞춘다 */
          const folded = round.foldedPlayerId
            ? data.players[round.foldedPlayerId]?.nickname
            : null;
          return (
            <Card key={round.round} className="p-3 sm:p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">
                    ROUND {round.round}
                  </p>
                  <p className="text-cdm-fg mt-0.5 text-sm font-black">
                    {round.reason === 'tie'
                      ? '완전 동률 · 팟 이월'
                      : round.reason === 'fold'
                        ? `${folded ?? '상대'}님 다이`
                        : `${winner} 승리`}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-cdm-primary text-sm font-black">팟 {round.potAmount}</p>
                  <p className="text-cdm-fg-muted text-[10px]">
                    기본 베팅 {round.carryRound ? '생략' : round.ante}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex justify-center gap-1.5">
                {round.communityCards.map((card, index) => (
                  <CardTile key={index} value={card} compact />
                ))}
              </div>

              {round.holeCards ? (
                <div className="mt-3 grid grid-cols-2 gap-2">
                  {playerEntries.map(([playerId, player]) => (
                    <div key={playerId} className="bg-cdm-bg-elev-1 rounded-cdm-md p-2 text-center">
                      <p className="text-cdm-fg-muted truncate text-[10px]">{player.nickname}</p>
                      <div className="mt-1 flex justify-center gap-1">
                        {round.holeCards?.[playerId]?.map((card, index) => (
                          <CardTile key={index} value={card} compact />
                        ))}
                      </div>
                      <p className="text-cdm-fg mt-1 text-xs font-black">
                        {handLabel(round.evaluations?.[playerId])}
                      </p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-cdm-fg-muted mt-3 text-center text-xs">
                  다이로 종료되어 개인 카드는 공개되지 않았습니다.
                </p>
              )}

              <details className="border-cdm-border mt-3 border-t pt-3">
                <summary className="text-cdm-fg-muted cursor-pointer text-xs font-bold">
                  베팅 기록 {round.actions.length}개
                </summary>
                <div className="mt-2 space-y-1">
                  {round.actions.map((action, index) => (
                    <p key={index} className="bg-cdm-bg-elev-1 rounded-cdm-sm px-2 py-1 text-xs">
                      <b>{data.players[action.playerId]?.nickname}</b> ·{' '}
                      {action.phase === 'first' ? '1차' : '2차'} ·{' '}
                      {action.action === 'fold'
                        ? '다이'
                        : action.action === 'raise'
                          ? `레이즈 +${action.amount}`
                          : action.amount === 0
                            ? '체크'
                            : `콜 +${action.amount}`}
                    </p>
                  ))}
                </div>
              </details>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
