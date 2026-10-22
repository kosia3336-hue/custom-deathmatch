'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { NoVowelGameData } from '@/shared/types/no-vowel';
import WordRaceView from '../word-race/WordRaceView';

export default function NoVowelGame() {
  const { sendAction, ...props } = useGameModuleConnection<NoVowelGameData>(GAME_IDS.NO_VOWEL);
  return (
    <GameActionProvider send={sendAction}>
      {/* 자음만 늘어서면 글자 경계가 없어 붙어 보인다 — 자간을 넓혀 하나씩 읽히게 */}
      <WordRaceView key={props.gameKey} {...props} shownClassName="tracking-[0.3em]" />
    </GameActionProvider>
  );
}
