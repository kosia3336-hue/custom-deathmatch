'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';
import { useRoomStore } from '@/stores/room';
import { GameFrame } from '@/components/game/GameFrame';
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

/** 한 사람의 자리 — 이름·칩·이번 라운드에 낸 칩. 낮게 유지해 카드 자리를 남긴다. */
function PlayerRow({
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
        'rounded-cdm-lg flex items-baseline justify-between gap-2 border px-2 py-1 transition',
        isCurrent
          ? 'border-cdm-highlight bg-cdm-highlight-soft'
          : 'border-cdm-border bg-cdm-bg-elev-1',
      )}
    >
      <div className="flex min-w-0 items-baseline gap-1.5">
        <p className="text-cdm-fg truncate text-xs font-black">
          {player.nickname}
          {playerId === myId ? ' (나)' : ''}
        </p>
        <span className="text-cdm-fg-muted shrink-0 text-[10px] font-bold">
          {playerId === gameData.firstPlayerId ? '선' : '후'}
        </span>
      </div>
      <div className="flex shrink-0 items-baseline gap-2">
        <span className="text-cdm-fg-muted text-[10px] font-bold tabular-nums">
          낸 칩 {player.roundBet}
        </span>
        <span className="text-cdm-primary text-sm font-black tabular-nums">{player.chips}칩</span>
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
      <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 text-center">
        <p className="text-cdm-fg text-xs font-black">
          {canArrange
            ? '앞면으로 공개할 카드를 골라야 합니다'
            : '선 플레이어가 카드를 배치하고 있습니다'}
        </p>
        <p className="text-cdm-fg-muted mt-0.5 text-[10px]">남은 카드는 뒷면으로 놓입니다.</p>
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
              getSocket().emit('game:action', { type: 'arrange-choice', faceUpIndex: selectedIndex });
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
              canPick
                ? () => getSocket().emit('game:action', { type: 'pick-choice', choice: 'face-up' })
                : undefined
            }
          />
          <CardTile
            value={gameData.choice.faceDown}
            compact
            label="뒷면"
            onClick={
              canPick
                ? () => getSocket().emit('game:action', { type: 'pick-choice', choice: 'face-down' })
                : undefined
            }
          />
        </div>
      </div>
    );
  }
  return null;
}

/** 칩 한 줄 — 큰 숫자와 작은 이름표. 조작부에서 눈이 먼저 닿는 자리다. */
function ChipStat({
  label,
  value,
  tone = 'plain',
  hint,
}: {
  label: string;
  value: number;
  tone?: 'plain' | 'primary' | 'highlight';
  hint?: string;
}) {
  return (
    <div className="min-w-0 text-center">
      <p className="text-cdm-fg-subtle text-[9px] leading-3 font-bold">{label}</p>
      <p
        className={cn(
          'text-base leading-5 font-black tabular-nums',
          tone === 'primary' && 'text-cdm-primary',
          tone === 'highlight' && 'text-cdm-highlight',
          tone === 'plain' && 'text-cdm-fg',
        )}
      >
        {value}
      </p>
      {hint && <p className="text-cdm-fg-subtle text-[9px] leading-3">{hint}</p>}
    </div>
  );
}

/**
 * 조작부 — 콜·레이즈·다이.
 *
 * 숫자를 먼저 보여 주고 단추를 그 아래 둔다. 예전에는 '맞출 칩' 하나만 있어서
 * 내가 이 판에 이미 얼마를 냈는지, 레이즈하면 추가로 얼마가 나가는지가 보이지
 * 않았다. 레이즈 슬라이더의 값은 '이번 라운드 총 베팅' 이라 그대로 읽으면
 * 그만큼이 또 나가는 것으로 오해하기 쉽다 — 그래서 총액과 추가 지불을 따로 적는다.
 */
function BettingArea({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
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

  /* 레이즈 슬라이더 값은 이번 라운드 총 베팅이다. 실제로 더 내는 칩은 그 차액. */
  const raiseExtra = Math.max(0, raiseAmount - myBet);

  return (
    <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2">
      <div className="mb-2 flex items-start justify-around gap-2">
        <ChipStat label="팟" value={gameData.pot} tone="primary" />
        <ChipStat
          label="내가 낸 칩"
          value={myBet}
          hint={gameData.ante > 0 ? `기본 ${gameData.ante} 포함` : undefined}
        />
        <ChipStat
          label={showRaise ? '추가로 낼 칩' : '맞출 칩'}
          value={showRaise ? raiseExtra : gameData.toCall}
          tone="highlight"
        />
      </div>

      {showRaise && gameData.minRaise != null && gameData.maxRaise != null ? (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <input
              className="accent-cdm-primary min-w-0 flex-1"
              type="range"
              min={gameData.minRaise}
              max={gameData.maxRaise}
              value={raiseAmount}
              onChange={(event) => setRaiseAmount(Number(event.target.value))}
            />
            <span className="text-cdm-fg w-12 shrink-0 text-right text-lg font-black tabular-nums">
              {raiseAmount}
            </span>
          </div>
          <p className="text-cdm-fg-muted text-center text-[10px]">
            이번 라운드 총 베팅 {gameData.minRaise}–{gameData.maxRaise} · 이미 낸 {myBet}칩을 빼고{' '}
            <b className="text-cdm-fg">{raiseExtra}</b>칩이 더 나갑니다
          </p>
          <div className="grid grid-cols-2 gap-2">
            <Button
              onClick={() => {
                setShowRaise(false);
                getSocket().emit('game:action', { type: 'raise', amount: raiseAmount });
              }}
            >
              레이즈 · 총 {raiseAmount} (+{raiseExtra})
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
            onClick={() => {
              setRaiseAmount(gameData.minRaise ?? 0);
              setShowRaise(true);
            }}
          >
            레이즈
          </Button>
          <Button variant="danger" onClick={() => getSocket().emit('game:action', { type: 'fold' })}>
            다이
          </Button>
        </div>
      )}
    </div>
  );
}

/** 라운드 결과는 무대 위에 겹쳐 띄운다 — 새 줄로 만들면 그 순간 판이 밀린다. */
function ResultOverlay({ gameData, myId }: { gameData: ChoiceHoldemGameData; myId: string }) {
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
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
      <div className="border-cdm-highlight bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
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
                <p className="text-cdm-fg-muted truncate text-[10px]">
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
      </div>
    </div>
  );
}

