'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { TripleGomokuGameData } from '@/shared/types/triple-gomoku';
import TripleGomokuView from './TripleGomokuView';

export default function TripleGomokuGame() {
  const { sendAction, ...props } = useGameModuleConnection<TripleGomokuGameData>(
    GAME_IDS.TRIPLE_GOMOKU,
  );
  return (
    <GameActionProvider send={sendAction}>
      <TripleGomokuView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
