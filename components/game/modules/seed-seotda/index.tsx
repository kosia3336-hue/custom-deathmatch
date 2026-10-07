'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS as GAME } from '@/shared/types/game';
import type { SeedSeotdaGameData } from '@/shared/types/seed-seotda';
import SeedSeotdaView from './SeedSeotdaView';

export default function SeedSeotdaGame() {
  const { sendAction, ...props } = useGameModuleConnection<SeedSeotdaGameData>(GAME.SEED_SEOTDA);
  return (
    <GameActionProvider send={sendAction}>
      <SeedSeotdaView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
