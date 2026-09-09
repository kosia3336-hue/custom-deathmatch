'use client';

import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { useRoomStore } from '@/stores/room';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useTurnTimer } from '@/hooks/useTurnTimer';
import type {
  FTActionLogEntry,
  FTGameData,
  FTMilestoneEntry,
  FTPlayerInfo,
  FTTower,
} from '@/shared/types/five-towers';
import { FT_MAX_SCORE } from '@/shared/types';
import { GAME_IDS } from '@/shared/types/game';
import { getSkinTheme } from '@/lib/skins/registry';
import InferenceField, { TOWER_COLORS } from './InferenceField';
import ActionPanel from './ActionPanel';

const WIN_TYPE_LABELS: Record<string, string> = {
  score: '3선승 달성',
  leave: '기권',
  timeout: '시간 초과',
};

/* ── BottomSheet ── */
function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <div
        className={`fixed inset-0 z-(--cdm-z-overlay) bg-black/40 transition-opacity duration-300 lg:hidden ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
      />
      <div
        className={`fixed inset-x-0 bottom-0 z-(--cdm-z-modal) flex max-h-[85vh] flex-col rounded-t-2xl border-t border-gray-200 bg-white shadow-2xl transition-transform duration-300 lg:hidden ${
          open ? 'translate-y-0' : 'translate-y-full'
        }`}
      >
        <div className="flex shrink-0 flex-col items-center pt-3 pb-2">
          <div className="h-1 w-10 rounded-full bg-gray-300" />
          {title && (
            <p className="mt-2 text-sm font-semibold text-gray-700">{title}</p>
          )}
        </div>
        <div
          className="overflow-y-auto px-4 pb-4"
          style={{ paddingBottom: 'max(16px, var(--cdm-safe-bottom, 0px))' }}
        >
          {children}
        </div>
      </div>
    </>
  );
}

/* ── 점수 카드 ── */
function ScoreCard({
  player,
  isMe,
  isCurrentTurn,
}: {
  player: FTPlayerInfo;
  isMe: boolean;
  isCurrentTurn: boolean;
}) {
  return (
    <div
      className={`flex flex-col gap-1 rounded-xl border-2 p-3 transition-all ${
        isCurrentTurn
          ? 'border-indigo-400 bg-indigo-50 shadow-sm'
          : 'border-gray-200 bg-white'
      }`}
    >
      <div className="flex items-center justify-between text-xs font-medium text-gray-500">
        <span>{isMe ? '나' : '상대'}</span>
        {isCurrentTurn && (
          <span className="rounded-full bg-indigo-500 px-2 py-0.5 text-[10px] font-semibold text-white">
            차례
          </span>
        )}
      </div>
      <div className="truncate text-sm font-semibold text-gray-800">{player.nickname}</div>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          {Array.from({ length: FT_MAX_SCORE }, (_, i) => (
            <span
              key={i}
              className={`h-3 w-3 rounded-full transition-colors ${
                i < player.score ? 'bg-amber-400' : 'bg-gray-200'
              }`}
            />
          ))}
        </div>
        <span className="text-xl font-black tabular-nums text-gray-800">
          {player.score}
          <span className="ml-0.5 text-xs font-normal text-gray-400">/{FT_MAX_SCORE}</span>
        </span>
      </div>
      {isMe && player.itemUsed && (
        <div className="mt-0.5 text-[10px] font-medium text-gray-400">
          아이템 사용함{player.myItemUsedKind ? ` (${labelOfItem(player.myItemUsedKind)})` : ''}
        </div>
      )}
    </div>
  );
}

function labelOfItem(kind: string): string {
  if (kind === 'info') return '정보';
  if (kind === 'zero') return '제로';
  if (kind === 'secret') return '시크릿';
  return kind;
}

/* ── 모바일 점수 바 ── */
function MobileScoreBar({
  players,
  myId,
  currentPlayerId,
  phase,
}: {
  players: Record<string, FTPlayerInfo>;
  myId: string;
  currentPlayerId: string;
  phase: string;
}) {
  return (
    <div className="flex w-full max-w-3xl gap-2 lg:hidden">
      {Object.entries(players).map(([id, p]) => {
        const isMe = id === myId;
        const isCurrentTurn = id === currentPlayerId && phase === 'turn';
        return (
          <div
            key={id}
            className={`flex flex-1 items-center justify-between rounded-lg border px-3 py-1.5 text-xs transition-all ${
              isCurrentTurn
                ? 'border-indigo-300 bg-indigo-50'
                : isMe
                  ? 'border-gray-200 bg-white'
                  : 'border-gray-200 bg-white'
            }`}
          >
            <span className={`truncate font-medium ${isMe ? 'text-indigo-700' : 'text-gray-700'}`}>
              {isMe ? '나' : p.nickname}
              {isCurrentTurn && (
                <span className="ml-1 text-[10px] text-indigo-500">▶</span>
              )}
            </span>
            <div className="ml-2 flex shrink-0 items-center gap-1">
              {Array.from({ length: FT_MAX_SCORE }, (_, i) => (
                <span
                  key={i}
                  className={`h-2 w-2 rounded-full ${i < p.score ? 'bg-amber-400' : 'bg-gray-200'}`}
                />
              ))}
              <span className="ml-1 font-bold tabular-nums">{p.score}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

/* ── 타이머 ── */
function TimerDisplay({ remaining }: { remaining: number | null }) {
  if (remaining == null) return null;
  const isLow = remaining <= 10;
  return (
    <span
      className={`rounded-full px-3 py-1 text-sm font-bold tabular-nums transition-colors ${
        isLow ? 'animate-pulse bg-red-100 text-red-600' : 'bg-gray-100 text-gray-700'
      }`}
    >
      {Math.ceil(remaining)}s
    </span>
  );
}

/* ── 마일스톤 오버레이 ── */
function MilestoneOverlay({
  entry,
  visible,
  citadel,
}: {
  entry: FTMilestoneEntry | null;
  visible: boolean;
  citadel?: boolean;
}) {
  const isComplete = entry?.kind === 'complete';
  return (
    <div
      className={`pointer-events-none fixed inset-0 z-(--cdm-z-modal) flex items-center justify-center transition-all duration-500 ${
        visible ? 'opacity-100' : 'opacity-0'
      }`}
    >
      {entry && (
        isComplete ? (
          citadel ? (
            <div className="skin-citadel-milestone-complete flex flex-col items-center gap-3 px-14 py-10 text-center shadow-2xl">
              <span className="skin-citadel-milestone-kicker text-sm font-semibold tracking-widest uppercase">
                탑 완성
              </span>
              <span className="text-6xl font-black">{entry.tower}</span>
              <span className="text-xl font-bold">{entry.actorNickname}</span>
              <span className="skin-citadel-milestone-score rounded-full px-5 py-1.5 text-base font-black">
                +1 점
              </span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-3 rounded-3xl bg-amber-900/80 px-14 py-10 text-center text-white shadow-2xl backdrop-blur-sm">
              <span className="text-sm font-semibold tracking-widest uppercase opacity-70">
                탑 완성
              </span>
              <span className="text-6xl font-black">{entry.tower}</span>
              <span className="text-xl font-bold">{entry.actorNickname}</span>
              <span className="rounded-full bg-amber-400 px-5 py-1.5 text-base font-black text-amber-900">
                +1 점
              </span>
            </div>
          )
        ) : citadel ? (
          <div
            className="skin-citadel-milestone-half px-10 py-5 text-center shadow-2xl"
            style={{ marginTop: '-30vh' }}
          >
            <span className="skin-citadel-milestone-kicker block text-xs font-semibold tracking-widest uppercase">
              6칸 공개
            </span>
            <span className="mt-1 block text-3xl font-black">{entry.tower}탑</span>
            <span className="mt-0.5 block text-sm font-medium opacity-90">
              {entry.actorNickname}
            </span>
          </div>
        ) : (
          <div
            className="rounded-2xl border-2 border-yellow-400 bg-yellow-50 px-10 py-5 text-center shadow-2xl"
            style={{ marginTop: '-30vh' }}
          >
            <span className="block text-xs font-semibold tracking-widest text-yellow-600 uppercase">
              6칸 공개
            </span>
            <span className="mt-1 block text-3xl font-black text-yellow-800">
              {entry.tower}탑
            </span>
            <span className="mt-0.5 block text-sm font-medium text-yellow-700">
              {entry.actorNickname}
            </span>
          </div>
        )
      )}
    </div>
  );
}

/* ── 액션 로그 ── */
function ActionLogList({ log, myId }: { log: FTActionLogEntry[]; myId: string }) {
  if (log.length === 0) {
    return (
      <p className="px-3 py-4 text-center text-xs text-gray-400">
        아직 행동이 없습니다.
      </p>
    );
  }
  return (
    <ul className="flex flex-col gap-1 p-2">
      {log.slice(-40).map((e, i) => (
        <li
          key={`${e.turn}-${i}`}
          className={`rounded-md px-2 py-1.5 text-xs leading-relaxed ${
            e.actorId === myId ? 'bg-indigo-50 text-indigo-800' : 'bg-gray-50 text-gray-700'
          }`}
        >
          <span className="mr-1 font-mono text-[10px] text-gray-400">{e.turn}T</span>
          <span className="font-semibold">{e.actorNickname}</span>{' '}
          {renderActionDesc(e, myId)}
          {e.milestone === 'half' && (
            <span className="ml-1 rounded bg-yellow-200 px-1 text-[10px] font-bold text-yellow-800">6칸</span>
          )}
          {e.milestone === 'complete' && (
            <span className="ml-1 rounded bg-amber-400 px-1 text-[10px] font-bold text-white">완성</span>
          )}
        </li>
      ))}
    </ul>
  );
}

function renderActionDesc(e: FTActionLogEntry, myId: string): React.ReactNode {
  const isMe = e.actorId === myId;
  if (e.kind === 'stack-public') {
    return isMe
      ? <><b>{e.tower}</b>탑 +<b>{e.count}</b>칸</>
      : <><b>{e.tower}</b>탑에 쌓음</>;
  }
  if (e.kind === 'secret-hidden') {
    if (isMe && e.tower != null && e.count != null) {
      return <><span className="font-bold text-purple-700">시크릿</span> → <b>{e.tower}</b>탑 +<b>{e.count}</b>칸 (비공개)</>;
    }
    return <><span className="font-bold text-purple-700">시크릿</span> 사용</>;
  }
  if (e.kind === 'secret-revealed') {
    return (
      <>
        <span className="font-bold text-purple-700">시크릿</span> → <b>{e.tower}</b>탑 공개
        {isMe && e.count != null ? <> (+{e.count}칸)</> : null}
      </>
    );
  }
  if (e.kind === 'info-self') {
    return (
      <>
        <span className="font-bold text-sky-700">정보</span>:{' '}
        <b>{e.targets?.[0]}+{e.targets?.[1]}</b> = <b>{e.sum}</b>
      </>
    );
  }
  if (e.kind === 'zero-self') {
    return (
      <>
        <span className="font-bold text-slate-700">제로</span> → <b>{e.tower}</b>탑 (0칸)
      </>
    );
  }
  return null;
}

/* ══════════════════════════════════════
   메인 컴포넌트
══════════════════════════════════════ */
export default function FiveTowersGame() {
  const gameState = useRoomStore((s) => s.gameState);
  const skin = getSkinTheme(gameState?.activeSkin, GAME_IDS.FIVE_TOWERS);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const roomId = useRoomStore((s) => s.room?.id ?? '');
  const gameData = gameState?.gameData as FTGameData | undefined;
  const myId = useMySocketId();
  const { remaining } = useTurnTimer();

  const shownEndRef = useRef<string | null>(null);
  const lastMilestoneRef = useRef<number>(0);
  const lastActionRef = useRef<number>(0);
  const lastInfoRef = useRef<number>(0);
  const [milestoneEntry, setMilestoneEntry] = useState<FTMilestoneEntry | null>(null);
  const [milestoneVisible, setMilestoneVisible] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);

  const isMyTurn = !isSpectator && !!gameData && gameData.phase === 'turn' && gameData.currentPlayerId === myId;

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
  useEffect(() => {
    if (!gameData) return;
    const ms = gameData.milestoneLog;
    if (ms.length > lastMilestoneRef.current) {
      const newOnes = ms.slice(lastMilestoneRef.current);
      lastMilestoneRef.current = ms.length;
      const last = newOnes[newOnes.length - 1];
      const displayMs = last.kind === 'complete' ? 3500 : 2500;
      setMilestoneEntry(last);
      const tShow = setTimeout(() => setMilestoneVisible(true), 30);  // 마운트 후 fade-in
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
        msg = `${e.actorNickname}이(가) ${e.tower}탑에 쌓았습니다.`;
      } else if (e.kind === 'secret-hidden') {
        msg = `${e.actorNickname}이(가) 시크릿을 사용했습니다.`;
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
      toast.info(
        `정보 결과: ${last.targets[0]} + ${last.targets[1]} = ${last.sumAtTime}칸`,
        { duration: 6000 },
      );
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

  if (!gameData) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-500">게임을 불러오는 중...</p>
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

      <div className="flex h-full">
        <div className="flex flex-1 flex-col lg:flex-row">

          {/* ── 메인 영역 ── */}
          <div className="flex flex-1 flex-col items-center gap-3 overflow-y-auto p-3 pb-24 lg:p-5 lg:pb-5">

            {/* 모바일 점수 바 */}
            <MobileScoreBar
              players={gameData.players}
              myId={myId}
              currentPlayerId={gameData.currentPlayerId}
              phase={gameData.phase}
            />

            <div className="flex w-full max-w-3xl items-center justify-between rounded-xl border border-gray-200 bg-white px-4 py-2.5">
              <div className="flex items-baseline gap-2">
                <span className="text-xs text-gray-400">턴</span>
                <span className="text-lg font-black tabular-nums text-gray-800">
                  {gameData.turn}
                </span>
                {gameData.phase !== 'finished' && currentPlayer && (
                  <span className="ml-2 text-sm text-gray-600">
                    ·{' '}
                    <b className={isMyTurn ? 'text-indigo-700' : 'text-gray-700'}>
                      {currentPlayer.nickname}
                    </b>{' '}
                    차례
                  </span>
                )}
                {gameData.phase === 'finished' && (
                  <span className="ml-2 text-sm font-semibold text-gray-500">
                    게임 종료
                  </span>
                )}
              </div>
              <TimerDisplay remaining={remaining} />
            </div>

            {/* 추리 필드 */}
            <div className="w-full max-w-3xl">
              <InferenceField
                towers={gameData.towers}
                gameKey={`${roomId}.${gameData.firstPlayerId}`}
                skin={skin}
              />
            </div>

            {/* 시크릿 진행 중 알림 */}
            {gameData.unresolvedSecrets.length > 0 && (
              <div className="w-full max-w-3xl rounded-xl border border-purple-200 bg-purple-50 px-3 py-2 text-xs text-purple-700">
                <b>시크릿 진행 중</b>:{' '}
                {gameData.unresolvedSecrets.map((u, i) => {
                  const isMe = u.actorId === myId;
                  const nick = gameData.players[u.actorId]?.nickname ?? '???';
                  return (
                    <span key={i} className="mr-2">
                      {nick}
                      {isMe && u.details
                        ? ` (${u.details.target}탑 ${u.details.count}칸)`
                        : ''}
                    </span>
                  );
                })}
              </div>
            )}

            {/* 데스크톱 전용: 액션 패널 */}
            {!isSpectator && (
              <div className="hidden w-full max-w-3xl lg:block">
                {actionContent}
              </div>
            )}

            {/* 모바일: 행동 로그 접기 */}
            {gameData.actionLog.length > 0 && (
              <div className="w-full max-w-3xl lg:hidden">
                <details className="rounded-lg border border-gray-200 bg-white">
                  <summary className="cursor-pointer px-3 py-2 text-sm font-medium text-gray-600">
                    행동 로그 ({gameData.actionLog.length})
                  </summary>
                  <div className="border-t border-gray-100 px-3 py-2">
                    <ActionLogList log={gameData.actionLog} myId={myId} />
                  </div>
                </details>
              </div>
            )}
          </div>

          {/* ── 데스크톱 사이드 패널 ── */}
          <div className="hidden lg:flex lg:w-64 lg:shrink-0 lg:flex-col lg:gap-3 lg:border-l lg:border-gray-200 lg:p-4">
            <div className="flex flex-col gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">
                점수
              </p>
              {leftPlayer && (
                <ScoreCard
                  player={leftPlayer}
                  isMe={!isSpectator}
                  isCurrentTurn={
                    leftPlayer.id === gameData.currentPlayerId && gameData.phase === 'turn'
                  }
                />
              )}
              {rightPlayer && (
                <ScoreCard
                  player={rightPlayer}
                  isMe={false}
                  isCurrentTurn={
                    rightPlayer.id === gameData.currentPlayerId && gameData.phase === 'turn'
                  }
                />
              )}
            </div>

            <div className="flex flex-1 flex-col overflow-hidden rounded-xl border border-gray-200 bg-white">
              <p className="shrink-0 border-b border-gray-100 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-gray-400">
                행동 로그
              </p>
              <div className="flex-1 overflow-y-auto">
                <ActionLogList log={gameData.actionLog} myId={myId} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 모바일 바텀시트 ── */}
      {!isSpectator && (
        <>
          {/* 내 차례인데 시트가 닫혀 있을 때 플로팅 버튼 */}
          {isMyTurn && !sheetOpen && (
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="fixed inset-x-4 bottom-20 z-(--cdm-z-modal) rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white shadow-lg transition-transform active:scale-95 lg:hidden"
            >
              행동하기 →
            </button>
          )}
          <BottomSheet
            open={sheetOpen && isMyTurn}
            onClose={() => setSheetOpen(false)}
            title={`${currentPlayer?.nickname ?? ''} 차례`}
          >
            {actionContent}
          </BottomSheet>
        </>
      )}
    </>
  );
}

export { TOWER_COLORS };
export type { FTTower };
