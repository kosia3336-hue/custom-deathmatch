'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import type { DoubleSidedPokerGameData } from '@/shared/types/double-sided-poker';
import { GAME_IDS as GAME } from '@/shared/types/game';
import DoubleSidedPokerView from './DoubleSidedPokerView';

export default function DoubleSidedPokerGame() {
  const { sendAction, ...props } = useGameModuleConnection<DoubleSidedPokerGameData>(
    GAME.DOUBLE_SIDED_POKER,
  );
  return (
    <GameActionProvider send={sendAction}>
      <DoubleSidedPokerView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
