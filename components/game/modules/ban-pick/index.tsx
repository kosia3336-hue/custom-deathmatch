'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useMySocketId } from '@/hooks/useMySocketId';
import { cn } from '@/lib/utils';
import { playBanSfx, playLotteryPingSfx, playLotteryFinalSfx } from '@/lib/sfx';
import { RankBadge } from '@/components/cdm/RankBadge';
import type { Game } from '@/shared/types/game';
import type { RankTier } from '@/shared/types/rank';
import type {
  BanPickStartPayload,
  BanPickUpdatePayload,
  BanPickLotteryPayload,
  BannedGame,
  BanTurn,
} from '@/shared/types/ban-pick';

// ── 로컬 상태 타입 ────────────────────────────────────────────────────────────

interface BanPickData {
  games: Game[];
  sequence: BanTurn[];
  currentSequenceIdx: number;
  bansRemainingInTurn: number;
  currentPlayer: 'first' | 'second' | 'com';
  banCount: number;
  timeLimit: number;
  turnDeadline: number | null;
  bannedGames: BannedGame[];
  banCounts: [number, number];
  players: [{ id: string; nickname: string }, { id: string; nickname: string }];
  phase: 'banning' | 'lottery';
}

// ── 유틸 ─────────────────────────────────────────────────────────────────────

function getKoreanSubjectParticle(word: string): '이' | '가' {
  if (!word) return '이';
  const code = word.charCodeAt(word.length - 1);
  if (code < 0xac00 || code > 0xd7a3) return '이';
  return (code - 0xac00) % 28 === 0 ? '가' : '이';
}

function buildLotterySequence(
  remaining: string[],
  pickedId: string,
): Array<{ id: string; delay: number }> {
  const steps: Array<{ id: string; delay: number }> = [];
  let interval = 80;
  let elapsed = 0;
  let lastId: string | null = null;

  // 빠른 플래시 페이즈 (~1800ms)
  while (elapsed < 1800) {
    const pool = remaining.length > 1 ? remaining.filter((id) => id !== lastId) : remaining;
    const id = pool[Math.floor(Math.random() * pool.length)];
    steps.push({ id, delay: elapsed });
    lastId = id;
    elapsed += interval;
    interval = Math.ceil(interval * 1.07);
  }

  // 감속 페이즈
  for (const extra of [320, 430, 570]) {
    const pool =
      remaining.length > 1
        ? remaining.filter((id) => id !== lastId && id !== pickedId)
        : remaining;
    const id = pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : remaining[0];
    steps.push({ id, delay: elapsed });
    lastId = id;
    elapsed += extra;
  }

  // 최종 착지
  steps.push({ id: pickedId, delay: elapsed });
  return steps;
}

// ── 타이머 ────────────────────────────────────────────────────────────────────

function BanTimer({ deadline, timeLimit }: { deadline: number | null; timeLimit: number }) {
  const [remaining, setRemaining] = useState<number>(0);

  useEffect(() => {
    if (!deadline || timeLimit <= 0) return;
    const tick = () => setRemaining(Math.max(0, (deadline - Date.now()) / 1000));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline, timeLimit]);

  if (timeLimit <= 0) return <span className="text-2xl font-bold text-gray-400">∞</span>;
  if (!deadline) return <span className="text-2xl font-bold text-gray-300">--</span>;

  const secs = Math.ceil(remaining);
  return (
    <span
      className={cn(
        'text-2xl font-mono font-bold tabular-nums',
        secs <= 5 ? 'text-red-500 animate-pulse' : secs <= 10 ? 'text-yellow-500' : 'text-gray-800',
      )}
    >
      {secs}
    </span>
  );
}

// ── 플레이어 패널 (사이드바용) ────────────────────────────────────────────────

