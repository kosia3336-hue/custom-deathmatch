'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { getSocket } from '@/lib/socket';
import { sfxCall, sfxRaise, sfxDie, sfxDeal } from '@/lib/eventSfx';
import {
  IPE_MAX_SEATS,
  IPE_TURN_TIME_LIMIT_SECONDS,
  type IPEStatePayload,
  type IPEPlayerInfo,
  type IPEGameData,
  type IPEPhase,
} from '@/shared/types';
import Button from '@/components/ui/Button';
import EventHandResultBanner from './EventHandResultBanner';

interface Props {
  state: IPEStatePayload;
}

// ─── 턴 카운트다운 훅 ─────────────────────────────────────────────
function useTurnCountdown(turnStartedAt: number | null) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (turnStartedAt == null) { setRemaining(null); return; }

    const tick = () => {
      const elapsed = (Date.now() - turnStartedAt) / 1000;
      const left = Math.max(0, IPE_TURN_TIME_LIMIT_SECONDS - elapsed);
      setRemaining(left);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [turnStartedAt]);

  return remaining;
}

// ─── 카운트다운 뱃지 ──────────────────────────────────────────────
function TurnTimer({ turnStartedAt }: { turnStartedAt: number | null }) {
  const remaining = useTurnCountdown(turnStartedAt);
  if (remaining == null) return null;

  const isCrit = remaining <= 5;
  const isDanger = remaining <= 10 && remaining > 5;
  const display = remaining <= 10 ? remaining.toFixed(1) : Math.ceil(remaining).toString();

  return (
    <span
      className={cn(
        'tabular-nums font-mono font-bold text-sm',
        isCrit && 'animate-[pulse_0.5s_ease-in-out_infinite] text-red-500',
        isDanger && 'animate-pulse text-orange-400',
        !isCrit && !isDanger && 'text-cdm-fg-muted',
      )}
    >
      ⏱ {display}s
    </span>
  );
}

