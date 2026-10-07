'use client';
import { useGameToolsRegistration } from '@/contexts/GameToolsContext';
import { GameInfoPart, GameInfoStack } from '@/components/game/GameInfoPart';
import GameLoading from '@/components/game/GameLoading';
import { GameReferenceFrame } from '@/components/game/GameReferenceFrame';
import { useGameHud } from '@/hooks/useGameHud';
import { usePresentationEffect } from '@/hooks/usePresentationEffect';
import { opponentDisplayName } from '@/lib/anonymousOpponents';
import type { SkinTheme } from '@/lib/skins/registry';
import { josa } from '@/shared/lib/josa';
import type { FTGameData, FTMilestoneEntry } from '@/shared/types/five-towers';
import { memo, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { ActionLogList } from './ActionLogList';
import ActionPanel from './ActionPanel';
import { BottomSheet } from './BottomSheet';
import InferenceField from './InferenceField';
import { MilestoneOverlay } from './MilestoneOverlay';
import { WIN_TYPE_LABELS } from './presentation';
import { ScoreCard } from './ScoreCard';
import styles from './layout.module.css';

function FiveTowersView({
  gameData,
  myId,
  isSpectator = false,
  skin = null,
  roomId = '',
  gameKey = '',
}: {
  gameData?: FTGameData;
  myId: string;
  isSpectator?: boolean;
  skin?: SkinTheme | null;
  roomId?: string;
  gameKey?: string;
  remaining?: number | null;
}) {
  const desktop = useGameToolsRegistration()?.desktop ?? false;
  const shownEndRef = useRef<string | null>(null);
  const lastMilestoneRef = useRef<number>(0);
  const lastActionRef = useRef<number>(0);
  const lastInfoRef = useRef<number>(0);
  const [milestoneEntry, setMilestoneEntry] = useState<FTMilestoneEntry | null>(null);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMyTurn =
    !isSpectator && !!gameData && gameData.phase === 'turn' && gameData.currentPlayerId === myId;

  /* 내 차례 시작 → 바텀시트 자동 열기 */
  useEffect(() => {
    if (!gameData || isSpectator) return;
    if (isMyTurn) {
      const t = setTimeout(() => setSheetOpen(true), 0);
      return () => clearTimeout(t);
    } else {
      setSheetOpen(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isMyTurn, gameData?.turn]);

  /* 마일스톤 오버레이 */
  usePresentationEffect(() => {
    if (!gameData) return;
    const ms = gameData.milestoneLog;
    if (ms.length > lastMilestoneRef.current) {
      const newOnes = ms.slice(lastMilestoneRef.current);
      lastMilestoneRef.current = ms.length;
      const last = newOnes[newOnes.length - 1];
      const displayMs = last.kind === 'complete' ? 3500 : 2500;
      setMilestoneEntry(last);
      const tShow = setTimeout(() => setMilestoneVisible(true), 30); // 마운트 후 fade-in
      const tHide = setTimeout(() => setMilestoneVisible(false), displayMs);
      const tClear = setTimeout(() => setMilestoneEntry(null), displayMs + 500);
      return () => {
        clearTimeout(tShow);
        clearTimeout(tHide);
        clearTimeout(tClear);
      };
    }
    // milestoneLog 배열 참조가 매 브로드캐스트마다 바뀌어 effect가 재실행되면
    // cleanup이 타이머를 취소해 완성 창이 닫히지 않는 버그 방지 → 길이로만 비교
  }, [gameData?.milestoneLog.length]);

  /* 행동 알림 (상대/관전자 시점) */
  useEffect(() => {
    if (!gameData) return;
    const log = gameData.actionLog;
    // 무르기로 로그가 줄어든 경우 ref 재조정 (toast 없이 리셋)
    if (log.length < lastActionRef.current) {
      lastActionRef.current = log.length;
      return;
    }
    if (log.length <= lastActionRef.current) return;
    const newEntries = log.slice(lastActionRef.current);
    lastActionRef.current = log.length;

    for (const e of newEntries) {
      const isMe = e.actorId === myId;
      // 마일스톤 완성은 오버레이가 크게 표시하므로 행동 toast 스킵 (6칸은 같이 표시)
      if (e.milestone === 'complete') continue;
      // 내 행동: info-self / zero-self 는 별도 toast 처리, 나머지는 알림 불필요
      if (isMe) continue;

      let msg = '';
      if (e.kind === 'stack-public') {
        msg = `${josa(e.actorNickname, '이/가')} ${e.tower}탑에 쌓았습니다.`;
      } else if (e.kind === 'secret-hidden') {
        msg = `${josa(e.actorNickname, '이/가')} 시크릿을 사용했습니다.`;
      } else if (e.kind === 'secret-revealed') {
        msg = `${e.actorNickname}의 시크릿 — ${e.tower}탑이 공개됐습니다.`;
      }
      if (msg) toast.info(msg, { duration: 3000 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.actionLog, myId]);

  /* 정보 아이템 결과 토스트 */
  useEffect(() => {
    if (!gameData) return;
    const results = gameData.myInfoResults;
    if (results.length > lastInfoRef.current) {
      const last = results[results.length - 1];
      lastInfoRef.current = results.length;
      toast.info(`정보 결과: ${last.targets[0]} + ${last.targets[1]} = ${last.sumAtTime}칸`, {
        duration: 6000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameData?.myInfoResults]);

  /* 종료 토스트 */
  useEffect(() => {
    if (!gameData?.winType) return;
    const key = gameData.winner ?? 'ended';
    if (shownEndRef.current === key) return;
    shownEndRef.current = key;
    if (gameData.winner) {
      const nick = gameData.players[gameData.winner]?.nickname ?? '???';
      const reason = WIN_TYPE_LABELS[gameData.winType] ?? '';
      const isMe = gameData.winner === myId;
      if (isMe) toast.success(`${nick} 승리! ${reason}`, { duration: 5000 });
      else toast.error(`${nick} 승리! ${reason}`, { duration: 5000 });
    } else {
      toast.info('게임 종료', { duration: 5000 });
    }
  }, [gameData?.winType, gameData?.winner, myId, gameData?.players]);

  useGameHud(
    gameData
      ? {
          round: `${gameData.turn}턴`,
          order:
            gameData.phase === 'finished'
              ? '종료'
              : isSpectator
                ? '탑 쌓기'
                : isMyTurn
                  ? '(내 차례) 탑 쌓기'
                  : '(상대 차례) 탑 쌓기',
        }
      : null,
  );

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <GameLoading label="게임을 불러오는 중" />
      </div>
    );
  }

  const playerEntries = Object.entries(gameData.players);
  const myPlayer = playerEntries.find(([id]) => id === myId)?.[1];
  const opponentPlayer = playerEntries.find(([id]) => id !== myId)?.[1];
  const leftPlayer = !isSpectator && myPlayer ? myPlayer : playerEntries[0]?.[1];
  const rightPlayer = !isSpectator && opponentPlayer ? opponentPlayer : playerEntries[1]?.[1];

  const currentPlayer = gameData.players[gameData.currentPlayerId];

  /* 액션 패널 콘텐츠 (데스크톱 인라인 & 모바일 바텀시트 공용) */
  const actionContent = (
    <ActionPanel
      key={`${gameData.turn}:${gameData.myInfoResults.length}`}
      gameData={gameData}
      myId={myId}
      isMyTurn={isMyTurn}
      disabled={gameData.phase !== 'turn'}
    />
  );

  return (
    <>
      <MilestoneOverlay
        entry={milestoneEntry}
        visible={milestoneVisible}
        citadel={skin === 'citadel'}
      />

      <GameReferenceFrame
        reference={
          <GameInfoStack>
            <GameInfoPart title="점수" sizeToContent>
              <div className="grid grid-cols-2 gap-2">
                {[leftPlayer, rightPlayer].filter(Boolean).map((player) => (
                  <ScoreCard
                    key={player!.id}
                    player={player!}
                    isMe={player!.id === myId && !isSpectator}
                    isCurrentTurn={
                      player!.id === gameData.currentPlayerId && gameData.phase === 'turn'
                    }
                  />
                ))}
              </div>
            </GameInfoPart>
            <GameInfoPart title="행동 기록">
              <ActionLogList log={gameData.actionLog} myId={myId} />
            </GameInfoPart>
          </GameInfoStack>
        }
        controls={
          !isSpectator ? (
            <>
              {desktop && <div className={styles.actions}>{actionContent}</div>}
              {!desktop && isMyTurn && (
                <button
                  type="button"
                  onClick={() => setSheetOpen(true)}
                  className="w-full rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white lg:hidden"
                >
                  행동하기
                </button>
              )}
            </>
          ) : undefined
        }
      >
        <div className={styles.stage} data-game-intrinsic-stage>
          <div className={styles.board}>
            <InferenceField
              towers={gameData.towers}
              gameKey={gameKey || roomId + '.' + gameData.firstPlayerId}
              skin={skin}
            />
          </div>
          {gameData.unresolvedSecrets.length > 0 && (
            <div className="rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
              <b>시크릿 진행 중</b>:{' '}
              {gameData.unresolvedSecrets.map((u, i) => (
                <span key={i} className="mr-2">
                  {gameData.players[u.actorId]?.nickname ?? '???'}
                  {u.actorId === myId && u.details
                    ? ' (' + u.details.target + '탑 ' + u.details.count + '칸)'
                    : ''}
                </span>
              ))}
            </div>
          )}
        </div>
      </GameReferenceFrame>

      {/* ── 모바일 바텀시트 ── */}
      {!desktop && !isSpectator && (
        <>
          {/* 내 차례인데 시트가 닫혀 있을 때 플로팅 버튼 */}
          <BottomSheet
            open={sheetOpen && isMyTurn}
            onClose={() => setSheetOpen(false)}
            /* 내 차례에 '<내 닉> 차례' 라고 하면 남 얘기처럼 읽힌다 */
            title={
              isMyTurn
                ? '내 차례'
                : `${opponentDisplayName(currentPlayer?.nickname, isSpectator)} 차례`
            }
          >
            {actionContent}
          </BottomSheet>
        </>
      )}
    </>
  );
}

export default memo(FiveTowersView);
