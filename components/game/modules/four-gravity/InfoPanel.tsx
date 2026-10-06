'use client';

import { GameInfoPart } from '@/components/game/GameInfoPart';

import type { Direction, FourGravityGameData } from '@/shared/types/four-gravity';
import { DIR_LABEL, STONE_COLOR_CLASS } from './constants';

interface Props {
  players: FourGravityGameData['players'];
  currentColor: 'black' | 'white';
  neutralCount: number;
  lastGravity: Direction | null;
  hideWhite?: boolean;
}

function PlayerCard({
  player,
  color,
  isCurrent,
}: {
  player: FourGravityGameData['players']['black'];
  color: 'black' | 'white';
  isCurrent: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-3 ${
        isCurrent ? 'border-cdm-primary bg-cdm-primary/20' : 'border-cdm-ink-border'
      }`}
    >
      <div className="flex items-center gap-2">
        {/* 흑돌은 잉크 바탕과 거의 같은 색이라 테두리를 둘러야 보인다 */}
        <span className={`h-4 w-4 rounded-full ring-1 ring-white/40 ${STONE_COLOR_CLASS[color]}`} />
        <span className="text-cdm-ink-fg text-sm font-bold">{player.nickname}</span>
      </div>
      <div className="text-cdm-ink-fg-muted mt-1 text-xs">돌 {player.stoneCount}개</div>
      {isCurrent && <div className="mt-1 text-xs font-medium text-indigo-300">◀ 현재 턴</div>}
    </div>
  );
}

export default function InfoPanel({
  players,
  currentColor,
  neutralCount,
  lastGravity,
  hideWhite = false,
}: Props) {
  return (
    <div className="flex flex-col gap-4">
      <GameInfoPart title="플레이어" sizeToContent>
        <PlayerCard player={players.black} color="black" isCurrent={currentColor === 'black'} />
        {!hideWhite && (
          <PlayerCard player={players.white} color="white" isCurrent={currentColor === 'white'} />
        )}
      </GameInfoPart>
      <GameInfoPart title="판 정보" sizeToContent>
        <div className="text-cdm-ink-fg-muted text-xs">중립 돌: {neutralCount}개</div>
        <div className="text-cdm-ink-fg-muted mt-1 text-xs">
          금지 방향: {lastGravity ? DIR_LABEL[lastGravity] : '없음'}
        </div>
      </GameInfoPart>
    </div>
  );
}
