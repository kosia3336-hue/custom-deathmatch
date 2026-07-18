'use client';

import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import type {
  GS2GameData, GS2CardId, GS2PlayerPublic, GS2ResolveStep,
  GS2RoundRecord, GS2Side,
} from '@/shared/types/grape-sugar-2';
import {
  CARD_IDS, CARD_LABELS, GS2_TOTAL_ROUNDS,
} from '@/shared/types/grape-sugar-2';
import {
  CARD_STYLES, CARD_NAMES, CARD_HINTS, WIN_TYPE_LABELS,
} from './constants';
import { getSkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';

/** 유리설탕 스킨 — 반짝임 위치 */
const CANDY_SPARKLES = [
  { left: '6%',  top: '12%', delay: '0s' },
  { left: '92%', top: '18%', delay: '1.4s' },
  { left: '14%', top: '78%', delay: '2.6s' },
  { left: '86%', top: '70%', delay: '3.4s' },
];

const RESOLVE_STEP_INTERVAL_MS = 1100;
const REVEAL_INITIAL_DELAY_MS = 800;

/* ────────── Main ────────── */

export default function GrapeSugar2Game() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const gameData = gameState?.gameData as GS2GameData | undefined;
  const myId = useMySocketId();
  useTurnTimer();

  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.GRAPE_SUGAR_2);
  const isCandy = skin === 'candy';

  const [pendingSugar, setPendingSugar] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  /** 카드 클릭 시 열리는 확인 모달의 대상 카드 */
  const [modalCard, setModalCard] = useState<GS2CardId | null>(null);
  const [prevRoundKey, setPrevRoundKey] = useState<string>('');

  const shownWinnerRef = useRef<string | null>(null);

  const myPlayer = useMemo(() => {
    if (!gameData || !myId) return null;
    if (gameData.players.p1.id === myId) return gameData.players.p1;
    if (gameData.players.p2.id === myId) return gameData.players.p2;
    return null;
  }, [gameData, myId]);

  const opponent = useMemo(() => {
    if (!gameData || !myId) return gameData?.players.p2 ?? null;
    return gameData.players.p1.id === myId ? gameData.players.p2 : gameData.players.p1;
  }, [gameData, myId]);

  const mySide: GS2Side | null = myPlayer?.side ?? null;

  /* 라운드/페이즈 변동 시 입력 초기화 */
  if (gameData) {
    const key = `${gameData.extension}-${gameData.round}-${gameData.phase}`;
    if (prevRoundKey !== key) {
      setPrevRoundKey(key);
      if (gameData.phase === 'input') {
        if (pendingSugar !== 0) setPendingSugar(0);
        if (submitting) setSubmitting(false);
        if (modalCard !== null) setModalCard(null);
      }
    }
  }

  /* 게임 종료 토스트 */
  useEffect(() => {
    if (!gameData || gameData.phase !== 'finished') return;
    if (gameData.finalWinner === null) return;
    const key = `${gameData.finalWinner}-${gameData.extension}`;
    if (shownWinnerRef.current === key) return;
    shownWinnerRef.current = key;
    if (gameData.finalWinner === 'tie') {
      toast.info('무승부입니다!', { duration: 5000 });
      return;
    }
    const winner = gameData.players[gameData.finalWinner];
    const isMe = winner.id === myId;
    const reason = gameData.winType ? (WIN_TYPE_LABELS[gameData.winType] ?? '') : '';
    if (isMe) toast.success(`${winner.nickname} 승리! (${reason})`, { duration: 5000 });
    else toast.error(`${winner.nickname} 승리! (${reason})`, { duration: 5000 });
  }, [gameData, myId]);

  /* 카드 클릭 → 모달 오픈 (설탕은 이미 입력된 값 사용) */
  const handleSelectCard = useCallback((card: GS2CardId) => {
    if (submitting || isSpectator) return;
    if (!myPlayer || !myPlayer.hand.includes(card)) return;
    setModalCard(card);
  }, [submitting, isSpectator, myPlayer]);

  /* 모달에서 확정 제출 */
  const handleConfirmSubmit = useCallback(() => {
    if (!modalCard || submitting) return;
    if (pendingSugar > (myPlayer?.sugarRemain ?? 0)) {
      toast.error(`설탕이 부족합니다. (보유 ${myPlayer?.sugarRemain ?? 0})`);
      return;
    }
    setSubmitting(true);
    setModalCard(null);
    getSocket().emit('game:action', {
      type: 'submit',
      card: modalCard,
      sugar: pendingSugar,
    });
  }, [modalCard, pendingSugar, submitting, myPlayer]);

  const handleCancelSubmit = useCallback(() => {
    if (!myPlayer?.submitted) return;
    getSocket().emit('game:action', { type: 'cancelSubmit' });
    setSubmitting(false);
  }, [myPlayer]);

  if (!gameData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    );
  }

  const isInput = gameData.phase === 'input';
  const isRoundEnd = gameData.phase === 'roundEnd';
  const isExtension = gameData.phase === 'extensionIntro';
  const isFinished = gameData.phase === 'finished';
  const mySubmitted = myPlayer?.submitted ?? false;
  const oppSubmitted = opponent?.submitted ?? false;
  const canAct = isInput && !isSpectator && !mySubmitted && !!myPlayer;

  return (
    <>
      {/* 카드 선택 확인 모달 */}
      {modalCard && (
        <CardSubmitModal
          card={modalCard}
          sugar={pendingSugar}
          onClose={() => setModalCard(null)}
          onConfirm={handleConfirmSubmit}
          submitting={submitting}
          candy={isCandy}
        />
      )}

      <div
        className={`relative flex flex-1 flex-col gap-2 p-3 lg:flex-row lg:gap-3 lg:p-4 max-w-7xl mx-auto w-full ${
          isCandy ? 'skin-candy-field' : ''
        }`}
      >
        {isCandy && (
          <div className="skin-candy-fx" aria-hidden>
            {CANDY_SPARKLES.map((s, i) => (
              <span key={i} className="skin-candy-sparkle" style={{ left: s.left, top: s.top, animationDelay: s.delay }}>
                ✦
              </span>
            ))}
            <div className="skin-candy-jar skin-candy-jar--left hidden h-20 lg:block" />
            <div className="skin-candy-jar skin-candy-jar--right hidden h-[4.5rem] lg:block" />
          </div>
        )}
        {/* 연장전 인트로 오버레이 */}
        {isExtension && (
          <div className="pointer-events-none absolute inset-0 z-30 flex items-center justify-center">
            <div className="animate-bounce rounded-2xl bg-linear-to-br from-purple-600 to-fuchsia-600 px-10 py-6 text-3xl font-bold text-white shadow-2xl">
              {gameData.extension}차 연장전 시작!
            </div>
          </div>
        )}

        {/* 좌측: 메인 게임 영역 */}
        <div className="flex flex-1 flex-col gap-2 lg:gap-3 min-w-0">
          {/* 라운드 인디케이터 */}
          <RoundIndicator
            round={gameData.round}
            maxRound={gameData.maxRound}
            extension={gameData.extension}
            phase={gameData.phase}
            mySubmitted={mySubmitted}
            oppSubmitted={oppSubmitted}
            isSpectator={isSpectator}
            candy={isCandy}
          />

          {/* 상대 패널 */}
          {opponent && (
            <PlayerPanel
              player={opponent}
              label={isSpectator ? opponent.nickname : '상대'}
              isMe={false}
              showSubmittedBadge={isInput}
              candy={isCandy}
            />
          )}

          {/* 중앙 결투 영역 (reveal/roundEnd/finished 때만 표시) */}
          {gameData.phase !== 'input' && (
            <CombatArea
              phase={gameData.phase}
              roundResult={gameData.roundResult ?? null}
              resolveSteps={gameData.resolveSteps ?? null}
              players={gameData.players}
              mySide={mySide}
              isFinished={isFinished}
              finalWinner={gameData.finalWinner}
              winType={gameData.winType}
              candy={isCandy}
            />
          )}

          {/* 내 패널 */}
          {myPlayer && (
            <PlayerPanel
              player={myPlayer}
              label="나"
              isMe
              showSubmittedBadge={isInput}
              candy={isCandy}
            />
          )}

          {/* 설탕 입력 (관전자 아닐 때, input 페이즈) */}
          {myPlayer && !isSpectator && isInput && (
            <SugarBar
              sugarRemain={myPlayer.sugarRemain}
              pendingSugar={pendingSugar}
              setPendingSugar={setPendingSugar}
              canAct={canAct}
              submitted={mySubmitted}
              oppSubmitted={oppSubmitted}
              onCancelSubmit={handleCancelSubmit}
              candy={isCandy}
            />
          )}

          {/* 카드 핸드 (관전자 아닐 때, input 페이즈) */}
          {myPlayer && !isSpectator && isInput && (
            <CardHand
              hand={myPlayer.hand}
              onSelectCard={handleSelectCard}
              canAct={canAct}
              submitted={mySubmitted}
              candy={isCandy}
            />
          )}
        </div>

        {/* 우측: 사이드 패널 */}
        <div className="lg:w-72 xl:w-80 shrink-0 flex flex-col gap-2 lg:gap-3">
          <RoundHistoryPanel
            history={gameData.history}
            players={gameData.players}
            mySide={mySide}
            open={showHistory}
            setOpen={setShowHistory}
            isRoundEnd={isRoundEnd}
          />
        </div>
      </div>
    </>
  );
}