export default function ChoiceHoldemGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as ChoiceHoldemGameData | undefined;
  const myId = useMySocketId();
  const { setHud } = useRoomLayout();

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
          : !isPlayer
            ? '관전'
            : myTurn
              ? '내 차례'
              : '상대 차례',
      memo: <RecordPanel data={gameData} myId={myId} />,
    });
  }, [gameData, isPlayer, myTurn, myId, setHud]);
  useEffect(() => () => setHud(null), [setHud]);

  usePokerAudio(gameData ? {
    round: gameData.round, phase: gameData.phase, pot: gameData.phase === 'round-result' ? (gameData.lastRoundResult?.potAmount ?? gameData.pot) : gameData.pot,
    turnId: gameData.currentTurnId, myId, isPlayer: Boolean(gameData.players[myId]),
  } : null);

  /* 라운드가 끝나 팟이 넘어갈 때 한 번. 라운드 번호로 묶어 결과 화면이 다시 그려져도 겹치지 않는다. */
  const roundEnded = gameData?.phase === 'round-result';
  const roundNumber = gameData?.round;
  useEffect(() => {
    if (roundEnded) playChipsSfx();
  }, [roundEnded, roundNumber]);

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  const myPlayer = gameData.players[myId];
  const opponentId = playerIds.find((playerId) => playerId !== myId) ?? playerIds[1];
  const opponent = opponentId ? gameData.players[opponentId] : undefined;
  const resultCards = gameData.lastRoundResult?.holeCards;
  const seatOrder = myPlayer ? [...playerIds.filter((id) => id !== myId), myId] : playerIds;
  const actionKey = [gameData.round, gameData.phase, gameData.currentTurnId, gameData.toCall].join('-');

  return (
    <GameFrame
      info={
        <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg flex items-center justify-between gap-2 border px-2 py-1.5">
          <p className="text-cdm-fg min-w-0 truncate text-xs leading-4 font-black">
            {PHASE_LABEL[gameData.phase]}
            {gameData.carryRound && <span className="text-cdm-highlight ml-1.5">베팅 없는 이월</span>}
          </p>
          <div className="flex shrink-0 items-center gap-2.5 text-center">
            <div>
              <p className="text-cdm-fg-subtle text-[9px] leading-3 font-bold">ANTE</p>
              <p className="text-cdm-fg text-sm leading-4 font-black tabular-nums">{gameData.ante}</p>
            </div>
            <div className="bg-cdm-primary-soft rounded-cdm-md px-2.5 py-0.5">
              <p className="text-cdm-primary text-[9px] leading-3 font-bold">POT</p>
              <p className="text-cdm-primary text-base leading-5 font-black tabular-nums">
                {gameData.pot}
              </p>
            </div>
          </div>
        </div>
      }
      controls={
        isPlayer ? (
          <BettingArea key={actionKey} gameData={gameData} myId={myId} />
        ) : (
          gameData.phase !== 'finished' && (
            <p className="text-cdm-fg-muted text-center text-xs">실시간 경기를 관전하고 있습니다.</p>
          )
        )
      }
      aside={<RecordPanel data={gameData} myId={myId} />}
    >
      <main className="mx-auto flex h-full w-full max-w-xl min-w-0 flex-col justify-center gap-2 overflow-hidden">
        {seatOrder.map((playerId) => (
          <PlayerRow key={playerId} playerId={playerId} gameData={gameData} myId={myId} />
        ))}

        <div className="border-cdm-border bg-cdm-bg-elev-1 rounded-cdm-xl flex flex-col items-center gap-2 border p-2">
          <div className="text-center">
            <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-[0.14em]">COMMUNITY</p>
            <div className="mt-1 flex justify-center gap-1.5">
              {gameData.communityCards.map((card, index) => (
                <CardTile key={index} value={card} compact />
              ))}
            </div>
          </div>

          {(myPlayer || opponent) && (
            <div className="border-cdm-border grid w-full grid-cols-2 gap-3 border-t pt-2">
              {[myPlayer, opponent].map(
                (player, playerIndex) =>
                  player && (
                    <div key={player.id} className="text-center">
                      <p className="text-cdm-fg-muted mb-0.5 text-[10px] font-bold">
                        {playerIndex === 0 && isPlayer ? '내 개인 카드' : `${player.nickname} 개인 카드`}
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

      <ResultOverlay gameData={gameData} myId={myId} />
    </GameFrame>
  );
}
