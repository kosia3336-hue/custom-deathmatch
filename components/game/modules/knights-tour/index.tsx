'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { KnightTourGameData } from '@/shared/types/knights-tour';
import KnightsTourView from './KnightsTourView';

export default function KnightsTourGame() {
  const { sendAction, ...props } = useGameModuleConnection<KnightTourGameData>(
    GAME_IDS.KNIGHTS_TOUR,
  );
  return (
    <GameActionProvider send={sendAction}>
      <KnightsTourView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
