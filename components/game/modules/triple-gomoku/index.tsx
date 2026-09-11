'use client';

import { useEffect, useMemo, useState } from 'react';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { cn } from '@/lib/utils';
import {
  canMoveTripleGomokuStone,
  canPlaceTripleGomokuSetup,
  canPlaceTripleGomokuStone,
  isSameTripleGomokuCell,
  tripleGomokuCellKey,
  tripleGomokuMoveTargets,
  tripleGomokuTopOwner,
} from '@/shared/logic/triple-gomoku';
import {
  TG_MAX_HEIGHT,
  type TripleGomokuCell,
  type TripleGomokuGameData,
} from '@/shared/types/triple-gomoku';
import { useRoomStore } from '@/stores/room';
import { TripleGomokuBoardView, type TripleGomokuCellMark } from './BoardView';
import { GameFrame, fitBoardWidth } from '@/components/game/GameFrame';
import Modal from '@/components/ui/Modal';
import { TG_BOARD_ASPECT } from '@/shared/logic/triple-gomoku';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GamePiece3D, PlayerStrip, usePlacementConfirm } from '@/components/game/abstract-strategy';

type ActionMode = 'place' | 'move';

const WIN_HINT: Record<string, string> = {
  line: '오목 완성',
  'top-count': '3층 돌 다섯 개',
  'top-cluster': '붙어 있는 3층 돌 세 개',
  timeout: '제한시간 초과',
  'no-action': '둘 수 없음',
  forfeit: '기권',
};

