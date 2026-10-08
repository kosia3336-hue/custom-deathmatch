'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { WordPuzzleGameData } from '@/shared/types/word-puzzle';
import WordPuzzleView from './WordPuzzleView';

export default function WordPuzzleGame() {
  const { sendAction, ...props } = useGameModuleConnection<WordPuzzleGameData>(
    GAME_IDS.WORD_PUZZLE,
  );
  return (
    <GameActionProvider send={sendAction}>
      <WordPuzzleView key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
