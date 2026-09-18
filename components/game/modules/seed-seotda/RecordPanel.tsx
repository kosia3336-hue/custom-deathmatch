'use client';

import { useCallback, useEffect, useState } from 'react';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { SeedSeotdaCard } from '@/components/game/cards';
import { cn } from '@/lib/utils';
import { createSeedSeotdaDeck } from '@/shared/logic/seed-seotda';
import type {
  SeedSeotdaCard as SeedSeotdaCardData,
  SeedSeotdaGameData,
  SeedSeotdaRoundResult,
} from '@/shared/types/seed-seotda';

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

/**
 * 메모는 이 기기에만 둔다(판마다 새로).
 *
 * seen 은 내가 이미 본 카드, marks 는 내가 손으로 지운 카드다. seen 을 저장해 두는
 * 까닭은 서버가 되돌려주지 않는 것들이 있어서다 — 시드를 쓰며 버린 내 카드, 상대가
 * 다이해서 안 깐 채 넘어간 내 패. 그때 화면에 떠 있었으니 나는 본 것이고, 새로고침
 * 뒤에도 그대로여야 한다.
 */
type SeedSeotdaMemo = { seen: string[]; marks: string[] };

function readMemo(key: string): SeedSeotdaMemo {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return { seen: [], marks: [] };
    const parsed = JSON.parse(raw) as SeedSeotdaMemo;
    return { seen: parsed.seen ?? [], marks: parsed.marks ?? [] };
  } catch {
    return { seen: [], marks: [] };
  }
}

function writeMemo(key: string, memo: SeedSeotdaMemo) {
  try {
    for (let i = window.localStorage.length - 1; i >= 0; i -= 1) {
      const stored = window.localStorage.key(i);
      if (stored && stored.startsWith(MEMO_PREFIX) && stored !== key) {
        window.localStorage.removeItem(stored);
      }
    }
    window.localStorage.setItem(key, JSON.stringify(memo));
  } catch {
    // 저장하지 못해도 이번 화면에서는 그대로 쓴다
  }
}

/**
 * 지금 이 화면에 드러나 있는 카드 — 끝난 라운드의 시드와 공개된 패, 그리고 이번
 * 라운드의 시드와 내 손패.
 *
 * 눈에 보이는 것만 모은다. 상대가 안 깐 패는 서버가 null 로 주므로 애초에 들어올 수
 * 없다 — 그것만 사람이 직접 지운다. 내 카드는 잠깐 보였다 사라지기도 하는데(시드를
 * 쓰며 버린 장), 부르는 쪽이 모아 두므로 사라져도 지워진 채 남는다.
 */
function collectVisibleCards(data: SeedSeotdaGameData): string[] {
  const seen: string[] = [];
  const add = (card: SeedSeotdaCardData | null | undefined) => {
    if (card) seen.push(card.id);
  };

  for (const round of data.rounds) {
    add(round.seedCard);
    for (const hand of Object.values(round.hands)) hand?.forEach(add);
  }
  add(data.seedCard);
  for (const player of Object.values(data.players)) {
    player.cards.forEach(add);
    player.finalHand.forEach(add);
  }
  return seen;
}

/**
 * 메모탭 — 라운드 기록과 카운팅.
 *
 * 카운팅은 스무 장을 늘어놓고, 드러난 카드는 저절로 지워 준다. 나머지는 눌러서
 * 직접 지운다 — 다이로 덮인 패처럼 덱에서는 빠졌지만 무엇인지 모르는 카드가 있어,
 * 그 칸까지 기계가 정하면 반쯤 맞는 숫자가 된다.
 *
 * 넓은 화면은 GameFrame 의 옆 칸, 좁은 화면은 상단 바 '메모' 로 연다.
 */
/**
 * 카운팅 메모 상태.
 *
 * 이 패널은 상단 바 '메모' 와 옆 칸에 두 번 그려지므로, 상태는 부모가 하나만 들고
 * 나눠 준다 — 패널 안에 두면 한쪽에서 지운 것이 다른 쪽에 안 보인다.
 *
 * 본 카드는 쌓기만 한다. 한 번 눈에 들어온 카드는 화면에서 사라져도 덱에서 빠진
 * 사실이 변하지 않으므로, 빼는 일이 없다.
 */
export function useSeedSeotdaMarks(memoKey: string, data: SeedSeotdaGameData | null | undefined) {
  const visible = data ? collectVisibleCards(data) : [];
  const [memo, setMemo] = useState<SeedSeotdaMemo>(() => readMemo(memoKey));

  /* 새 판이면 처음부터 */
  useEffect(() => {
    setMemo(readMemo(memoKey));
  }, [memoKey]);

  useEffect(() => {
    setMemo((previous) => {
      /* cards 와 finalHand 가 같은 장을 가리키므로 안에서도 겹친다 */
      const added = visible.filter(
        (id, index) => visible.indexOf(id) === index && !previous.seen.includes(id),
      );
      if (added.length === 0) return previous;
      const next = {
        seen: [...previous.seen, ...added],
        /* 저절로 지워졌으니 손으로 지운 기록은 치운다 */
        marks: previous.marks.filter((id) => !added.includes(id)),
      };
      writeMemo(memoKey, next);
      return next;
    });
    // visible 은 매 렌더 새 배열이라 값으로 비교한다
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [memoKey, visible.join(',')]);

  const toggleMark = useCallback(
    (cardId: string) => {
      setMemo((previous) => {
        const next = {
          ...previous,
          marks: previous.marks.includes(cardId)
            ? previous.marks.filter((id) => id !== cardId)
            : [...previous.marks, cardId],
        };
        writeMemo(memoKey, next);
        return next;
      });
    },
    [memoKey],
  );

  return { seen: memo.seen, marks: memo.marks, toggleMark };
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
