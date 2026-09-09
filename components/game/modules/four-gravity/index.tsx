'use client';

import { useEffect, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useMySocketId } from '@/hooks/useMySocketId';
import type { FourGravityGameData, Direction } from '@/shared/types/four-gravity';
import { GAME_IDS } from '@/shared/types/game';
import { getSkinTheme } from '@/lib/skins/registry';
import Board from './Board';
import GravitySelector from './GravitySelector';
import PhaseIndicator from './PhaseIndicator';
import InfoPanel from './InfoPanel';
import Modal from '@/components/ui/Modal';
import { GameFrame, fitBoardWidth } from '@/components/game/GameFrame';
import Button from '@/components/ui/Button';
import TutorialCoach from './TutorialCoach';
import { DIR_LABEL, WIN_TYPE_TOAST_LABEL } from './constants';
import { applyGravity, findMovedPosition, calcNeutralCandidates } from './boardUtils';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';
import { seatStage, turnStage } from '@/lib/gameSeat';

export default function FourGravityGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const room = useRoomStore((s) => s.room);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const nickname = useNicknameStore((s) => s.nickname);

  const gameData = gameState?.gameData as FourGravityGameData | undefined;
  useAbstractStrategyMoveSfx(gameData?.board);
  const turnNumber = gameState?.turnNumber ?? 1;
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.FOUR_GRAVITY);

  const myId = useMySocketId();
  const { setHud } = useRoomLayout();

  const isMyTurn = !!gameData && !!myId && gameData.currentPlayer === myId && !isSpectator;

  const isSpecialSolo =
    nickname === '천하' &&
    room?.gameId === GAME_IDS.FOUR_GRAVITY &&
    room?.playMode === 'solo';

  const isAIMode = isSpecialSolo && !!gameData && (
    gameData.players.black.id === 'AI' || gameData.players.white.id === 'AI'
  );
  const tutorial = gameData?.tutorial ?? null;

  const previewColor = isMyTurn ? gameData?.currentColor ?? null : null;
  useTurnTimer();

  const [pendingGravity, setPendingGravity] = useState<Direction | null>(null);

  /*
    차례가 오가는 판이다. 단계 이름만 적으면 '중력 선택' 이 내 차례인지 상대
    차례인지 알 수 없어, 내 차례 여부를 앞에 둔다. (lib/gameSeat.ts)
  */
  const fgStep = gameData?.phase === 'place'
    ? '돌 놓기'
    : gameData?.phase === 'gravity'
      ? '중력 선택'
      : gameData?.phase === 'neutral'
        ? '중립 돌 놓기'
        : undefined;
  const phaseLabel = tutorial
    ? '조작 연습'
    : gameData?.winner
      ? '종료'
      : fgStep
        ? seatStage(
            turnStage({ finished: false, isSpectator, isMyTurn, spectatorStage: '진행 중' }),
            fgStep,
          )
        : undefined;

  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${turnNumber}턴`,
      order: phaseLabel,
      memo: (
        <FourGravitySidePanel
          gameData={gameData}
        />
      ),
    });
    return () => setHud(null);
  }, [gameData, phaseLabel, setHud, turnNumber]);

  const shownWinnerRef = useRef<string | null>(null);
  useEffect(() => {
    if (!gameData?.winner || !gameData?.winType) return;
    if (tutorial) return;
    if (shownWinnerRef.current === gameData.winner) return;
    shownWinnerRef.current = gameData.winner;

    const { players, winner, winType } = gameData;
    const winnerNick =
      players.black.id === winner ? players.black.nickname : players.white.nickname;

    const reason = winType ? (WIN_TYPE_TOAST_LABEL[winType] ?? '') : '';
    const isMe = winner === myId;
    const message = `${winnerNick} 승리! ${reason}`;

    if (isMe) {
      toast.success(message, { duration: 5000 });
    } else {
      toast.error(message, { duration: 5000 });
    }
  }, [gameData, myId, tutorial]);

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

    if (!tutorial && direction !== 'none' && gameData.placedPosition) {
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

  const ackTutorial = () => {
    getSocket().emit('game:action', { type: 'tutorial-ack' });
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
      <GameFrame
        controls={
          <div className="flex flex-col items-center gap-1.5">
            {tutorial ? (
              <TutorialCoach hint={tutorial} onAck={ackTutorial} className="max-w-[min(100%,500px)]" />
            ) : (
              <PhaseIndicator
                phase={gameData.phase}
                isMyTurn={isMyTurn}
                winner={gameData.winner}
                serverMessage={gameState?.message}
              />
            )}
            <GravitySelector
              phase={gameData.phase}
              isMyTurn={isMyTurn}
              lastGravity={gameData.lastGravity}
              onSelect={handleGravity}
              winner={gameData.winner}
              highlightGravity={tutorial?.highlightGravity}
            />
            {isSpecialSolo && !gameData.winner && (
              <Button
                size="sm"
                variant={isAIMode ? 'secondary' : 'ghost'}
                disabled={!isAIMode && gameData.phase !== 'place'}
                onClick={() => {
                  getSocket().emit('game:four-gravity:toggle-ai', { ai: !isAIMode });
                }}
              >
                {isAIMode ? '직접하기' : 'AI 쓰기'}
              </Button>
            )}
          </div>
        }
        aside={<FourGravitySidePanel gameData={gameData} />}
      >
        <Board
          board={gameData.board}
          phase={gameData.phase}
          isMyTurn={isMyTurn}
          previewColor={previewColor}
          neutralCandidates={gameData.neutralCandidates}
          placedPosition={gameData.placedPosition}
          winLine={gameData.winLine}
          winner={gameData.winner}
          highlightCells={tutorial?.highlightCells}
          skin={skin}
          maxWidth={fitBoardWidth(1, 1, '500px')}
          onCellClick={handleCellClick}
        />
      </GameFrame>
    </>
  );
}

function FourGravitySidePanel({ gameData }: { gameData: FourGravityGameData }) {
  return (
    <GameInfoPart title="판 정보">
      <InfoPanel
        players={gameData.players}
        currentColor={gameData.currentColor}
        neutralCount={gameData.neutralCount}
        lastGravity={gameData.lastGravity}
      />
    </GameInfoPart>
  );
}
