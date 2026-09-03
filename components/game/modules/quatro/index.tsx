'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { getSkinTheme } from '@/lib/skins/registry';
import { cn } from '@/lib/utils';
import { GAME_IDS } from '@/shared/types/game';
import {
  QUATRO_MAX_MULLIGANS,
  QUATRO_VP_COUNT,
  type QuatroCard,
  type QuatroGameData,
  type QuatroSuit,
} from '@/shared/types/quatro';
import FourCardCard from './skins/FourCardCard';

/* ── 카드 표현: 문양 + 색 (스=파랑, 다=노랑, 하=빨강, 클=초록, 검정0) ── */

const SUIT_INFO: Record<QuatroSuit, { symbol: string; cls: string; label: string }> = {
  spade: { symbol: '♠', cls: 'text-blue-600 border-blue-300 bg-blue-50', label: '스페이드' },
  diamond: { symbol: '♦', cls: 'text-yellow-600 border-yellow-300 bg-yellow-50', label: '다이아' },
  heart: { symbol: '♥', cls: 'text-red-600 border-red-300 bg-red-50', label: '하트' },
  club: { symbol: '♣', cls: 'text-green-600 border-green-300 bg-green-50', label: '클로버' },
  black: { symbol: '●', cls: 'text-white border-gray-700 bg-gray-900', label: '검정' },
};

function CardFace({
  card,
  size = 'md',
  selected,
  dimmed,
  onClick,
  badge,
  fourCard,
}: {
  card: QuatroCard | null;
  size?: 'sm' | 'md';
  selected?: boolean;
  dimmed?: boolean;
  onClick?: () => void;
  badge?: string;
  fourCard?: boolean;
}) {
  if (fourCard) {
    return (
      <FourCardCard
        card={card}
        size={size}
        selected={selected}
        dimmed={dimmed}
        onClick={onClick}
        badge={badge}
      />
    );
  }

  const sz = size === 'sm' ? 'h-12 w-9 text-sm' : 'h-16 w-12 text-lg';
  if (!card) {
    return (
      <div
        className={cn(
          sz,
          'flex items-center justify-center rounded-md border-2 border-indigo-300 bg-indigo-500/80 text-white shadow-sm',
        )}
        aria-label="뒷면 카드"
      >
        <span className="text-xs opacity-70">?</span>
      </div>
    );
  }
  const info = SUIT_INFO[card.suit];
  const Comp = onClick ? 'button' : 'div';
  return (
    <Comp
      {...(onClick ? { type: 'button' as const, onClick } : {})}
      className={cn(
        sz,
        'relative flex flex-col items-center justify-center rounded-md border-2 font-bold shadow-sm transition-all',
        info.cls,
        selected && 'ring-2 ring-cdm-primary -translate-y-1',
        dimmed && 'opacity-45',
        onClick && 'cursor-pointer hover:-translate-y-0.5',
      )}
      aria-label={`${info.label} ${card.num}`}
    >
      <span className="leading-none">{info.symbol}</span>
      <span className="leading-none">{card.num}</span>
      {badge && (
        <span className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-cdm-fg px-1.5 text-[9px] font-bold leading-4 text-white">
          {badge}
        </span>
      )}
    </Comp>
  );
}

/* ── 메인 ── */

