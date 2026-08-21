'use client';

import { useEffect, useMemo, useState } from 'react';
import { AI_PLAYER_ID } from '@/shared/types/room';
import type {
  CompleteHapActionRecord,
  CompleteHapBoard,
  CompleteHapCard,
  CompleteHapGameData,
} from '@/shared/types/complete-hap';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { cn } from '@/lib/utils';

const BACKGROUND_COLORS = {
  black: '#111318',
  gray: '#7a808a',
  white: '#f7f7f3',
} as const;

const SHAPE_COLORS = {
  red: '#ef4444',
  yellow: '#facc15',
  blue: '#2563eb',
} as const;

function formatClock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function actionLabel(
  record: CompleteHapActionRecord | null,
  players: CompleteHapGameData['players'],
) {
  if (!record) return '아직 외친 답이 없습니다.';
  const nickname =
    players[record.playerId]?.nickname ?? (record.playerId === AI_PLAYER_ID ? 'COM' : '플레이어');
  const board = record.boardIndex == null ? '' : ` · ${record.boardIndex + 1}번 문제`;
  const cards = record.cardIndexes?.length
    ? ` (${record.cardIndexes.map((index) => index + 1).join('·')})`
    : '';
  const labels: Record<CompleteHapActionRecord['kind'], string> = {
    hap: `합 정답 +1${cards}`,
    gyul: '결 정답 +3',
    'wrong-hap': `합 오답 -1${cards}`,
    'wrong-gyul': '결 오답 -1',
    'duplicate-hap': `이미 나온 합 -1${cards}`,
    'call-timeout': '번호 호명 시간 초과 -1',
    'turn-timeout': '차례 넘김',
  };
  return `${nickname}${board} · ${labels[record.kind]}`;
}

