'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import {
  IPE_MAX_SEATS,
  IPE_TURN_TIME_LIMIT_SECONDS,
  type IPEStatePayload,
  type IPEPlayerInfo,
} from '@/shared/types';
import EventPlayerSeat from './EventPlayerSeat';
import EventBettingPanel from './EventBettingPanel';
import EventPotDisplay from './EventPotDisplay';
import EventHandResultBanner from './EventHandResultBanner';
import EventGameBoardDesktop from './EventGameBoardDesktop';

// ── 모바일 턴 타이머 ──────────────────────────────────────────────
function MobileTurnTimer({ turnStartedAt }: { turnStartedAt: number | null }) {
  const [remaining, setRemaining] = useState<number | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (turnStartedAt == null) { setRemaining(null); return; }
    const tick = () => {
      const left = Math.max(0, IPE_TURN_TIME_LIMIT_SECONDS - (Date.now() - turnStartedAt) / 1000);
      setRemaining(left);
      if (left > 0) rafRef.current = requestAnimationFrame(tick);
    };
    tick();
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [turnStartedAt]);

  if (remaining == null) return null;
  const isCrit = remaining <= 5;
  const isDanger = remaining <= 10 && remaining > 5;
  return (
    <span className={cn(
      'tabular-nums font-mono font-bold text-xs',
      isCrit && 'animate-[pulse_0.5s_ease-in-out_infinite] text-red-500',
      isDanger && 'animate-pulse text-orange-400',
      !isCrit && !isDanger && 'text-cdm-fg-muted',
    )}>
      ⏱ {remaining <= 10 ? remaining.toFixed(1) : Math.ceil(remaining).toString()}s
    </span>
  );
}

// ── 바텀시트 (모바일 전용) ────────────────────────────────────────
function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={cn(
          'fixed inset-0 z-(--cdm-z-overlay) bg-black/50 transition-opacity duration-300 lg:hidden',
          open ? 'opacity-100' : 'pointer-events-none opacity-0',
        )}
        onClick={onClose}
      />
      <div
        className={cn(
          'fixed inset-x-0 bottom-0 z-(--cdm-z-modal) flex max-h-[80vh] flex-col rounded-t-2xl border-t border-cdm-border bg-cdm-bg shadow-2xl transition-transform duration-300 lg:hidden',
          open ? 'translate-y-0' : 'translate-y-full',
        )}
      >
        {/* 드래그 핸들 */}
        <div className="flex shrink-0 flex-col items-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-cdm-border" />
          {title && <p className="mt-2 text-sm font-semibold text-cdm-fg">{title}</p>}
        </div>
        <div
          className="overflow-y-auto px-4 pb-4"
          style={{ paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

interface Props {
  state: IPEStatePayload;
}

export default function EventGameBoard({ state }: Props) {
  const { gameData, mySeatIdx, role } = state;
  const isPlayer = role === 'player' && mySeatIdx !== null;
  const chipHint = role !== 'player';
  const isMyTurn = isPlayer && gameData.currentTurnSeatIdx === mySeatIdx;

  const [sheetOpen, setSheetOpen] = useState(false);

  // 내 차례 시작 시 자동으로 바텀시트 열기, 끝나면 닫기
  useEffect(() => {
    if (isMyTurn) {
      const t = setTimeout(() => setSheetOpen(true), 0);
      return () => clearTimeout(t);
    } else {
      setSheetOpen(false);
    }
  // gameData.currentTurnSeatIdx 변화마다 재평가
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, gameData.currentTurnSeatIdx]);

  const orderedSeats = useMemo(() => {
    const arr: Array<{ seatIdx: number; seat: IPEPlayerInfo | null }> = [];
    for (let i = 0; i < IPE_MAX_SEATS; i++) {
      arr.push({ seatIdx: i, seat: gameData.seats[i] });
    }
    if (isPlayer && mySeatIdx !== null) {
      const rotated: typeof arr = [];
      for (let off = 1; off <= IPE_MAX_SEATS; off++) {
        rotated.push(arr[(mySeatIdx + off) % IPE_MAX_SEATS]);
      }
      return rotated;
    }
    return arr;
  }, [gameData.seats, isPlayer, mySeatIdx]);

  const mySeat = mySeatIdx !== null ? gameData.seats[mySeatIdx] : null;
  const opponents = orderedSeats.slice(0, orderedSeats.length - (isPlayer ? 1 : 0));

  return (
    <div className="h-full">
      {/* ── 데스크탑 (lg 이상) ── */}
      <div className="hidden h-full lg:block">
        <EventGameBoardDesktop state={state} />
      </div>

      {/* ── 모바일 (lg 미만) ── */}
      <div className="relative flex h-full flex-col rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 lg:hidden">
        <div className="flex flex-1 flex-col gap-2 overflow-hidden p-2.5">

          {/* 메타 바 */}
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 text-xs text-cdm-fg-muted">
            <div className="flex items-center gap-3">
              <span>베팅 <strong className="text-cdm-fg">{gameData.currentBet}</strong></span>
              <span>{gameData.seats.filter(Boolean).length}/5명</span>
            </div>
            <div className="flex items-center gap-3">
              <MobileTurnTimer turnStartedAt={gameData.turnStartedAt ?? null} />
            </div>
          </div>

          {/* 상대 좌석 2열 그리드 */}
          <div className="grid shrink-0 grid-cols-2 gap-2">
            {opponents.map(({ seatIdx, seat }) => (
              <EventPlayerSeat
                key={seatIdx}
                seatIdx={seatIdx}
                seat={seat}
                isMe={false}
                isCurrentTurn={gameData.currentTurnSeatIdx === seatIdx}
                isFirstActor={gameData.firstActorSeatIdx === seatIdx}
                showChipHint={chipHint}
              />
            ))}
          </div>

          {/* 팟 */}
          <div className="shrink-0">
            <EventPotDisplay
              pot={gameData.pot}
              communityCards={gameData.communityCards}
              phase={gameData.phase}
            />
          </div>

          {/* 내 카드 (베팅 패널은 바텀시트로 이동) */}
          {isPlayer && mySeat && (
            <div className="shrink-0">
              <EventPlayerSeat
                seatIdx={mySeatIdx!}
                seat={mySeat}
                isMe
                isCurrentTurn={gameData.currentTurnSeatIdx === mySeatIdx}
                isFirstActor={gameData.firstActorSeatIdx === mySeatIdx}
              />
            </div>
          )}
        </div>

        {/* 핸드 결과 오버레이 */}
        {gameData.handResult && (
          <EventHandResultBanner
            key={gameData.handResult.handId}
            result={gameData.handResult}
            mySeatIdx={mySeatIdx}
          />
        )}
      </div>

      {/* ── 모바일 바텀시트: 베팅 패널 ── */}
      {isPlayer && mySeat && (
        <>
          {/* 내 차례인데 시트가 닫혀 있을 때 플로팅 버튼 */}
          {isMyTurn && !sheetOpen && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="fixed inset-x-4 bottom-20 z-(--cdm-z-modal) rounded-xl bg-cdm-primary py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 lg:hidden"
            >
              베팅하기 →
            </button>
          )}
          <BottomSheet
            open={sheetOpen}
            onClose={() => setSheetOpen(false)}
            title={isMyTurn ? '내 차례' : `좌석 ${(gameData.currentTurnSeatIdx ?? 0) + 1} 베팅 중`}
          >
            <EventBettingPanel
              mySeat={mySeat}
              gameData={gameData}
              isMyTurn={isMyTurn}
            />
          </BottomSheet>
        </>
      )}
    </div>
  );
}
