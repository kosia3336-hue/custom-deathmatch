'use client';
import type {
  SeedSeotdaCard as SeedSeotdaCardData,
  SeedSeotdaGameData,
} from '@/shared/types/seed-seotda';
import { useCallback, useEffect, useState } from 'react';
const MEMO_PREFIX = 'cdm-seed-seotda-memo:';

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
 * 지금 이 화면에 드러나 있는 카드 — 이번 덱에서 끝난 라운드의 시드와 공개된 패,
 * 그리고 이번 라운드의 시드와 내 손패.
 *
 * 눈에 보이는 것만 모은다. 상대가 안 깐 패는 서버가 null 로 주므로 애초에 들어올 수
 * 없다 — 그것만 사람이 직접 지운다. 내 카드는 잠깐 보였다 사라지기도 하는데(시드를
 * 쓰며 버린 장), 부르는 쪽이 모아 두므로 사라져도 지워진 채 남는다.
 *
 * 지난 덱의 라운드는 빼야 한다. 덱은 다섯 장 밑으로 떨어지면 새로 섞이는데, 그때도
 * 계속 세면 스무 장이 모두 '본 패' 가 되어 카운팅이 통째로 잠긴다.
 */
function collectVisibleCards(data: SeedSeotdaGameData): string[] {
  const seen: string[] = [];
  const add = (card: SeedSeotdaCardData | null | undefined) => {
    if (card) seen.push(card.id);
  };

  for (const round of data.rounds) {
    if (round.deckCycle !== data.deckCycles) continue;
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
 * 메모는 독립 패널로 한 번만 그린다. 라운드 갱신에도 유지하도록 상태는 부모가 들고
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