export default function CompleteHapGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as CompleteHapGameData | undefined;
  const myId = useMySocketId();
  const [now, setNow] = useState(gameData?.matchStartedAt ?? 0);
  const [selection, setSelection] = useState<{ key: string; indexes: number[] }>({
    key: '',
    indexes: [],
  });

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(interval);
  }, []);

  const selectionKey = `${gameData?.turn ?? 0}:${gameData?.phase ?? ''}:${gameData?.selectedBoardIndex ?? ''}`;
  const picked = selection.key === selectionKey ? selection.indexes : [];

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-cdm-fg-muted">게임을 불러오는 중...</p>
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId;
  const matchRemaining = Math.max(
    0,
    Math.ceil((gameData.matchStartedAt + gameData.matchSeconds * 1000 - now) / 1000),
  );
  const phaseLimit = gameData.phase === 'selecting' ? gameData.callSeconds : gameData.turnSeconds;
  const phaseRemaining =
    gameData.phase === 'finished'
      ? 0
      : Math.max(0, Math.ceil((gameData.phaseStartedAt + phaseLimit * 1000 - now) / 1000));

  const currentName =
    gameData.players[gameData.currentPlayerId]?.nickname ??
    (gameData.currentPlayerId === AI_PLAYER_ID ? 'COM' : '플레이어');
  const entries = Object.entries(gameData.players);

  function callHap(boardIndex: number) {
    if (!isMyTurn || gameData!.phase !== 'turn') return;
    getSocket().emit('game:action', { type: 'call-hap', boardIndex });
  }

  function callGyul(boardIndex: number) {
    if (!isMyTurn || gameData!.phase !== 'turn') return;
    getSocket().emit('game:action', { type: 'call-gyul', boardIndex });
  }

  function toggleCard(boardIndex: number, cardIndex: number) {
    if (!isMyTurn || gameData!.phase !== 'selecting' || gameData!.selectedBoardIndex !== boardIndex)
      return;
    setSelection((current) => {
      const indexes = current.key === selectionKey ? current.indexes : [];
      if (indexes.includes(cardIndex)) {
        return { key: selectionKey, indexes: indexes.filter((index) => index !== cardIndex) };
      }
      if (indexes.length >= 3) return { key: selectionKey, indexes };
      return { key: selectionKey, indexes: [...indexes, cardIndex] };
    });
  }

  function submitHap() {
    if (
      !isMyTurn ||
      gameData!.phase !== 'selecting' ||
      gameData!.selectedBoardIndex == null ||
      picked.length !== 3
    )
      return;
    getSocket().emit('game:action', {
      type: 'submit-hap',
      boardIndex: gameData!.selectedBoardIndex,
      cardIndexes: picked,
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-3 p-3 sm:gap-4 sm:p-4">
      <header className="rounded-cdm-lg border-cdm-border bg-cdm-bg grid gap-3 border p-3 shadow-sm md:grid-cols-[1fr_auto_1fr] md:items-center">
        <div className="flex min-w-0 items-center gap-3">
          <div className="bg-cdm-primary flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-black text-white">
            {gameData.turn}
          </div>
          <div className="min-w-0">
            <p className="text-cdm-fg truncate text-sm font-extrabold">
              {gameData.phase === 'finished'
                ? '게임 종료'
                : gameData.phase === 'selecting'
                  ? `${currentName} 님이 합을 호명 중`
                  : `${currentName} 님의 차례`}
            </p>
            <p className="text-cdm-fg-muted truncate text-xs">
              {actionLabel(gameData.lastAction, gameData.players)}
            </p>
          </div>
        </div>

        <div className="flex items-center justify-center gap-2">
          <div className="rounded-cdm-md bg-cdm-bg-elev-1 px-3 py-2 text-center">
            <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-[0.16em]">MATCH</p>
            <p
              className={cn(
                'text-xl font-black tabular-nums',
                matchRemaining <= 30 ? 'text-cdm-accent' : 'text-cdm-fg',
              )}
            >
              {formatClock(matchRemaining)}
            </p>
          </div>
          {gameData.phase !== 'finished' && (
            <div
              className={cn(
                'rounded-cdm-md min-w-20 px-3 py-2 text-center',
                phaseRemaining <= 3 ? 'bg-cdm-accent-soft' : 'bg-cdm-primary-soft',
              )}
            >
              <p className="text-cdm-fg-subtle text-[9px] font-bold tracking-[0.16em]">
                {gameData.phase === 'selecting' ? 'CALL' : 'TURN'}
              </p>
              <p
                className={cn(
                  'text-xl font-black tabular-nums',
                  phaseRemaining <= 3 ? 'text-cdm-accent' : 'text-cdm-primary',
                )}
              >
                {phaseRemaining}s
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2">
          {entries.map(([playerId, player]) => (
            <div
              key={playerId}
              className={cn(
                'rounded-cdm-md min-w-24 border px-3 py-2',
                playerId === gameData.currentPlayerId && gameData.phase !== 'finished'
                  ? 'border-cdm-primary bg-cdm-primary-soft'
                  : 'border-cdm-border bg-cdm-bg-elev-1',
              )}
            >
              <p className="text-cdm-fg-muted max-w-28 truncate text-[11px] font-semibold">
                {player.nickname}
                {playerId === myId ? ' (나)' : ''}
              </p>
              <p className="text-cdm-fg text-right text-xl font-black tabular-nums">
                {gameData.scores[playerId] ?? 0}
              </p>
            </div>
          ))}
        </div>
      </header>

      <div className="grid gap-3 lg:grid-cols-3">
        {gameData.boards.map((board, boardIndex) => (
          <BoardPanel
            key={boardIndex}
            board={board}
            boardIndex={boardIndex}
            active={gameData.phase === 'selecting' && gameData.selectedBoardIndex === boardIndex}
            selectable={
              isMyTurn &&
              gameData.phase === 'selecting' &&
              gameData.selectedBoardIndex === boardIndex
            }
            canAct={isMyTurn && gameData.phase === 'turn' && !board.completed}
            picked={gameData.selectedBoardIndex === boardIndex ? picked : []}
            onToggle={(cardIndex) => toggleCard(boardIndex, cardIndex)}
            onCallHap={() => callHap(boardIndex)}
            onCallGyul={() => callGyul(boardIndex)}
          />
        ))}
      </div>

      {gameData.phase === 'selecting' && isMyTurn && (
        <div className="rounded-cdm-lg border-cdm-primary bg-cdm-bg sticky bottom-3 z-10 mx-auto flex w-full max-w-xl items-center gap-3 border p-3 shadow-xl">
          <div className="min-w-0 flex-1">
            <p className="text-cdm-primary text-xs font-bold">합! 카드 번호 3개를 호명하세요</p>
            <p className="text-cdm-fg mt-0.5 text-sm font-extrabold">
              {picked.length ? picked.map((index) => index + 1).join(' · ') : '카드를 선택하세요'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setSelection({ key: selectionKey, indexes: [] })}
            disabled={picked.length === 0}
            className="rounded-cdm-md border-cdm-border text-cdm-fg border px-3 py-2 text-sm font-semibold disabled:opacity-40"
          >
            취소
          </button>
          <button
            type="button"
            onClick={submitHap}
            disabled={picked.length !== 3}
            className="rounded-cdm-md bg-cdm-primary px-4 py-2 text-sm font-black text-white disabled:opacity-40"
          >
            번호 호명
          </button>
        </div>
      )}

      {!isPlayer && gameData.phase !== 'finished' && (
        <p className="text-cdm-fg-muted text-center text-xs">관전 중입니다.</p>
      )}
      {isPlayer && !isMyTurn && gameData.phase !== 'finished' && (
        <p className="text-cdm-fg-muted text-center text-xs">
          {gameData.currentPlayerId === AI_PLAYER_ID
            ? 'COM이 보드를 살펴보고 있습니다.'
            : '상대 차례입니다.'}
        </p>
      )}
      {gameData.phase === 'finished' && (
        <div className="rounded-cdm-lg bg-cdm-primary-soft p-4 text-center">
          <p className="text-cdm-primary text-sm font-extrabold">{gameData.finishReason}</p>
          <p className="text-cdm-fg-muted mt-1 text-xs">최종 결과를 집계하고 있습니다...</p>
        </div>
      )}
    </div>
  );
}

function BoardPanel({
  board,
  boardIndex,
  active,
  selectable,
  canAct,
  picked,
  onToggle,
  onCallHap,
  onCallGyul,
}: {
  board: CompleteHapBoard;
  boardIndex: number;
  active: boolean;
  selectable: boolean;
  canAct: boolean;
  picked: number[];
  onToggle: (cardIndex: number) => void;
  onCallHap: () => void;
  onCallGyul: () => void;
}) {
  const claimedText = useMemo(
    () => board.claimedSets.map((set) => set.map((index) => index + 1).join('·')).join(' / '),
    [board.claimedSets],
  );

  return (
    <section
      className={cn(
        'rounded-cdm-lg bg-cdm-bg relative border-2 p-3 transition-colors',
        active ? 'border-cdm-primary shadow-lg' : 'border-cdm-border',
        board.completed && 'opacity-70',
      )}
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="text-cdm-fg-subtle text-[10px] font-bold tracking-[0.18em]">PROBLEM</p>
          <h2 className="text-cdm-fg text-lg font-black">{boardIndex + 1}번 문제</h2>
        </div>
        <span
          className={cn(
            'rounded-full px-2.5 py-1 text-[11px] font-bold',
            board.completed
              ? 'bg-cdm-success-soft text-cdm-success'
              : 'bg-cdm-bg-elev-1 text-cdm-fg-muted',
          )}
        >
          {board.completed ? '결 완료' : `찾은 합 ${board.claimedSets.length}`}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-1.5 sm:gap-2">
        {board.cards.map((card, cardIndex) => (
          <PictureCard
            key={cardIndex}
            card={card}
            number={cardIndex + 1}
            selected={picked.includes(cardIndex)}
            selectable={selectable}
            disabled={board.completed}
            onClick={() => onToggle(cardIndex)}
          />
        ))}
      </div>

      <div className="rounded-cdm-md bg-cdm-bg-elev-1 text-cdm-fg-muted mt-3 min-h-8 px-2.5 py-2 text-[11px]">
        <span className="text-cdm-fg-subtle font-bold">기존 정답</span> {claimedText || '아직 없음'}
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={onCallHap}
          disabled={!canAct}
          className="rounded-cdm-md bg-cdm-primary px-3 py-2.5 text-sm font-black text-white transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
        >
          합! <span className="text-xs font-semibold opacity-80">+1</span>
        </button>
        <button
          type="button"
          onClick={onCallGyul}
          disabled={!canAct}
          className="rounded-cdm-md border-cdm-accent bg-cdm-accent-soft text-cdm-accent border-2 px-3 py-2 text-sm font-black transition-transform enabled:hover:-translate-y-0.5 disabled:opacity-40"
        >
          결! <span className="text-xs font-semibold opacity-80">+3</span>
        </button>
      </div>

      {board.completed && (
        <div className="rounded-cdm-lg bg-cdm-bg/50 pointer-events-none absolute inset-0 flex items-center justify-center backdrop-blur-[1px]">
          <span className="rounded-cdm-md border-cdm-success text-cdm-success rotate-[-8deg] border-4 px-5 py-2 text-2xl font-black">
            결 완료
          </span>
        </div>
      )}
    </section>
  );
}

function PictureCard({
  card,
  number,
  selected,
  selectable,
  disabled,
  onClick,
}: {
  card: CompleteHapCard;
  number: number;
  selected: boolean;
  selectable: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const background = BACKGROUND_COLORS[card.background];
  const fill = SHAPE_COLORS[card.color];
  const labelColor = card.background === 'white' ? '#111318' : '#ffffff';
  const stroke =
    card.color === 'yellow' && card.background === 'white' ? '#a16207' : 'rgba(0,0,0,.28)';

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!selectable || disabled}
      aria-label={`${number}번 카드`}
      aria-pressed={selected}
      className={cn(
        'rounded-cdm-md relative aspect-[4/3] overflow-hidden border-2 transition-all',
        selected
          ? 'border-cdm-primary ring-cdm-primary/30 z-[1] scale-[1.04] ring-2'
          : 'border-cdm-border-strong',
        selectable && !selected && 'hover:border-cdm-primary cursor-pointer hover:-translate-y-0.5',
        !selectable && 'cursor-default',
      )}
    >
      <svg viewBox="0 0 100 75" className="h-full w-full" aria-hidden="true">
        <rect width="100" height="75" fill={background} />
        {card.shape === 'circle' && (
          <circle cx="50" cy="38" r="22" fill={fill} stroke={stroke} strokeWidth="2" />
        )}
        {card.shape === 'triangle' && (
          <polygon
            points="50,12 77,61 23,61"
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
            strokeLinejoin="round"
          />
        )}
        {card.shape === 'square' && (
          <rect
            x="27"
            y="15"
            width="46"
            height="46"
            rx="2"
            fill={fill}
            stroke={stroke}
            strokeWidth="2"
          />
        )}
        <circle
          cx="12"
          cy="12"
          r="8"
          fill={card.background === 'white' ? 'rgba(255,255,255,.88)' : 'rgba(0,0,0,.48)'}
        />
        <text x="12" y="15.5" textAnchor="middle" fontSize="10" fontWeight="800" fill={labelColor}>
          {number}
        </text>
      </svg>
      {selected && (
        <span className="bg-cdm-primary absolute top-1 right-1 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-black text-white">
          {number}
        </span>
      )}
    </button>
  );
}
