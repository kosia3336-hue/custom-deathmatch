'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { quatroPlayGuide } from './presentation';
import { useGameHud } from '@/hooks/useGameHud';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type { SkinTheme } from '@/lib/skins/registry';
import { cn } from '@/lib/utils';
import {
  QUATRO_MAX_MULLIGANS,
  QUATRO_VP_COUNT,
  type QuatroGameData,
  type QuatroPlayerView,
} from '@/shared/types/quatro';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ActionBtn } from './ActionBtn';
import { CardFace } from './CardFace';
import QuatroRecord from './QuatroRecord';

function QuatroView({
  gameData,
  myId,
  skin = null,
}: {
  gameData?: QuatroGameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const sendAction = useGameAction();
  const { setHeaderBelow } = useRoomLayout();

  const shownResultRef = useRef(false);
  const me = gameData?.me;
  const opp = gameData?.opp;
  const seats = gameData?.seats ?? [];
  const isMyTurn = gameData?.currentTurnId === myId;
  const phase = gameData?.phase;
  const isFourCard = skin === 'four-card';

  const selectionKey = `${phase}:${gameData?.round}`;
  const [selection, setSelection] = useState<{
    key: string;
    card: string | null;
    vp: number | null;
  }>({ key: selectionKey, card: null, vp: null });
  const selectedCardId = selection.key === selectionKey ? selection.card : null;
  const selectedVp = selection.key === selectionKey ? selection.vp : null;
  const setSelectedCardId = (card: string) =>
    setSelection({ key: selectionKey, card, vp: selectedVp });
  const setSelectedVp = (vp: number) =>
    setSelection({ key: selectionKey, card: selectedCardId, vp });

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

  // 기록 데이터는 서버의 개인별 마스킹을 그대로 사용한다.
  const recordLog = gameData?.log;
  const recordFirst = gameData?.firstByRound;
  const recordPlayers = gameData?.players;
  const recordRound = gameData?.round ?? 0;
  useGameHud(
    gameData
      ? {
          round: `${gameData.round}R`,
          order:
            gameData.phase === 'finished'
              ? '종료'
              : gameData.phase === 'reveal'
                ? '최종 공개'
                : gameData.phase === 'open'
                  ? '(공동 차례) 카드 공개'
                  : `${
                      gameData.currentTurnId === myId
                        ? '(내 차례)'
                        : gameData.me
                          ? '(상대 차례)'
                          : // 관전자에게 '상대' 는 누구인지 모른다 — 차례인 사람 이름으로
                            `(${gameData.players[gameData.currentTurnId ?? '']?.nickname ?? '상대'} 차례)`
                    } ${gameData.phase === 'mulligan' ? '멀리건 선택' : '카드 교환'}`,
        }
      : null,
  );

  const statusText = gameData ? quatroPlayGuide(gameData, myId) : '';
  useEffect(() => {
    setHeaderBelow(
      statusText ? (
        <p data-quatro-play-guide className="m-0 text-xs leading-relaxed text-slate-200">
          {statusText}
        </p>
      ) : null,
    );
    return () => setHeaderBelow(null);
  }, [setHeaderBelow, statusText]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  function act(action: Record<string, unknown>) {
    sendAction(action);
  }

  return (
    <GameReferenceFrame
      controls={
        me && (
          <>
            {' '}
            {/* 행동 버튼 */}
            <div className="mt-3 flex flex-wrap gap-2">
              {phase === 'mulligan' && isMyTurn && (
                <>
                  <ActionBtn onClick={() => act({ type: 'mulligan', use: true })}>
                    멀리건 사용 (새 카드 4장)
                  </ActionBtn>
                  <ActionBtn
                    variant="secondary"
                    onClick={() => act({ type: 'mulligan', use: false })}
                  >
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
          </>
        )
      }
      reference={
        <>
          {(me || opp || seats.length > 0) && (
            <GameInfoPart title="플레이어 점수판" sizeToContent>
              <div className="grid grid-cols-2 gap-2">
                {(me || opp ? [me, opp] : seats).filter(Boolean).map((player) => (
                  <div key={player!.id} className="text-xs">
                    <b>{player!.id === myId ? '나' : opponentDisplayName(player!.nickname, !me)}</b>
                    <p>
                      교환 {player!.vpUsedCount}/{QUATRO_VP_COUNT}
                    </p>
                    <p>
                      멀리건 {player!.mulligansUsed}/{QUATRO_MAX_MULLIGANS}
                    </p>
                  </div>
                ))}
              </div>
            </GameInfoPart>
          )}
          <GameInfoPart title="라운드 기록">
            <QuatroRecord
              log={recordLog ?? []}
              firstByRound={recordFirst ?? {}}
              players={recordPlayers ?? {}}
              myId={myId}
              round={recordRound}
            />
          </GameInfoPart>
        </>
      }
    >
      <div
        data-game-intrinsic-stage
        className={cn(
          // 모바일은 판 여백을 줄여 조작부까지 한 화면에 — 넓은 화면은 그대로
          'quatro-stage flex w-full max-w-3xl min-w-0 flex-col justify-center gap-1 p-1 sm:gap-3 sm:p-3',
          isFourCard && 'skin-four-card-table',
        )}
      >
        {/* 상대 */}
        {opp && !gameData.result && (
          <SeatPanel
            player={opp}
            name={opponentDisplayName(opp.nickname)}
            isFirst={gameData.firstId === opp.id}
            fourCard={isFourCard}
          />
        )}

        {/* 관전자 — 두 플레이어의 공개 카드(오픈한 카드만 앞면). 판 위아래에 한 사람씩 */}
        {!me && seats[0] && !gameData.result && (
          <SeatPanel
            player={seats[0]}
            name={seats[0].nickname}
            isFirst={gameData.firstId === seats[0].id}
            fourCard={isFourCard}
          />
        )}

        {/* 가상 플레이어 6명 */}
        <section
          hidden={Boolean(gameData.result)}
          className="quatro-panel quatro-vp-panel rounded-cdm-lg border-cdm-border bg-cdm-bg-elev-1 border p-1.5"
        >
          <div
            className={`grid gap-2 ${isFourCard ? 'grid-cols-2 sm:grid-cols-3' : 'grid-cols-3'}`}
          >
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
                    'quatro-vp-seat rounded-cdm-md flex flex-col items-center gap-1 border p-1 transition-colors',
                    selectedVp === vp.index
                      ? 'quatro-vp-seat--selected border-cdm-primary bg-cdm-primary-soft'
                      : vp.usedByMe
                        ? 'quatro-vp-seat--used border-cdm-border bg-cdm-bg-elev-2 opacity-50'
                        : 'border-cdm-border bg-cdm-bg',
                    selectable &&
                      'quatro-vp-seat--selectable hover:border-cdm-primary cursor-pointer',
                  )}
                >
                  <span className="text-cdm-fg text-[11px] font-bold">
                    {String.fromCharCode(65 + vp.index)}
                    {/* 교환 표시는 닉네임 대신 [나]/[상대] — 익명(???)이면 누구인지 헷갈리고, 괄호로 묶어야 한눈에 들어온다 */}
                    {vp.usedByMe && <span className="text-cdm-primary"> [나]</span>}
                    {vp.usedByOpp && (
                      <span className="text-cdm-fg-subtle"> [{me ? '상대' : '교환됨'}]</span>
                    )}
                  </span>
                  <div className="flex gap-0.5">
                    {vp.cards ? (
                      /* 관전자 — 가상 플레이어 패 전체 공개 */
                      vp.cards.map((c) => (
                        <CardFace key={c.id} card={c} size="sm" fourCard={isFourCard} />
                      ))
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
        {me && !gameData.result && (
          <section className="quatro-panel rounded-cdm-lg border-cdm-border bg-cdm-bg border p-1.5">
            <div className="mb-1 flex items-center justify-between text-sm">
              <span className="text-cdm-fg font-semibold">
                내 카드
                {gameData.firstId === me.id && (
                  <span className="bg-cdm-highlight/20 text-cdm-highlight ml-1.5 rounded px-1.5 text-[11px] font-bold">
                    선
                  </span>
                )}
              </span>
            </div>
            <div className="flex gap-2 pt-1">
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
          </section>
        )}

        {!me && seats[1] && !gameData.result && (
          <SeatPanel
            player={seats[1]}
            name={seats[1].nickname}
            isFirst={gameData.firstId === seats[1].id}
            fourCard={isFourCard}
          />
        )}

        {/* 결과 */}
        {gameData.result && (
          <section className="quatro-panel quatro-result rounded-cdm-lg border-cdm-primary bg-cdm-primary-soft/40 border-2 p-4">
            <p className="text-cdm-fg mb-3 text-center text-base font-bold">
              {gameData.result.winnerId
                ? `${gameData.players[gameData.result.winnerId]?.nickname} 승리 — ${gameData.result.reason}`
                : `무승부 — ${gameData.result.reason}`}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center sm:gap-8">
              {Object.entries(gameData.result.hands).map(([pid, cards]) => (
                <div key={pid} className="flex flex-col items-center gap-1.5">
                  <span className="text-cdm-fg text-sm font-semibold">
                    {gameData.players[pid]?.nickname}
                    <span className="text-cdm-fg-muted ml-1.5 text-xs">
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
    </GameReferenceFrame>
  );
}

/** 다른 사람의 패 한 줄 — 오픈한 카드만 앞면. 플레이어가 보는 상대 패 · 관전자가 보는 두 자리에 쓴다 */
function SeatPanel({
  player,
  name,
  isFirst,
  fourCard,
}: {
  player: QuatroPlayerView;
  name: string;
  isFirst: boolean;
  fourCard: boolean;
}) {
  return (
    <section className="quatro-panel rounded-cdm-lg border-cdm-border bg-cdm-bg border p-1.5">
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="text-cdm-fg font-semibold">
          {name}
          {isFirst && (
            <span className="bg-cdm-highlight/20 text-cdm-highlight ml-1.5 rounded px-1.5 text-[11px] font-bold">
              선
            </span>
          )}
        </span>
      </div>
      <div className="flex gap-2 pt-1">
        {player.hand.map((h, i) => (
          <CardFace key={i} card={h.card} badge={h.open ? '공개' : undefined} fourCard={fourCard} />
        ))}
      </div>
    </section>
  );
}

export default memo(QuatroView);