function PlayerPanel({
  name,
  banCount,
  maxBan,
  isCurrentTurn,
  isMe,
  tier,
  rp,
  placement,
}: {
  name: string;
  banCount: number;
  maxBan: number;
  isCurrentTurn: boolean;
  isMe: boolean;
  tier?: RankTier;
  rp?: number;
  placement?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        isCurrentTurn
          ? 'border-indigo-300 bg-indigo-50'
          : 'border-gray-200 bg-white',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('truncate text-sm font-semibold', isCurrentTurn ? 'text-indigo-700' : 'text-gray-700')}>
          {isMe ? `${name} (나)` : name}
        </span>
        {isCurrentTurn && (
          <span className="shrink-0 rounded-full bg-indigo-600 px-2 py-0.5 text-xs font-medium text-white">
            밴 중
          </span>
        )}
      </div>
      {tier && (
        <div className="mt-1.5">
          <RankBadge tier={tier} rp={placement ? undefined : rp} size="sm" showRp={!placement} />
        </div>
      )}
      <div className="mt-2 flex items-center gap-1">
        {Array.from({ length: maxBan }).map((_, i) => (
          <div
            key={i}
            className={cn(
              'h-2 flex-1 rounded-full',
              i < banCount ? 'bg-red-400' : 'bg-gray-200',
            )}
          />
        ))}
      </div>
      <p className="mt-1 text-right text-xs text-gray-500">{banCount}/{maxBan}개 밴</p>
    </div>
  );
}

// ── 게임 카드 ─────────────────────────────────────────────────────────────────

function GameCard({
  game,
  ban,
  isPickedByLottery,
  isMyTurn,
  onBan,
}: {
  game: Game;
  ban?: BannedGame;
  isPickedByLottery?: boolean;
  isMyTurn: boolean;
  onBan: (gameId: string) => void;
}) {
  const isBanned = !!ban;
  const bannedByLabel = ban
    ? ban.bannedBy === 'first' ? '선플' : ban.bannedBy === 'second' ? '후플' : 'COM'
    : null;

  // 새로 밴됐을 때만 이펙트 (마운트 시 이미 밴 상태면 스킵)
  const [slashPhase, setSlashPhase] = useState<'idle' | 'active' | 'done'>(
    isBanned ? 'done' : 'idle',
  );
  const wasBannedRef = useRef(isBanned);
  const shakeControls = useAnimation();

  useEffect(() => {
    if (ban && !wasBannedRef.current) {
      wasBannedRef.current = true;
      playBanSfx();
      // 카드 흔들기
      shakeControls.start({
        x: [0, -6, 6, -4, 4, -2, 2, 0],
        transition: { duration: 0.3, ease: 'easeOut' },
      });
      // 슬래시 라인 표시 후 페이드아웃
      setSlashPhase('active');
      const t = setTimeout(() => setSlashPhase('done'), 700);
      return () => clearTimeout(t);
    }
  }, [ban, shakeControls]);

  return (
    <motion.button
      animate={shakeControls}
      onClick={() => !isBanned && isMyTurn && onBan(game.id)}
      disabled={isBanned || !isMyTurn}
      className={cn(
        'relative flex h-16 w-full flex-col items-start justify-center overflow-hidden rounded-xl border px-3 text-left text-sm transition-colors lg:h-14',
        isPickedByLottery && 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300 shadow-md',
        isBanned && 'border-gray-200 bg-gray-50 opacity-40',
        !isBanned && isMyTurn && !isPickedByLottery &&
          'cursor-pointer border-indigo-300 bg-white shadow-sm hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-md active:scale-95',
        !isBanned && !isMyTurn && !isPickedByLottery &&
          'border-gray-200 bg-white cursor-default',
      )}
    >
      {/* 슬래시 이펙트 오버레이 */}
      {slashPhase === 'active' && (
        <>
          {/* 임팩트 플래시 */}
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 bg-white"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
          {/* 슬래시 라인 */}
          <motion.div
            className="pointer-events-none absolute z-20"
            style={{
              height: '2px',
              width: '140%',
              left: '-20%',
              top: '46%',
              rotate: '-10deg',
              transformOrigin: 'left center',
              background: 'linear-gradient(90deg, transparent, #ef4444 20%, #ef4444 80%, transparent)',
              boxShadow: '0 0 8px 2px rgba(239,68,68,0.6)',
            }}
            initial={{ scaleX: 0, opacity: 1 }}
            animate={{ scaleX: 1, opacity: [1, 1, 0] }}
            transition={{ duration: 0.35, ease: [0.2, 0, 0.1, 1], times: [0, 0.6, 1] }}
          />
        </>
      )}

      <span
        className={cn(
          'font-medium leading-tight',
          isBanned ? 'text-gray-400 line-through' : isPickedByLottery ? 'text-yellow-700' : 'text-gray-800',
        )}
      >
        {game.name}
      </span>
      {ban && (
        <span className="mt-0.5 text-xs text-gray-400">
          {ban.isTimeout ? '⏱ 자동 · ' : ''}{bannedByLabel} 밴
        </span>
      )}
      {isPickedByLottery && (
        <span className="mt-0.5 text-xs font-semibold text-yellow-600">⭐ 선택됨</span>
      )}
    </motion.button>
  );
}