/* ────────── 라운드 인디케이터 ────────── */

function RoundIndicator({
  round, maxRound, extension, phase, mySubmitted, oppSubmitted, isSpectator, candy,
}: {
  round: number;
  maxRound: 8 | 9;
  extension: number;
  phase: string;
  mySubmitted: boolean;
  oppSubmitted: boolean;
  isSpectator: boolean;
  candy?: boolean;
}) {
  let statusText = '';
  if (phase === 'input') {
    if (mySubmitted && oppSubmitted) statusText = '양측 제출 완료, 정산 시작...';
    else if (mySubmitted) statusText = '상대를 기다리는 중...';
    else if (oppSubmitted) statusText = '상대 제출 완료! 빨리 결정하세요';
    else if (isSpectator) statusText = '양측 입력 대기 중...';
    else statusText = '설탕 입력 후 카드를 눌러 제출하세요';
  } else if (phase === 'reveal') statusText = '정산 중...';
  else if (phase === 'roundEnd') statusText = '라운드 종료';
  else if (phase === 'extensionIntro') statusText = `${extension}차 연장전 시작!`;
  else if (phase === 'finished') statusText = '게임 종료';

  if (candy) {
    return (
      <div className="relative z-10 flex flex-col items-center gap-1">
        <div className="skin-candy-round w-full max-w-xs px-6">
          <span className="skin-candy-round-text text-lg lg:text-xl">
            {extension > 0 && <span className="mr-1.5 text-sm">연장{extension}</span>}
            R {round} / {maxRound}
          </span>
        </div>
        <span className="skin-candy-subtext min-w-0 truncate text-xs font-medium lg:text-sm">
          {statusText}
        </span>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-purple-200 bg-linear-to-r from-purple-50 to-fuchsia-50 px-3 py-2">
      <div className="flex items-baseline gap-1.5 shrink-0">
        {extension > 0 && (
          <span className="rounded bg-purple-600 px-1.5 py-0.5 text-xs font-bold text-white">
            {extension}차 연장
          </span>
        )}
        <span className="text-base font-bold text-purple-900 lg:text-lg">R {round}</span>
        <span className="text-sm text-purple-500">/ {maxRound}</span>
        {maxRound === 9 && extension === 0 && (
          <span className="rounded bg-teal-100 px-1.5 py-0.5 text-[10px] font-bold text-teal-700">
            연장
          </span>
        )}
      </div>
      <span className="ml-2 min-w-0 truncate text-xs font-medium text-purple-600 text-right lg:text-sm">
        {statusText}
      </span>
    </div>
  );
}

/* ────────── 플레이어 패널 ────────── */

function PlayerPanel({
  player, label, isMe, showSubmittedBadge, candy,
}: {
  player: GS2PlayerPublic;
  label: string;
  isMe: boolean;
  showSubmittedBadge: boolean;
  candy?: boolean;
}) {
  return (
    <div className={`relative z-10 flex min-w-0 items-center gap-2 px-3 py-2 ${
      candy
        ? `skin-candy-panel ${isMe ? 'ring-1 ring-white' : ''}`
        : `rounded-lg border ${isMe ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200 bg-white'}`
    }`}>
      {/* 닉네임 + 배지 */}
      <div className="min-w-0 flex items-center gap-1.5 flex-1">
        <span className="truncate text-sm font-bold text-gray-800">{player.nickname}</span>
        <span className="shrink-0 text-xs text-gray-400">{label}</span>
        {showSubmittedBadge && player.submitted && (
          <span className="shrink-0 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-700">제출</span>
        )}
        {player.hrPenaltyPending > 0 && (
          <span className="shrink-0 rounded-full bg-orange-100 px-1.5 py-0.5 text-[10px] font-bold text-orange-700">
            -{player.hrPenaltyPending}
          </span>
        )}
      </div>

      {/* 스탯 */}
      <div className="flex shrink-0 items-center gap-2 text-xs lg:gap-3">
        <span className={`font-bold ${player.score < 0 ? 'text-red-500' : 'text-purple-700'}`}>
          {player.score}점
        </span>
        <span className="font-bold text-amber-700">{player.sugarRemain}</span>
        <span className="font-bold text-sky-600">{player.hand.length}</span>
      </div>

      {/* 잔여 카드 미니 배지 (sm 이상) */}
      <div className="hidden sm:flex shrink-0 flex-wrap gap-0.5 max-w-[200px] justify-end lg:max-w-[240px]">
        {CARD_IDS.map((c) => {
          const has = player.hand.includes(c);
          const style = CARD_STYLES[c];
          return (
            <span
              key={c}
              className={`inline-flex items-center justify-center rounded px-1 py-0.5 text-[9px] font-bold leading-none ${
                has ? `${style.bg} ${style.text} border ${style.border}` : 'bg-gray-100 text-gray-300 line-through'
              }`}
              title={CARD_NAMES[c]}
            >
              {CARD_LABELS[c]}
            </span>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── 중앙 결투 영역 (reveal/roundEnd/finished) ────────── */

/**
 * reveal 페이즈에서 받은 steps를 state로 캐싱해, roundEnd 전환 시에도 유지.
 * resolveSteps가 새 배열로 바뀌면 렌더 시점에 즉시 stepIdx를 0으로 리셋해
 * "결과가 즉시 완성된 채로 표시되는" 문제를 방지한다.
 */
function CombatArea({
  phase, roundResult, resolveSteps, players, mySide,
  isFinished, finalWinner, winType, candy,
}: {
  phase: string;
  roundResult: GS2RoundRecord | null;
  resolveSteps: GS2ResolveStep[] | null;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
  isFinished: boolean;
  finalWinner: GS2Side | 'tie' | null;
  winType: string | null;
  candy?: boolean;
}) {
  const [stepIdx, setStepIdx] = useState(0);
  // reveal steps를 state로 보존 — roundEnd에서 resolveSteps=null 이 와도 유지됨
  const [cachedSteps, setCachedSteps] = useState<GS2ResolveStep[]>([]);

  // 새 라운드의 steps가 도착하면 렌더 중에 즉시 idx를 0으로 리셋.
  // React는 렌더 중 setState를 감지하면 이 렌더를 버리고 새 state로 즉시 재렌더하므로
  // stepIdx가 이전 값인 중간 렌더가 사용자에게 보이지 않는다.
  if (resolveSteps && resolveSteps.length > 0 && resolveSteps !== cachedSteps) {
    setCachedSteps(resolveSteps);
    setStepIdx(0);
  }

  useEffect(() => {
    if (!cachedSteps.length) return;
    // stepIdx는 위의 렌더-타임 리셋으로 이미 0. 타이머만 설정.
    const timers: ReturnType<typeof setTimeout>[] = [];
    timers.push(setTimeout(() => setStepIdx(1), REVEAL_INITIAL_DELAY_MS));
    for (let i = 1; i < cachedSteps.length; i++) {
      timers.push(setTimeout(
        () => setStepIdx(i + 1),
        REVEAL_INITIAL_DELAY_MS + i * RESOLVE_STEP_INTERVAL_MS,
      ));
    }
    return () => timers.forEach(clearTimeout);
  }, [cachedSteps]);

  if (isFinished) {
    return (
      <div
        className={`relative z-10 flex flex-col items-center justify-center py-6 ${
          candy
            ? 'skin-candy-panel'
            : 'rounded-xl border border-purple-300 bg-linear-to-br from-purple-100 to-fuchsia-100'
        }`}
      >
        <p className={`mt-2 text-xl font-bold lg:text-2xl ${candy ? 'skin-candy-heading' : 'text-purple-900'}`}>
          {finalWinner === 'tie' ? '무승부!' : finalWinner ? `${players[finalWinner].nickname} 승리!` : '게임 종료'}
        </p>
        {winType && <p className="mt-0.5 text-sm text-purple-600">{WIN_TYPE_LABELS[winType] ?? winType}</p>}
      </div>
    );
  }

  if ((phase === 'reveal' || phase === 'roundEnd') && cachedSteps.length > 0) {
    return (
      <ResolutionPanel
        steps={cachedSteps}
        cursor={stepIdx}
        players={players}
        mySide={mySide}
        roundResult={roundResult}
        showFinal={phase === 'roundEnd' || stepIdx >= cachedSteps.length}
        candy={candy}
      />
    );
  }

  return (
    <div
      className={`relative z-10 flex items-center justify-center py-4 ${
        candy ? 'skin-candy-panel' : 'rounded-xl border border-gray-200 bg-white'
      }`}
    >
      <span className={`text-sm ${candy ? 'skin-candy-subtext' : 'text-gray-400'}`}>대기 중...</span>
    </div>
  );
}

/* ────────── 라이브 설탕 계산 ────────── */

/**
 * cursor까지 보여진 steps를 기반으로 현재 라운드 설탕 값을 계산.
 * reveal step의 제출값에서 시작해, effect/cancel/final을 순서대로 반영한다.
 */
function computeLiveSugar(steps: GS2ResolveStep[], cursor: number): { p1: number; p2: number } {
  let p1 = 0;
  let p2 = 0;
  const revealStep = steps[0];
  if (revealStep?.type === 'reveal') {
    p1 = revealStep.actions.p1.sugar;
    p2 = revealStep.actions.p2.sugar;
  }
  for (let i = 1; i < cursor; i++) {
    const s = steps[i];
    if (s.type === 'cancel') {
      if (s.targetSide === 'p1') p1 = 0;
      else p2 = 0;
    } else if (s.type === 'effect') {
      if (s.targetSide === 'p1') p1 = s.after;
      else p2 = s.after;
    } else if (s.type === 'final') {
      p1 = s.roundSugar.p1;
      p2 = s.roundSugar.p2;
    }
  }
  return { p1, p2 };
}

/* ────────── 라이브 설탕 뱃지 ────────── */

function LiveSugarBadge({ value }: { value: number }) {
  const prevRef = useRef(value);
  const [deltas, setDeltas] = useState<{ id: number; diff: number }[]>([]);
  const [flash, setFlash] = useState<'up' | 'down' | null>(null);
  const counterRef = useRef(0);

  useEffect(() => {
    const diff = value - prevRef.current;
    prevRef.current = value;
    if (diff === 0) return;

    const id = ++counterRef.current;
    setFlash(diff > 0 ? 'up' : 'down');
    setDeltas((prev) => [...prev, { id, diff }]);

    const t1 = setTimeout(() => setFlash(null), 400);
    const t2 = setTimeout(() => setDeltas((prev) => prev.filter((d) => d.id !== id)), 800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [value]);

  const flashCls =
    flash === 'up'
      ? 'bg-emerald-100 border-emerald-400 scale-110'
      : flash === 'down'
      ? 'bg-rose-100 border-rose-400 scale-110'
      : 'bg-amber-50 border-amber-200 scale-100';

  return (
    <div className="relative flex flex-col items-center">
      {/* 떠오르는 델타 배지들 */}
      {deltas.map(({ id, diff }) => (
        <span
          key={id}
          className={`pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2
            text-sm font-extrabold animate-out fade-out slide-out-to-top-3 duration-700 fill-mode-forwards
            ${diff > 0 ? 'text-emerald-500' : 'text-rose-500'}`}
        >
          {diff > 0 ? `+${diff}` : diff}
        </span>
      ))}
      <div
        className={`flex items-center gap-1 rounded-lg border-2 px-2 py-1
          transition-all duration-300 ${flashCls}`}
      >
        <span
          key={value}
          className="tabular-nums font-bold text-amber-800 text-sm animate-in zoom-in-50 duration-300"
        >
          {value}
        </span>
      </div>
    </div>
  );
}

/* ────────── 정산 패널 ────────── */

function ResolutionPanel({
  steps, cursor, players, mySide, roundResult, showFinal, candy,
}: {
  steps: GS2ResolveStep[];
  cursor: number;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
  roundResult: GS2RoundRecord | null;
  showFinal: boolean;
  candy?: boolean;
}) {
  const reveal = steps[0]?.type === 'reveal' ? steps[0] : null;
  const visibleSteps = steps.slice(0, cursor);
  const nicknameOf = (side: GS2Side) => (mySide === side ? '나' : players[side].nickname);
  const orderedSides: GS2Side[] = mySide === 'p2' ? ['p2', 'p1'] : ['p1', 'p2'];
  const liveSugar = computeLiveSugar(steps, cursor);

  return (
    <div
      className={`relative z-10 flex flex-col gap-3 p-4 lg:p-5 ${
        candy
          ? 'skin-candy-panel'
          : 'rounded-xl border border-purple-200 bg-linear-to-b from-purple-50 to-white'
      }`}
    >
      {/* 카드 + 설탕 동시 공개 */}
      {reveal && reveal.type === 'reveal' && (
        <div className="flex items-center justify-around gap-4">
          {orderedSides.map((side, idx) => {
            const action = reveal.actions[side];
            const card = action.card;
            const style = CARD_STYLES[card];
            return (
              <div
                key={side}
                className={`flex flex-col items-center gap-2 transition-all duration-500 ${
                  cursor >= 1 ? 'opacity-100 scale-100' : 'opacity-0 scale-90'
                }`}
                style={{ transitionDelay: `${idx * 100}ms` }}
              >
                <span className={`text-xs truncate max-w-[100px] ${candy ? 'skin-candy-subtext' : 'text-gray-500'}`}>{nicknameOf(side)}</span>
                <div
                  className={
                    candy
                      ? `skin-candy-card skin-candy-card--${card} flex w-20 flex-col items-center justify-center lg:w-24`
                      : `flex flex-col items-center justify-center rounded-xl border-2 w-20 h-28 lg:w-24 lg:h-32 ${style.bg} ${style.text} ${style.border}`
                  }
                >
                  <span className="text-3xl lg:text-4xl">{style.icon}</span>
                  <span className="mt-1 text-xs font-bold text-center px-1">{CARD_NAMES[card]}</span>
                </div>
                <LiveSugarBadge value={liveSugar[side]} />
              </div>
            );
          })}
        </div>
      )}

      {/* 정산 단계 로그 */}
      <div className="flex flex-col gap-1">
        {visibleSteps.slice(1).map((step, i) => (
          <ResolveStepRow key={i} step={step} players={players} mySide={mySide} />
        ))}
      </div>

      {/* 최종 라운드 결과 */}
      {showFinal && roundResult && (
        <div className="flex items-center justify-around gap-3 rounded-lg border-2 border-purple-300 bg-purple-100 p-2.5 animate-in fade-in duration-500">
          {orderedSides.map((side) => {
            const isWinner = roundResult.winner === side;
            const isTie = roundResult.winner === 'tie';
            const sugar = roundResult.finalRoundSugar[side];
            const delta = roundResult.scoreDelta[side];
            return (
              <div key={side} className="flex flex-col items-center gap-1">
                <span className="text-xs text-gray-500 truncate max-w-[100px]">{nicknameOf(side)}</span>
                <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1 ${
                  isWinner ? 'bg-emerald-500 text-white' : isTie ? 'bg-gray-300 text-gray-700' : 'bg-rose-100 text-rose-700'
                }`}>
                  <span className="font-bold">{sugar}</span>
                  <span className="text-xs font-bold">{isWinner ? '승' : isTie ? '무' : '패'}</span>
                </div>
                {delta !== 0 && (
                  <span className={`text-xs font-bold ${delta > 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {delta > 0 ? `+${delta}` : delta}점
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ResolveStepRow({
  step, players, mySide,
}: {
  step: GS2ResolveStep;
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
}) {
  const nick = (side: GS2Side) => (mySide === side ? '나' : players[side].nickname);
  let text = '';
  let cls = 'text-gray-700';

  switch (step.type) {
    case 'cancel':
      cls = 'text-indigo-700 font-bold';
      text = `${nick(step.bySide)}의 우주뿌셔! → ${nick(step.targetSide)} 무효`;
      break;
    case 'effect':
      text = `${nick(step.actor)}의 ${CARD_NAMES[step.card]}: ${nick(step.targetSide)} 설탕 ${step.before} → ${step.after} (${step.op})`;
      break;
    case 'dice':
      cls = 'text-yellow-700 font-bold';
      text = `${nick(step.actor)}의 주사위: ${step.roll} → ${
        step.branch === 'opp-3' ? '상대 -3' : step.branch === 'self-5' ? '본인 -5' : '미승리 시 상대 +2점 예약'
      }`;
      break;
    case 'final':
      cls = 'text-purple-700 font-bold';
      text = `최종 설탕: ${players.p1.nickname} ${step.roundSugar.p1} vs ${players.p2.nickname} ${step.roundSugar.p2}`;
      break;
    case 'winner':
      cls = 'text-emerald-700 font-bold';
      text = step.winner === 'tie' ? '라운드 무승부' : `${nick(step.winner)} 라운드 승! +1점`;
      break;
    case 'bless':
      cls = step.scoreDelta > 0 ? 'text-purple-700 font-bold' : step.scoreDelta < 0 ? 'text-red-600 font-bold' : 'text-gray-500';
      text = `${nick(step.actor)}의 포도의가호: ${
        step.outcome === 'win' ? `승리 → +${step.scoreDelta}점` : step.outcome === 'loss' ? `패배 → ${step.scoreDelta}점` : '무승부, 보정 없음'
      }`;
      break;
    case 'diceScore':
      cls = 'text-yellow-700 font-bold';
      text = `${nick(step.actor)}의 주사위 5·6 보너스 → ${nick(step.loserBonusTo)} +${step.amount}점`;
      break;
    case 'hrPenaltyScheduled':
      cls = 'text-orange-600 font-bold';
      text = `${nick(step.actor)}의 하이리스크 패배 → 다음 R 시작 시 설탕 ${step.amount}개 이전 예정`;
      break;
    case 'breathExtended':
      cls = 'text-teal-700 font-bold';
      text = '숨고르기! 게임이 9라운드로 연장됩니다.';
      break;
    case 'breathNoEffect':
      cls = 'text-gray-500';
      text = `${nick(step.actor)}의 숨고르기 무효 (${step.reason === 'alreadyExtended' ? '이미 연장됨' : '우주뿌셔!로 무효화'})`;
      break;
    case 'instantWin':
      cls = 'text-red-700 font-bold';
      text = `${nick(step.winner)} 즉시 게임 승리! (무행동 vs 우주뿌셔!)`;
      break;
    default:
      return null;
  }

  return (
    <div className={`flex items-center gap-1.5 rounded bg-white/70 px-2 py-1 text-xs lg:text-sm ${cls} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
      <span className="min-w-0">{text}</span>
    </div>
  );
}

/* ────────── 설탕 입력 바 (SugarBar) ────────── */

function SugarBar({
  sugarRemain, pendingSugar, setPendingSugar, canAct, submitted, oppSubmitted, onCancelSubmit, candy,
}: {
  sugarRemain: number;
  pendingSugar: number;
  setPendingSugar: (n: number) => void;
  canAct: boolean;
  submitted: boolean;
  oppSubmitted: boolean;
  onCancelSubmit: () => void;
  candy?: boolean;
}) {
  const clamp = (n: number) => Math.max(0, Math.min(sugarRemain, Math.floor(n)));
  const adjust = (d: number) => setPendingSugar(clamp(pendingSugar + d));
  const handleInput = (v: string) => {
    if (v === '') { setPendingSugar(0); return; }
    const n = Number(v.replace(/[^\d]/g, ''));
    if (Number.isFinite(n)) setPendingSugar(clamp(n));
  };

  if (submitted) {
    return (
      <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-300 bg-emerald-50 px-3 py-2">
        <span className="flex-1 text-sm font-bold text-emerald-700">제출 완료 — 상대 대기 중...</span>
        {!oppSubmitted && (
          <button
            type="button"
            onClick={onCancelSubmit}
            className="shrink-0 rounded border border-emerald-400 px-2 py-1 text-xs font-bold text-emerald-700 hover:bg-emerald-100"
          >
            취소
          </button>
        )}
      </div>
    );
  }

  if (candy) {
    // 시안 스프라이트 버튼: 라벨은 이미지에 포함 (sr-only로 접근성 유지)
    return (
      <div className="skin-candy-panel relative z-10 flex flex-col gap-1.5 px-3 py-2">
        <div className="flex items-center justify-between">
          <span className="skin-candy-heading text-xs font-medium">제출 설탕</span>
          <span className="skin-candy-subtext text-xs">보유 {sugarRemain}</span>
        </div>
        <div className="flex items-center justify-center gap-1">
          <button type="button" onClick={() => adjust(-5)} disabled={!canAct} className="skin-candy-btn skin-candy-btn--m5 h-9">
            <span className="sr-only">-5</span>
          </button>
          <button type="button" onClick={() => adjust(-1)} disabled={!canAct} className="skin-candy-btn skin-candy-btn--m1 h-9">
            <span className="sr-only">-1</span>
          </button>
          <input
            type="text" inputMode="numeric"
            value={pendingSugar}
            onChange={(e) => handleInput(e.target.value)}
            disabled={!canAct}
            className="skin-candy-input h-9 w-16 px-1 text-sm"
          />
          <button type="button" onClick={() => adjust(1)} disabled={!canAct} className="skin-candy-btn skin-candy-btn--p1 h-9">
            <span className="sr-only">+1</span>
          </button>
          <button type="button" onClick={() => adjust(5)} disabled={!canAct} className="skin-candy-btn skin-candy-btn--p5 h-9">
            <span className="sr-only">+5</span>
          </button>
          <button type="button" onClick={() => setPendingSugar(sugarRemain)} disabled={!canAct} className="skin-candy-btn skin-candy-btn--max h-9">
            <span className="sr-only">MAX</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-2">
      {/* 레이블 + 보유량 */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-gray-500">
          제출 설탕
        </span>
        <span className="text-xs text-gray-400">보유 {sugarRemain}</span>
      </div>
      {/* 버튼 + 입력 한 줄 */}
      <div className="flex items-center justify-center gap-1">
        {([-5, -1] as const).map((d) => (
          <button key={d} type="button" onClick={() => adjust(d)} disabled={!canAct}
            className="h-8 w-9 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            {d}
          </button>
        ))}
        <input
          type="text" inputMode="numeric"
          value={pendingSugar}
          onChange={(e) => handleInput(e.target.value)}
          disabled={!canAct}
          className="h-8 w-14 rounded border-2 border-amber-300 bg-amber-50 px-1 text-center text-sm font-bold text-amber-900 disabled:opacity-50"
        />
        {([1, 5] as const).map((d) => (
          <button key={d} type="button" onClick={() => adjust(d)} disabled={!canAct}
            className="h-8 w-9 rounded border border-gray-300 text-xs font-bold text-gray-600 hover:bg-gray-50 disabled:opacity-40">
            +{d}
          </button>
        ))}
        <button type="button" onClick={() => setPendingSugar(sugarRemain)} disabled={!canAct}
          className="h-8 px-2 rounded border border-gray-300 text-xs font-bold text-gray-500 hover:bg-gray-50 disabled:opacity-40">
          MAX
        </button>
      </div>
    </div>
  );
}

/* ────────── 카드 핸드 ────────── */

function CardHand({
  hand, onSelectCard, canAct, submitted, candy,
}: {
  hand: GS2CardId[];
  onSelectCard: (c: GS2CardId) => void;
  canAct: boolean;
  submitted: boolean;
  candy?: boolean;
}) {
  return (
    <div
      className={`relative z-10 p-2.5 lg:p-3 ${
        candy ? 'skin-candy-panel' : 'rounded-xl border border-gray-200 bg-white'
      }`}
    >
      <div className="mb-2 flex items-center justify-between px-0.5">
        <span className={`text-xs font-medium ${candy ? 'skin-candy-heading' : 'text-gray-500'}`}>
          {submitted ? '제출 완료' : '카드를 눌러 제출'}
        </span>
        <span className={`text-[10px] ${candy ? 'skin-candy-subtext' : 'text-gray-400'}`}>잔여 {hand.length}장</span>
      </div>
      <div className="flex flex-wrap gap-1.5 justify-center lg:gap-2">
        {CARD_IDS.map((c) => {
          const has = hand.includes(c);
          const style = CARD_STYLES[c];
          if (!has) {
            return (
              <div
                key={c}
                className={
                  candy
                    ? `skin-candy-card skin-candy-card--${c} skin-candy-card--spent flex w-12 flex-col items-center justify-center sm:w-14 lg:w-16`
                    : 'flex flex-col items-center justify-center rounded-lg border-2 border-gray-200 bg-gray-50 w-12 h-16 sm:w-14 sm:h-20 lg:w-16 lg:h-[88px] opacity-30'
                }
              >
                <span className={`text-base ${candy ? '' : 'text-gray-300'}`}>{style.icon}</span>
              </div>
            );
          }
          return (
            <button
              key={c}
              type="button"
              onClick={() => canAct && onSelectCard(c)}
              disabled={!canAct}
              title={CARD_HINTS[c]}
              className={
                candy
                  ? `skin-candy-card skin-candy-card--${c} skin-candy-card-btn flex flex-col items-center justify-center select-none
                     w-12 sm:w-14 lg:w-16 ${canAct ? 'cursor-pointer' : 'opacity-60 cursor-not-allowed'}`
                  : `flex flex-col items-center justify-center rounded-lg border-2 transition-all select-none
                     w-12 h-16 sm:w-14 sm:h-20 lg:w-16 lg:h-[88px]
                     ${canAct
                       ? 'cursor-pointer hover:scale-105 hover:-translate-y-1 shadow-sm hover:shadow-md active:scale-95'
                       : 'opacity-60 cursor-not-allowed'
                     }
                     ${style.bg} ${style.text} ${style.border}`
              }
            >
              <span className="text-lg sm:text-xl lg:text-2xl">{style.icon}</span>
              <span className="mt-0.5 text-[9px] sm:text-[10px] lg:text-xs font-bold leading-tight text-center px-0.5">
                {CARD_NAMES[c]}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ────────── 카드 제출 확인 모달 ────────── */

function CardSubmitModal({
  card, sugar, onClose, onConfirm, submitting, candy,
}: {
  card: GS2CardId;
  sugar: number;
  onClose: () => void;
  onConfirm: () => void;
  submitting: boolean;
  candy?: boolean;
}) {
  const style = CARD_STYLES[card];

  return (
    <div
      className="fixed inset-0 z-(--cdm-z-modal) flex items-end justify-center bg-black/50 sm:items-center"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="w-full max-w-sm rounded-t-2xl bg-white p-5 shadow-2xl sm:rounded-2xl">
        {/* 카드 + 효과 설명 */}
        <div className="flex items-start gap-4 mb-4">
          <div
            className={
              candy
                ? `skin-candy-card skin-candy-card--${card} shrink-0 flex w-20 flex-col items-center justify-center`
                : `shrink-0 flex flex-col items-center justify-center rounded-xl border-2 w-20 h-28 ${style.bg} ${style.text} ${style.border}`
            }
          >
            <span className="text-3xl">{style.icon}</span>
            <span className="mt-1 text-xs font-bold text-center px-1">{CARD_NAMES[card]}</span>
          </div>
          <p className="flex-1 text-sm text-gray-600 leading-relaxed pt-1 min-w-0">
            {CARD_HINTS[card]}
          </p>
        </div>

        {/* 설탕 확인 */}
        <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 mb-4">
          <span className="text-sm text-amber-800">
            설탕 <strong>{sugar}개</strong> 함께 제출
          </span>
        </div>

        {/* 버튼 */}
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 rounded-xl border border-gray-300 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            취소
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className={
              candy
                ? 'skin-candy-submit flex-1 py-3 text-sm'
                : 'flex-1 rounded-xl bg-indigo-600 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 transition-colors'
            }
          >
            {CARD_NAMES[card]} 제출
          </button>
        </div>
      </div>
    </div>
  );
}

/* ────────── 라운드 히스토리 ────────── */

function RoundHistoryPanel({
  history, players, mySide, open, setOpen, isRoundEnd,
}: {
  history: GS2RoundRecord[];
  players: { p1: GS2PlayerPublic; p2: GS2PlayerPublic };
  mySide: GS2Side | null;
  open: boolean;
  setOpen: (v: boolean) => void;
  isRoundEnd: boolean;
}) {
  void isRoundEnd;
  const orderedSides: GS2Side[] = mySide === 'p2' ? ['p2', 'p1'] : ['p1', 'p2'];

  return (
    <div className="rounded-xl border border-gray-200 bg-white">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-sm font-semibold text-gray-700"
      >
        라운드 기록
        <span className="text-xs text-gray-400">{open ? '접기 ▲' : '펼치기 ▼'}</span>
      </button>
      {open && (
        <div className="border-t border-gray-100 p-2 space-y-1.5 max-h-72 overflow-y-auto lg:max-h-[500px]">
          {history.length === 0 ? (
            <p className="py-6 text-center text-xs text-gray-400">아직 기록이 없습니다</p>
          ) : (
            [...history].reverse().map((r, idx) => {
              const key = `${r.extension}-${r.round}-${idx}`;
              return (
                <div key={key} className="rounded-lg border border-gray-100 bg-gray-50 p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-600">
                      {r.extension > 0 && (
                        <span className="mr-1 rounded bg-purple-200 px-1 text-[10px] font-bold text-purple-800">연장{r.extension}</span>
                      )}
                      R{r.round}
                    </span>
                    <span className="text-[10px] text-gray-400">
                      {r.winner === 'tie' ? '무승부' : `${players[r.winner].nickname} 승`}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1">
                    {orderedSides.map((side) => {
                      const a = r.actions[side];
                      const style = CARD_STYLES[a.card];
                      const isWin = r.winner === side;
                      return (
                        <div
                          key={side}
                          className={`rounded p-1 text-[10px] ${
                            isWin ? 'bg-emerald-50 border border-emerald-200' : 'bg-white border border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-1">
                            <span className={`inline-flex h-4 px-1 items-center justify-center rounded text-[8px] font-bold ${style.bg} ${style.text}`}>
                              {style.icon}
                            </span>
                            <span className="truncate text-gray-700">{CARD_NAMES[a.card]}</span>
                          </div>
                          <div className="mt-0.5 flex items-center gap-1 text-gray-500">
                            <span>{a.sugar}→{r.finalRoundSugar[side]}</span>
                            <span className={`ml-auto font-bold ${r.scoreDelta[side] > 0 ? 'text-emerald-600' : r.scoreDelta[side] < 0 ? 'text-red-500' : ''}`}>
                              {r.scoreDelta[side] > 0 ? `+${r.scoreDelta[side]}` : r.scoreDelta[side]}점
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

/* suppress unused */
void GS2_TOTAL_ROUNDS;
