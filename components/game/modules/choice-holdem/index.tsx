'use client';

import { useMemo, useState } from 'react';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import type {
  ChoiceHoldemCard,
  ChoiceHoldemEvaluation,
  ChoiceHoldemGameData,
  ChoiceHoldemHandCategory,
} from '@/shared/types/choice-holdem';
import Button from '@/components/ui/Button';
import CardTile from './CardTile';

const CATEGORY_LABEL: Record<ChoiceHoldemHandCategory, string> = {
  'high-card': '하이 카드',
  'one-pair': '원 페어',
  'two-pair': '투 페어',
  triple: '트리플',
  straight: '스트레이트',
  'full-house': '풀하우스',
  'four-kind': '포 카드',
};

const PHASE_LABEL: Record<ChoiceHoldemGameData['phase'], string> = {
  'first-betting': '1차 베팅',
  'arranging-choice': '카드 배치',
  'choosing-card': '카드 선택',
  'second-betting': '2차 베팅',
  'round-result': '라운드 결과',
  finished: '게임 종료',
};

function evaluationLabel(evaluation: ChoiceHoldemEvaluation | undefined) {
  if (!evaluation) return '';
  const number =
    evaluation.primaryValues.length > 0 ? ` · ${evaluation.primaryValues.join('/')}` : '';
  return `${CATEGORY_LABEL[evaluation.category]}${number}`;
}

