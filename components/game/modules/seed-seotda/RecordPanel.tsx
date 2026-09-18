'use client';

import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { SeedSeotdaCard } from '@/components/game/cards';
import { cn } from '@/lib/utils';
import type { SeedSeotdaGameData, SeedSeotdaRoundResult } from '@/shared/types/seed-seotda';

/**
 * 족보 표 — server/src/socket/games/seed-seotda/judge.ts 가 판정하는 순서 그대로다.
 * 여기 값을 손으로 고치지 말고, 판정이 바뀌면 그쪽을 보고 맞춘다.
 */
const HAND_TABLE: { name: string; detail: string }[] = [
  { name: '삼팔광땡', detail: '3·8 광 두 장' },
  { name: '광땡', detail: '1·3 또는 1·8 광 두 장' },
  { name: '땡', detail: '같은 월 두 장 (장땡 10 … 삥땡 1)' },
  { name: '알리', detail: '1·2' },
  { name: '독사', detail: '1·4' },
  { name: '구삥', detail: '1·9' },
  { name: '장삥', detail: '1·10' },
  { name: '장사', detail: '4·10' },
  { name: '세륙', detail: '4·6' },
  { name: '갑오', detail: '끗수 9' },
  { name: '끗', detail: '끗수 8 → 1' },
  { name: '망통', detail: '끗수 0' },
];

/** 세기만으로 정해지지 않는 것들. 순서표 아래에 따로 적는다. */
const SPECIAL_TABLE: { name: string; detail: string }[] = [
  { name: '암행어사', detail: '4·7 열끗 두 장 — 광땡을 이긴다 (삼팔광땡은 못 이김)' },
  { name: '땡잡이', detail: '3·7 — 9땡 이하의 땡을 이긴다' },
  { name: '구사', detail: '4·9 — 상대가 광땡·땡이 아니면 재경기' },
  { name: '멍텅구리 구사', detail: '4·9 열끗 두 장 — 상대가 광땡이 아니면 재경기' },
];

/** 화투는 월마다 두 장씩, 1~10월 스무 장이다. */
const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CARDS_PER_MONTH = 2;

/**
 * 이번 덱에서 아직 안 나온 패를 월별로 센다.
 *
 * 덱이 떨어지면 다시 섞으므로(engine.ts) 그 전까지 센 것은 의미가 없다. 라운드
 * 기록의 deckRemainingAfter 가 **늘어나는 지점**이 곧 새 덱이 시작된 자리라,
 * 서버가 덱 회차를 따로 보내 주지 않아도 여기서 가려낼 수 있다.
 *
 * 세는 것은 '공개된 패' 뿐이다 — 지난 라운드의 시드와 까인 패, 그리고 지금 깔린
 * 시드. 다이로 덮인 패는 덱에서 빠졌지만 무엇인지 알 수 없으므로 여기서는 여전히
 * '안 나온 패' 로 남는다(사람이 손으로 세도 마찬가지다).
 */
function unseenByMonth(data: SeedSeotdaGameData) {
  const seen = new Map<number, number>();
  const markSeen = (card: { month: number } | null | undefined) => {
    if (!card) return;
    seen.set(card.month, (seen.get(card.month) ?? 0) + 1);
  };

  let start = 0;
  for (let index = 1; index < data.rounds.length; index += 1) {
    if (data.rounds[index].deckRemainingAfter > data.rounds[index - 1].deckRemainingAfter) {
      start = index;
    }
  }
  for (const round of data.rounds.slice(start)) {
    markSeen(round.seedCard);
    for (const cards of Object.values(round.hands)) cards?.forEach(markSeen);
  }

  /*
    라운드 결과 화면에서는 방금 끝난 판이 기록에도 들어가 있고 시드로도 남아 있다.
    그대로 더하면 같은 패를 두 번 센다.
  */
  const currentAlreadyRecorded = data.rounds.at(-1)?.round === data.round;
  if (!currentAlreadyRecorded) markSeen(data.seedCard);

  return MONTHS.map((month) => ({
    month,
    left: Math.max(0, CARDS_PER_MONTH - (seen.get(month) ?? 0)),
  }));
}

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
 * 메모탭 — 족보 표와 라운드 기록.
 *
 * 넓은 화면에서는 GameFrame 의 옆 칸, 좁은 화면에서는 상단 바의 '메모' 로 연다.
 * 같은 것을 두 자리에서 쓰므로 바깥 여백은 두지 않는다.
 */
export default function RecordPanel({
  data,
  myId,
}: {
  data: SeedSeotdaGameData;
  myId: string;
}) {
  const isPlayer = Boolean(data.players[myId]);
  const opponentId = Object.keys(data.players).find((id) => id !== myId) ?? null;
  /* 내 자리도 닉네임을 그대로 보이고 뒤에 (나) 를 붙인다 — 기록에서 누가 누구인지 바로 읽히게 */
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
                        <span className="text-cdm-ink-fg ml-1">· 다이 패널티 {round.diePenalty}</span>
                      )}
                    </p>
                  )}

                  {/*
                    패는 그림으로 보여야 알아본다 — 월 숫자만 적으면 화투를 눈으로
                    맞춰 보는 게임에서 한 번 더 머리를 쓰게 된다.
                    공개된 패만 적는다. 안 깐 패는 줄 자체를 만들지 않는다.
                  */}
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

      <GameInfoPart title="남은 패">
        <p className="text-cdm-ink-fg-muted mb-1.5 text-[11px]">이번 덱에서 아직 안 나온 패</p>
        <div className="grid grid-cols-5 gap-1">
          {unseenByMonth(data).map(({ month, left }) => (
            <div
              key={month}
              className={cn(
                'flex items-center justify-between rounded-md px-1.5 py-1 text-xs tabular-nums',
                left === 0 ? 'bg-white/5 opacity-40' : 'bg-white/10',
              )}
            >
              <span className="text-cdm-ink-fg-muted">{month}월</span>
              <span className={left === 0 ? 'text-cdm-ink-fg-muted' : 'text-cdm-ink-fg font-bold'}>
                {left}
              </span>
            </div>
          ))}
        </div>
      </GameInfoPart>

      <GameInfoPart title="족보">
        <ul className="space-y-0.5 text-xs">
          {HAND_TABLE.map((hand, index) => (
            <li key={hand.name} className="flex items-baseline gap-1.5">
              <span className="text-cdm-ink-fg-muted w-4 shrink-0 tabular-nums">{index + 1}</span>
              <span className="text-cdm-ink-fg shrink-0 font-bold">{hand.name}</span>
              <span className="text-cdm-ink-fg-muted min-w-0">{hand.detail}</span>
            </li>
          ))}
        </ul>
        <p className="text-cdm-ink-fg-muted mt-2 mb-1 text-[11px] font-bold">특수</p>
        <ul className="space-y-0.5 text-xs">
          {SPECIAL_TABLE.map((hand) => (
            <li key={hand.name} className="flex items-baseline gap-1.5">
              <span className="text-cdm-ink-fg shrink-0 font-bold">{hand.name}</span>
              <span className="text-cdm-ink-fg-muted min-w-0">{hand.detail}</span>
            </li>
          ))}
        </ul>
      </GameInfoPart>
    </GameInfoStack>
  );
}
