'use client';

import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import OpponentPowderTracker from './OpponentPowderTracker';
import PowderTrack from './PowderTrack';
import RoundHistoryTable from './RoundHistoryTable';
import ScorePanel from './ScorePanel';
import DalmajiPowderTrack from './skins/DalmajiPowderTrack';
import DalmajiScorePanel from './skins/DalmajiScorePanel';
import { zeroOpponentEstimate } from './types';

export function SunMoonStarReference({ ctx }: { ctx: SMS2ContextValue }) {
  const {
    gameData,
    isSpectator,
    myId,
    myPlayer,
    opponent,
    mySide,
    firstSide,
    showTracker,
    opponentEstimate,
    setOpponentEstimate,
    dalmaji,
  } = ctx;
  const Scores = dalmaji ? DalmajiScorePanel : ScorePanel;
  const Track = dalmaji ? DalmajiPowderTrack : PowderTrack;
  if (!gameData || !firstSide) return null;
  const left = !isSpectator && myPlayer ? myPlayer : gameData.players.p1;
  const right = !isSpectator && opponent ? opponent : gameData.players.p2;
  return (
    <GameInfoStack>
      <GameInfoPart title="점수" sizeToContent>
        <Scores
          p1={gameData.players.p1}
          p2={gameData.players.p2}
          firstSide={firstSide}
          myId={myId}
        />
      </GameInfoPart>
      {showTracker && opponentEstimate && opponent && (
        <GameInfoPart title="상대 빛가루 추리">
          <OpponentPowderTracker
            stageNow={opponent.powderStage}
            stagePrev={opponentEstimate.basedOnStagePrev}
            estimate={opponentEstimate}
            onChange={setOpponentEstimate}
            onReset={() =>
              setOpponentEstimate(
                zeroOpponentEstimate(opponentEstimate.basedOnStagePrev, opponent.powderStage),
              )
            }
          />
        </GameInfoPart>
      )}
      <GameInfoPart title="빛가루 트랙" sizeToContent>
        <Track
          leftLabel={!isSpectator && myPlayer ? '나' : left.nickname}
          leftStage={left.powderStage}
          leftRemain={
            !isSpectator && myPlayer ? (gameData.selfPrivate?.powderRemain ?? null) : null
          }
          leftIsFirst={left.side === gameData.firstPlayerSide}
          leftChips={left.chips}
          rightLabel={
            !isSpectator && opponent ? opponentDisplayName(opponent.nickname) : right.nickname
          }
          rightStage={right.powderStage}
          rightRemain={null}
          rightIsFirst={right.side === gameData.firstPlayerSide}
          rightChips={right.chips}
        />
      </GameInfoPart>
      <GameInfoPart title="라운드 기록">
        <RoundHistoryTable history={gameData.history} mySide={mySide} players={gameData.players} />
      </GameInfoPart>
    </GameInfoStack>
  );
}