export default function TripleGomokuGame() {
  const gameState = useRoomStore((state) => state.gameState);
  const gameData = gameState?.gameData as TripleGomokuGameData | undefined;
  useAbstractStrategyMoveSfx(gameData?.board);
  const myId = useMySocketId();
  const [tilted, setTilted] = useState(true);

  if (!gameData) {
    return (
      <div className="text-cdm-fg-muted flex h-full items-center justify-center">
        게임을 불러오는 중...
      </div>
    );
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn = isPlayer && gameData.currentPlayerId === myId && gameData.phase !== 'finished';

  return (
    <PlaySurface
      key={`${gameData.turnNumber}:${gameData.phase}:${myId}`}
      gameData={gameData}
      myId={myId}
      isPlayer={isPlayer}
      isMyTurn={isMyTurn}
      tilted={tilted}
      onToggleTilt={() => setTilted((value) => !value)}
    />
  );
}

function PlaySurface({
  gameData,
  myId,
  isPlayer,
  isMyTurn,
  tilted,
  onToggleTilt,
}: {
  gameData: TripleGomokuGameData;
  myId: string;
  isPlayer: boolean;
  isMyTurn: boolean;
  tilted: boolean;
  onToggleTilt: () => void;
}) {
  const canPlay = isMyTurn;
  const [showHelp, setShowHelp] = useState(false);
  const [mode, setMode] = useState<ActionMode>('place');
  const [source, setSource] = useState<TripleGomokuCell | null>(null);
  /*
    어떤 판 상태에서 행동을 보냈는지 기억한다. 서버가 받아 주면 아래
    acceptedSignature 가 바뀌면서 잠금이 저절로 풀린다.
  */
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const { setHud } = useRoomLayout();
  const setup = gameData.phase === 'setup';
  const reserve = gameData.reserves[myId] ?? 0;
  const sidePanel = <TripleGomokuSidePanel gameData={gameData} myId={myId} />;

  useEffect(() => {
    setHud({
      round: `${gameData.turnNumber}턴`,
      order: gameData.phase === 'setup'
        ? '기본 배치'
        : gameData.phase === 'finished'
          ? '종료'
          : isMyTurn ? '내 차례' : '상대 차례',
      // 판 정보는 메모가 아니라 판 위(info)에 늘 펴 둔다 — design.md §14.9
    });
    return () => setHud(null);
  }, [gameData, isMyTurn, myId, setHud]);

  /*
    서버가 행동을 받아 줄 때마다 바뀌는 값. 기본 배치에서 한 턴에 두 개를 놓는
    차례(선-후후-선)에는 첫 돌을 놓아도 턴 번호가 그대로라, 턴 번호만 보면
    잠금이 풀리지 않아 두 번째 돌을 놓을 수 없었다.
  */
  const acceptedSignature = `${gameData.turnNumber}:${gameData.setupRemaining}:${
    gameData.lastAction ? JSON.stringify(gameData.lastAction.action) : ''
  }`;
  const pending = pendingSignature === acceptedSignature;
  const active = canPlay && !pending;
  /* 터치에서는 첫 탭에 반투명 돌로 자리만 보여 주고, 같은 칸을 한 번 더 눌러야 둔다. */
  const placement = usePlacementConfirm(`${acceptedSignature}:${mode}`);

  /* 서버가 거부하면 판이 그대로라 잠금이 안 풀리므로 error 신호로 직접 푼다. */
  useEffect(() => {
    const socket = getSocket();
    const release = () => setPendingSignature(null);
    socket.on('error', release);
    return () => {
      socket.off('error', release);
    };
  }, []);

  const targets = useMemo(
    () => (source ? tripleGomokuMoveTargets(gameData.board, source, myId) : []),
    [gameData.board, myId, source],
  );
  const targetKeys = useMemo(() => new Set(targets.map(tripleGomokuCellKey)), [targets]);
  const winKeys = useMemo(
    () => new Set(gameData.winCells.map(tripleGomokuCellKey)),
    [gameData.winCells],
  );
  const lastKeys = useMemo(() => {
    const action = gameData.lastAction?.action;
    if (!action) return new Set<string>();
    return new Set(
      action.type === 'place'
        ? [tripleGomokuCellKey(action.to)]
        : [tripleGomokuCellKey(action.from), tripleGomokuCellKey(action.to)],
    );
  }, [gameData.lastAction]);

  function canPlaceHere(cell: TripleGomokuCell) {
    if (reserve <= 0) return false;
    return setup
      ? canPlaceTripleGomokuSetup(gameData.board, cell, myId)
      : canPlaceTripleGomokuStone(gameData.board, cell);
  }

  function isEnabled(cell: TripleGomokuCell) {
    if (!active) return false;
    if (setup || mode === 'place') return canPlaceHere(cell);
    if (source && targetKeys.has(tripleGomokuCellKey(cell))) return true;
    return tripleGomokuTopOwner(gameData.board, cell) === myId;
  }

  function markOf(cell: TripleGomokuCell): TripleGomokuCellMark {
    const key = tripleGomokuCellKey(cell);
    if (winKeys.has(key)) return 'win';
    if (source && isSameTripleGomokuCell(source, cell)) return 'selected';
    if (targetKeys.has(key)) return 'target';
    if (lastKeys.has(key)) return 'last';
    return 'none';
  }

  function handleClick(cell: TripleGomokuCell) {
    if (!active) return;
    if (setup || mode === 'place') {
      if (!canPlaceHere(cell)) return;
      placement.tap(tripleGomokuCellKey(cell), () => {
        setPendingSignature(acceptedSignature);
        getSocket().emit('game:action', { type: 'place', to: cell });
      });
      return;
    }
    if (source && canMoveTripleGomokuStone(gameData.board, source, cell, myId)) {
      setPendingSignature(acceptedSignature);
      getSocket().emit('game:action', { type: 'move', from: source, to: cell });
      return;
    }
    if (tripleGomokuTopOwner(gameData.board, cell) === myId) setSource(cell);
  }

  const sourceHeight = source ? (gameData.board[tripleGomokuCellKey(source)]?.length ?? 0) : 0;
  const currentName = gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어';
  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;
  const finished = gameData.phase === 'finished';

  return (
    <>
      <GameFrame
        info={
          <PlayerStrip
            entries={Object.entries(gameData.players).map(([playerId, player]) => ({
              id: playerId,
              name: player.nickname,
              isMe: playerId === myId,
              marker: (
                <span className="block h-3.5 w-3.5">
                  <GamePiece3D tone={playerId === gameData.firstPlayerId ? 'primary' : 'highlight'} />
                </span>
              ),
              detail: `돌 ${gameData.reserves[playerId] ?? 0}`,
              active: gameData.currentPlayerId === playerId && !finished,
            }))}
          />
        }
        controls={
          <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2">
            <div className="grid grid-cols-[1fr_1fr_auto_auto] gap-1.5">
              <ModeButton
                active={!setup && mode === 'place'}
                disabled={setup || !active || reserve <= 0}
                onClick={() => {
                  setMode('place');
                  setSource(null);
                }}
                label={`돌 놓기 ${reserve}`}
              />
              <ModeButton
                active={!setup && mode === 'move'}
                disabled={setup || !active}
                onClick={() => setMode('move')}
                label="돌 옮기기"
              />
              <button
                type="button"
                onClick={onToggleTilt}
                aria-pressed={tilted}
                className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg rounded-cdm-md min-h-11 border px-2 text-[11px] font-black"
              >
                {tilted ? '평면' : '입체'}
              </button>
              <button
                type="button"
                onClick={() => setShowHelp(true)}
                aria-label="승리 조건 보기"
                className="rounded-cdm-md border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted min-h-11 w-10 border text-sm font-black lg:hidden"
              >
                ?
              </button>
            </div>
            <p className="text-cdm-fg-muted mt-1.5 flex min-h-6 items-center justify-center text-center text-[11px]">
              {placement.armed && active && (setup || mode === 'place')
                ? '같은 자리를 한 번 더 누르면 놓습니다. 다른 곳을 누르면 자리만 옮깁니다.'
                : setup
                ? `기본 배치 · 이번 턴에 ${gameData.setupRemaining}개. 정중앙과 자기 돌 옆은 안 됩니다.`
                : !isPlayer
                  ? '관전 중입니다.'
                  : !isMyTurn
                    ? `${currentName} 님의 차례입니다.`
                    : mode === 'place'
                      ? '빈칸 아무 곳에나 새 돌을 놓습니다.'
                      : source
                        ? `${sourceHeight}층 칸 선택됨 · 갈 수 있는 곳 ${targets.length}곳 (다시 누르면 해제)`
                        : '옮길 내 돌을 고르세요. 맨 위 돌만 움직입니다.'}
            </p>
          </div>
        }
        aside={sidePanel}
      >
        <TripleGomokuBoardView
          board={gameData.board}
          firstPlayerId={gameData.firstPlayerId}
          tilted={tilted}
          markOf={markOf}
          onCellClick={handleClick}
          isEnabled={isEnabled}
          previewOwnerId={active ? myId : null}
          armedKey={setup || mode === 'place' ? placement.armed : null}
          ariaLabel="삼층 오목 판"
          maxWidth={fitBoardWidth(TG_BOARD_ASPECT, 1, '38rem', '1rem')}
          className="border-cdm-border bg-cdm-bg rounded-cdm-lg border p-2 sm:p-3"
        />

        {finished && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-4">
            <div className="border-cdm-primary bg-cdm-bg/95 rounded-cdm-lg max-w-xs border px-5 py-4 text-center shadow-(--cdm-shadow-lg) backdrop-blur">
              <p className="text-cdm-primary text-base font-black">
                {winnerName ? `${winnerName} 승리!` : '게임 종료'}
              </p>
              {gameData.winType && (
                <p className="text-cdm-fg-muted mt-0.5 text-[11px] font-bold">
                  {WIN_HINT[gameData.winType] ?? ''}
                </p>
              )}
              <p className="text-cdm-fg-muted mt-1 text-xs">{gameData.finishReason}</p>
            </div>
          </div>
        )}
      </GameFrame>

      <Modal open={showHelp} onClose={() => setShowHelp(false)} title="승리 조건">
        <WinReference />
      </Modal>
    </>
  );
}

