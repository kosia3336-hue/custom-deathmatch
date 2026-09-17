'use client';

import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
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

/** 패를 '3·8' 처럼 월로 적는다. 공개되지 않은 패는 적지 않는다. */
function handLabel(round: SeedSeotdaRoundResult, playerId: string) {
  const cards = round.hands[playerId];
  if (!cards || cards.length === 0) return null;
  return cards.map((card) => card.month).join('·');
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
  const name = (id: string | null | undefined) =>
    id ? (id === myId ? '나' : (data.players[id]?.nickname ?? '상대')) : null;

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

                  {/* 공개된 패만 적는다 — 안 깐 패는 줄 자체를 만들지 않는다 */}
                  <p className="text-cdm-ink-fg-muted mt-0.5">
                    씨앗 {round.seedCard.month}
                    {Object.keys(data.players).map((playerId) => {
                      const hand = handLabel(round, playerId);
                      if (!hand) return null;
                      const evaluation = round.evaluations[playerId];
                      return (
                        <span key={playerId}>
                          <span className="text-cdm-ink-fg-muted"> · {name(playerId)} </span>
                          <span className="text-cdm-ink-fg">{hand}</span>
                          {evaluation && (
                            <span className="text-cdm-ink-fg-muted"> {evaluation.name}</span>
                          )}
                        </span>
                      );
                    })}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
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
