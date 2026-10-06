'use client';

import GameLoading from '@/components/game/GameLoading';

import { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { getSocket } from '@/lib/socket';
import { toast } from 'sonner';
import type { NumberFourGameData, NumberFourAction } from '@/shared/types/number4';
import { INITIAL_WHITE, INITIAL_BLACK } from '@/shared/types/number4';
import { getSkinTheme, type SkinTheme } from '@/lib/skins/registry';
import { GAME_IDS } from '@/shared/types/game';
import SubmitSelector from './SubmitSelector';
import RevealPanel from './RevealPanel';
import InfoPanel from './InfoPanel';
import TileTracker from './TileTracker';
import { WIN_TYPE_LABELS } from './constants';
import { GameFrame } from '@/components/game/GameFrame';
import { useRoomLayout } from '@/contexts/RoomLayoutContext';
import styles from './number-four.module.css';
import { useGameToolsRegistration, type GameTool } from '@/contexts/GameToolsContext';
import TutorialCoach from '@/components/game/TutorialCoach';
import {
  updateNumberFourNote,
  clearNumberFourNote,
  type NumberFourRoundNotes,
} from '@/lib/numberFourNotes';

export function numberFourStatus(data: NumberFourGameData, myId: string, spectator: boolean) {
  if (data.tutorial) return '튜토리얼';
  if (data.phase === 'finished') return '종료';
  if (data.phase === 'reveal') return '제출 공개';
  if (data.currentSide)
    return `${data.currentSide === 'player1' ? '1P' : '2P'} 차례 · 타일 넘버 선택`;
  if (spectator) return '(공동 차례) 제출 대기';
  return data.players[myId]?.submitted
    ? '(공동 차례) 상대 제출 대기'
    : '(공동 차례) 타일 넘버 선택';
}

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
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const [notes, setNotes] = useState<NumberFourRoundNotes>({});
  const [pinnedMemoRound, setPinnedRound] = useState<number | null>(null);
  const memoRound = Math.min(pinnedMemoRound ?? data.round, data.round);
  const selectMemoRound = useCallback(
    (round: number) => setPinnedRound(round === data.round ? null : round),
    [data.round],
  );
  const order = numberFourStatus(data, myId, isSpectator);
  useEffect(() => {
    setHud({
      round: `${data.round} / 6R`,
      order,
    });
    return () => setHud(null);
  }, [data.round, order, setHud]);
  const entries = Object.entries(data.players);
  const player = data.players[data.currentSide === 'player2' ? `${myId}_p2` : myId];
  const tracked = isSpectator
    ? entries
    : entries.filter(([id]) => id !== myId && id !== `${myId}_p2`);
  // 솔로는 현재 조작하는 쪽의 상대를 추리한다.
  const trackerEntries = tracked.length ? tracked : entries.filter(([id]) => id !== player?.id);
  const setNote = useCallback(
    (id: string, color: 'white' | 'black', value: number) =>
      setNotes((prev) => updateNumberFourNote(prev, memoRound, id, color, value)),
    [memoRound],
  );
  const info = useMemo(
    () => (
      <InfoPanel
        gameData={data}
        myId={myId}
        predictions={notes[data.round] ?? {}}
        compact={!desktop}
        notes={notes}
      />
    ),
    [data, myId, notes, desktop],
  );
  const trackerPanel = useMemo(
    () => (
      <div className={styles.trackerGroup}>
        {trackerEntries.map(([id, p]) => (
          <TileTracker
            key={id}
            playerNickname={isSpectator ? p.nickname : undefined}
            {...(notes[memoRound]?.[id] ?? { white: INITIAL_WHITE, black: INITIAL_BLACK })}
            round={memoRound}
            currentRound={data.round}
            entered={!!notes[memoRound]?.[id]}
            onSelectRound={selectMemoRound}
            showTitle={!desktop}
            skin={skin}
            onSet={(color, value) => setNote(id, color, value)}
            onClear={() => setNotes((prev) => clearNumberFourNote(prev, memoRound, id))}
          />
        ))}
      </div>
    ),
    [
      data.players,
      data.round,
      myId,
      isSpectator,
      skin,
      notes,
      memoRound,
      setNote,
      player?.id,
      desktop,
      selectMemoRound,
    ],
  );
  const tools = useMemo<GameTool[]>(
    () => [
      {
        id: 'score',
        title: '점수·라운드 기록',
        content: info,
        defaultEdge: 'right',
        defaultOrder: 0,
        height: 210,
        mobileSlot: 'info',
      },
      {
        id: 'tracker',
        title: '메모 - 상대 타일 추리',
        content: trackerPanel,
        defaultEdge: 'right',
        defaultOrder: 10,
        height: isSpectator ? 400 : 260,
        sizeToContent: true,
      },
    ],
    [info, trackerPanel, isSpectator],
  );
  const hint = data.tutorial;
  return (
    <GameFrame
      className={styles.frame}
      info={info}
      controls={
        hint || !desktop ? (
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
            {!desktop && <div className="w-full">{trackerPanel}</div>}
          </div>
        ) : undefined
      }
      tools={tools}
    >
      <div className={styles.stage}>
        {data.phase === 'submit' &&
          !isSpectator &&
          player &&
          !player.submitted &&
          (!hint || hint.step === 'choose') && (
            <SubmitSelector
              key={`${data.round}-${player.id}`}
              player={player}
              currentSide={data.currentSide}
              isSpectator={false}
              skin={skin}
              onAction={onAction}
              tutorial={hint}
            />
          )}
        {data.phase === 'submit' && (isSpectator || player?.submitted) && (
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
        {(data.phase === 'reveal' || data.phase === 'finished') && data.revealData && (
          <RevealPanel
            revealData={data.revealData}
            players={data.players}
            round={data.round}
            winType={data.winType}
            tiebreakerReason={data.tiebreakerReason}
            skin={skin}
            automatic={!hint}
            revealEndsAt={data.revealEndsAt}
          />
        )}
      </div>
    </GameFrame>
  );
}