function PlayerPanel({
  playerId,
  gameData,
  myId,
}: {
  playerId: string;
  gameData: ChoiceHoldemGameData;
  myId: string;
}) {
  const player = gameData.players[playerId];
  const isCurrent = gameData.currentTurnId === playerId;
  return (
    <div
      className={cn(
        'rounded-cdm-lg border p-2.5 transition sm:p-3',
        isCurrent
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-cdm-fg truncate text-xs font-black sm:text-sm">
          {player.nickname}
          {playerId === myId ? ' (나)' : ''}
        </p>
        <span className="text-cdm-primary text-sm font-black tabular-nums">{player.chips}칩</span>
      </div>
      <div className="mt-1 flex items-center justify-between text-[10px] font-bold sm:text-xs">
        <span className="text-cdm-fg-muted">베팅 {player.roundBet}</span>
        <span className={isCurrent ? 'text-cdm-highlight' : 'text-cdm-fg-subtle'}>
          {isCurrent
            ? '행동 중'
            : playerId === gameData.firstPlayerId
              ? '선 플레이어'
              : '후 플레이어'}
        </span>
      </div>
    </div>
  );
}

function ChoiceArea({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
  const isMyTurn = gameData.currentTurnId === myId;
  const [selectedIndex, setSelectedIndex] = useState<0 | 1 | null>(null);
  const options = gameData.choice.options;

  if (gameData.phase === 'arranging-choice') {
    const canArrange = isMyTurn && options != null;
    return (
      <section className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg text-sm font-black">
          {canArrange
            ? '앞면으로 공개할 카드를 고르세요'
            : '선 플레이어가 카드를 배치하고 있습니다'}
        </p>
        <p className="text-cdm-fg-muted mt-0.5 text-[11px]">남은 카드는 뒷면으로 놓입니다.</p>
        <div className="mt-3 flex justify-center gap-4">
          {(options ?? [null, null]).map((card, index) => (
            <CardTile
              key={index}
              value={card}
              label={canArrange ? '앞면으로 두기' : '배치 중'}
              selected={selectedIndex === index}
              onClick={canArrange ? () => setSelectedIndex(index as 0 | 1) : undefined}
            />
          ))}
        </div>
        {canArrange && (
          <Button
            className="mt-3 w-full sm:w-auto"
            disabled={selectedIndex == null}
            onClick={() => {
              if (selectedIndex == null) return;
              getSocket().emit('game:action', {
                type: 'arrange-choice',
                faceUpIndex: selectedIndex,
              });
            }}
          >
            이 카드 공개하기
          </Button>
        )}
      </section>
    );
  }

  if (gameData.phase === 'choosing-card') {
    const canPick = isMyTurn && myId === gameData.selectorId;
    return (
      <section className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-lg border p-3 text-center">
        <p className="text-cdm-fg text-sm font-black">
          {canPick ? '가져갈 카드 한 장을 선택하세요' : '후 플레이어가 카드를 선택하고 있습니다'}
        </p>
        <div className="mt-3 flex justify-center gap-5">
          <CardTile
            value={gameData.choice.faceUp}
            label="앞면"
            onClick={
              canPick
                ? () => getSocket().emit('game:action', { type: 'pick-choice', choice: 'face-up' })
                : undefined
            }
          />
          <CardTile
            value={gameData.choice.faceDown}
            label="뒷면"
            onClick={
              canPick
                ? () =>
                    getSocket().emit('game:action', { type: 'pick-choice', choice: 'face-down' })
                : undefined
            }
          />
        </div>
      </section>
    );
  }
  return null;
}

function BettingArea({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
  const [showRaise, setShowRaise] = useState(false);
  const [raiseAmount, setRaiseAmount] = useState(gameData.minRaise ?? 0);
  const isBetting = gameData.phase === 'first-betting' || gameData.phase === 'second-betting';
  const isMyTurn = isBetting && gameData.currentTurnId === myId;

  if (!isBetting) return null;
  if (!isMyTurn) {
    const currentName = gameData.currentTurnId
      ? gameData.players[gameData.currentTurnId]?.nickname
      : null;
    return (
      <div className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-lg border p-4 text-center">
        <p className="text-cdm-fg-muted animate-pulse text-sm font-bold">
          {currentName ? `${currentName} 님이 베팅 중입니다` : '베팅을 기다리는 중입니다'}
        </p>
      </div>
    );
  }

  return (
    <section className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-3">
      <div className="mb-3 flex items-center justify-between text-xs">
        <span className="text-cdm-fg-muted">맞출 칩</span>
        <span className="text-cdm-fg text-base font-black tabular-nums">{gameData.toCall}</span>
      </div>
      {showRaise && gameData.minRaise != null && gameData.maxRaise != null ? (
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <input
              className="accent-cdm-primary min-w-0 flex-1"
              type="range"
              min={gameData.minRaise}
              max={gameData.maxRaise}
              value={raiseAmount}
              onChange={(event) => setRaiseAmount(Number(event.target.value))}
            />
            <span className="text-cdm-fg w-14 text-right text-base font-black tabular-nums">
              {raiseAmount}
            </span>
          </div>
          <p className="text-cdm-fg-muted text-center text-[10px]">
            이번 라운드 총 베팅 · {gameData.minRaise}–{gameData.maxRaise}
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() =>
                getSocket().emit('game:action', { type: 'raise', amount: raiseAmount })
              }
            >
              레이즈 {raiseAmount}
            </Button>
            <Button variant="ghost" onClick={() => setShowRaise(false)}>
              취소
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2">
          <Button onClick={() => getSocket().emit('game:action', { type: 'call' })}>
            {gameData.toCall === 0 ? '체크' : `콜 ${gameData.toCall}`}
          </Button>
          <Button
            variant="secondary"
            disabled={gameData.minRaise == null}
            onClick={() => setShowRaise(true)}
          >
            레이즈
          </Button>
          <Button
            variant="danger"
            onClick={() => getSocket().emit('game:action', { type: 'fold' })}
          >
            폴드
          </Button>
        </div>
      )}
    </section>
  );
}

function ResultArea({ gameData }: { gameData: ChoiceHoldemGameData }) {
  const result = gameData.lastRoundResult;
  if (gameData.phase !== 'round-result' || !result) return null;
  const winnerName = result.winnerId ? gameData.players[result.winnerId]?.nickname : null;
  return (
    <section className="border-cdm-highlight bg-cdm-highlight-soft rounded-cdm-lg border p-3 text-center">
      <p className="text-cdm-fg text-base font-black">
        {result.reason === 'tie'
          ? '완전 동률 · 팟 이월'
          : result.reason === 'fold'
            ? `${winnerName ?? '상대'} 님이 폴드 승리`
            : `${winnerName ?? '플레이어'} 님이 ${result.potAmount}칩 획득`}
      </p>
      {result.evaluations && (
        <div className="mt-2 grid grid-cols-2 gap-2">
          {Object.entries(result.evaluations).map(([playerId, evaluation]) => (
            <div key={playerId} className="bg-cdm-bg/70 rounded-cdm-md px-2 py-1.5">
              <p className="text-cdm-fg-muted truncate text-[10px]">
                {gameData.players[playerId]?.nickname}
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

export default function ChoiceHoldemGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as ChoiceHoldemGameData | undefined;
  const myId = useMySocketId();
  const { remaining } = useTurnTimer();

  const playerIds = useMemo(() => (gameData ? Object.keys(gameData.players) : []), [gameData]);
  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }
  const isPlayer = Boolean(gameData.players[myId]);
  const myPlayer = gameData.players[myId];
  const opponentId = playerIds.find((playerId) => playerId !== myId) ?? playerIds[1];
  const opponent = opponentId ? gameData.players[opponentId] : undefined;
  const resultCards = gameData.lastRoundResult?.holeCards;

  return (
    <div className="mx-auto flex h-full w-full max-w-5xl flex-col gap-2 overflow-y-auto overscroll-contain p-2 sm:gap-3 sm:p-4">
      <header className="border-cdm-border bg-cdm-bg rounded-cdm-lg grid grid-cols-[1fr_auto] items-center gap-2 border p-2.5 sm:p-3">
        <div>
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.16em]">
            ROUND {gameData.round}
          </p>
          <p className="text-cdm-fg text-sm font-black">
            {PHASE_LABEL[gameData.phase]}
            {gameData.carryRound && (
              <span className="text-cdm-highlight ml-2">베팅 없는 이월 라운드</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-3 text-center">
          <div>
            <p className="text-cdm-fg-subtle text-[9px] font-bold">ANTE</p>
            <p className="text-cdm-fg text-lg font-black">{gameData.ante}</p>
          </div>
          <div className="bg-cdm-primary-soft rounded-cdm-md min-w-16 px-3 py-1.5">
            <p className="text-cdm-primary text-[9px] font-bold">POT</p>
            <p className="text-cdm-primary text-xl font-black tabular-nums">{gameData.pot}</p>
          </div>
          <div>
            <p className="text-cdm-fg-subtle text-[9px] font-bold">TIME</p>
            <p
              className={cn(
                'text-cdm-fg text-lg font-black tabular-nums',
                remaining != null && remaining <= 10 && 'text-cdm-accent',
              )}
            >
              {remaining == null ? '∞' : Math.ceil(remaining)}
            </p>
          </div>
        </div>
      </header>

      <div className="grid grid-cols-2 gap-2">
        {playerIds.map((playerId) => (
          <PlayerPanel key={playerId} playerId={playerId} gameData={gameData} myId={myId} />
        ))}
      </div>

      <main className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-xl flex flex-col items-center gap-3 border p-3 sm:p-4">
        <div className="text-center">
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.14em]">COMMUNITY</p>
          <div className="mt-1.5 flex justify-center gap-2">
            {gameData.communityCards.map((card, index) => (
              <CardTile key={index} value={card} compact />
            ))}
          </div>
        </div>

        {(myPlayer || opponent) && (
          <div className="border-cdm-border grid w-full max-w-xl grid-cols-2 gap-4 border-t pt-3">
            {[myPlayer, opponent].map(
              (player, playerIndex) =>
                player && (
                  <div key={player.id} className="text-center">
                    <p className="text-cdm-fg-muted mb-1 text-[10px] font-bold">
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

        {gameData.choice.arranged &&
          !['arranging-choice', 'choosing-card'].includes(gameData.phase) && (
            <p className="text-cdm-fg-muted text-[10px]">
              공개 선택 카드 {gameData.choice.faceUp} ·{' '}
              {gameData.choice.faceUpOwnerId
                ? `${gameData.players[gameData.choice.faceUpOwnerId]?.nickname} 소유`
                : '선택 전'}
            </p>
          )}
      </main>

      <ChoiceArea gameData={gameData} myId={myId} />
      {isPlayer ? (
        <BettingArea
          key={`${gameData.phase}:${gameData.currentTurnId}:${gameData.minRaise}`}
          gameData={gameData}
          myId={myId}
        />
      ) : (
        gameData.phase !== 'finished' && (
          <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
        )
      )}
      <ResultArea gameData={gameData} />

      {gameData.phase === 'finished' && (
        <section className="bg-cdm-primary-soft rounded-cdm-lg p-4 text-center">
          <p className="text-cdm-primary text-base font-black">
            {gameData.winnerId
              ? `${gameData.players[gameData.winnerId]?.nickname} 승리!`
              : '무승부'}
          </p>
          <p className="text-cdm-fg-muted mt-1 text-xs">{gameData.finishReason}</p>
        </section>
      )}
    </div>
  );
}
