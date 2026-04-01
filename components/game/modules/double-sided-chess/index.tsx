'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import type {
  DoubleSidedChessGameData,
  PieceType,
  Owner,
  Position,
} from '@/shared/types/double-sided-chess';
import Board from './Board';
import PrisonerBar from './PrisonerBar';
import InfoPanel from './InfoPanel';
import PlayerBadge from './PlayerBadge';
import { WIN_TYPE_TOAST_LABEL } from './constants';
import { getValidMoves, getValidPrisonerPlacements } from './boardUtils';

export default function DoubleSidedChessGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);

  const gameData = gameState?.gameData as DoubleSidedChessGameData | undefined;
  const turnNumber = gameState?.turnNumber ?? 1;

  const myId = useMySocketId();
  const { remaining: timerRemaining } = useTurnTimer();

  const myOwner: Owner | null = useMemo(() => {
    if (!gameData || !myId) return null;
    const isFirst = gameData.players.first.id === myId;
    const isSecond = gameData.players.second.id === myId;
    if (!isFirst && !isSecond) return null;
    // 솔로 모드: first.id === second.id이므로 현재 턴 소유자를 따름
    if (isFirst && isSecond) return gameData.currentOwner;
    if (isFirst) return 'first';
    return 'second';
  }, [gameData, myId]);

  const isMyTurn = !!gameData && !!myOwner && gameData.currentOwner === myOwner && !isSpectator;

  const [selectedPiece, setSelectedPiece] = useState<Position | null>(null);
  const [selectedPrisoner, setSelectedPrisoner] = useState<PieceType | null>(null);

  useEffect(() => {
    setSelectedPiece(null);
    setSelectedPrisoner(null);
  }, [gameData?.turnNumber, gameData?.currentPlayer]);

  const shownWinnerRef = useRef<string | null>(null);
  const winner = gameData?.winner;
  const winType = gameData?.winType;

  useEffect(() => {
    if (!winner || !winType || !gameData) return;
    if (shownWinnerRef.current === winner) return;
    shownWinnerRef.current = winner;

    const { players } = gameData;
    const winnerNick = players.first.id === winner ? players.first.nickname : players.second.nickname;
    const reason = WIN_TYPE_TOAST_LABEL[winType] ?? '';
    const isMe = winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) toast.success(message, { duration: 5000 });
    else toast.error(message, { duration: 5000 });
  }, [winner, winType, myId, gameData]);

  const validMoves = useMemo(() => {
    if (!selectedPiece || !gameData) return [];
    return getValidMoves(gameData.board, selectedPiece.row, selectedPiece.col);
  }, [selectedPiece, gameData]);

  const prisonerPlacements = useMemo(() => {
    if (!selectedPrisoner || !myOwner || !gameData) return [];
    return getValidPrisonerPlacements(gameData.board, myOwner);
  }, [selectedPrisoner, myOwner, gameData]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const activeMoves = selectedPrisoner ? prisonerPlacements : validMoves;

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn || gameData.winner) return;

    if (selectedPrisoner) {
      if (prisonerPlacements.some((p) => p.row === row && p.col === col)) {
        getSocket().emit('game:action', {
          type: 'place-prisoner',
          pieceType: selectedPrisoner,
          position: { row, col },
        });
        setSelectedPrisoner(null);
        setSelectedPiece(null);
        return;
      }
      setSelectedPrisoner(null);
    }

    if (selectedPiece && validMoves.some((m) => m.row === row && m.col === col)) {
      getSocket().emit('game:action', {
        type: 'move',
        from: { row: selectedPiece.row, col: selectedPiece.col },
        to: { row, col },
      });
      setSelectedPiece(null);
      return;
    }

    const cell = gameData.board[row][col];
    if (cell && cell.owner === myOwner) {
      if (selectedPiece?.row === row && selectedPiece?.col === col) {
        setSelectedPiece(null);
      } else {
        setSelectedPiece({ row, col });
        setSelectedPrisoner(null);
      }
      return;
    }

    setSelectedPiece(null);
  };

  const handlePrisonerSelect = (piece: PieceType) => {
    if (selectedPrisoner === piece) {
      setSelectedPrisoner(null);
    } else {
      setSelectedPrisoner(piece);
      setSelectedPiece(null);
    }
  };

  const message = !isMyTurn
    ? (gameState?.message ?? '상대 턴입니다. 기다려 주세요...')
    : selectedPrisoner
      ? '배치할 칸을 선택하세요'
      : selectedPiece
        ? '이동할 칸을 선택하세요'
        : '말을 선택하세요';

  // 진영 색 기준: second(파랑) → 보드 위, first(빨강) → 보드 아래
  const isSecondMyTurn = isMyTurn && gameData.currentOwner === 'second';
  const isFirstMyTurn = isMyTurn && gameData.currentOwner === 'first';

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col items-center gap-1 p-2 lg:p-4">
          {/* 플레이어 뱃지 (모바일) */}
          <div className="mb-1 flex w-full max-w-2xl justify-between lg:hidden">
            <PlayerBadge
              player={gameData.players.first}
              owner="first"
              isCurrent={gameData.currentOwner === 'first'}
              remaining={gameData.currentOwner === 'first' ? timerRemaining : null}
            />
            <PlayerBadge
              player={gameData.players.second}
              owner="second"
              isCurrent={gameData.currentOwner === 'second'}
              remaining={gameData.currentOwner === 'second' ? timerRemaining : null}
            />
          </div>

          {/* second(파랑) 포로 — 보드 위, 항상 고정 */}
          <div className="w-full max-w-2xl shrink-0">
            <PrisonerBar
              prisoners={gameData.prisoners.second}
              owner="second"
              isMine={myOwner === 'second'}
              isMyTurn={isSecondMyTurn}
              selectedPrisoner={myOwner === 'second' ? selectedPrisoner : null}
              onSelect={myOwner === 'second' ? handlePrisonerSelect : () => {}}
              winner={gameData.winner}
            />
          </div>

          {/* 보드 — 남은 공간 채우기 */}
          <div className="flex min-h-0 w-full flex-1 items-center justify-center">
            <Board
              board={gameData.board}
              myOwner={myOwner}
              selectedPiece={selectedPiece}
              validMoves={activeMoves}
              lastMove={gameData.lastMove}
              isMyTurn={isMyTurn}
              winner={gameData.winner}
              onCellClick={handleCellClick}
            />
          </div>

          {/* first(빨강) 포로 — 보드 아래, 항상 고정 */}
          <div className="w-full max-w-2xl shrink-0">
            <PrisonerBar
              prisoners={gameData.prisoners.first}
              owner="first"
              isMine={myOwner === 'first'}
              isMyTurn={isFirstMyTurn}
              selectedPrisoner={myOwner === 'first' ? selectedPrisoner : null}
              onSelect={myOwner === 'first' ? handlePrisonerSelect : () => {}}
              winner={gameData.winner}
            />
          </div>

          {/* 상태 메시지 */}
          {!gameData.winner && (
            <p className="shrink-0 text-sm text-gray-500">{message}</p>
          )}
        </div>

        {/* 데스크탑: 사이드 패널 */}
        <div className="hidden lg:flex lg:w-56 lg:flex-col lg:border-l lg:border-gray-200 lg:p-4">
          <InfoPanel
            turnNumber={turnNumber}
            players={gameData.players}
            currentOwner={gameData.currentOwner}
          />
        </div>
      </div>
    </div>
  );
}
