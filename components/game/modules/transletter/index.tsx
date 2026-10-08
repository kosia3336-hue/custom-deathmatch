'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { TransletterGameData } from '@/shared/types/transletter';
import TransletterView from './TransletterView';

export default function TransletterGame() {
  const { sendAction, ...props } = useGameModuleConnection<TransletterGameData>(
    GAME_IDS.TRANSLETTER,
  );
  return (
    <GameActionProvider send={sendAction}>
      <TransletterView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
