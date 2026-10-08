'use client';
import { memo } from 'react';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameFeedback } from '@/components/game/GameFeedbackContext';
import { useGameAction } from '@/components/game/GameActionContext';

import type { GameModuleViewProps } from '@/hooks/useGameModuleConnection';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useMemo, useState } from 'react';
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
import type { TripleGomokuCell, TripleGomokuGameData } from '@/shared/types/triple-gomoku';
import { TripleGomokuBoardView, type TripleGomokuCellMark } from './BoardView';
import { fitBoardWidth } from '@/components/game/GameFrame';
import { TG_BOARD_ASPECT } from '@/shared/logic/triple-gomoku';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { GamePiece3D, usePlacementConfirm } from '@/components/game/abstract-strategy';

const WIN_HINT: Record<string, string> = {
  line: '오목 완성',
  'top-count': '3층 돌 다섯 개',
  'top-cluster': '붙어 있는 3층 돌 세 개',
  timeout: '제한시간 초과',
  'no-action': '둘 수 없음',
  forfeit: '기권',
};

function TripleGomokuView({
  gameData,
  myId,
  isSolo = false,
}: GameModuleViewProps<TripleGomokuGameData> & { isSolo?: boolean }) {
  useAbstractStrategyMoveSfx(gameData?.board);
  /*
    훅은 조기 return 위에 둬야 한다. 아래에 두면 gameData 가 없던 첫 렌더와
    도착한 다음 렌더의 훅 개수가 달라져 React 가 렌더를 통째로 실패시킨다
    (화면에는 '일시적인 오류' 가 떴다). 솔로는 판이 곧바로 시작돼 화면이
    상태보다 먼저 뜨는 일이 잦아 거기서 먼저 드러났다.
  */

  if (!gameData) {
    return <GameLoading label="게임을 불러오는 중" />;
  }

  const isPlayer = Boolean(gameData.players[myId]);
  const isMyTurn =
    isPlayer && (isSolo || gameData.currentPlayerId === myId) && gameData.phase !== 'finished';

  return (
    <PlaySurface
      key={`${gameData.turnNumber}:${gameData.phase}:${myId}:${isSolo ? gameData.currentPlayerId : ''}`}
      gameData={gameData}
      myId={myId}
      isPlayer={isPlayer}
      isMyTurn={isMyTurn}
      isSolo={isSolo}
    />
  );
}