function TripleGomokuSidePanel({ gameData, myId }: { gameData: TripleGomokuGameData; myId: string }) {
  return (
    <GameInfoStack>
      <GameInfoPart title="플레이어">
        <div className="space-y-1.5">
          {Object.entries(gameData.players).map(([playerId, player]) => (
            <div
              key={playerId}
              className={cn(
                'flex items-center justify-between rounded-md px-2.5 py-2 text-sm',
                gameData.currentPlayerId === playerId && gameData.phase !== 'finished'
                  ? 'bg-cdm-primary/20 text-white'
                  : 'bg-white/5 text-cdm-ink-fg',
              )}
            >
              <span className="truncate font-semibold">{player.nickname}{playerId === myId ? ' (나)' : ''}</span>
              <span className="font-black tabular-nums">돌 {gameData.reserves[playerId] ?? 0}</span>
            </div>
          ))}
        </div>
      </GameInfoPart>
      <GameInfoPart><WinReference /></GameInfoPart>
    </GameInfoStack>
  );
}

function WinReference() {
  return (
    <div className="border-cdm-border bg-cdm-bg rounded-cdm-lg text-cdm-fg-muted h-full border p-3 text-[11px] leading-5">
      <p className="text-cdm-fg text-sm font-black">승리 조건</p>
      <p className="mt-2">· 위에서 봐서 내 돌 5개가 일직선 (6개는 인정 안 됨)</p>
      <p>· 3층에 올라간 내 돌 5개</p>
      <p>· 서로 붙어 있는 3층 돌 3개</p>
      <p className="mt-3">
        돌은 {TG_MAX_HEIGHT}층까지 쌓이고, 원래 칸보다 높은 칸으로는 갈 수 없습니다.
      </p>
      <p className="mt-1">돌 옮기기는 내 돌이 맨 위인 칸에서만 됩니다.</p>
    </div>
  );
}

function ModeButton({
  active,
  disabled,
  onClick,
  label,
}: {
  active: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'rounded-cdm-md border-cdm-border min-h-11 border px-2 text-[11px] font-black transition-colors disabled:opacity-35',
        active
          ? 'border-cdm-primary bg-cdm-primary-soft text-cdm-primary'
          : 'bg-cdm-bg-elev-1 text-cdm-fg',
      )}
    >
      {label}
    </button>
  );
}
