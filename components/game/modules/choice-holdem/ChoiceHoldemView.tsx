'use client';
import { memo } from 'react';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GamePlayerScoreboard } from '@/components/game/GamePlayerScoreboard';
import { PokerBettingPanel } from '@/components/game/poker/PokerBettingPanel';
import { PokerBettingSummary } from '@/components/game/poker/PokerBettingSummary';
import { PokerAmountInput } from '@/components/game/poker/PokerAmountInput';
import { PokerTableInfo } from '@/components/game/poker/PokerTableInfo';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameAction } from '@/components/game/GameActionContext';

import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useMemo, useState } from 'react';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { playChipsSfx } from '@/lib/audio/chips';
import { usePokerAudio } from '@/hooks/useGameAudio';
import Button from '@/components/ui/Button';
import type { ChoiceHoldemCard, ChoiceHoldemGameData } from '@/shared/types/choice-holdem';
import CardTile from './CardTile';
import RecordPanel, { evaluationLabel } from './RecordPanel';

const PHASE_LABEL: Record<ChoiceHoldemGameData['phase'], string> = {
  'first-betting': '1차 베팅',
  'arranging-choice': '카드 배치',
  'choosing-card': '카드 선택',
  'second-betting': '2차 베팅',
  'round-result': '라운드 결과',
  finished: '게임 종료',
};

/** 선의 앞면 배치와 후의 카드 선택. */
function ChoiceArea({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
  const sendAction = useGameAction();
  const isMyTurn = gameData.currentTurnId === myId;
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | null>(null);
  const options = gameData.choice.options;

  if (gameData.phase === 'arranging-choice') {
    const canArrange = isMyTurn && options != null;
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 text-center">
        <p className="text-cdm-fg text-xs font-black">
          {canArrange
            ? '앞면으로 공개할 카드를 골라야 합니다'
            : '선 플레이어가 카드를 배치하고 있습니다'}
        </p>
        <p className="text-cdm-fg-muted mt-0.5 text-[11px]">남은 카드는 뒷면으로 놓입니다.</p>
        <div className="mt-2 flex justify-center gap-4">
          {(options ?? [null, null]).map((card, index) => (
            <CardTile
              key={index}
              value={card}
              compact
              label={canArrange ? '앞면으로 두기' : '배치 중'}
              selected={selectedIndex === index}
              onClick={canArrange ? () => setSelectedIndex(index as 0 | 1) : undefined}
            />
          ))}
        </div>
        {canArrange && (
          <Button
            className="mt-2"
            disabled={selectedIndex == null}
            onClick={() => {
              if (selectedIndex == null) return;
              sendAction({ type: 'arrange-choice', faceUpIndex: selectedIndex });
            }}
          >
            이 카드 공개하기
          </Button>
        )}
      </div>
    );
  }

  if (gameData.phase === 'choosing-card') {
    const canPick = isMyTurn && myId === gameData.selectorId;
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 text-center">
        <p className="text-cdm-fg text-xs font-black">
          {canPick ? '가져갈 카드 한 장을 골라야 합니다' : '후 플레이어가 카드를 선택하고 있습니다'}
        </p>
        <div className="mt-2 flex justify-center gap-5">
          <CardTile
            value={gameData.choice.faceUp}
            compact
            label="앞면"
            onClick={
              canPick ? () => sendAction({ type: 'pick-choice', choice: 'face-up' }) : undefined
            }
          />
          <CardTile
            value={gameData.choice.faceDown}
            compact
            label="뒷면"
            onClick={
              canPick ? () => sendAction({ type: 'pick-choice', choice: 'face-down' }) : undefined
            }
          />
        </div>
      </div>
    );
  }
  return null;
}

