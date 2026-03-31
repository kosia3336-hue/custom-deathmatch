export interface Game {
  id: string;
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  supportsMulti: boolean;
  supportsCom: boolean;
  supportsSolo: boolean;
}

export const GAME_IDS = {
  FOUR_GRAVITY: 'game-001',
} as const;
