'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import type {
  WinningStreakGameData, WSCardType, WSCardCount, WSPlayerInfo,
} from '@/shared/types/winning-streak';
import { WS_TOTAL_ROUNDS, CARD_TYPES } from '@/shared/types/winning-streak';
import { WIN_TYPE_LABELS, CARD_COLORS, CARD_NAMES, CARD_MATCHUP_DESC } from './constants';
import { GameFrame } from '@/components/game/GameFrame';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';

/* ────────── types ────────── */

interface ModalCard {
  type: WSCardType;
  index: number;
}

/* ────────── helpers ────────── */

function getAvailableCards(cards: WSCardCount, lastPlayed: WSCardType | null): WSCardType[] {
  const available: WSCardType[] = [];
  for (const ct of CARD_TYPES) {
    if (cards[ct] <= 0) continue;
    if (ct === lastPlayed) continue;
    available.push(ct);
  }
  if (available.length === 0 && lastPlayed && cards[lastPlayed] > 0) {
    available.push(lastPlayed);
  }
  return available;
}

function getCardEntries(cards: WSCardCount): { type: WSCardType; count: number }[] {
  return CARD_TYPES.map((ct) => ({ type: ct, count: cards[ct] }));
}

/* ────────── main ────────── */

export default function WinningStreakGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as WinningStreakGameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();
  const { setHud } = useRoomLayout();

  const [modalCard, setModalCard] = useState<ModalCard | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const shownWinnerRef = useRef<string | null>(null);
  const prevRoundRef = useRef<number | null>(null);
  const [roundOverlay, setRoundOverlay] = useState<number | null>(null);

  const phaseLabel = gameData?.phase === 'cardSelect'
    ? '카드 선택'
    : gameData?.phase === 'reveal' || gameData?.phase === 'result'
      ? '카드 공개'
      : gameData?.phase === 'finished'
        ? '종료'
        : undefined;

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round} / ${WS_TOTAL_ROUNDS}R`,
      order: phaseLabel,
      memo: <WinningStreakSidePanel gameData={gameData} myId={myId} />,
    });
    return () => setHud(null);
  }, [gameData, myId, phaseLabel, setHud]);

  const handleCardClick = useCallback((type: WSCardType, index: number, isLocked: boolean) => {
    if (submitting || isSpectator) return;
    if (isLocked) {
      toast.warning('직전 라운드에 낸 카드는 연속으로 낼 수 없습니다.', { duration: 2500 });
      return;
    }
    setModalCard({ type, index });
  }, [submitting, isSpectator]);

  const handleCloseModal = useCallback(() => setModalCard(null), []);

  const handleSubmitFromModal = useCallback(() => {
    if (!modalCard || submitting) return;
    setSubmitting(true);
    getSocket().emit('game:action', { type: 'selectCard', card: modalCard.type });
    setModalCard(null);
    setTimeout(() => setSubmitting(false), 500);
  }, [modalCard, submitting]);

  // Reset on new round
  useEffect(() => {
    if (!gameData) return;
    if (prevRoundRef.current !== null && prevRoundRef.current !== gameData.round) {
      setModalCard(null);
      setSubmitting(false);
      setRoundOverlay(gameData.round);
      prevRoundRef.current = gameData.round;
      const t = setTimeout(() => setRoundOverlay(null), 2000);
      return () => clearTimeout(t);
    }
    prevRoundRef.current = gameData.round;
  }, [gameData?.round]);

  useEffect(() => {
    if (gameData?.phase === 'cardSelect') setSubmitting(false);
  }, [gameData?.phase]);

  useEffect(() => {
    if (!gameData?.winner || !gameData?.winType) return;
    if (gameData.winType === 'draw') {
      if (shownWinnerRef.current === 'draw') return;
      shownWinnerRef.current = 'draw';
      toast.info('무승부!', { duration: 5000 });
      return;
    }
    if (shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;
    const winnerNick = gameData.players[gameData.winner]?.nickname ?? '???';
    const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
    const isMe = gameData.winner === myId;
    if (isMe) toast.success(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
    else toast.error(`${winnerNick} 승리! ${reason}`, { duration: 5000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  const playerIds = Object.keys(gameData.players);
  const myPlayer = myId ? gameData.players[myId] : null;
  const isCardSelect = gameData.phase === 'cardSelect';
  const isRevealing = gameData.phase === 'reveal' || gameData.phase === 'result';
  const isFinished = gameData.phase === 'finished';
  const mySubmitted = myPlayer?.submitted ?? false;
  const canAct = isCardSelect && !isSpectator && !mySubmitted && !isFinished;
  const availableCards = myPlayer
    ? getAvailableCards(myPlayer.remainingCards, myPlayer.lastPlayedCard)
    : [];

  return (
    <>
      {/* ── 카드 선택 모달 ── */}
      {modalCard && (
        <CardModal
          card={modalCard.type}
          onClose={handleCloseModal}
          onSubmit={handleSubmitFromModal}
          submitting={submitting}
        />
      )}

      <GameFrame
        controls={
          <div className="flex flex-col gap-1.5">
            {myPlayer && !isSpectator && (
              <MyCardHand
                cards={myPlayer.remainingCards}
                lastPlayed={myPlayer.lastPlayedCard}
                available={availableCards}
                onCardClick={handleCardClick}
                canAct={canAct}
                submitted={mySubmitted}
              />
            )}
          </div>
        }
        aside={<WinningStreakSidePanel gameData={gameData} myId={myId} />}
      >
        <div className="flex h-full w-full flex-col items-center justify-center gap-2 overflow-hidden rounded-xl border border-gray-200 bg-white p-3">
          {isRevealing && gameData.revealData ? (
            <RevealArea
              revealData={gameData.revealData}
              playerIds={playerIds}
              players={gameData.players}
              myId={myId}
            />
          ) : isCardSelect ? (
            <div className="flex flex-col items-center gap-2 text-gray-400">
              {mySubmitted ? (
                <span className="animate-pulse text-sm text-indigo-500 lg:text-base">
                  상대의 제출을 기다리는 중...
                </span>
              ) : !isSpectator ? (
                <span className="text-sm lg:text-base">카드를 눌러 선택하세요</span>
              ) : null}
            </div>
          ) : isFinished ? (
            <div className="text-center">
              <p className="mt-2 text-xl font-bold text-gray-800 lg:text-2xl">
                {gameData.winner
                  ? `${gameData.players[gameData.winner]?.nickname} 승리!`
                  : '무승부!'}
              </p>
              {gameData.winType && (
                <p className="mt-1 text-sm text-gray-500 lg:text-base">
                  {WIN_TYPE_LABELS[gameData.winType] ?? gameData.winType}
                </p>
              )}
            </div>
          ) : null}

          {isSpectator && (
            <div className="mt-2 flex w-full flex-col gap-1.5">
              {playerIds.map((pid) => (
                <StatLine
                  key={pid}
                  player={gameData.players[pid]}
                  label={gameData.players[pid].nickname}
                  isMe={false}
                />
              ))}
            </div>
          )}
        </div>

        {roundOverlay !== null && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="animate-bounce rounded-xl bg-indigo-600 px-8 py-4 text-2xl font-bold text-white shadow-xl">
              라운드 {roundOverlay}
            </div>
          </div>
        )}
      </GameFrame>

    </>
  );
}

function WinningStreakSidePanel({ gameData, myId }: { gameData: WinningStreakGameData; myId: string }) {
  const ids = Object.keys(gameData.players);
  const opponentId = ids.find((id) => id !== myId);
  const opponent = opponentId ? gameData.players[opponentId] : undefined;
  return (
    <GameInfoStack>
      <GameInfoPart title="전적">
        <div className="space-y-1.5">
          {ids.map((id) => (
            <StatLine key={id} player={gameData.players[id]} label={id === myId ? '나' : '상대'} isMe={id === myId} />
          ))}
        </div>
      </GameInfoPart>
      {opponent && (
        <GameInfoPart title="상대 잔여 카드">
          <CardRow cards={opponent.remainingCards} lastPlayed={opponent.lastPlayedCard} label="" />
        </GameInfoPart>
      )}
      <GameInfoPart>
        <RoundHistory history={gameData.roundHistory} players={gameData.players} />
      </GameInfoPart>
    </GameInfoStack>
  );
}

/** 한 줄짜리 전적 — 연승·최대·승수. 예전 PlayerBar 를 정보 칸 높이에 맞게 줄인 것. */
function StatLine({ player, label, isMe }: { player: WSPlayerInfo; label: string; isMe: boolean }) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg border px-2.5 py-1.5 ${
        isMe ? 'border-cdm-primary/50 bg-cdm-primary/15' : 'border-cdm-ink-border bg-white/5'
      }`}
    >
      <span className="min-w-0 truncate text-xs font-bold text-cdm-ink-fg">{player.nickname}</span>
      <span className="shrink-0 text-[10px] text-cdm-ink-fg-muted">{label}</span>
      <span className="ml-auto shrink-0 text-[11px] font-bold whitespace-nowrap text-cdm-ink-fg tabular-nums">
        {player.currentStreak}연승 · 최대 {player.maxStreak} · {player.totalWins}승
      </span>
    </div>
  );
}