export default function QuatroGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const gameData = gameState?.gameData as unknown as QuatroGameData | undefined;
  const myId = useMySocketId();

  const [selectedCardId, setSelectedCardId] = useState<string | null>(null);
  const [selectedVp, setSelectedVp] = useState<number | null>(null);
  const shownResultRef = useRef(false);

  const me = gameData?.me;
  const opp = gameData?.opp;
  const isMyTurn = gameData?.currentTurnId === myId;
  const phase = gameData?.phase;
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.QUATRO);
  const isFourCard = skin === 'four-card';

  // 페이즈 바뀌면 선택 초기화
  useEffect(() => {
    setSelectedCardId(null);
    setSelectedVp(null);
  }, [phase, gameData?.round]);

  // 결과 토스트
  useEffect(() => {
    if (!gameData?.result || shownResultRef.current) return;
    shownResultRef.current = true;
    const r = gameData.result;
    if (!r.winnerId) {
      toast(`무승부! (${r.reason})`, { duration: 6000 });
      return;
    }
    const nick = gameData.players[r.winnerId]?.nickname ?? '???';
    const msg = `${nick} 승리! ${r.reason}`;
    if (r.winnerId === myId) toast.success(msg, { duration: 6000 });
    else toast.error(msg, { duration: 6000 });
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cdm-fg-muted">게임을 불러오는 중...</p>
      </div>
    );
  }

  function act(action: Record<string, unknown>) {
    getSocket().emit('game:action', action);
  }

  const myClosedCards = me?.hand.filter((h) => h.card && !h.open) ?? [];

  return (
    <div className={cn('mx-auto flex w-full max-w-3xl flex-col gap-4 p-3 sm:p-4', isFourCard && 'skin-four-card-table')}>
      {/* 상태 배너 */}
      <div className="quatro-status rounded-cdm-md border border-cdm-border bg-cdm-bg px-3 py-2 text-center text-sm font-semibold text-cdm-fg">
        {phase === 'mulligan' && (isMyTurn ? '멀리건을 사용할까요?' : '상대가 멀리건을 결정 중…')}
        {phase === 'open' &&
          (me && !gameData.iOpened ? `${gameData.round}번째로 오픈할 카드를 선택하세요` : '상대의 오픈을 기다리는 중…')}
        {phase === 'exchange' &&
          (isMyTurn
            ? gameData.mustExchangeRemaining > 0
              ? `마지막 교환! 남은 가상 플레이어 ${gameData.mustExchangeRemaining}명과 모두 교환해야 합니다`
              : '교환할 카드와 가상 플레이어를 고르세요 (또는 스탑)'
            : '상대의 교환 차례…')}
        {(phase === 'reveal' || phase === 'finished') && '최종 공개!'}
      </div>

      {/* 상대 */}
      {opp && (
        <section className="quatro-panel rounded-cdm-lg border border-cdm-border bg-cdm-bg p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-cdm-fg">
              {opp.nickname}
              {gameData.firstId === opp.id && <span className="ml-1.5 rounded bg-cdm-highlight/20 px-1.5 text-[10px] font-bold text-cdm-highlight">선</span>}
            </span>
            <span className="text-xs text-cdm-fg-muted">
              교환 {opp.vpUsedCount}/{QUATRO_VP_COUNT}
              {phase === 'exchange' && opp.stopped && ' · 스탑'}
            </span>
          </div>
          <div className="flex gap-2 pt-3">
            {opp.hand.map((h, i) => (
              <CardFace key={i} card={h.card} badge={h.open ? '공개' : undefined} fourCard={isFourCard} />
            ))}
          </div>
        </section>
      )}

      {/* 가상 플레이어 6명 */}
      <section className="quatro-panel quatro-vp-panel rounded-cdm-lg border border-cdm-border bg-cdm-bg-elev-1 p-3">
        <p className="mb-2 text-xs font-bold uppercase tracking-wide text-cdm-fg-subtle">가상 플레이어</p>
        <div className="grid grid-cols-3 gap-2">
          {gameData.vps.map((vp) => {
            const selectable =
              phase === 'exchange' && isMyTurn && !vp.usedByMe && Boolean(selectedCardId);
            return (
              <button
                key={vp.index}
                type="button"
                disabled={!selectable}
                onClick={() => setSelectedVp(vp.index)}
                className={cn(
                  'quatro-vp-seat flex flex-col items-center gap-1 rounded-cdm-md border p-2 transition-colors',
                  selectedVp === vp.index
                    ? 'quatro-vp-seat--selected border-cdm-primary bg-cdm-primary-soft'
                    : vp.usedByMe
                      ? 'quatro-vp-seat--used border-cdm-border bg-cdm-bg-elev-2 opacity-50'
                      : 'border-cdm-border bg-cdm-bg',
                  selectable && 'quatro-vp-seat--selectable cursor-pointer hover:border-cdm-primary',
                )}
              >
                <span className="text-[11px] font-bold text-cdm-fg">
                  {String.fromCharCode(65 + vp.index)}
                  {vp.usedByMe && (
                    <span className="text-cdm-primary"> ✓ {me?.nickname ?? '나'}</span>
                  )}
                  {vp.usedByOpp && (
                    <span className="text-cdm-fg-subtle"> ({opp?.nickname ?? '상대'})</span>
                  )}
                </span>
                <div className="flex gap-0.5">
                  {vp.cards ? (
                    /* 관전자 — 가상 플레이어 패 전체 공개 */
                    vp.cards.map((c) => <CardFace key={c.id} card={c} size="sm" fourCard={isFourCard} />)
                  ) : (
                    <>
                      {vp.receivedOpen.map((c) => (
                        <CardFace key={c.id} card={c} size="sm" fourCard={isFourCard} />
                      ))}
                      {Array.from({ length: vp.hiddenCount }).map((_, i) => (
                        <CardFace key={`h-${i}`} card={null} size="sm" fourCard={isFourCard} />
                      ))}
                    </>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* 내 손패 */}
      {me && (
        <section className="quatro-panel rounded-cdm-lg border border-cdm-border bg-cdm-bg p-3">
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="font-semibold text-cdm-fg">
              내 카드
              {gameData.firstId === me.id && <span className="ml-1.5 rounded bg-cdm-highlight/20 px-1.5 text-[10px] font-bold text-cdm-highlight">선</span>}
            </span>
            <span className="text-xs text-cdm-fg-muted">
              멀리건 {me.mulligansUsed}/{QUATRO_MAX_MULLIGANS} · 교환 {me.vpUsedCount}/{QUATRO_VP_COUNT}
            </span>
          </div>
          <div className="flex gap-2 pt-3">
            {me.hand.map((h, i) => {
              const clickable =
                Boolean(h.card) &&
                !h.open &&
                ((phase === 'open' && !gameData.iOpened) || (phase === 'exchange' && isMyTurn));
              return (
                <CardFace
                  key={h.card?.id ?? i}
                  card={h.card}
                  selected={selectedCardId === h.card?.id}
                  dimmed={phase === 'exchange' && h.open}
                  badge={h.open ? '공개' : undefined}
                  onClick={clickable ? () => setSelectedCardId(h.card!.id) : undefined}
                  fourCard={isFourCard}
                />
              );
            })}
          </div>

          {/* 행동 버튼 */}
          <div className="mt-3 flex flex-wrap gap-2">
            {phase === 'mulligan' && isMyTurn && (
              <>
                <ActionBtn onClick={() => act({ type: 'mulligan', use: true })}>
                  멀리건 사용 (새 카드 4장)
                </ActionBtn>
                <ActionBtn variant="secondary" onClick={() => act({ type: 'mulligan', use: false })}>
                  이대로 진행
                </ActionBtn>
              </>
            )}
            {phase === 'open' && me && !gameData.iOpened && (
              <ActionBtn
                disabled={!selectedCardId}
                onClick={() => selectedCardId && act({ type: 'open', cardId: selectedCardId })}
              >
                이 카드 오픈
              </ActionBtn>
            )}
            {phase === 'exchange' && isMyTurn && (
              <>
                <ActionBtn
                  disabled={!selectedCardId || selectedVp === null}
                  onClick={() =>
                    selectedCardId != null &&
                    selectedVp != null &&
                    act({ type: 'exchange', vpIndex: selectedVp, giveCardId: selectedCardId })
                  }
                >
                  {selectedVp !== null
                    ? `${String.fromCharCode(65 + selectedVp)}와 교환`
                    : '교환 (카드+상대 선택)'}
                </ActionBtn>
                <ActionBtn
                  variant="secondary"
                  disabled={gameData.mustExchangeRemaining > 0}
                  onClick={() => act({ type: 'stop' })}
                >
                  스탑
                </ActionBtn>
              </>
            )}
          </div>
          {phase === 'exchange' && isMyTurn && myClosedCards.length > 0 && !selectedCardId && (
            <p className="mt-1.5 text-[11px] text-cdm-fg-subtle">
              넘길 카드(비공개)를 먼저 고른 뒤 가상 플레이어를 선택하세요. 넘긴 카드는 공개되고, 받는
              카드는 비공개입니다.
            </p>
          )}
        </section>
      )}

      {/* 결과 */}
      {gameData.result && (
        <section className="quatro-panel quatro-result rounded-cdm-lg border-2 border-cdm-primary bg-cdm-primary-soft/40 p-4">
          <p className="mb-3 text-center text-base font-bold text-cdm-fg">
            {gameData.result.winnerId
              ? `${gameData.players[gameData.result.winnerId]?.nickname} 승리 — ${gameData.result.reason}`
              : `무승부 — ${gameData.result.reason}`}
          </p>
          <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-8">
            {Object.entries(gameData.result.hands).map(([pid, cards]) => (
              <div key={pid} className="flex flex-col items-center gap-1.5">
                <span className="text-sm font-semibold text-cdm-fg">
                  {gameData.players[pid]?.nickname}
                  <span className="ml-1.5 text-xs text-cdm-fg-muted">
                    합 {gameData.result!.sums[pid]}
                    {gameData.result!.quatro[pid] ? ' · 콰트로!' : ''}
                  </span>
                </span>
                <div className="flex gap-1.5">
                  {cards.map((c) => (
                    <CardFace key={c.id} card={c} size="sm" fourCard={isFourCard} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function ActionBtn({
  children,
  onClick,
  disabled,
  variant = 'primary',
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'quatro-action-btn rounded-cdm-md px-3 py-2 text-sm font-semibold transition-colors disabled:opacity-40',
        variant === 'primary'
          ? 'border border-cdm-primary bg-cdm-primary text-white hover:bg-cdm-primary-strong'
          : 'border border-cdm-primary bg-cdm-bg text-cdm-primary hover:bg-cdm-primary-soft',
      )}
    >
      {children}
    </button>
  );
}
