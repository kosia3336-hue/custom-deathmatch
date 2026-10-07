'use client';
import type { BettingRpsAction, BettingRpsGameData } from '@/shared/types/betting-rps';
import { buildBettingRpsView } from './viewModel';
import PlayerStatusCard from './PlayerStatusCard';
import RoleSelector from './RoleSelector';
import ResultSelector from './ResultSelector';
import BetSelector from './BetSelector';
import RevealPanel from './RevealPanel';
import RoundHistoryTable from './RoundHistoryTable';
import { useDreamshopAudio } from './skins/useDreamshopAudio';
import skinStyles from './skins/dreamshop.module.css';
import styles from './betting-rps.module.css';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
export default function BettingRpsView({
  gameData,
  myId,
  isSpectator,
  disabled,
  onAction,
  dreamshop = false,
}: {
  gameData: BettingRpsGameData;
  myId: string;
  isSpectator: boolean;
  disabled?: boolean;
  dreamshop?: boolean;
  onAction: (action: BettingRpsAction) => void;
}) {
  useDreamshopAudio(dreamshop);
  const view = buildBettingRpsView(gameData, myId, isSpectator);
  return (
    <GameReferenceFrame
      className={`${styles.frame} ${dreamshop ? skinStyles.dreamshop : ''}`}
      reference={
        <GameInfoStack className={dreamshop ? skinStyles.dreamshop : undefined}>
          <GameInfoPart title="점수판" sizeToContent>
            <PlayerStatusCard
              players={gameData.players}
              myId={myId}
              round={gameData.round}
              isSpectator={isSpectator}
            />
          </GameInfoPart>
          <GameInfoPart title="라운드 기록">
            <RoundHistoryTable
              history={gameData.roundHistory}
              players={gameData.players}
              myId={isSpectator ? '' : myId}
            />
          </GameInfoPart>
        </GameInfoStack>
      }
    >
      <section
        className={styles.board}
        aria-label="베팅 가위바위보 게임판"
        data-betting-rps
        data-skin={dreamshop ? 'dreamshop' : undefined}
      >
        {view.canChoose && (
          <RoleSelector
            disabled={disabled}
            onSelectRole={(role) => onAction({ type: 'selectRole', role })}
          />
        )}
        {view.canSubmit && view.me?.role === 'match' && (
          <ResultSelector
            dreamshop={dreamshop}
            key={gameData.round}
            disabled={disabled}
            onSubmit={(result) => onAction({ type: 'submitMatch', result })}
          />
        )}
        {view.canSubmit && view.me?.role === 'bet' && (
          <BetSelector
            dreamshop={dreamshop}
            key={gameData.round}
            disabled={disabled}
            myChips={view.me.chips}
            onSubmit={(prediction, chips) => onAction({ type: 'submitBet', prediction, chips })}
          />
        )}
        {((gameData.phase === 'roleSelect' && !view.canChoose) ||
          (gameData.phase === 'submit' && !view.canSubmit)) && (
          <div
            role="status"
            className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-sm text-gray-500"
          >
            {isSpectator
              ? '플레이어들이 선택 중입니다.'
              : view.me?.submitted
                ? `${view.opponentName}의 제출을 기다립니다.`
                : '상대가 역할을 선택 중입니다.'}
          </div>
        )}
        {(gameData.phase === 'reveal' || gameData.phase === 'finished') && (
          <RevealPanel key={gameData.round} gameData={gameData} dreamshop={dreamshop} />
        )}
      </section>
    </GameReferenceFrame>
  );
}
