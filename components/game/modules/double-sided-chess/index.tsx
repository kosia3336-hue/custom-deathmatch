'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRoomStore } from '@/stores/room';
import { useNicknameStore } from '@/stores/nickname';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useAbstractStrategyMoveSfx } from '@/hooks/useAbstractStrategyMoveSfx';
import type {
  DoubleSidedChessGameData,
  PieceType,
  Owner,
  Position,
} from '@/shared/types/double-sided-chess';
import { GAME_IDS, isSuperAiGameOptions } from '@/shared/types/game';
import { getSkinTheme } from '@/lib/skins/registry';
import Button from '@/components/ui/Button';
import Board from './Board';
import PrisonerBar from './PrisonerBar';
import InfoPanel from './InfoPanel';
import { PlayerStrip, usePlacementConfirm } from '@/components/game/abstract-strategy';
import { OWNER_COLOR } from './constants';
import { WIN_TYPE_TOAST_LABEL } from './constants';
import { getValidMoves, getValidPrisonerPlacements } from './boardUtils';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import { GameInfoPart } from '@/components/game/GameInfoPart';

export default function DoubleSidedChessGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const room = useRoomStore((s) => s.room);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const nickname = useNicknameStore((s) => s.nickname);

  const gameData = gameState?.gameData as DoubleSidedChessGameData | undefined;
  useAbstractStrategyMoveSfx(gameData?.board);
  const turnNumber = gameState?.turnNumber ?? 1;
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.DOUBLE_SIDED_CHESS);

  const isSuperAiSolo = isSuperAiGameOptions(room?.gameOptions);
  const isSpecialSolo =
    isSuperAiSolo
    || (
      nickname === '천하'
      && room?.gameId === GAME_IDS.DOUBLE_SIDED_CHESS
      && room?.playMode === 'solo'
    );

  const isAIMode = isSpecialSolo && !!gameData && (
    gameData.players.first.id === 'AI' || gameData.players.second.id === 'AI'
  );

  const myId = useMySocketId();
  const { setHud } = useRoomLayout();

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
  useEffect(() => {
    if (!gameData) return;
    setHud({
      round: `${turnNumber}턴`,
      order: gameData.winner ? '종료' : isMyTurn ? '내 차례' : '상대 차례',
      // 판 정보는 메모가 아니라 판 위에 늘 펴 둔다 — design.md §14.9
    });
    return () => setHud(null);
  }, [gameData, isMyTurn, setHud, turnNumber]);

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

  /*
    포로 배치와 이동 모두, 터치에서는 첫 탭에 반투명 말로 자리만 보여 주고 같은 칸을
    한 번 더 눌러야 둔다. 고른 포로·말이 바뀌면 보여 주던 자리를 버린다.
  */
  const placement = usePlacementConfirm(
    `${gameData?.turnNumber ?? ''}:${gameData?.currentPlayer ?? ''}:${selectedPrisoner ?? ''}:${
      selectedPiece ? `${selectedPiece.row},${selectedPiece.col}` : ''
    }`,
  );

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
        const pieceType = selectedPrisoner;
        placement.tap(`${row},${col}`, () => {
          getSocket().emit('game:action', {
            type: 'place-prisoner',
            pieceType,
            position: { row, col },
          });
          setSelectedPrisoner(null);
          setSelectedPiece(null);
        });
        return;
      }
      setSelectedPrisoner(null);
    }

    if (selectedPiece && validMoves.some((m) => m.row === row && m.col === col)) {
      const from = { row: selectedPiece.row, col: selectedPiece.col };
      placement.tap(`${row},${col}`, () => {
        getSocket().emit('game:action', { type: 'move', from, to: { row, col } });
        setSelectedPiece(null);
      });
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
      ? placement.armed
        ? '같은 칸을 한 번 더 누르면 배치합니다'
        : '배치할 칸을 선택하세요'
      : selectedPiece
        ? placement.armed
          ? '같은 칸을 한 번 더 누르면 이동합니다'
          : '이동할 칸을 선택하세요'
        : '말을 선택하세요';

  /* 터치 첫 탭 미리보기 — 포로를 고른 중이면 그 포로, 말을 고른 중이면 그 말 */
  const armedAt = placement.armed ? placement.armed.split(',').map(Number) : null;
  const movingCell = selectedPiece ? gameData.board[selectedPiece.row][selectedPiece.col] : null;
  const ghost =
    armedAt && myOwner
      ? selectedPrisoner
        ? { row: armedAt[0], col: armedAt[1], piece: selectedPrisoner, owner: myOwner, isPromoted: false }
        : movingCell
          ? {
              row: armedAt[0],
              col: armedAt[1],
              piece: movingCell.piece,
              owner: movingCell.owner,
              isPromoted: movingCell.isPromoted,
            }
          : null
      : null;

  // 진영 색 기준: second(파랑) → 보드 위, first(빨강) → 보드 아래
  const isSecondMyTurn = isMyTurn && gameData.currentOwner === 'second';
  const isFirstMyTurn = isMyTurn && gameData.currentOwner === 'first';

  return (
    <div className="flex h-full">
      <div className="flex flex-1 flex-col lg:flex-row">
        <div className="flex flex-1 flex-col items-center gap-1 p-2 lg:p-4">
          <div className="w-full max-w-2xl shrink-0">
            <PlayerStrip
              entries={(['second', 'first'] as const).map((owner) => ({
                id: owner,
                name: gameData.players[owner].nickname,
                isMe: myOwner === owner,
                marker: <span className={`h-3.5 w-3.5 rounded-full ${OWNER_COLOR[owner].bg}`} />,
                active: !gameData.winner && gameData.currentOwner === owner,
              }))}
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
              skin={skin}
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
              skin={skin}
              ghost={ghost}
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
              skin={skin}
            />
          </div>

          {/* 상태 메시지 */}
          {!gameData.winner && (
            <p className="shrink-0 text-sm text-gray-500">{message}</p>
          )}

          {/* 솔로: AI 토글 (슈퍼 AI 페이지 · 천하) */}
          {isSpecialSolo && !gameData.winner && (
            <Button
              size="sm"
              variant={isAIMode ? 'secondary' : 'ghost'}
              onClick={() => {
                getSocket().emit('game:double-sided-chess:toggle-ai', { ai: !isAIMode });
              }}
            >
              {isAIMode ? '직접하기' : isSuperAiSolo ? '슈퍼 AI 쓰기' : 'AI 쓰기'}
            </Button>
          )}
        </div>

        {/* 데스크탑: 사이드 패널 */}
        <div className="hidden lg:flex lg:w-72 lg:flex-col lg:p-3">
          <DoubleSidedChessSidePanel gameData={gameData} />
        </div>
      </div>
    </div>
  );
}

function DoubleSidedChessSidePanel({ gameData }: { gameData: DoubleSidedChessGameData }) {
  return (
    <GameInfoPart title="플레이어">
      <InfoPanel players={gameData.players} currentOwner={gameData.currentOwner} />
    </GameInfoPart>
  );
}
