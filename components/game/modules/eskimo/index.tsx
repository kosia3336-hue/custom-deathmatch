'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { EskimoGameData } from '@/shared/types/eskimo';
import EskimoView from './EskimoView';

export default function EskimoGame() {
  const { sendAction, ...props } = useGameModuleConnection<EskimoGameData>(GAME_IDS.ESKIMO);
  return (
    <GameActionProvider send={sendAction}>
      <EskimoView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
