'use client';

import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import type {
  ChoiceHoldemEvaluation,
  ChoiceHoldemGameData,
  ChoiceHoldemHandCategory,
  ChoiceHoldemRoundResult,
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

export function evaluationLabel(evaluation: ChoiceHoldemEvaluation | undefined) {
  if (!evaluation) return '';
  const number = evaluation.primaryValues.length > 0 ? ` ${evaluation.primaryValues.join('/')}` : '';
  return `${CATEGORY_LABEL[evaluation.category]}${number}`;
}

/**
 * 그 라운드에 이 사람이 낸 칩.
 *
 * 행동 기록의 totalBet 은 그때까지 이 라운드에 낸 누계라서 마지막 값이 곧 총액이다.
 * 한 번도 행동하지 않았다면(이월 라운드 따위) 기본 베팅만 낸 것이다.
 */
function betOf(round: ChoiceHoldemRoundResult, playerId: string) {
  const mine = round.actions.filter((action) => action.playerId === playerId);
  const last = mine.at(-1);
  return last ? last.totalBet : round.ante;
}

/*
  다이는 이긴 사람이 아니라 던진 사람을 부르므로 이름을 따로 받는다.
  그 사람이 나여도 '나' 로 바꾸지 않는다 — '나님 다이' 가 되어 읽기 이상해진다.
*/
function reasonLabel(
  round: ChoiceHoldemRoundResult,
  winnerName: string | null,
  foldedName: string | null,
) {
  if (round.reason === 'tie') return '동률 · 팟 이월';
  if (round.reason === 'fold') return `${foldedName ?? '상대'}님 다이`;
  return `${winnerName ?? '플레이어'} 승`;
}

/**
 * 라운드 기록 — 내가 얼마를 걸었고, 누가 무슨 패로 이겼는지.
 *
 * 넓은 화면에서는 GameFrame 의 옆 칸, 좁은 화면에서는 상단 바의 '메모' 아이콘으로 연다.
 * 같은 것을 두 자리에서 쓰므로 바깥 여백은 두지 않는다.
 */
export default function RecordPanel({
  data,
  myId,
}: {
  data: ChoiceHoldemGameData;
  myId: string;
}) {
  const name = (id: string | null | undefined) =>
    id ? (id === myId ? '나' : (data.players[id]?.nickname ?? '상대')) : null;
  const opponentId = Object.keys(data.players).find((id) => id !== myId) ?? null;
  const isPlayer = Boolean(data.players[myId]);

  return (
    <GameInfoStack>
      <GameInfoPart title="라운드 기록">
        {data.rounds.length === 0 ? (
          <p className="text-cdm-ink-fg-muted text-xs">아직 끝난 라운드가 없습니다.</p>
        ) : (
          <ul className="max-h-72 space-y-1 overflow-y-auto">
            {[...data.rounds].reverse().map((round) => {
              const winnerName = name(round.winnerId);
              const foldedName = round.foldedPlayerId
                ? (data.players[round.foldedPlayerId]?.nickname ?? null)
                : null;
              return (
                <li key={round.round} className="rounded-md bg-white/5 px-2 py-1.5 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-cdm-ink-fg-muted">{round.round}R</span>
                    <span className="text-cdm-ink-fg font-bold">
                      {reasonLabel(round, winnerName, foldedName)}
                    </span>
                    <span className="text-cdm-ink-fg-muted tabular-nums">팟 {round.potAmount}</span>
                  </div>
                  {/* 내가 낸 칩은 늘 보이게 둔다 — 이 기록을 여는 까닭이 대개 그것이다 */}
                  {isPlayer && (
                    <p className="text-cdm-ink-fg-muted mt-0.5 tabular-nums">
                      내 베팅 <b className="text-cdm-ink-fg">{betOf(round, myId)}</b>
                      {opponentId && ` · 상대 ${betOf(round, opponentId)}`}
                      <span className="ml-1">(기본 {round.ante} 포함)</span>
                    </p>
                  )}
                  {round.evaluations && (
                    <p className="text-cdm-ink-fg mt-0.5">
                      {Object.entries(round.evaluations).map(([playerId, evaluation], index) => (
                        <span key={playerId}>
                          {index > 0 && <span className="text-cdm-ink-fg-muted"> · </span>}
                          <span className="text-cdm-ink-fg-muted">{name(playerId)} </span>
                          {evaluationLabel(evaluation)}
                          {round.holeCards?.[playerId] && (
                            <span className="text-cdm-ink-fg-muted">
                              {' '}
                              [{round.holeCards[playerId].join(' ')}]
                            </span>
                          )}
                        </span>
                      ))}
                    </p>
                  )}
                  {round.communityCards.length > 0 && (
                    <p className="text-cdm-ink-fg-muted mt-0.5 tracking-wider">
                      공유 {round.communityCards.join(' ')}
                      {round.choiceFaceUp != null && ` · 선택 ${round.choiceFaceUp}`}
                    </p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </GameInfoPart>
    </GameInfoStack>
  );
}
