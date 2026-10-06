'use client';

import type { InvestDonateAction, InvestDonateGameData } from '@/shared/types/invest-donate';
import CoinSelector from './CoinSelector';
import RevealPanel from './RevealPanel';
import PlayerStatusCard from './PlayerStatusCard';
import OpponentInferPanel from './OpponentInferPanel';
import RoundHistoryTable from './RoundHistoryTable';
import { buildInvestDonateView } from './viewModel';
import styles from './invest-donate.module.css';

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
    <div className={styles.layout} data-invest-donate>
      <section className={styles.board} aria-label="투자와 기부 게임판">
        <PlayerStatusCard
          players={gameData.players}
          roundHistory={gameData.roundHistory}
          myId={myId}
          isSpectator={isSpectator}
        />
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
      <section className={styles.history} aria-label="라운드 기록">
        <h2 className="shrink-0 border-b border-gray-100 px-3 py-2 text-sm font-semibold text-gray-700">
          라운드 기록
        </h2>
        <div className={styles.historyBody}>
          <RoundHistoryTable
            history={gameData.roundHistory}
            players={gameData.players}
            myId={isSpectator ? '' : myId}
          />
        </div>
      </section>
    </div>
  );
}
