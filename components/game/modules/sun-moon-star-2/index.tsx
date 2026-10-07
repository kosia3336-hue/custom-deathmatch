'use client';
import { GameActionProvider } from '@/components/game/GameActionContext';
import { useGameModuleConnection } from '@/hooks/useGameModuleConnection';
import { GAME_IDS } from '@/shared/types/game';
import type { SMS2GameData } from '@/shared/types/sun-moon-star-2';
import SunMoonStar2View from './SunMoonStar2View';
export default function SunMoonStar2Game() {
  const { sendAction, ...props } = useGameModuleConnection<SMS2GameData>(GAME_IDS.SUN_MOON_STAR_2);
  return (
    <GameActionProvider send={sendAction}>
      <SunMoonStar2View key={props.gameKey} {...props} />
    </GameActionProvider>
  );
}
