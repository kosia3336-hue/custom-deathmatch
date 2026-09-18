'use client';

import { useCallback, useState } from 'react';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { SeedSeotdaCard } from '@/components/game/cards';
import { cn } from '@/lib/utils';
import { createSeedSeotdaDeck } from '@/shared/logic/seed-seotda';
import type { SeedSeotdaGameData, SeedSeotdaRoundResult } from '@/shared/types/seed-seotda';

/** 스무 장. 월 순서, 그 안에서 a·b. */
const DECK = createSeedSeotdaDeck();
const MEMO_PREFIX = 'cdm-seed-seotda-memo:';

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

/** 표시해 둔 카드는 이 기기에만 둔다(판마다 새로). */
function readMarks(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function writeMarks(key: string, marks: string[]) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const stored = window.localStorage.key(i);
      if (stored && stored.startsWith(MEMO_PREFIX) && stored !== key) {
        window.localStorage.removeItem(stored);
      }
    }
    window.localStorage.setItem(key, JSON.stringify(marks));
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 쓴다
  }
}

/**
 * 메모탭 — 라운드 기록과 카운팅.
 *
 * 카운팅은 스무 장을 그대로 늘어놓고 플레이어가 직접 눌러 지운다. 자동으로 세지
 * 않는 까닭은, 다이로 덮인 패처럼 '덱에서는 빠졌지만 무엇인지 모르는' 카드가
 * 있어서다 — 기계가 세면 그 칸을 어느 쪽으로도 정할 수 없고, 반쯤 맞는 숫자는
 * 안 세느니만 못하다. 무엇을 지울지는 사람이 정한다.
 *
 * 넓은 화면은 GameFrame 의 옆 칸, 좁은 화면은 상단 바 '메모' 로 연다.
 */
/**
 * 카운팅 메모 상태.
 *
 * 이 패널은 상단 바 '메모' 와 옆 칸에 두 번 그려진다. 상태를 패널 안에 두면
 * 한쪽에서 지운 것이 다른 쪽에 안 보이므로, 부모가 하나만 들고 나눠 준다.
 */
export function useSeedSeotdaMarks(memoKey: string) {
  const [marks, setMarks] = useState<string[]>(() => readMarks(memoKey));
  const toggleMark = useCallback(
    (cardId: string) => {
      setMarks((previous) => {
        const next = previous.includes(cardId)
          ? previous.filter((id) => id !== cardId)
          : [...previous, cardId];
        writeMarks(memoKey, next);
        return next;
      });
    },
    [memoKey],
  );
  return { marks, toggleMark };
}

export default function RecordPanel({
  data,
  myId,
  marks,
  onToggleMark,
}: {
  data: SeedSeotdaGameData;
  myId: string;
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
                          {evaluation && (
                            <span className="text-cdm-ink-fg">{evaluation.name}</span>
                          )}
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
        <p className="text-cdm-ink-fg-muted mb-1.5 text-[11px]">
          나온 패를 눌러 지웁니다. 다시 누르면 되돌아옵니다.
        </p>
        <div className="grid grid-cols-5 justify-items-center gap-1">
          {DECK.map((card) => {
            const marked = marks.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                onClick={() => onToggleMark(card.id)}
                aria-pressed={marked}
                aria-label={`${card.month}월 ${card.variant === 'a' ? '첫' : '둘'}째 장`}
                /*
                  flex 로 둬야 카드 아래에 글자 여백이 안 붙는다(칸마다 8px 씩 버려졌다).
                  흐리기는 클래스로 주면 먹지 않았다 — 눌러도 그대로 밝게 남았다.
                  그림이 지워졌는지가 이 기능의 전부라 인라인으로 못 박는다.
                */
                className={cn('flex rounded transition-all', marked && 'grayscale')}
                style={{ opacity: marked ? 0.25 : 1 }}
              >
                <SeedSeotdaCard card={card} size="tiny" />
              </button>
            );
          })}
        </div>
      </GameInfoPart>
    </GameInfoStack>
  );
}
