'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS as GAME } from '@/shared/types/game';
import type { GS2GameData } from '@/shared/types/grape-sugar-2';
import GrapeSugar2View from './GrapeSugar2View';

export default function GrapeSugar2Game() {
  const { sendAction, ...props } = useGameModuleConnection<GS2GameData>(GAME.GRAPE_SUGAR_2);
  return (
    <GameActionProvider send={sendAction}>
      <GrapeSugar2View key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
