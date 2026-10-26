'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { SquareMokGameData } from '@/shared/types/square-mok';
import SquareMokView from './SquareMokView';

export default function SquareMokGame() {
  const { sendAction, ...props } = useGameModuleConnection<SquareMokGameData>(GAME_IDS.SQUARE_MOK);
  return (
    <GameActionProvider send={sendAction}>
      <SquareMokView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