function PlaySurface({
  gameData,
  myId,
  isPlayer,
  isMyTurn,
  isSolo,
}: {
  gameData: TripleGomokuGameData;
  myId: string;
  isPlayer: boolean;
  isMyTurn: boolean;
  isSolo: boolean;
}) {
  const sendAction = useGameAction();
  const { subscribeError } = useGameFeedback();
  const canPlay = isMyTurn;
  const seatId = isSolo ? gameData.currentPlayerId : myId;
  /* 옮기려고 고른 내 돌. 없으면 빈칸을 눌러 새 돌을 놓는다. */
  const [source, setSource] = useState<TripleGomokuCell | null>(null);
  /*
    어떤 판 상태에서 행동을 보냈는지 기억한다. 서버가 받아 주면 아래
    acceptedSignature 가 바뀌면서 잠금이 저절로 풀린다.
  */
  const [pendingSignature, setPendingSignature] = useState<string | null>(null);
  const { setHud } = useRoomLayout();
  const setup = gameData.phase === 'setup';
  const reserve = gameData.reserves[seatId] ?? 0;
  const sidePanel = <TripleGomokuSidePanel gameData={gameData} myId={myId} />;

  useEffect(() => {
    setHud({
      round: `${gameData.turnNumber}턴`,
      order:
        gameData.phase === 'setup'
          ? `${isMyTurn ? '(내 차례)' : '(상대 차례)'} 기본 배치`
          : gameData.phase === 'finished'
            ? '종료'
            : isMyTurn
              ? '(내 차례)'
              : '(상대 차례)',
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
  /*
    터치에서는 첫 탭에 반투명 돌로 자리만 보여 주고, 같은 칸을 한 번 더 눌러야
    둔다·옮긴다. 옮길 돌을 고르거나 풀면 보여 주던 자리를 직접 버린다(clear) —
    고른 돌을 resetKey 에 넣으면 '고른 돌 풀기 + 빈칸 자리 보여 주기' 를 한 번에
    할 때 방금 보여 준 자리까지 사라진다.
  */
  const placement = usePlacementConfirm(acceptedSignature);

  /* 서버가 거부하면 판이 그대로라 잠금이 안 풀리므로 error 신호로 직접 푼다. */
  useEffect(() => {
    const release = () => setPendingSignature(null);
    return subscribeError(release);
  }, [subscribeError]);

  const targets = useMemo(
    () => (source ? tripleGomokuMoveTargets(gameData.board, source, seatId) : []),
    [gameData.board, seatId, source],
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
      ? canPlaceTripleGomokuSetup(gameData.board, cell, seatId)
      : canPlaceTripleGomokuStone(gameData.board, cell);
  }

  /** 본 게임에서 맨 위가 내 돌인 칸 — 누르면 옮길 돌로 고른다. */
  function isMyStack(cell: TripleGomokuCell) {
    return !setup && tripleGomokuTopOwner(gameData.board, cell) === seatId;
  }

  function isEnabled(cell: TripleGomokuCell) {
    if (!active) return false;
    if (source && targetKeys.has(tripleGomokuCellKey(cell))) return true;
    return isMyStack(cell) || canPlaceHere(cell);
  }

  function markOf(cell: TripleGomokuCell): TripleGomokuCellMark {
    const key = tripleGomokuCellKey(cell);
    if (winKeys.has(key)) return 'win';
    if (source && isSameTripleGomokuCell(source, cell)) return 'selected';
    if (targetKeys.has(key)) return 'target';
    if (lastKeys.has(key)) return 'last';
    return 'none';
  }

  /*
    돌 놓기·옮기기를 버튼으로 나누지 않는다.
    · 고른 돌이 갈 수 있는 칸 → 옮기기
    · 내 돌(맨 위) → 옮길 돌로 고르기, 같은 돌을 다시 누르면 풀기
    · 빈칸 → 새 돌 놓기 (고른 돌이 있었으면 풀고 놓기)
  */
  function handleClick(cell: TripleGomokuCell) {
    if (!active) return;
    const key = tripleGomokuCellKey(cell);
    if (source && canMoveTripleGomokuStone(gameData.board, source, cell, seatId)) {
      const from = source;
      placement.tap(key, () => {
        setPendingSignature(acceptedSignature);
        sendAction({ type: 'move', from, to: cell });
      });
      return;
    }
    if (isMyStack(cell)) {
      placement.clear();
      setSource(source && isSameTripleGomokuCell(source, cell) ? null : cell);
      return;
    }
    if (!canPlaceHere(cell)) return;
    if (source) setSource(null);
    placement.tap(key, () => {
      setPendingSignature(acceptedSignature);
      sendAction({ type: 'place', to: cell });
    });
  }

  const sourceHeight = source ? (gameData.board[tripleGomokuCellKey(source)]?.length ?? 0) : 0;
  const armedIsMove = Boolean(placement.armed && targetKeys.has(placement.armed));
  const currentName = gameData.players[gameData.currentPlayerId]?.nickname ?? '플레이어';
  const winnerName = gameData.winnerId ? gameData.players[gameData.winnerId]?.nickname : null;
  const finished = gameData.phase === 'finished';

  return (
    <>
      <GameReferenceFrame
        controls={
          <p className="border-cdm-border bg-cdm-bg rounded-cdm-lg text-cdm-fg-muted flex min-h-11 items-center justify-center border px-3 py-2 text-center text-[11px]">
            {placement.armed && active
              ? armedIsMove
                ? '같은 자리를 한 번 더 누르면 옮깁니다. 다른 목적지를 누르면 미리보기만 바뀝니다.'
                : '같은 자리를 한 번 더 누르면 놓습니다. 다른 곳을 누르면 자리만 옮깁니다.'
              : setup
                ? `기본 배치 · 이번 턴에 ${gameData.setupRemaining}개. 정중앙과 자기 돌 옆은 안 됩니다.`
                : !isPlayer
                  ? '관전 중입니다.'
                  : !isMyTurn
                    ? `${currentName} 님의 차례입니다.`
                    : source
                      ? `${sourceHeight}층 내 돌을 골랐습니다 · 초록 칸 ${targets.length}곳으로 옮길 수 있습니다. 같은 돌을 다시 누르면 풀립니다.`
                      : reserve > 0
                        ? '빈칸을 누르면 돌을 놓고, 내 돌을 누르면 옮길 곳을 고릅니다.'
                        : '남은 돌이 없습니다. 내 돌을 눌러 옮겨야 합니다.'}
          </p>
        }
        reference={sidePanel}
      >
        <TripleGomokuBoardView
          board={gameData.board}
          firstPlayerId={gameData.firstPlayerId}
          markOf={markOf}
          onCellClick={handleClick}
          isEnabled={isEnabled}
          previewOwnerId={active ? seatId : null}
          armedKey={placement.armed}
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
      </GameReferenceFrame>
    </>
  );
}

function TripleGomokuSidePanel({
  gameData,
  myId,
}: {
  gameData: TripleGomokuGameData;
  myId: string;
}) {
  return (
    <GameInfoStack>
      <GameInfoPart title="플레이어" kind="score" sizeToContent>
        <div className="grid grid-cols-2 gap-2">
          {Object.entries(gameData.players)
            .sort(([a], [b]) => Number(b === myId) - Number(a === myId))
            .map(([playerId, player]) => (
              <div
                key={playerId}
                className={cn(
                  'flex flex-wrap items-center justify-between gap-2 rounded-md px-2.5 py-2 text-sm',
                  gameData.currentPlayerId === playerId && gameData.phase !== 'finished'
                    ? 'bg-cdm-primary-soft text-cdm-primary'
                    : 'text-cdm-fg bg-cdm-bg-elev-1',
                )}
              >
                <span className="flex min-w-0 items-center gap-2 font-semibold">
                  <span className="block h-3.5 w-3.5 shrink-0">
                    <GamePiece3D
                      tone={playerId === gameData.firstPlayerId ? 'primary' : 'highlight'}
                    />
                  </span>
                  {player.nickname}
                  {playerId === myId ? ' (나)' : ''}
                </span>
                <span className="font-black tabular-nums">
                  돌 {gameData.reserves[playerId] ?? 0}
                </span>
              </div>
            ))}
        </div>
      </GameInfoPart>
    </GameInfoStack>
  );
}

export default memo(TripleGomokuView);
