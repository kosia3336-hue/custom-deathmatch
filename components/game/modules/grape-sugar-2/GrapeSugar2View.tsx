'use client';
import { useGameAction } from '@/components/game/GameActionContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameHud } from '@/hooks/useGameHud';
import { submitStage } from '@/lib/gameSeat';
import type { SkinTheme } from '@/lib/skins/registry';
import type { GS2CardId, GS2GameData, GS2Side } from '@/shared/types/grape-sugar-2';
import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { CardHand } from './CardHand';
import { CardSubmitModal } from './CardSubmitModal';
import { CombatArea } from './CombatArea';
import { WIN_TYPE_LABELS } from './constants';
import { PlayerPanel } from './PlayerPanel';
import { CANDY_SPARKLES } from './presentation';
import { RoundHistoryPanel } from './RoundHistoryPanel';
import { SugarBar } from './SugarBar';

function GrapeSugar2View({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
}: {
  gameData?: GS2GameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const sendAction = useGameAction();

  const isCandy = skin === 'candy';

  const [pendingSugar, setPendingSugar] = useState<number>(0);
  const [submitting, setSubmitting] = useState(false);
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
  /*
    상단 바 — 라운드만. 동시 제출 게임이라 선/후가 없다.
    점수·기록은 독립 창, 입력 카드는 무대, 설탕 조절은 하단에 둔다.
  */
  const gsRound = gameData?.round ?? 0;
  const gsMax = gameData?.maxRound ?? 8;
  useGameHud(
    gameData
      ? {
          round: `${gsRound} / ${gsMax}R`,
          order:
            gameData.phase === 'input'
              ? submitStage({
                  finished: false,
                  isSpectator,
                  submitted: myPlayer?.submitted ?? false,
                  pending: '(공동 차례) 카드·설탕 선택',
                })
              : gameData.phase === 'finished'
                ? '종료'
                : '라운드 정산',
        }
      : null,
  );

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
  const handleSelectCard = useCallback(
    (card: GS2CardId) => {
      if (submitting || isSpectator) return;
      if (!myPlayer || !myPlayer.hand.includes(card)) return;
      setModalCard(card);
    },
    [submitting, isSpectator, myPlayer],
  );

  /* 모달에서 확정 제출 */
  const handleConfirmSubmit = useCallback(() => {
    if (!modalCard || submitting) return;
    if (pendingSugar > (myPlayer?.sugarRemain ?? 0)) {
      toast.error(`설탕이 부족합니다. (보유 ${myPlayer?.sugarRemain ?? 0})`);
      return;
    }
    setSubmitting(true);
    setModalCard(null);
    sendAction({
      type: 'submit',
      card: modalCard,
      sugar: pendingSugar,
    });
  }, [modalCard, pendingSugar, submitting, myPlayer, sendAction]);

  const handleCancelSubmit = useCallback(() => {
    if (!myPlayer?.submitted) return;
    sendAction({ type: 'cancelSubmit' });
    setSubmitting(false);
  }, [myPlayer, sendAction]);

  if (!gameData) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <GameLoading label="로딩 중" />
      </div>
    );
  }

  const isInput = gameData.phase === 'input';

  const isExtension = gameData.phase === 'extensionIntro';
  const isFinished = gameData.phase === 'finished';
  const mySubmitted = myPlayer?.submitted ?? false;
  const oppSubmitted = opponent?.submitted ?? false;
  const canAct = isInput && !isSpectator && !mySubmitted && !!myPlayer;

  return (
    <>
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
      <GameReferenceFrame
        baseSkin={!isCandy}
        className={isCandy ? 'skin-candy-field' : undefined}
        reference={
          <GameInfoStack>
            <GameInfoPart title="점수" sizeToContent>
              <div className="grid grid-cols-2 gap-1">
                {[myPlayer ?? gameData.players.p1, opponent ?? gameData.players.p2].map((p) => (
                  <PlayerPanel
                    key={p.side}
                    player={p}
                    label={p.id === myId ? '나' : isSpectator ? p.nickname : '상대'}
                    isMe={p.id === myId && !isSpectator}
                    showSubmittedBadge={isInput}
                    candy={isCandy}
                    showHand={false}
                  />
                ))}
              </div>
            </GameInfoPart>
            <GameInfoPart title="잔여 카드" sizeToContent>
              {[gameData.players.p1, gameData.players.p2]
                .filter((p) => isSpectator || p.id !== myId)
                .map((p) => (
                  <PlayerPanel
                    key={p.side}
                    player={p}
                    label={isSpectator ? p.nickname : '상대'}
                    isMe={false}
                    showSubmittedBadge={false}
                    showStats={false}
                    candy={isCandy}
                  />
                ))}
            </GameInfoPart>
            <GameInfoPart title="라운드 기록">
              <RoundHistoryPanel
                history={gameData.history}
                players={gameData.players}
                mySide={mySide}
                candy={isCandy}
              />
            </GameInfoPart>
          </GameInfoStack>
        }
        controls={
          myPlayer && !isSpectator && isInput ? (
            <div className="flex flex-col gap-1">
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
            </div>
          ) : undefined
        }
      >
        {isCandy && (
          <div className="skin-candy-fx" aria-hidden>
            {CANDY_SPARKLES.map((s, i) => (
              <span
                key={i}
                className="skin-candy-sparkle"
                style={{ left: s.left, top: s.top, animationDelay: s.delay }}
              >
                ✦
              </span>
            ))}
          </div>
        )}
        <div className="flex h-full w-full max-w-2xl flex-col justify-center gap-2 overflow-hidden">
          {isInput ? (
            myPlayer && !isSpectator ? (
              <CardHand
                hand={myPlayer.hand}
                onSelectCard={handleSelectCard}
                canAct={canAct}
                submitted={mySubmitted}
                candy={isCandy}
                belt={isCandy}
              />
            ) : (
              <p className="text-cdm-fg-muted text-center text-sm">플레이어들이 선택 중입니다.</p>
            )
          ) : (
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
          {isExtension && (
            <p className="text-center text-xl font-bold text-purple-600">
              {gameData.extension}차 연장전
            </p>
          )}
        </div>
      </GameReferenceFrame>
    </>
  );
}

export default memo(GrapeSugar2View);