// ─── 상대 좌석 카드 ────────────────────────────────────────────────
function OpponentCard({
  seatIdx, seat, isCurrentTurn, isFirstActor, showChipHint,
}: {
  seatIdx: number;
  seat: IPEPlayerInfo | null;
  isCurrentTurn: boolean;
  isFirstActor: boolean;
  showChipHint: boolean;
}) {
  // 카드 딜 SFX
  const prevCardRef = useRef<number | null | undefined>(undefined);
  useEffect(() => {
    if (seat?.card !== undefined && seat.card !== null && prevCardRef.current === null) {
      sfxDeal();
    }
    prevCardRef.current = seat?.card ?? null;
  }, [seat?.card]);

  // 베팅 플로팅 텍스트
  const [floatKey, setFloatKey] = useState(0);
  const [floatDelta, setFloatDelta] = useState(0);
  const prevRoundBetRef = useRef<number>(0);
  useEffect(() => {
    const cur = seat?.roundBet ?? 0;
    const prev = prevRoundBetRef.current;
    if (cur > prev && cur > 0) {
      setFloatDelta(cur - prev);
      setFloatKey((k) => k + 1);
    }
    prevRoundBetRef.current = cur;
  }, [seat?.roundBet]);

  if (!seat) {
    return (
      <button
        type="button"
        onClick={() => { if (showChipHint) toast.error('이벤트 칩이 부족합니다. 상점에서 칩을 구매해주세요.'); }}
        className={cn(
          'flex w-28 flex-col items-center justify-center gap-1 rounded-xl border border-dashed border-cdm-border bg-cdm-bg/40 py-5 text-cdm-fg-muted transition-colors',
          showChipHint ? 'cursor-pointer hover:border-cdm-primary/40 hover:bg-cdm-primary/5' : 'cursor-default',
        )}
      >
        <span className="text-xs font-semibold">좌석 {seatIdx + 1}</span>
        <span className="text-[11px]">빈자리</span>
      </button>
    );
  }

  const isDead = !seat.isAlive;

  return (
    <div
      className={cn(
        'relative flex w-28 flex-col items-center gap-1.5 rounded-xl border-2 bg-cdm-bg px-2 py-2.5 transition-all',
        isCurrentTurn
          ? 'border-cdm-primary shadow-[0_0_10px_2px_rgba(99,102,241,0.3)]'
          : isFirstActor ? 'border-cdm-highlight/60' : 'border-cdm-border',
        isDead && 'opacity-40',
      )}
    >
      {/* 베팅 플로팅 텍스트 */}
      <AnimatePresence>
        {floatKey > 0 && (
          <motion.div
            key={floatKey}
            initial={{ y: 0, opacity: 1, scale: 1 }}
            animate={{ y: -28, opacity: 0, scale: 1.15 }}
            transition={{ duration: 0.65, ease: 'easeOut' }}
            className="pointer-events-none absolute top-8 left-1/2 z-20 -translate-x-1/2 rounded-full bg-cdm-highlight/90 px-2 py-0.5 text-[9px] font-bold text-black"
          >
            +{floatDelta}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex w-full items-center justify-between text-[10px] text-cdm-fg-muted">
        <span>좌석 {seatIdx + 1}</span>
        {isFirstActor && <span className="font-bold text-cdm-highlight">선</span>}
      </div>

      {/* 카드 — 애니메이션 적용 */}
      <div
        className={cn(
          'relative flex h-16 w-11 items-center justify-center rounded-lg border-2 bg-cdm-bg-elev-1 font-bold',
          isDead ? 'border-cdm-fg-muted/30' : isCurrentTurn ? 'border-cdm-primary/60' : 'border-cdm-border',
        )}
      >
        <AnimatePresence mode="wait">
          {isDead ? (
            <motion.span key="dead" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-xl text-cdm-fg-muted">×</motion.span>
          ) : seat.card !== null ? (
            <motion.span
              key={`card-${seat.card}`}
              initial={{ rotateY: 90, opacity: 0 }}
              animate={{ rotateY: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 22 }}
              className={cn('text-3xl', seat.card === 10 && 'text-xl')}
            >
              {seat.card}
            </motion.span>
          ) : (
            <motion.span key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-2xl text-cdm-primary/60">🂠</motion.span>
          )}
        </AnimatePresence>
        {seat.hasDied && (
          <span className="absolute -top-2 -right-2 rounded bg-cdm-accent px-1 py-0.5 text-[9px] font-bold text-white">DIE</span>
        )}
      </div>

      <div className="flex w-full flex-col items-center gap-0.5">
        <span className="w-full truncate text-center text-[11px] font-semibold text-cdm-fg">{seat.nickname}</span>
        <span className="text-[10px] tabular-nums text-cdm-fg-muted">🪙 {seat.chips}</span>
      </div>

      <AnimatePresence>
        {seat.roundBet > 0 && (
          <motion.div
            key="roundBet"
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.5, opacity: 0 }}
            className="rounded-full bg-cdm-highlight/20 px-2 py-0.5 text-[10px] font-bold text-cdm-highlight"
          >
            +{seat.roundBet}
          </motion.div>
        )}
      </AnimatePresence>
      {isCurrentTurn && !isDead && (
        <div className="animate-pulse rounded-full bg-cdm-primary/20 px-2 py-0.5 text-[10px] font-bold text-cdm-primary">
          베팅 중
        </div>
      )}
    </div>
  );
}

