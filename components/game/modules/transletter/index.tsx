'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { TransletterGameData } from '@/shared/types/transletter';
import WordRaceView from '../word-race/WordRaceView';

export default function TransletterGame() {
  const { sendAction, ...props } = useGameModuleConnection<TransletterGameData>(
    GAME_IDS.TRANSLETTER,
  );
  return (
    <GameActionProvider send={sendAction}>
      <WordRaceView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
