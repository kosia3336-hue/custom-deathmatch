'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useRef } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import type { NumberFourGameData, NumberFourAction } from '@/shared/types/number4';
import { getSkinTheme, type SkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import SubmitSelector from './SubmitSelector';
import RevealPanel from './RevealPanel';
import { WIN_TYPE_LABELS } from './constants';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import styles from './number-four.module.css';
import TutorialCoach from '@/components/game/TutorialCoach';
import { TOTAL_ROUNDS } from '@/shared/types/number4';
import { useNumberFourTools } from './useNumberFourTools';
export { numberFourStatus } from '@/lib/numberFourView';

const sendAction = (action: NumberFourAction) => getSocket().emit('game:action', action);

export default function NumberFourGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const spectator = useRoomStore((s) => s.isSpectator);
  const myId = useMySocketId();
  const data = gameState?.gameData as NumberFourGameData | undefined;
  const shown = useRef<string | null>(null);
  useEffect(() => {
    if (!data?.winType || data.tutorial || shown.current === (data.winner ?? 'draw')) return;
    shown.current = data.winner ?? 'draw';
    if (!data.winner) {
      toast.info('무승부!');
      return;
    }
    const message = `${data.players[data.winner]?.nickname ?? '플레이어'} 승리! ${WIN_TYPE_LABELS[data.winType]}`;
    if (data.winner === myId) toast.success(message);
    else toast.error(message);
  }, [data, myId]);
  return data ? (
    <NumberFourView
      key={gameState?.startedAt}
      gameData={data}
      myId={myId}
      isSpectator={spectator}
      skin={getSkinTheme(gameState?.activeSkin, GAME_IDS.NUMBER_FOUR)}
      onAction={sendAction}
    />
  ) : (
    <GameLoading label="게임을 불러오는 중" />
  );
}

/** 실제 게임과 로컬 dev 페이지가 같은 UI를 사용한다. dev는 소켓을 호출하지 않는다. */
export function NumberFourView({
  gameData: data,
  myId,
  isSpectator,
  skin,
  onAction,
}: {
  gameData: NumberFourGameData;
  myId: string;
  isSpectator: boolean;
  skin?: SkinTheme | null;
  onAction: (action: NumberFourAction) => void;
}) {
  const { setHud } = useRoomLayout();
  const { tools, model } = useNumberFourTools(data, myId, isSpectator, skin);
  const { player, order } = model;
  useEffect(() => {
    setHud({ round: `${data.round} / ${TOTAL_ROUNDS}R`, order });
    return () => setHud(null);
  }, [data.round, order, setHud]);
  const hint = data.tutorial;
  return (
    <GameReferenceFrame
      className={styles.frame}
      controls={
        hint ? (
          <div className="flex flex-col items-center gap-2">
            {hint && (
              <TutorialCoach
                compact
                hint={{
                  step:
                    hint.step === 'intro'
                      ? 1
                      : hint.step === 'summary'
                        ? 14
                        : data.round * 2 + (hint.step === 'result' ? 1 : 0),
                  total: 14,
                  title: hint.title,
                  body: hint.body,
                  canAck: !!hint.ackLabel && !isSpectator && data.phase !== 'finished',
                  ackLabel: hint.ackLabel ?? '확인',
                }}
                onAck={() => onAction({ type: 'tutorial-ack' })}
                className="max-w-[min(100%,720px)]"
              />
            )}
          </div>
        ) : undefined
      }
      tools={tools}
    >
      <div className={styles.stage}>
        {model.canChoose && player && (
          <SubmitSelector
            key={`${data.round}-${player.id}`}
            player={player}
            isSpectator={false}
            skin={skin}
            onAction={onAction}
            tutorial={hint}
          />
        )}
        {model.waiting && (
          <div className="border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted rounded-xl border p-6 text-center text-sm">
            {isSpectator ? '플레이어들의 제출을 기다립니다.' : '상대의 제출을 기다립니다.'}
            {!isSpectator && player?.submission && (
              <p className="mt-2 text-xs">
                내 제출: 백 □{player.submission.white} · 흑 ■{player.submission.black} · N
                {player.submission.number}
              </p>
            )}
          </div>
        )}
        {model.revealing && data.revealData && (
          <RevealPanel
            revealData={data.revealData}
            players={data.players}
            round={data.round}
            winType={data.winType}
            tiebreakerReason={data.tiebreakerReason}
            skin={skin}
          />
        )}
      </div>
    </GameReferenceFrame>
  );
}
