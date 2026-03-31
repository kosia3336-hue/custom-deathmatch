'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useMySocketId } from '@/hooks/useMySocketId';
import type { FourGravityGameData, Direction } from '@/shared/types/four-gravity';
import Board from './Board';
import GravitySelector from './GravitySelector';
import PhaseIndicator from './PhaseIndicator';
import InfoPanel from './InfoPanel';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { DIR_LABEL } from './constants';
import { applyGravity, findMovedPosition, calcNeutralCandidates } from './boardUtils';

export default function FourGravityGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);

  const gameData = gameState?.gameData as FourGravityGameData | undefined;
  const turnNumber = gameState?.turnNumber ?? 1;

  const myId = useMySocketId();

  const isMyTurn = !!gameData && !!myId && gameData.currentPlayer === myId && !isSpectator;

  const previewColor = isMyTurn ? gameData?.currentColor ?? null : null;

  const [pendingGravity, setPendingGravity] = useState<Direction | null>(null);

  const shownWinnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameData?.winner || !gameData?.winType) return;
    if (shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;

    const { players, winner, winType } = gameData;
    const winnerNick =
      players.black.id === winner ? players.black.nickname : players.white.nickname;

    const reason =
      winType === 'black' ? '흑 사목 완성!'
      : winType === 'white' ? '백 사목 완성!'
      : winType === 'neutral' ? '중립 사목 완성!'
      : winType === 'no-space' ? '더 이상 둘 곳 없음'
      : winType === 'no-neutral' ? '중립 돌을 놓지 못함'
      : '';

    const isMe = winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) {
      toast.success(message, { duration: 5000 });
    } else {
      toast.error(message, { duration: 5000 });
    }
  }, [gameData, myId]);

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
      </div>
    );
  }

  const handleCellClick = (row: number, col: number) => {
    if (!isMyTurn) return;
    if (gameData.phase === 'place') {
      getSocket().emit('game:action', { type: 'place', row, col });
    } else if (gameData.phase === 'neutral') {
      getSocket().emit('game:action', { type: 'neutral', row, col });
    }
  };

  const handleGravity = (direction: Direction) => {
    if (!isMyTurn || gameData.phase !== 'gravity') return;

    if (direction !== 'none' && gameData.placedPosition) {
      const newBoard = applyGravity(gameData.board, direction);
      const movedPos = findMovedPosition(gameData.placedPosition, direction, gameData.board, newBoard);
      const candidates = calcNeutralCandidates(gameData.placedPosition, movedPos, newBoard);

      if (candidates.length === 0) {
        setPendingGravity(direction);
        return;
      }
    }

    getSocket().emit('game:action', { type: 'gravity', direction });
  };

  const confirmGravity = () => {
    if (pendingGravity) {
      getSocket().emit('game:action', { type: 'gravity', direction: pendingGravity });
      setPendingGravity(null);
    }
  };

  return (
    <>
    <Modal
      open={pendingGravity !== null}
      onClose={() => setPendingGravity(null)}
      title="패배 경고"
      closable={false}
    >
      <p className="mb-2 text-sm text-gray-700">
        <strong>{pendingGravity ? DIR_LABEL[pendingGravity] : ''}</strong> 방향으로 중력을 적용하면
        중립 돌을 놓을 수 없어{' '}
        <span className="font-semibold text-red-600">패배</span>합니다.
      </p>
      <p className="mb-6 text-sm text-gray-500">정말 이 방향을 선택하시겠습니까?</p>
      <div className="flex justify-end gap-3">
        <Button variant="secondary" onClick={() => setPendingGravity(null)}>
          취소
        </Button>
        <Button variant="danger" onClick={confirmGravity}>
          확인 (패배 감수)
        </Button>
      </div>
    </Modal>
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* 메인 영역: 보드 + 컨트롤 */}
        <div className="flex flex-1 flex-col items-center justify-center gap-1 p-2 lg:p-4">
          {/* 모바일: 플레이어 바 */}
          <div className="mb-1 flex w-full max-w-md justify-between lg:hidden">
            <PlayerBadge
              player={gameData.players.black}
              color="black"
              isCurrent={gameData.currentColor === 'black'}
            />
            <PlayerBadge
              player={gameData.players.white}
              color="white"
              isCurrent={gameData.currentColor === 'white'}
            />
          </div>

          {/* 모바일: 상태 바 */}
          <div className="mb-1 flex w-full max-w-md items-center gap-3 text-xs text-gray-500 lg:hidden">
            <span>턴 #{turnNumber}</span>
            {gameData.lastGravity && (
              <span>금지 방향: {DIR_LABEL[gameData.lastGravity]}</span>
            )}
          </div>

          <Board
            board={gameData.board}
            phase={gameData.phase}
            isMyTurn={isMyTurn}
            previewColor={previewColor}
            neutralCandidates={gameData.neutralCandidates}
            placedPosition={gameData.placedPosition}
            winLine={gameData.winLine}
            winner={gameData.winner}
            onCellClick={handleCellClick}
          />

          <PhaseIndicator
            phase={gameData.phase}
            isMyTurn={isMyTurn}
            winner={gameData.winner}
            serverMessage={gameState?.message}
          />

          <GravitySelector
            phase={gameData.phase}
            isMyTurn={isMyTurn}
            lastGravity={gameData.lastGravity}
            onSelect={handleGravity}
            winner={gameData.winner}
          />
        </div>

        {/* 데스크탑: 정보 패널 */}
        <div className="hidden lg:flex lg:w-64 lg:flex-col lg:border-l lg:border-gray-200 lg:p-4">
          <InfoPanel
            turnNumber={turnNumber}
            players={gameData.players}
            currentColor={gameData.currentColor}
            neutralCount={gameData.neutralCount}
            lastGravity={gameData.lastGravity}
          />
        </div>
      </div>
    </div>
    </>
  );
}

function PlayerBadge({
  player,
  color,
  isCurrent,
}: {
  player: FourGravityGameData['players']['black'];
  color: 'black' | 'white';
  isCurrent: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-2 rounded-lg px-3 py-1 ${
        isCurrent ? 'bg-indigo-50 ring-1 ring-indigo-300' : ''
      }`}
    >
      <span
        className={`h-3 w-3 rounded-full ${
          color === 'black' ? 'bg-[#1a1a2e]' : 'border border-gray-300 bg-white'
        }`}
      />
      <span className="text-sm font-medium text-gray-900">{player.nickname}</span>
      {isCurrent && <span className="text-xs text-indigo-600">◀</span>}
    </div>
  );
}
