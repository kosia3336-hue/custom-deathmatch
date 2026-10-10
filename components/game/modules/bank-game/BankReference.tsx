'use client';
import { GameMemoDisclosure } from '@/components/game/GameMemoDisclosure';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import OpponentInventoryTracker from './OpponentInventoryTracker';
import RoundHistoryTable from './RoundHistoryTable';
import ScorePanel from './ScorePanel';
import type { BankContextValue } from './hooks/useBankContext';

export function BankReference({ ctx }: { ctx: BankContextValue }) {
  const { gameData, firstSide, myId, mySide, showOpponentTracker, inventoryNotes, isSpectator } =
    ctx;
  if (!gameData) return null;
  return (
    <GameInfoStack>
      {firstSide && (
        <GameInfoPart title="점수" sizeToContent>
          <ScorePanel
            p1={gameData.players.p1}
            p2={gameData.players.p2}
            firstSide={firstSide}
            myId={myId}
            opponentNote={!isSpectator ? inventoryNotes.currentNote : undefined}
          />
        </GameInfoPart>
      )}
      <GameInfoPart title="라운드 기록">
        <RoundHistoryTable
          history={gameData.history}
          mySide={mySide}
          players={gameData.players}
          variant="mobile"
        />
      </GameInfoPart>
      {showOpponentTracker && (
        /* 모바일은 해달별2처럼 '메모 열기' 버튼 하나만 — 패널·제목·요약 없이(mobileBare) */
        <GameInfoPart
          title="나의 메모 - 상대 잔여 추리"
          toolId="상대 잔여 추리"
          sizeToContent
          mobileBare
        >
          <GameMemoDisclosure title="나의 메모 - 상대 잔여 추리" skin={ctx.skin}>
            <OpponentInventoryTracker notes={inventoryNotes} />
          </GameMemoDisclosure>
        </GameInfoPart>
      )}
    </GameInfoStack>
  );
}
