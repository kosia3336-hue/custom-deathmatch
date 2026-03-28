'use client';

import { useState, useEffect } from 'react';
import { useRoomStore } from '@/stores/room';
import { getSocket } from '@/lib/socket';
import type { FourGravityGameData, Direction } from '@/shared/types/four-gravity';
import Board from './Board';
import GravitySelector from './GravitySelector';
import PhaseIndicator from './PhaseIndicator';
import InfoPanel from './InfoPanel';

function directionLabel(dir: Direction): string {
  const map: Record<Direction, string> = {
    up: '▲ 상',
    down: '▼ 하',
    left: '◀ 좌',
    right: '▶ 우',
    none: '무',
  };
  return map[dir];
}

export default function FourGravityGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const isSpectator = useRoomStore((s) => s.isSpectator);

  const gameData = gameState?.gameData as FourGravityGameData | undefined;
  const turnNumber = gameState?.turnNumber ?? 1;

  const [myId, setMyId] = useState<string | undefined>(() => getSocket().id);
  useEffect(() => {
    const socket = getSocket();
    const onConnect = () => setMyId(socket.id);
    socket.on('connect', onConnect);
    return () => { socket.off('connect', onConnect); };
  }, []);

  const isMyTurn = !!gameData && !!myId && gameData.currentPlayer === myId && !isSpectator;

  const previewColor = isMyTurn ? gameData?.currentColor ?? null : null;

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
    getSocket().emit('game:action', { type: 'gravity', direction });
  };

  return (
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
              <span>직전 중력: {directionLabel(gameData.lastGravity)}</span>
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