// ─── 내 카드 ──────────────────────────────────────────────────────
function MyCard({
  seatIdx, seat, isCurrentTurn, isFirstActor,
}: {
  seatIdx: number;
  seat: IPEPlayerInfo;
  isCurrentTurn: boolean;
  isFirstActor: boolean;
}) {
  const isDead = !seat.isAlive;

  return (
    <div
      className={cn(
        'relative flex w-36 shrink-0 flex-col items-center gap-2 rounded-xl border-2 bg-cdm-primary/5 px-3 py-3 transition-all',
        isCurrentTurn
          ? 'border-cdm-primary shadow-[0_0_14px_3px_rgba(99,102,241,0.35)]'
          : isFirstActor ? 'border-cdm-highlight/60' : 'border-cdm-primary/30',
        isDead && 'opacity-40',
      )}
    >
      <div className="flex w-full items-center justify-between text-[10px]">
        <span className="text-cdm-fg-muted">좌석 {seatIdx + 1}</span>
        <span className="rounded bg-cdm-primary px-1.5 py-0.5 text-[9px] font-bold text-white">YOU</span>
      </div>

      {/* 카드 */}
      <div
        className={cn(
          'flex h-24 w-16 items-center justify-center rounded-xl border-2 bg-cdm-bg font-extrabold shadow-sm',
          isCurrentTurn ? 'border-cdm-primary/70' : 'border-cdm-border',
        )}
      >
        <AnimatePresence mode="wait">
          {isDead ? (
            <motion.span key="dead" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-3xl text-cdm-fg-muted">×</motion.span>
          ) : seat.card !== null ? (
            <motion.span
              key={`mycard-${seat.card}`}
              initial={{ rotateY: 90, scale: 0.7, opacity: 0 }}
              animate={{ rotateY: 0, scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 280, damping: 22 }}
              className={cn('text-5xl', seat.card === 10 && 'text-3xl')}
            >
              {seat.card}
            </motion.span>
          ) : (
            <motion.span key="hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-3xl text-cdm-primary/60">?</motion.span>
          )}
        </AnimatePresence>
      </div>

      <div className="flex w-full flex-col items-center gap-0.5">
        <span className="w-full truncate text-center text-xs font-bold text-cdm-fg">{seat.nickname}</span>
        <span className="text-xs tabular-nums text-cdm-fg-muted">🪙 {seat.chips}</span>
      </div>

      {seat.roundBet > 0 && (
        <div className="rounded-full bg-cdm-highlight/20 px-2.5 py-0.5 text-[10px] font-bold text-cdm-highlight">
          베팅 {seat.roundBet}
        </div>
      )}
      {isCurrentTurn && !isDead && (
        <div className="animate-pulse rounded-full bg-cdm-primary/20 px-2.5 py-0.5 text-[10px] font-bold text-cdm-primary">
          내 차례
        </div>
      )}
      {seat.hasDied && (
        <div className="absolute top-1.5 right-1.5 rounded bg-cdm-accent px-1.5 py-0.5 text-[9px] font-bold text-white">DIE</div>
      )}
      {isFirstActor && !isCurrentTurn && (
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded bg-cdm-highlight px-2 py-0.5 text-[9px] font-bold text-black">선공</div>
      )}
    </div>
  );
}

