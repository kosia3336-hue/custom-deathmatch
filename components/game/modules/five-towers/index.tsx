'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import type { FTGameData } from '@/shared/types/five-towers';
import { GAME_IDS as GAME } from '@/shared/types/game';
import FiveTowersView from './FiveTowersView';

export default function FiveTowersGame() {
  const { sendAction, ...props } = useGameModuleConnection<FTGameData>(GAME.FIVE_TOWERS);
  return (
    <GameActionProvider send={sendAction}>
      <FiveTowersView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