// ── 메인 컴포넌트 ─────────────────────────────────────────────────────────────

export default function BanPickGame() {
  const [data, setData] = useState<BanPickData | null>(null);
  const [lottery, setLottery] = useState<BanPickLotteryPayload | null>(null);
  const [readySent, setReadySent] = useState(false);
  const [lotteryReveal, setLotteryReveal] = useState(false);
  const [lotteryHighlight, setLotteryHighlight] = useState<string | null>(null);

  const room = useRoomStore((s) => s.room);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const myId = useMySocketId();
  const rankMatchTiers = useRankMatchStore((s) => s.rankMatchTiers);
  const lotteryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const socket = getSocket();

    const onStart = (payload: BanPickStartPayload) => {
      setData({ ...payload, phase: 'banning' });
      setLottery(null);
      setLotteryReveal(false);
      setLotteryHighlight(null);
      setReadySent(false);
      lotteryTimersRef.current.forEach((t) => clearTimeout(t));
      lotteryTimersRef.current = [];
    };

    const onUpdate = (payload: BanPickUpdatePayload) => {
      setData((prev) => (prev ? { ...prev, ...payload } : null));
    };

    const onLottery = (payload: BanPickLotteryPayload) => {
      setLottery(payload);
      setData((prev) => (prev ? { ...prev, phase: 'lottery' } : null));

      lotteryTimersRef.current.forEach((t) => clearTimeout(t));
      lotteryTimersRef.current = [];

      const steps = buildLotterySequence(payload.remainingGameIds, payload.pickedGameId);
      steps.forEach(({ id, delay }, i) => {
        const isLast = i === steps.length - 1;
        const t = setTimeout(() => {
          setLotteryHighlight(id);
          if (isLast) {
            playLotteryFinalSfx();
            setLotteryReveal(true);
          } else {
            playLotteryPingSfx();
          }
        }, delay);
        lotteryTimersRef.current.push(t);
      });
    };

    socket.on('banpick:start', onStart);
    socket.on('banpick:update', onUpdate);
    socket.on('banpick:lottery', onLottery);

    return () => {
      socket.off('banpick:start', onStart);
      socket.off('banpick:update', onUpdate);
      socket.off('banpick:lottery', onLottery);
      lotteryTimersRef.current.forEach((t) => clearTimeout(t));
      lotteryTimersRef.current = [];
    };
  }, []);

  const myPosition: 'first' | 'second' | null = data
    ? data.players[0].id === myId ? 'first'
    : data.players[1].id === myId ? 'second'
    : null
    : null;

  const isMyTurn =
    !isSpectator &&
    myPosition !== null &&
    data?.phase === 'banning' &&
    data.currentPlayer === myPosition;

  const handleBan = (gameId: string) => {
    if (!isMyTurn) return;
    getSocket().emit('banpick:ban', { gameId });
  };

  const handleReady = () => {
    if (readySent || isSpectator) return;
    setReadySent(true);
    getSocket().emit('banpick:ready');
  };

  if (!data) {
    return (
      <div className="flex h-full items-center justify-center">
        <p className="text-gray-400 text-sm">밴픽 데이터 로딩 중...</p>
      </div>
    );
  }

  const bannedSet = new Map(data.bannedGames.map((b) => [b.gameId, b]));
  const firstName =
    (room?.players.find((p) => p.id === data.players[0].id)?.nickname ?? data.players[0].nickname) || '선플';
  const secondName =
    (room?.players.find((p) => p.id === data.players[1].id)?.nickname ?? data.players[1].nickname) || '후플';

  const firstIsMe = myPosition === 'first';
  const secondIsMe = myPosition === 'second';

  const currentTurnLabel =
    data.currentPlayer === 'com' ? 'COM 밴 중...'
    : data.currentPlayer === 'first' ? `${firstName}의 밴 차례`
    : `${secondName}의 밴 차례`;

  const pickedGame = lottery ? data.games.find((g) => g.id === lottery.pickedGameId) : null;

  const rankBanPickBanner =
    room?.isRanked === true ? (
      <div className="mb-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-center">
        <span className="text-[11px] font-semibold text-amber-900">
          🏆 랭크 게임 · {firstName} vs {secondName}
        </span>
      </div>
    ) : null;

  // ── 공통 상단 상태 바 (모바일 + 데스크탑) ──────────────────────────────────

  const StatusBar = () => {
    if (lotteryReveal && pickedGame) {
      return (
        <motion.div
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 18 }}
          className="rounded-xl border-2 border-yellow-400 bg-yellow-400 px-4 py-3 text-center shadow-lg"
        >
          <p className="text-[11px] font-semibold uppercase tracking-widest text-yellow-900/60">추첨 결과</p>
          <p className="text-2xl font-black leading-tight text-yellow-900">{pickedGame.name}</p>
          <p className="mt-0.5 text-sm font-bold text-yellow-800">
            {pickedGame.name}{getKoreanSubjectParticle(pickedGame.name)} 추첨되었습니다!
          </p>
        </motion.div>
      );
    }

    return (
      <div
        className={cn(
          'flex items-center justify-between gap-3 rounded-xl px-4 py-2.5',
          data.phase === 'lottery'
            ? 'bg-gray-50 border border-gray-200'
            : isMyTurn
            ? 'bg-indigo-50 border border-indigo-200'
            : 'bg-gray-50 border border-gray-200',
        )}
      >
        {data.phase === 'banning' ? (
          <>
            <span className={cn('text-sm font-semibold', isMyTurn ? 'text-indigo-700' : 'text-gray-600')}>
              {isMyTurn
                ? `내 차례${data.bansRemainingInTurn > 1 ? ` (${data.bansRemainingInTurn}개 연속)` : ''}`
                : currentTurnLabel}
            </span>
            {data.timeLimit > 0 && (
              <div className="flex items-center gap-1.5 text-xs text-gray-400">
                <BanTimer deadline={data.turnDeadline} timeLimit={data.timeLimit} />
                <span>초</span>
              </div>
            )}
          </>
        ) : (
          <span className="text-sm font-semibold text-gray-500 w-full text-center">추첨 중...</span>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full overflow-hidden">
      {/* ── 메인 영역 ── */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* 모바일 전용: 상단 정보 */}
        <div className="flex-shrink-0 border-b border-gray-100 bg-white px-3 py-3 lg:hidden">
          {rankBanPickBanner}
          {/* 플레이어 밴 현황 (모바일: compact) */}
          <div className="mb-2.5 flex gap-2">
            {([
              { name: firstName, isMe: firstIsMe, banCount: data.banCounts[0], pos: 'first' as const,
                active: data.currentPlayer === 'first' && data.phase === 'banning' },
              { name: secondName, isMe: secondIsMe, banCount: data.banCounts[1], pos: 'second' as const,
                active: (data.currentPlayer === 'second' || data.currentPlayer === 'com') && data.phase === 'banning' },
            ] as const).map(({ name, isMe, banCount: bc, pos, active }) => {
              const t = rankMatchTiers
                ? (myPosition === pos ? rankMatchTiers.selfTier : myPosition !== null ? rankMatchTiers.opponentTier : undefined)
                : undefined;
              const r = rankMatchTiers
                ? (myPosition === pos ? rankMatchTiers.selfRp : myPosition !== null ? rankMatchTiers.opponentRp : undefined)
                : undefined;
              const isPl = rankMatchTiers
                ? (myPosition === pos ? rankMatchTiers.selfIsPlacement : myPosition !== null ? rankMatchTiers.opponentIsPlacement : undefined)
                : undefined;
              return (
                <div key={pos} className={cn('flex flex-1 flex-col rounded-lg border px-3 py-1.5 text-xs',
                  active ? 'border-indigo-200 bg-indigo-50' : 'border-gray-200 bg-gray-50',
                )}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-700 truncate">{name}{isMe ? ' (나)' : ''}</span>
                    <span className="ml-2 shrink-0 text-gray-500">{bc}/{data.banCount}</span>
                  </div>
                  {t && (
                    <div className="mt-1">
                      <RankBadge tier={t} rp={isPl ? undefined : r} size="sm" showRp={!isPl} />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <StatusBar />
        </div>

        {/* 게임 카드 그리드 */}
        <div className="min-h-0 flex-1 overflow-y-auto p-3 lg:p-5">
          <div className="mx-auto max-w-2xl">
            {/* 데스크탑 전용: 상단 상태 바 */}
            <div className="mb-4 hidden lg:block">
              {rankBanPickBanner}
              <StatusBar />
            </div>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {data.games.map((game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  ban={bannedSet.get(game.id)}
                  isPickedByLottery={
                    lotteryReveal
                      ? lottery?.pickedGameId === game.id
                      : lotteryHighlight === game.id
                  }
                  isMyTurn={isMyTurn && !bannedSet.has(game.id)}
                  onBan={handleBan}
                />
              ))}
            </div>

            {/* 추첨 결과 (모바일: 그리드 하단, 데스크탑: 사이드바) */}
            {data.phase === 'lottery' && (
              <div className="mt-4 lg:hidden">
                {lotteryReveal && pickedGame ? (
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4 }}
                    className="rounded-xl border border-yellow-300 bg-yellow-50 p-4 text-center"
                  >
                    <p className="mb-1 text-xs text-yellow-600">
                      {data.games.filter((g) => !bannedSet.has(g.id)).length}개 게임 중 추첨
                    </p>
                    <p className="text-lg font-bold text-yellow-700">⭐ {pickedGame.name}</p>
                    <p className="mt-0.5 text-xs text-yellow-600">
                      {pickedGame.name}{getKoreanSubjectParticle(pickedGame.name)} 추첨되었습니다!
                    </p>
                    {!isSpectator && (
                      <button
                        onClick={handleReady}
                        disabled={readySent}
                        className={cn(
                          'mt-3 w-full rounded-lg py-2 text-sm font-semibold transition-colors',
                          readySent ? 'bg-gray-100 text-gray-400' : 'bg-indigo-600 text-white hover:bg-indigo-700',
                        )}
                      >
                        {readySent ? '상대방 대기 중...' : '게임 시작'}
                      </button>
                    )}
                  </motion.div>
                ) : (
                  <div className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-gray-50 py-4 text-sm text-gray-400">
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                    추첨 중...
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 데스크탑 사이드바 ── */}
      <div className="hidden lg:flex lg:w-64 lg:flex-col lg:gap-4 lg:border-l lg:border-gray-100 lg:bg-gray-50 lg:p-4">
        {/* 플레이어 패널 */}
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-400">플레이어</h3>
          <PlayerPanel
            name={firstName}
            banCount={data.banCounts[0]}
            maxBan={data.banCount}
            isCurrentTurn={data.currentPlayer === 'first' && data.phase === 'banning'}
            isMe={firstIsMe}
            tier={rankMatchTiers ? (myPosition === 'first' ? rankMatchTiers.selfTier : myPosition === 'second' ? rankMatchTiers.opponentTier : undefined) : undefined}
            rp={rankMatchTiers ? (myPosition === 'first' ? rankMatchTiers.selfRp : myPosition === 'second' ? rankMatchTiers.opponentRp : undefined) : undefined}
            placement={rankMatchTiers ? (myPosition === 'first' ? rankMatchTiers.selfIsPlacement : myPosition === 'second' ? rankMatchTiers.opponentIsPlacement : undefined) : undefined}
          />
          <PlayerPanel
            name={secondName}
            banCount={data.banCounts[1]}
            maxBan={data.banCount}
            isCurrentTurn={(data.currentPlayer === 'second' || data.currentPlayer === 'com') && data.phase === 'banning'}
            isMe={secondIsMe}
            tier={rankMatchTiers ? (myPosition === 'second' ? rankMatchTiers.selfTier : myPosition === 'first' ? rankMatchTiers.opponentTier : undefined) : undefined}
            rp={rankMatchTiers ? (myPosition === 'second' ? rankMatchTiers.selfRp : myPosition === 'first' ? rankMatchTiers.opponentRp : undefined) : undefined}
            placement={rankMatchTiers ? (myPosition === 'second' ? rankMatchTiers.selfIsPlacement : myPosition === 'first' ? rankMatchTiers.opponentIsPlacement : undefined) : undefined}
          />
        </div>

        {/* 타이머 (시간제한 있을 때만) */}
        {data.timeLimit > 0 && data.phase === 'banning' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="mb-1 text-xs text-gray-400">남은 시간</p>
            <BanTimer deadline={data.turnDeadline} timeLimit={data.timeLimit} />
          </div>
        )}

        {/* 밴 시퀀스 */}
        <div className="flex-1">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">밴 순서</h3>
          <div className="space-y-1">
            {data.sequence.map((turn, i) => {
              const isDone = i < data.currentSequenceIdx;
              const isCurrent = i === data.currentSequenceIdx && data.phase === 'banning';
              const label = turn.playerIdx === 0 ? firstName : secondName;
              return (
                <div
                  key={i}
                  className={cn(
                    'flex items-center justify-between rounded-lg px-3 py-1.5 text-xs',
                    isDone && 'bg-gray-100 text-gray-400 line-through',
                    isCurrent && 'bg-indigo-100 font-semibold text-indigo-700',
                    !isDone && !isCurrent && 'bg-white text-gray-600',
                  )}
                >
                  <span className="truncate">{label}</span>
                  <span className="ml-2 shrink-0">{turn.count}밴</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 추첨 결과 패널 (데스크탑) */}
        {data.phase === 'lottery' && (
          <div className="rounded-xl border border-yellow-200 bg-white p-4">
            {lotteryReveal && pickedGame ? (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <p className="mb-1 text-xs text-gray-400 text-center">
                  {data.games.filter((g) => !bannedSet.has(g.id)).length}개 중 추첨
                </p>
                <p className="mb-1 text-center text-base font-bold text-yellow-700">⭐ {pickedGame.name}</p>
                <p className="mb-3 text-center text-xs text-yellow-600">
                  {pickedGame.name}{getKoreanSubjectParticle(pickedGame.name)} 추첨되었습니다!
                </p>
                {!isSpectator && (
                  <button
                    onClick={handleReady}
                    disabled={readySent}
                    className={cn(
                      'w-full rounded-lg py-2.5 text-sm font-semibold transition-colors',
                      readySent ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700',
                    )}
                  >
                    {readySent ? '대기 중...' : '게임 시작'}
                  </button>
                )}
              </motion.div>
            ) : (
              <div className="flex items-center justify-center gap-2 py-2 text-sm text-gray-400">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
                추첨 중...
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