// ─── 베팅 패널 ────────────────────────────────────────────────────
function DesktopBettingPanel({
  mySeat, gameData, isMyTurn,
}: {
  mySeat: IPEPlayerInfo;
  gameData: IPEGameData;
  isMyTurn: boolean;
}) {
  const [raiseAmount, setRaiseAmount] = useState<number>(gameData.currentBet + 1);
  const minRaise = Math.max(gameData.currentBet + 1, 1);
  // 생존 플레이어 중 최소 칩 기준 (올인 방지)
  const minChipsAlive = Math.min(
    ...gameData.seats.filter((s) => s?.isAlive).map((s) => s!.chips + (s!.roundBet ?? 0)),
    mySeat.roundBet + mySeat.chips,
  );
  const maxRaise = minChipsAlive;
  const callCost = Math.max(0, gameData.currentBet - mySeat.roundBet);
  const canCheck = !gameData.bettingStarted && mySeat.roundBet >= gameData.currentBet;
  const canCall = !canCheck && callCost > 0 && mySeat.chips >= callCost;
  const canRaise = mySeat.chips > callCost && minRaise <= maxRaise;
  const safeRaise = Math.max(minRaise, Math.min(maxRaise, raiseAmount));

  const send = (data: Record<string, unknown>) => getSocket().emit('game:action', data);

  if (!isMyTurn) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-cdm-border bg-cdm-bg p-6 text-cdm-fg-muted">
        <div className="text-3xl">⏳</div>
        <div className="text-sm font-medium">상대 차례 대기 중</div>
        {gameData.currentTurnSeatIdx !== null && (
          <div className="rounded-full bg-cdm-bg-elev-2 px-3 py-1 text-xs">
            좌석 {gameData.currentTurnSeatIdx + 1} 베팅 중
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border-2 border-cdm-primary bg-cdm-primary/5 p-4">
      <div className="flex items-center gap-2">
        <div className="h-2 w-2 animate-pulse rounded-full bg-cdm-primary" />
        <span className="text-sm font-bold uppercase tracking-wider text-cdm-primary">내 차례</span>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Button variant="secondary" size="md" disabled={!canCheck} onClick={() => { sfxCall(); send({ type: 'check' }); }} className={cn(!canCheck && 'opacity-40')}>
          체크
        </Button>
        <Button variant="primary" size="md" disabled={!canCall} onClick={() => { sfxCall(); send({ type: 'call' }); }} className={cn(!canCall && 'opacity-40')}>
          콜 {callCost > 0 ? `(${callCost})` : ''}
        </Button>
      </div>

      <div className="flex flex-col gap-1.5 rounded-lg bg-cdm-bg/60 p-2.5">
        <div className="flex items-center justify-between text-xs text-cdm-fg-muted">
          <span>레이즈</span>
          <span className="tabular-nums">최소 {minRaise} · 최대 {maxRaise}</span>
        </div>
        <input
          type="range"
          min={minRaise}
          max={Math.max(maxRaise, minRaise)}
          value={safeRaise}
          disabled={!canRaise}
          onChange={(e) => setRaiseAmount(Number(e.target.value))}
          className="w-full accent-cdm-primary disabled:opacity-40"
        />
        <div className="flex items-center gap-2">
          <input
            type="number"
            min={minRaise}
            max={maxRaise}
            value={safeRaise}
            disabled={!canRaise}
            onChange={(e) => setRaiseAmount(Math.trunc(Number(e.target.value) || minRaise))}
            className="h-8 w-20 rounded-lg border border-cdm-border bg-cdm-bg px-2 text-sm tabular-nums disabled:opacity-40"
          />
          <Button variant="primary" size="md" disabled={!canRaise} onClick={() => { sfxRaise(); send({ type: 'raise', amount: safeRaise }); }} className={cn('flex-1', !canRaise && 'opacity-40')}>
            레이즈 ({safeRaise})
          </Button>
        </div>
      </div>

      <Button
        variant="danger"
        size="md"
        onClick={() => { sfxDie(); send({ type: 'die' }); }}
      >
        다이
      </Button>
    </div>
  );
}

// ─── 팟 (한 줄 compact) ─────────────────────────────────────────
function DesktopPot({ pot, communityCards, phase }: { pot: number; communityCards: [number, number] | null; phase: IPEPhase }) {
  return (
    <div className="flex shrink-0 items-center justify-center gap-4 rounded-xl border border-cdm-border bg-cdm-bg-elev-2 px-6 py-2.5 text-sm">
      <span className="text-[10px] uppercase tracking-wider text-cdm-fg-muted">POT</span>
      <span className="text-lg font-extrabold tabular-nums text-cdm-fg">🪙 {pot}</span>
      {communityCards && (
        <>
          <span className="text-cdm-fg-muted/50">·</span>
          <span className="text-xs text-cdm-fg-muted">공유 카드</span>
          {communityCards.map((c, idx) => (
            <div
              key={idx}
              className={cn(
                'flex h-9 w-7 items-center justify-center rounded-md border-2 border-cdm-primary/60 bg-cdm-bg font-bold',
                c === 10 ? 'text-sm' : 'text-lg',
              )}
            >
              {c}
            </div>
          ))}
        </>
      )}
      <span className="text-cdm-fg-muted/50">·</span>
      <span className="text-xs text-cdm-fg-muted">{phaseLabel(phase)}</span>
    </div>
  );
}

function phaseLabel(phase: IPEPhase): string {
  switch (phase) {
    case 'waiting': return '대기 중';
    case 'dealing': return '카드 배분 중';
    case 'betting': return '베팅 중';
    case 'showdown': return '쇼다운';
    case 'dieResult': return '핸드 종료';
    case 'closed': return '운영 시간 외';
    default: return '';
  }
}

// ─── 메인 데스크탑 보드 ──────────────────────────────────────────
export default function EventGameBoardDesktop({ state }: Props) {
  const { gameData, mySeatIdx, role } = state;
  const isPlayer = role === 'player' && mySeatIdx !== null;
  const chipHint = role !== 'player';

  const orderedSeats = useMemo(() => {
    const arr: Array<{ seatIdx: number; seat: IPEPlayerInfo | null }> = [];
    for (let i = 0; i < IPE_MAX_SEATS; i++) arr.push({ seatIdx: i, seat: gameData.seats[i] });
    if (isPlayer && mySeatIdx !== null) {
      const rotated: typeof arr = [];
      for (let off = 1; off <= IPE_MAX_SEATS; off++) rotated.push(arr[(mySeatIdx + off) % IPE_MAX_SEATS]);
      return rotated;
    }
    return arr;
  }, [gameData.seats, isPlayer, mySeatIdx]);

  const mySeat = mySeatIdx !== null ? gameData.seats[mySeatIdx] : null;
  const opponents = orderedSeats.slice(0, orderedSeats.length - (isPlayer ? 1 : 0));

  return (
    <div className="relative flex h-full flex-col rounded-2xl border border-cdm-border bg-cdm-bg-elev-1">
      {/* 메타 바 */}
      <div className="flex shrink-0 items-center justify-between border-b border-cdm-border px-5 py-2 text-xs text-cdm-fg-muted">
        <div className="flex items-center gap-4">
          <span>베팅 <strong className="text-cdm-fg">{gameData.currentBet}</strong></span>
          <span>{gameData.seats.filter(Boolean).length} / 5명</span>
        </div>
        <div className="flex items-center gap-4">
          <TurnTimer turnStartedAt={gameData.turnStartedAt ?? null} />
        </div>
      </div>

      {/* 본문 — 상대/팟/내자리 순으로 세로 쌓기, 남는 공간은 justify-evenly 로 균등 배분 */}
      <div className="flex min-h-0 flex-1 flex-col items-center justify-evenly gap-3 px-5 py-3">

        {/* 상대 좌석 */}
        <div className="flex flex-wrap justify-center gap-2">
          {opponents.map(({ seatIdx, seat }) => (
            <OpponentCard
              key={seatIdx}
              seatIdx={seatIdx}
              seat={seat}
              isCurrentTurn={gameData.currentTurnSeatIdx === seatIdx}
              isFirstActor={gameData.firstActorSeatIdx === seatIdx}
              showChipHint={chipHint}
            />
          ))}
        </div>

        {/* 팟 (한 줄) */}
        <DesktopPot pot={gameData.pot} communityCards={gameData.communityCards} phase={gameData.phase} />

        {/* 내 자리 + 베팅 패널 — 자연 높이(컨텐츠 크기)만큼만 */}
        {isPlayer && mySeat ? (
          <div className="flex w-full max-w-2xl items-start gap-3">
            <MyCard
              seatIdx={mySeatIdx!}
              seat={mySeat}
              isCurrentTurn={gameData.currentTurnSeatIdx === mySeatIdx}
              isFirstActor={gameData.firstActorSeatIdx === mySeatIdx}
            />
            <DesktopBettingPanel
              mySeat={mySeat}
              gameData={gameData}
              isMyTurn={gameData.currentTurnSeatIdx === mySeatIdx}
            />
          </div>
        ) : (
          <div className="flex w-full max-w-2xl items-center justify-center rounded-xl border border-dashed border-cdm-border py-6 text-sm text-cdm-fg-muted">
            관전 중 — 다음 핸드 시작 시 빈 자리가 있으면 자동 입장됩니다.
          </div>
        )}
      </div>

      {gameData.handResult && (
        <EventHandResultBanner
          key={gameData.handResult.handId}
          result={gameData.handResult}
          mySeatIdx={mySeatIdx}
        />
      )}
    </div>
  );
}
