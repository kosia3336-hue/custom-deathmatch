'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS as GAME } from '@/shared/types/game';
import type { WinningStreakGameData } from '@/shared/types/winning-streak';
import WinningStreakView from './WinningStreakView';

export default function WinningStreakGame() {
  const { sendAction, ...props } = useGameModuleConnection<WinningStreakGameData>(
    GAME.WINNING_STREAK,
  );
  return (
    <GameActionProvider send={sendAction}>
      <WinningStreakView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
