'use client';

import type { InvestDonateAction, InvestDonateGameData } from '@/shared/types/invest-donate';
import CoinSelector from './CoinSelector';
import RevealPanel from './RevealPanel';
import PlayerStatusCard from './PlayerStatusCard';
import OpponentInferPanel from './OpponentInferPanel';
import RoundHistoryTable from './RoundHistoryTable';
import { buildInvestDonateView } from './viewModel';
import styles from './invest-donate.module.css';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { GameInfoPart } from '@/components/game/GameInfoPart';

export default function InvestDonateView({
  gameData,
  myId,
  isSpectator,
  disabled,
  onAction,
}: {
  gameData: InvestDonateGameData;
  myId: string;
  isSpectator: boolean;
  disabled?: boolean;
  onAction: (action: InvestDonateAction) => void;
}) {
  const view = buildInvestDonateView(gameData, myId, isSpectator);
  return (
    <GameReferenceFrame
      className={styles.frame}
      reference={
        <>
          <GameInfoPart title="점수판" sizeToContent>
            <PlayerStatusCard
              players={gameData.players}
              roundHistory={gameData.roundHistory}
              myId={myId}
              isSpectator={isSpectator}
            />
          </GameInfoPart>
          <GameInfoPart title="상대 남은 코인" kind="auto" defaultOrder={10} sizeToContent>
            {isSpectator
              ? view.entries.map(([id, player]) => (
                  <OpponentInferPanel
                    key={id}
                    opponentNickname={player.nickname}
                    opponentCoinStock={player.coinStock}
                  />
                ))
              : view.opponent && (
                  <OpponentInferPanel
                    opponentNickname={view.opponentName}
                    opponentCoinStock={view.opponent.coinStock}
                  />
                )}
          </GameInfoPart>
          <GameInfoPart title="라운드 기록">
            <RoundHistoryTable
              history={gameData.roundHistory}
              players={gameData.players}
              myId={isSpectator ? '' : myId}
            />
          </GameInfoPart>
        </>
      }
    >
      <section className={styles.board} aria-label="투자와 기부 게임판" data-invest-donate>
        {gameData.phase === 'submit' && (
          <div className={styles.allocation}>
            {view.canAct && view.myPlayer && (
              <CoinSelector
                key={`${gameData.round}:${myId}`}
                coinStock={view.myPlayer.coinStock}
                submitted={view.myPlayer.submitted}
                submittedCoins={
                  view.myPlayer.investCoins && view.myPlayer.donateCoins
                    ? { invest: view.myPlayer.investCoins, donate: view.myPlayer.donateCoins }
                    : null
                }
                canCancel={view.canCancel}
                disabled={disabled}
                onSubmit={(invest, donate) => onAction({ type: 'submit', invest, donate })}
                onCancel={() => onAction({ type: 'cancelSubmit' })}
              />
            )}
            <div className="flex min-w-0 flex-col gap-2">
              {(isSpectator || view.myPlayer?.submitted) && (
                <div
                  role="status"
                  className="rounded-xl border border-gray-200 bg-gray-50 p-3 text-center text-xs text-gray-500"
                >
                  {isSpectator
                    ? '플레이어들이 코인을 배분하고 있습니다.'
                    : view.myPlayer?.submitted
                      ? `${view.opponentName}의 제출을 기다리고 있습니다.`
                      : null}
                </div>
              )}
            </div>
          </div>
        )}
        {gameData.phase !== 'submit' && <RevealPanel key={gameData.round} gameData={gameData} />}
      </section>
    </GameReferenceFrame>
  );
}
