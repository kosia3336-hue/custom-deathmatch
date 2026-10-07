'use client';

import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { SeedSeotdaCard } from '@/components/game/cards';
import { cn } from '@/lib/utils';
import { createSeedSeotdaDeck } from '@/shared/logic/seed-seotda';
import type { SeedSeotdaGameData, SeedSeotdaRoundResult } from '@/shared/types/seed-seotda';

/** 스무 장. 월 순서, 그 안에서 a·b. */
const DECK = createSeedSeotdaDeck();
const REASON_LABEL: Record<SeedSeotdaRoundResult['reason'], string> = {
  showdown: '승부',
  die: '다이',
  tie: '동일 족보 · 재경기',
  'gusa-rematch': '구사 · 재경기',
  'mung-gusa-rematch': '멍텅구리 구사 · 재경기',
};

/** 그 라운드에 이 사람이 낸 칩. 행동 기록의 totalBet 은 누계라 마지막 값이 총액이다. */
function betOf(round: SeedSeotdaRoundResult, playerId: string) {
  const mine = round.actions.filter((action) => action.playerId === playerId);
  return mine.at(-1)?.totalBet ?? 0;
}

export default function RecordPanel({
  data,
  myId,
  seen,
  marks,
  onToggleMark,
}: {
  data: SeedSeotdaGameData;
  myId: string;
  seen: string[];
  marks: string[];
  onToggleMark: (cardId: string) => void;
}) {
  const isPlayer = Boolean(data.players[myId]);
  const opponentId = Object.keys(data.players).find((id) => id !== myId) ?? null;
  const name = (id: string | null | undefined) => {
    if (!id) return null;
    const nickname = data.players[id]?.nickname ?? '상대';
    return id === myId ? `${nickname}(나)` : nickname;
  };

  return (
    <GameInfoStack>
      <GameInfoPart title="라운드 기록">
        {data.rounds.length === 0 ? (
          <p className="text-cdm-ink-fg-muted text-xs">아직 끝난 라운드가 없습니다.</p>
        ) : (
          <ul className="max-h-64 space-y-1 overflow-y-auto">
            {[...data.rounds].reverse().map((round) => {
              const winner = name(round.winnerId);
              return (
                <li key={round.round} className="rounded-md bg-white/5 px-2 py-1.5 text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-cdm-ink-fg-muted">{round.round}R</span>
                    <span className="text-cdm-ink-fg font-bold">
                      {round.reason === 'die'
                        ? `${name(round.foldedPlayerId) ?? '상대'}님 다이`
                        : round.winnerId
                          ? `${winner} 승`
                          : REASON_LABEL[round.reason]}
                    </span>
                    <span className="text-cdm-ink-fg-muted tabular-nums">팟 {round.potAmount}</span>
                  </div>

                  {isPlayer && (
                    <p className="text-cdm-ink-fg-muted mt-0.5 tabular-nums">
                      내 베팅 <b className="text-cdm-ink-fg">{betOf(round, myId)}</b>
                      {opponentId && ` · 상대 ${betOf(round, opponentId)}`}
                      {round.diePenalty > 0 && (
                        <span className="text-cdm-ink-fg ml-1">
                          · 다이 패널티 {round.diePenalty}
                        </span>
                      )}
                    </p>
                  )}

                  {/* 공개된 패만 적는다 — 안 깐 패는 줄 자체를 만들지 않는다 */}
                  <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                    <span className="text-cdm-ink-fg-muted flex items-center gap-1">
                      시드
                      <SeedSeotdaCard card={round.seedCard} size="tiny" />
                    </span>
                    {Object.keys(data.players).map((playerId) => {
                      const hand = round.hands[playerId];
                      if (!hand || hand.length === 0) return null;
                      const evaluation = round.evaluations[playerId];
                      return (
                        <span key={playerId} className="flex items-center gap-1">
                          <span className="text-cdm-ink-fg-muted">{name(playerId)}</span>
                          {hand.map((card, index) => (
                            <SeedSeotdaCard key={`${card.id}-${index}`} card={card} size="tiny" />
                          ))}
                          {evaluation && <span className="text-cdm-ink-fg">{evaluation.name}</span>}
                        </span>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </GameInfoPart>

      <GameInfoPart title="카운팅">
        {/* 다섯 칸씩 네 줄. 칸이 폭을 정하므로 좁은 화면에서도 꽉 찬다. */}
        <div className="grid grid-cols-5 gap-1">
          {DECK.map((card) => {
            const known = seen.includes(card.id);
            const marked = known || marks.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onToggleMark(card.id)}
                /* 내가 본 패는 되돌릴 일이 없다 — 눌러서 되살아나면 거짓이 된다. */
                disabled={known}
                aria-pressed={marked}
                aria-label={`${card.month}월 ${card.variant === 'a' ? '첫' : '둘'}째 장${known ? ' · 확인됨' : ''}`}
                /*
                  flex 로 둬야 카드 아래에 글자 여백이 안 붙는다(칸마다 8px 씩 버려졌다).
                  흐리기는 클래스로 주면 먹지 않았다 — 눌러도 그대로 밝게 남았다.
                  그림이 지워졌는지가 이 기능의 전부라 인라인으로 못 박는다.
                */
                className={cn('flex w-full rounded transition-all', marked && 'grayscale')}
                style={{ opacity: marked ? 0.25 : 1 }}
              >
                <SeedSeotdaCard card={card} size="full" />
              </button>
            );
          })}
        </div>
      </GameInfoPart>
    </GameInfoStack>
  );
}
