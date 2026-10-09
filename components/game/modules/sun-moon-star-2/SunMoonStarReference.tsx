'use client';

import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type { SMS2ContextValue } from './hooks/useSMS2Context';
import OpponentPowderMemo from './OpponentPowderMemo';
import PowderTrack from './PowderTrack';
import RoundHistoryTable from './RoundHistoryTable';
import ScorePanel from './ScorePanel';
import DalmajiPowderTrack from './skins/DalmajiPowderTrack';
import DalmajiScorePanel from './skins/DalmajiScorePanel';

export function SunMoonStarReference({ ctx }: { ctx: SMS2ContextValue }) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const {
    gameData,
    isSpectator,
    myId,
    myPlayer,
    opponent,
    mySide,
    firstSide,
    showTracker,
    powderNotes,
    dalmaji,
  } = ctx;
  const Scores = dalmaji ? DalmajiScorePanel : ScorePanel;
  const Track = dalmaji ? DalmajiPowderTrack : PowderTrack;
  if (!gameData || !firstSide) return null;
  const left = !isSpectator && myPlayer ? myPlayer : gameData.players.p1;
  const right = !isSpectator && opponent ? opponent : gameData.players.p2;
  const trackView = (
    <Track
      compact
      leftLabel={!isSpectator && myPlayer ? '나' : left.nickname}
      leftStage={left.powderStage}
      leftRemain={!isSpectator && myPlayer ? (gameData.selfPrivate?.powderRemain ?? null) : null}
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
  );
  return (
    <GameInfoStack>
      {/*
        모바일은 점수와 빛가루 트랙을 한 칸에 둔다. 따로 두면 칸마다 제목·여백이
        붙어 판이 그만큼 아래로 밀렸다. 트랙 모양은 그대로다.
        PC 는 점수 칸이 판 위에 붙으므로 트랙까지 넣으면 판이 밀려 넘친다 —
        예전처럼 트랙을 따로 둔다.
      */}
      <GameInfoPart title="점수" sizeToContent>
        <div className="flex flex-col gap-2">
          <Scores
            p1={gameData.players.p1}
            p2={gameData.players.p2}
            firstSide={firstSide}
            myId={myId}
          />
          {!desktop && trackView}
        </div>
      </GameInfoPart>
      {showTracker && opponent && (
        <GameInfoPart title="상대 빛가루 추리" sizeToContent>
          <OpponentPowderMemo
            round={powderNotes.round}
            latestRound={powderNotes.latest}
            estimate={powderNotes.estimate}
            max={powderNotes.max}
            onSelectRound={powderNotes.selectRound}
            onChange={powderNotes.change}
            onReset={powderNotes.reset}
          />
        </GameInfoPart>
      )}
      {desktop && (
        <GameInfoPart title="빛가루 트랙" sizeToContent>
          {trackView}
        </GameInfoPart>
      )}
      <GameInfoPart title="라운드 기록">
        <RoundHistoryTable history={gameData.history} mySide={mySide} players={gameData.players} />
      </GameInfoPart>
    </GameInfoStack>
  );
}