/* ────────── CardModal ────────── */

function CardModal({
  card, onClose, onSubmit, submitting,
}: {
  card: WSCardType;
  onClose: () => void;
  onSubmit: () => void;
  submitting: boolean;
}) {
  const style = CARD_COLORS[card];
  const info = CARD_MATCHUP_DESC[card];

  return (
    <div
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-xl sm:rounded-2xl">
        {/* 카드 미리보기 */}
        <div className="flex items-center gap-4 mb-5">
          <div className={`flex flex-col items-center justify-center rounded-xl w-20 h-28 border-2 shrink-0 ${style.border} ${style.bg} ${style.text}`}>
            <span className="text-4xl">{style.icon}</span>
            <span className="mt-1.5 text-sm font-semibold">{CARD_NAMES[card]}</span>
          </div>
          <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-2 text-sm lg:text-base flex-1 min-w-0">
            <span className="font-semibold text-emerald-600 whitespace-nowrap">이김</span>
            <span className="text-gray-700 min-w-0">{info.beats}</span>
            <span className="font-semibold text-red-500 whitespace-nowrap">짐</span>
            <span className="text-gray-700 min-w-0">{info.losesTo}</span>
            {info.special && (
              <>
                <span className="text-gray-400 text-xs whitespace-nowrap pt-1.5 border-t border-gray-100">특이</span>
                <span className="text-gray-400 text-xs min-w-0 pt-1.5 border-t border-gray-100">{info.special}</span>
              </>
            )}
          </div>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors lg:text-base"
          >
            취소
          </button>
          <button
            onClick={onSubmit}
            disabled={submitting}
            className="flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors lg:text-base"
          >
            {CARD_NAMES[card]} 제출
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── CardRow (잔여 카드 배지) ────────── */

function CardRow({
  cards, lastPlayed, label,
}: {
  cards: WSCardCount;
  lastPlayed: WSCardType | null;
  label: string;
}) {
  const entries = getCardEntries(cards);
  return (
    <div className="rounded-lg border border-cdm-ink-border bg-white/5 px-3 py-2">
      {label && <p className="mb-1.5 text-xs font-medium text-cdm-ink-fg-muted uppercase lg:text-sm">{label}</p>}
      <div className="flex flex-wrap gap-1.5">
        {entries.map(({ type, count }) => {
          const style = CARD_COLORS[type];
          const isLocked = type === lastPlayed;
          const isEmpty = count <= 0;
          return (
            <div
              key={type}
              className={`flex items-center gap-1 rounded-md px-2 py-1 text-xs lg:text-sm font-medium ${
                isEmpty
                  ? 'bg-gray-100 text-gray-300 line-through'
                  : isLocked
                    ? 'bg-gray-200 text-gray-500 ring-1 ring-red-300'
                    : `${style.bg} ${style.text}`
              }`}
            >
              <span>{style.icon}</span>
              <span className="font-mono font-bold">×{count}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── MyCardHand ────────── */

function MyCardHand({
  cards, lastPlayed, available, onCardClick, canAct, submitted,
}: {
  cards: WSCardCount;
  lastPlayed: WSCardType | null;
  available: WSCardType[];
  onCardClick: (type: WSCardType, index: number, isLocked: boolean) => void;
  canAct: boolean;
  submitted: boolean;
}) {
  const entries = getCardEntries(cards);

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-2 lg:p-4">
      <p className="mb-1.5 text-center text-[11px] font-medium text-gray-500 lg:text-sm">
        {submitted ? '제출 완료 — 상대를 기다리는 중...' : '카드를 눌러 선택하세요'}
      </p>
      {/*
        손패는 한 줄로만 둔다. 줄바꿈하면 카드 수에 따라 조작부 높이가 달라져
        그때마다 판이 출렁이고, 많이 들면 화면 밖으로 나간다. 넘치면 가로로
        민다 — 세로 스크롤과 달리 판과 조작부는 제자리에 있는다.
      */}
      <div className="flex gap-2 overflow-x-auto overscroll-x-contain pb-1 lg:justify-center lg:gap-4">
        {entries.map(({ type, count }) => {
          if (count <= 0) return null;
          const style = CARD_COLORS[type];
          const isLocked = type === lastPlayed && !available.includes(type);
          const isAvailable = available.includes(type);

          return Array.from({ length: count }, (_, i) => (
            <button
              key={`${type}-${i}`}
              onClick={() => (canAct && !submitted) && onCardClick(type, i, isLocked)}
              className={`relative flex flex-col items-center justify-center rounded-xl border-2 transition-all select-none
                w-14 h-[76px] shrink-0 sm:w-20 sm:h-28 lg:w-24 lg:h-32
                ${isLocked
                  ? `${style.border} opacity-50 cursor-pointer`
                  : isAvailable && canAct && !submitted
                    ? `${style.border} hover:scale-105 hover:-translate-y-2 cursor-pointer shadow-sm hover:shadow-lg active:scale-95`
                    : `${style.border} opacity-40 cursor-not-allowed`
                }
                ${style.bg} ${style.text}
              `}
            >
              <span className="text-xl sm:text-3xl lg:text-5xl">{style.icon}</span>
              <span className="mt-1 text-[10px] sm:text-xs lg:text-base font-semibold leading-tight text-center px-0.5">
                {CARD_NAMES[type]}
              </span>
            </button>
          ));
        })}
      </div>
    </div>
  );
}

/* ────────── RevealArea ────────── */

// step 1: 첫 번째 카드 | step 2: 두 번째 카드 | step 3: 승패 결과 | step 4: 연승 변화
const REVEAL_STEPS = [400, 1000, 1700, 2500];

function Reveal({ visible, children }: { visible: boolean; children: React.ReactNode }) {
  return (
    <div className={`transition-all duration-500 ${visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
      {children}
    </div>
  );
}

function RevealArea({
  revealData, playerIds, players, myId,
}: {
  revealData: WinningStreakGameData['revealData'];
  playerIds: string[];
  players: Record<string, WSPlayerInfo>;
  myId: string | null;
}) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!revealData) return;
    setStep(0);
    const timers = REVEAL_STEPS.map((delay, i) =>
      setTimeout(() => setStep(i + 1), delay),
    );
    return () => timers.forEach(clearTimeout);
  }, [revealData]);

  if (!revealData) return null;

  const orderedIds = myId && playerIds.includes(myId)
    ? [myId, ...playerIds.filter((id) => id !== myId)]
    : playerIds;

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      {/* Step 1~2: 카드 한 장씩 공개 */}
      <div className="flex items-center justify-center gap-6 sm:gap-12">
        {orderedIds.map((pid, idx) => {
          const pr = revealData.players[pid];
          if (!pr) return null;
          const style = CARD_COLORS[pr.card];
          return (
            <div key={pid} className={`flex flex-col items-center gap-2 transition-all duration-500 ${step >= idx + 1 ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-3'}`}>
              <span className="text-sm font-medium text-gray-500 truncate max-w-[90px] lg:text-base lg:max-w-[120px]">
                {players[pid]?.nickname}
              </span>
              <div className={`flex flex-col items-center justify-center rounded-xl border-2 w-20 h-28 lg:w-28 lg:h-40 ${style.bg} ${style.text} border-gray-300`}>
                <span className="text-3xl lg:text-5xl">{style.icon}</span>
                <span className="mt-1 text-xs font-semibold lg:text-base">{CARD_NAMES[pr.card]}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Step 3: 승패 + 설명 */}
      <Reveal visible={step >= 3}>
        <div className="flex flex-col items-center gap-2">
          <p className="text-base font-semibold text-gray-700 lg:text-lg text-center">
            {revealData.matchDescription}
          </p>
          <div className="flex items-center justify-center gap-6 sm:gap-12">
            {orderedIds.map((pid) => {
              const pr = revealData.players[pid];
              if (!pr) return null;
              const isWin = pr.result === 'win' || pr.result === 'draw_win';
              const isLose = pr.result === 'lose' || pr.result === 'draw_lose';
              return (
                <span key={pid} className={`text-lg font-bold lg:text-xl ${isWin ? 'text-emerald-600' : isLose ? 'text-red-500' : 'text-gray-500'}`}>
                  {pr.result === 'win' ? '승리'
                    : pr.result === 'lose' ? '패배'
                    : pr.result === 'draw_win' ? '양측 승리'
                    : '양측 패배'}
                </span>
              );
            })}
          </div>
        </div>
      </Reveal>

      {/* Step 4: 연승 변화 */}
      <Reveal visible={step >= 4}>
        <div className="flex items-center justify-center gap-6 sm:gap-12">
          {orderedIds.map((pid) => {
            const pr = revealData.players[pid];
            if (!pr) return null;
            return (
              <div key={pid} className="flex flex-col items-center gap-0.5 text-sm">
                {pr.streakAfter > 0
                  ? <span className="text-orange-500 font-bold">{pr.streakAfter}연승</span>
                  : <span className="text-gray-400 text-xs">연승 리셋</span>}
                {pr.maxStreakUpdated && (
                  <span className="text-yellow-500 font-bold text-xs lg:text-sm">최대 연승 갱신!</span>
                )}
              </div>
            );
          })}
        </div>
      </Reveal>
    </div>
  );
}

/* ────────── RoundHistory ────────── */

function RoundHistory({
  history, players,
}: {
  history: WinningStreakGameData['roundHistory'];
  players: Record<string, WSPlayerInfo>;
}) {
  const [open, setOpen] = useState(true);
  const playerIds = Object.keys(players);

  return (
    <div className="h-full w-full rounded-xl border border-cdm-ink-border bg-white/5">
      <button
        className="flex w-full items-center justify-between px-4 py-3 text-sm font-semibold text-cdm-ink-fg lg:text-base"
        onClick={() => setOpen((v) => !v)}
      >
        라운드 기록
        <span className="text-xs text-cdm-ink-fg-muted">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>

      {open && (
        <div className="max-h-72 overflow-y-auto p-2 space-y-1.5 lg:max-h-[420px]">
          {history.length === 0 ? (
            <p className="py-4 text-center text-sm text-cdm-ink-fg-muted">아직 기록이 없습니다</p>
          ) : (
            [...history].reverse().map((round) => (
              <div
                key={round.round}
                className="rounded-lg border border-cdm-ink-border bg-white/5 p-2"
              >
                <div className="mb-1 text-xs font-semibold text-cdm-ink-fg-muted lg:text-sm">
                  R{round.round}
                </div>
                <div className="flex flex-col gap-1">
                  {playerIds.map((pid) => {
                    const pr = round.players[pid];
                    if (!pr) return null;
                    const style = CARD_COLORS[pr.card];
                    const isWin = pr.result === 'win' || pr.result === 'draw_win';
                    return (
                      <div key={pid} className="flex items-center gap-1.5 text-xs lg:text-sm">
                        <span className={`rounded px-1.5 py-0.5 ${style.bg} ${style.text}`}>
                          {style.icon}
                        </span>
                        <span className="truncate text-cdm-ink-fg-muted max-w-[72px]">
                          {players[pid]?.nickname ?? pid}
                        </span>
                        <span className={`ml-auto font-bold ${isWin ? 'text-emerald-600' : 'text-red-400'}`}>
                          {isWin ? '승' : '패'}
                        </span>
                        {pr.streakAfter > 0 && (
                          <span className="text-orange-500">{pr.streakAfter}연</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
