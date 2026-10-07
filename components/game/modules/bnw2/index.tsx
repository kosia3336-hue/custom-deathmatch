'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import type { BNW2GameData } from '@/shared/types/bnw2';
import { GAME_IDS as GAME } from '@/shared/types/game';
import BNW2View from './BNW2View';

export default function BNW2Game() {
  const { sendAction, ...props } = useGameModuleConnection<BNW2GameData>(GAME.BNW2);
  return (
    <GameActionProvider send={sendAction}>
      <BNW2View key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