/** 칩 한 줄 — 큰 숫자와 작은 이름표. 조작부에서 눈이 먼저 닿는 자리다. */
function BettingArea({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
  const sendAction = useGameAction();
  const [showRaise, setShowRaise] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(gameData.minRaise ?? 0);
  const isBetting = gameData.phase === 'first-betting' || gameData.phase === 'second-betting';
  const mine = gameData.players[myId];
  const myBet = mine?.roundBet ?? 0;

  if (!isBetting) return null;

  if (gameData.currentTurnId !== myId) {
    const currentName = gameData.currentTurnId
      ? gameData.players[gameData.currentTurnId]?.nickname
      : null;
    return (
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border px-3 py-2.5 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-xs font-bold">
          {currentName ? `${currentName} 님이 베팅 중입니다` : '베팅을 기다리는 중입니다'}
        </p>
      </div>
    );
  }

  const raiseExtra = Math.max(0, raiseAmount - myBet);
  return (
    <PokerBettingPanel>
      <PokerBettingSummary
        chips={mine?.chips ?? 0}
        pot={gameData.pot}
        callCost={showRaise ? raiseExtra : gameData.toCall}
        costLabel={showRaise ? '추가 칩' : '콜 비용'}
        status={PHASE_LABEL[gameData.phase]}
      />
      {showRaise && gameData.minRaise != null && gameData.maxRaise != null ? (
        <PokerAmountInput
          min={gameData.minRaise}
          max={gameData.maxRaise}
          initialAmount={gameData.minRaise}
          maximumLabel="올인"
          onPreview={setRaiseAmount}
          onCancel={() => setShowRaise(false)}
          confirmLabel={(amount) => `레이즈 · 총 ${amount} (+${Math.max(0, amount - myBet)})`}
          onConfirm={(amount) => {
            setShowRaise(false);
            sendAction({ type: 'raise', amount });
          }}
        />
      ) : (
        <div className="ip-betting-actions">
          <button
            type="button"
            className="ip-betting-primary"
            onClick={() => sendAction({ type: 'call' })}
          >
            {gameData.toCall === 0 ? '체크' : `콜 ${gameData.toCall}`}
          </button>
          <button
            type="button"
            disabled={gameData.minRaise == null}
            onClick={() => {
              setRaiseAmount(gameData.minRaise ?? 0);
              setShowRaise(true);
            }}
          >
            레이즈
          </button>
          <button
            type="button"
            className="ip-betting-fold"
            onClick={() => sendAction({ type: 'fold' })}
          >
            폴드
          </button>
        </div>
      )}
    </PokerBettingPanel>
  );
}

/** 공개된 개인 카드와 공유 카드를 가리지 않도록 판 아래에 결과를 표시한다. */
function ResultSummary({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId
    ? result.winnerId === myId
      ? '나'
      : gameData.players[result.winnerId]?.nickname
    : null;
  /*
    다이는 이긴 사람이 아니라 던진 사람을 부른다 — 다른 카드 게임과 같은 표기다.
    여기서는 '나' 로 바꾸지 않는다. '나님 다이' 가 되어 읽기 이상해진다.
  */
  const foldedName = result.foldedPlayerId
    ? gameData.players[result.foldedPlayerId]?.nickname
    : null;
  return (
    <section
      aria-label="라운드 결과"
      className="border-cdm-highlight bg-cdm-bg rounded-cdm-lg border px-3 py-3 text-center"
    >
      <p className="text-cdm-fg text-base font-black">
        {result.reason === 'tie'
          ? '완전 동률 · 팟 이월'
          : result.reason === 'fold'
            ? `${foldedName ?? '상대'}님 다이`
            : `${winnerName ?? '플레이어'} 님이 ${result.potAmount}칩 획득`}
      </p>
      {result.evaluations && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(result.evaluations).map(([playerId, evaluation]) => (
            <div key={playerId} className="bg-cdm-bg-elev-1 rounded-cdm-md px-2 py-1">
              <p className="text-cdm-fg-muted truncate text-[11px]">
                {playerId === myId ? '나' : gameData.players[playerId]?.nickname}
              </p>
              <p className="text-cdm-fg text-xs font-black">{evaluationLabel(evaluation)}</p>
            </div>
          ))}
        </div>
      )}
      {result.reason === 'tie' && (
        <p className="text-cdm-fg-muted mt-2 text-[11px]">
          선 플레이어를 유지하고 다음 딜은 베팅 없이 진행합니다.
        </p>
      )}
    </section>
  );
}

function ChoiceHoldemView({
  gameData,
  myId,
}: GameModuleViewProps<ChoiceHoldemGameData> & { isSolo?: boolean }) {
  const { setHud, setHeaderBelow } = useRoomLayout();

  const playerIds = useMemo(() => (gameData ? Object.keys(gameData.players) : []), [gameData]);
  const isPlayer = Boolean(gameData && gameData.players[myId]);
  const myTurn = gameData?.currentTurnId === myId;

  /* 차례·라운드·기록은 상단 바로 올린다. 조작부와 무대는 그만큼 넓어진다. */
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${gameData.round}R`,
      order:
        gameData.phase === 'finished'
          ? '종료'
          : gameData.phase === 'round-result'
            ? '라운드 결과'
            : !isPlayer
              ? '관전'
              : myTurn
                ? `(내 차례) ${PHASE_LABEL[gameData.phase]}`
                : `(상대 차례) ${PHASE_LABEL[gameData.phase]}`,
    });
  }, [gameData, isPlayer, myTurn, myId, setHud]);
  useEffect(() => () => setHud(null), [setHud]);
  const ante = gameData?.ante;
  const pot = gameData?.pot;
  useEffect(() => {
    setHeaderBelow(ante != null && pot != null ? <PokerTableInfo ante={ante} pot={pot} /> : null);
    return () => setHeaderBelow(null);
  }, [ante, pot, setHeaderBelow]);

  usePokerAudio(
    gameData
      ? {
          round: gameData.round,
          phase: gameData.phase,
          pot:
            gameData.phase === 'round-result'
              ? (gameData.lastRoundResult?.potAmount ?? gameData.pot)
              : gameData.pot,
          turnId: gameData.currentTurnId,
          myId,
          isPlayer: Boolean(gameData.players[myId]),
        }
      : null,
  );

  /* 라운드가 끝나 팟이 넘어갈 때 한 번. 라운드 번호로 묶어 결과 화면이 다시 그려져도 겹치지 않는다. */
  const roundEnded = gameData?.phase === 'round-result';
  const roundNumber = gameData?.round;
  useEffect(() => {
    if (roundEnded) playChipsSfx();
  }, [roundEnded, roundNumber]);

  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  const myPlayer = gameData.players[myId];
  const opponentId = playerIds.find((playerId) => playerId !== myId) ?? playerIds[1];
  const opponent = opponentId ? gameData.players[opponentId] : undefined;
  const resultCards = gameData.lastRoundResult?.holeCards;
  const actionKey = [gameData.round, gameData.phase, gameData.currentTurnId, gameData.toCall].join(
    '-',
  );

  return (
    <GameReferenceFrame
      controls={
        isPlayer ? (
          <BettingArea key={actionKey} gameData={gameData} myId={myId} />
        ) : (
          gameData.phase !== 'finished' && (
            <p className="text-cdm-fg-muted text-center text-xs">
              실시간 경기를 관전하고 있습니다.
            </p>
          )
        )
      }
      reference={
        <GameInfoStack>
          <GameInfoPart title="점수" sizeToContent>
            <GamePlayerScoreboard
              myId={myId}
              entries={playerIds.map((id) => ({
                id,
                nickname: gameData.players[id].nickname,
                value: `${gameData.players[id].chips}칩`,
                active: gameData.currentTurnId === id,
              }))}
            />
          </GameInfoPart>
          <RecordPanel data={gameData} myId={myId} />
        </GameInfoStack>
      }
    >
      <main
        data-game-intrinsic-stage
        className="mx-auto flex w-full max-w-xl min-w-0 flex-col justify-center gap-2"
      >
        <div className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-xl grid grid-cols-2 items-center gap-3 border p-3 lg:grid-cols-1">
          <div className="col-span-2 text-center lg:order-2 lg:col-span-1">
            <p className="text-cdm-fg-subtle text-[11px] font-bold tracking-[0.14em]">COMMUNITY</p>
            <div className="mt-1 flex justify-center gap-1.5">
              {gameData.communityCards.map((card, index) => (
                <CardTile key={index} value={card} compact />
              ))}
            </div>
          </div>

          {(myPlayer || opponent) && (
            <div className="contents">
              {[myPlayer, opponent].map(
                (player, playerIndex) =>
                  player && (
                    <div
                      key={player.id}
                      className={
                        playerIndex === 0 ? 'text-center lg:order-3' : 'text-center lg:order-1'
                      }
                    >
                      <p className="text-cdm-fg-muted mb-0.5 text-[11px] font-bold">
                        {playerIndex === 0 && isPlayer
                          ? '내 개인 카드'
                          : `${player.nickname} 개인 카드`}
                      </p>
                      <div className="flex justify-center gap-1.5">
                        {(resultCards?.[player.id] ?? player.cards).map((card, index) => (
                          <CardTile key={index} value={card as ChoiceHoldemCard | null} compact />
                        ))}
                        {player.cards.length < 2 && <CardTile value={null} compact />}
                      </div>
                    </div>
                  ),
              )}
            </div>
          )}
        </div>

        <ChoiceArea gameData={gameData} myId={myId} />
        <ResultSummary gameData={gameData} myId={myId} />

        {gameData.phase === 'finished' && (
          <div className="bg-cdm-primary-soft rounded-cdm-lg p-3 text-center">
            <p className="text-cdm-primary text-base font-black">
              {gameData.winnerId
                ? `${gameData.winnerId === myId ? '나' : gameData.players[gameData.winnerId]?.nickname} 승리!`
                : '무승부'}
            </p>
            <p className="text-cdm-fg-muted mt-0.5 text-xs">{gameData.finishReason}</p>
          </div>
        )}
      </main>
    </GameReferenceFrame>
  );
}

export default memo(ChoiceHoldemView);
