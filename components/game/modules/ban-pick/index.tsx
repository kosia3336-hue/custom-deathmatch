'use client';

import { useEffect, useRef, useState } from 'react';
import { motion, useAnimation } from 'framer-motion';
import { getSocket } from '@/lib/socket';
import { useRoomStore } from '@/stores/room';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useMySocketId } from '@/hooks/useMySocketId';
import { cn } from '@/lib/utils';
import { playBanSfx, playLotteryPingSfx, playLotteryFinalSfx, playUnbanSfx, playUnbanTurnStartSfx } from '@/lib/audio/synth/general';
import { serverNow } from '@/lib/serverClock';
import { RankBadge } from '@/components/cdm/RankBadge';
import type { Game } from '@/shared/types/game';
import type { RankTier } from '@/shared/types/rank';
import type {
  BanPickStartPayload,
  BanPickUpdatePayload,
  BanPickLotteryPayload,
  BanPickUnbanTurnPayload,
  BanPickUnbanUpdatePayload,
  BannedGame,
  BanTurn,
  GameWinRate,
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
  phase: 'banning' | 'lottery' | 'unban';
  opponentStatsMap: Map<string, GameWinRate>;
}

interface UnbanState {
  queue: Array<'first' | 'second'>;
  currentTurn: 'first' | 'second';
  erasableGameIds: Set<string>;
  turnDeadline: number;
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
    const tick = () => setRemaining(Math.max(0, (deadline - serverNow()) / 1000));
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
  opponentStat,
  isErasable,
  isUnbanMyTurn,
  onUnban,
  justRestored,
}: {
  game: Game;
  ban?: BannedGame;
  isPickedByLottery?: boolean;
  isMyTurn: boolean;
  onBan: (gameId: string) => void;
  opponentStat?: GameWinRate;
  isErasable?: boolean;
  isUnbanMyTurn?: boolean;
  onUnban?: (gameId: string) => void;
  justRestored?: boolean;
}) {
  const isBanned = !!ban;
  const isClickableForUnban = !!isErasable && !!isUnbanMyTurn;
  const isClickableForBan = !isBanned && isMyTurn;
  const isClickable = isClickableForBan || isClickableForUnban;

  const bannedByLabel = ban
    ? ban.bannedBy === 'first' ? '선플' : ban.bannedBy === 'second' ? '후플' : 'COM'
    : null;

  // 새로 밴됐을 때만 이펙트
  const [slashPhase, setSlashPhase] = useState<'idle' | 'active' | 'done'>(
    isBanned ? 'done' : 'idle',
  );
  const wasBannedRef = useRef(isBanned);
  const shakeControls = useAnimation();

  useEffect(() => {
    if (ban && !wasBannedRef.current) {
      wasBannedRef.current = true;
      playBanSfx();
      shakeControls.start({
        x: [0, -6, 6, -4, 4, -2, 2, 0],
        transition: { duration: 0.3, ease: 'easeOut' },
      });
      setSlashPhase('active');
      const t = setTimeout(() => setSlashPhase('done'), 700);
      return () => clearTimeout(t);
    }
  }, [ban, shakeControls]);

  // 복원 이펙트
  const [restorePhase, setRestorePhase] = useState<'idle' | 'active' | 'done'>('idle');
  const prevBanRef = useRef(ban);

  useEffect(() => {
    const wasRestored = !!prevBanRef.current && !ban && !!justRestored;
    prevBanRef.current = ban;
    if (wasRestored) {
      shakeControls.start({
        y: [0, -8, 0],
        transition: { duration: 0.3, ease: 'easeOut' },
      });
      setRestorePhase('active');
      const t = setTimeout(() => setRestorePhase('done'), 700);
      return () => clearTimeout(t);
    }
  }, [ban, justRestored, shakeControls]);

  const winRateColor =
    opponentStat && opponentStat.totalGames > 0
      ? opponentStat.winRate >= 60 ? 'text-red-500'
      : opponentStat.winRate < 40 ? 'text-green-600'
      : 'text-gray-400'
      : 'text-gray-400';

  return (
    <motion.button
      animate={shakeControls}
      onClick={() => {
        if (isClickableForUnban) { onUnban?.(game.id); return; }
        if (isClickableForBan) { onBan(game.id); }
      }}
      disabled={!isClickable}
      className={cn(
        'relative flex w-full flex-col items-start justify-center overflow-hidden rounded-xl border px-3 text-left text-sm transition-colors',
        opponentStat ? 'h-[4.5rem] lg:h-16' : 'h-16 lg:h-14',
        isPickedByLottery && 'border-yellow-400 bg-yellow-50 ring-2 ring-yellow-300 shadow-md',
        // 밴 상태
        isBanned && !isClickableForUnban && 'border-gray-200 bg-gray-50 opacity-40',
        // 밴 삭제 가능 강조
        isBanned && isClickableForUnban && [
          'border-emerald-400 bg-emerald-50 ring-2 ring-emerald-300 cursor-pointer',
          'hover:border-emerald-500 hover:bg-emerald-100',
        ],
        // 일반 밴 차례 (내 턴)
        !isBanned && isMyTurn && !isPickedByLottery && [
          'cursor-pointer border-indigo-300 bg-white shadow-sm',
          'hover:border-indigo-500 hover:bg-indigo-50 hover:shadow-md active:scale-95',
        ],
        // 비활성 (내 턴 아님)
        !isBanned && !isMyTurn && !isPickedByLottery && 'border-gray-200 bg-white cursor-default',
      )}
    >
      {/* 밴 슬래시 이펙트 */}
      {slashPhase === 'active' && (
        <>
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 bg-white"
            initial={{ opacity: 0.6 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
          />
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

      {/* 복원 이펙트 */}
      {restorePhase === 'active' && (
        <>
          <motion.div
            className="pointer-events-none absolute inset-0 z-20 bg-emerald-400"
            initial={{ opacity: 0.5 }}
            animate={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          />
          <motion.div
            className="pointer-events-none absolute z-20"
            style={{
              height: '2px',
              width: '140%',
              left: '-20%',
              top: '46%',
              rotate: '-10deg',
              transformOrigin: 'right center',
              background: 'linear-gradient(90deg, transparent, #10b981 20%, #10b981 80%, transparent)',
              boxShadow: '0 0 8px 2px rgba(16,185,129,0.6)',
            }}
            initial={{ scaleX: 1, opacity: 1 }}
            animate={{ scaleX: 0, opacity: [1, 1, 0] }}
            transition={{ duration: 0.2, ease: [0.2, 0, 0.1, 1], times: [0, 0.5, 1] }}
          />
        </>
      )}

      <span
        className={cn(
          'font-medium leading-tight',
          isBanned && !isClickableForUnban ? 'text-gray-400 line-through'
          : isBanned && isClickableForUnban ? 'text-emerald-700 line-through'
          : isPickedByLottery ? 'text-yellow-700'
          : 'text-gray-800',
        )}
      >
        {game.name}
      </span>
      {ban && (
        <span className={cn('mt-0.5 text-xs', isClickableForUnban ? 'text-emerald-600' : 'text-gray-400')}>
          {ban.isTimeout ? '자동 · ' : ''}{bannedByLabel} 밴
          {isClickableForUnban && ' · 클릭하여 취소'}
        </span>
      )}
      {isPickedByLottery && (
        <span className="mt-0.5 text-xs font-semibold text-yellow-600">선택됨</span>
      )}
      {opponentStat && !ban && !isPickedByLottery && (
        <span className={cn('mt-0.5 text-[10px] font-medium', winRateColor)}>
          {opponentStat.totalGames === 0
            ? '전적 없음'
            : `${opponentStat.totalGames}전 ${opponentStat.wins}승 ${opponentStat.losses}패 ${opponentStat.winRate}%`}
        </span>
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
  const [unbanState, setUnbanState] = useState<UnbanState | null>(null);
  const [restoredGameIds, setRestoredGameIds] = useState<Set<string>>(new Set());
  const [nobanFeedback, setNobanFeedback] = useState<'first' | 'second' | null>(null);

  const room = useRoomStore((s) => s.room);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const myId = useMySocketId();
  const rankMatchTiers = useRankMatchStore((s) => s.rankMatchTiers);
  const lotteryTimersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const restoredTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  const nobanFeedbackTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('game:sync');

    const onStart = (payload: BanPickStartPayload) => {
      const opponentStatsMap = new Map<string, GameWinRate>(
        (payload.opponentGameStats ?? []).map((s) => [s.gameId, s]),
      );
      setData({ ...payload, phase: 'banning', opponentStatsMap });
      setLottery(null);
      setLotteryReveal(false);
      setLotteryHighlight(null);
      setReadySent(false);
      setUnbanState(null);
      setRestoredGameIds(new Set());
      setNobanFeedback(null);
      if (nobanFeedbackTimerRef.current) { clearTimeout(nobanFeedbackTimerRef.current); nobanFeedbackTimerRef.current = null; }
      restoredTimersRef.current.forEach((t) => clearTimeout(t));
      restoredTimersRef.current.clear();
      lotteryTimersRef.current.forEach((t) => clearTimeout(t));
      lotteryTimersRef.current = [];
    };

    const onUpdate = (payload: BanPickUpdatePayload) => {
      setData((prev) => (prev ? { ...prev, ...payload } : null));
      if (payload.lastNobanBy) {
        setNobanFeedback(payload.lastNobanBy);
        if (nobanFeedbackTimerRef.current) clearTimeout(nobanFeedbackTimerRef.current);
        nobanFeedbackTimerRef.current = setTimeout(() => {
          setNobanFeedback(null);
          nobanFeedbackTimerRef.current = null;
        }, 2000);
      }
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

    const onUnbanTurn = (payload: BanPickUnbanTurnPayload) => {
      setData((prev) => {
        if (!prev) return null;
        const myPos =
          prev.players[0].id === myId ? 'first'
          : prev.players[1].id === myId ? 'second'
          : null;
        if (!isSpectator && myPos === payload.currentTurn) {
          playUnbanTurnStartSfx();
        }
        return { ...prev, phase: 'unban' };
      });
      setUnbanState({
        queue: payload.queue,
        currentTurn: payload.currentTurn,
        erasableGameIds: new Set(payload.erasableGames.map((g) => g.gameId)),
        turnDeadline: payload.turnDeadline,
      });
    };

    const onUnbanUpdate = (payload: BanPickUnbanUpdatePayload) => {
      if (payload.erasedGameId) {
        const id = payload.erasedGameId;
        playUnbanSfx();
        setRestoredGameIds((prev) => new Set([...prev, id]));
        setData((prev) =>
          prev ? { ...prev, bannedGames: prev.bannedGames.filter((b) => b.gameId !== id) } : null,
        );
        const prev = restoredTimersRef.current.get(id);
        if (prev) clearTimeout(prev);
        const t = setTimeout(() => {
          setRestoredGameIds((s) => {
            const next = new Set(s);
            next.delete(id);
            return next;
          });
          restoredTimersRef.current.delete(id);
        }, 800);
        restoredTimersRef.current.set(id, t);
      }

      if (payload.currentTurn === null) {
        setUnbanState(null);
        setData((prev) => (prev ? { ...prev, phase: 'lottery' } : null));
      } else {
        setUnbanState((prev) =>
          prev
            ? {
                ...prev,
                currentTurn: payload.currentTurn!,
                erasableGameIds: new Set(),
                turnDeadline: payload.turnDeadline ?? serverNow() + 15_000,
              }
            : null,
        );
      }
    };

    socket.on('banpick:start', onStart);
    socket.on('banpick:update', onUpdate);
    socket.on('banpick:lottery', onLottery);
    socket.on('banpick:unban_turn', onUnbanTurn);
    socket.on('banpick:unban_update', onUnbanUpdate);

    return () => {
      socket.off('banpick:start', onStart);
      socket.off('banpick:update', onUpdate);
      socket.off('banpick:lottery', onLottery);
      socket.off('banpick:unban_turn', onUnbanTurn);
      socket.off('banpick:unban_update', onUnbanUpdate);
      lotteryTimersRef.current.forEach((t) => clearTimeout(t));
      lotteryTimersRef.current = [];
      restoredTimersRef.current.forEach((t) => clearTimeout(t));
      restoredTimersRef.current.clear();
      if (nobanFeedbackTimerRef.current) { clearTimeout(nobanFeedbackTimerRef.current); nobanFeedbackTimerRef.current = null; }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const isMyUnbanTurn =
    !isSpectator &&
    myPosition !== null &&
    data?.phase === 'unban' &&
    unbanState?.currentTurn === myPosition;

  const handleBan = (gameId: string) => {
    if (!isMyTurn) return;
    getSocket().emit('banpick:ban', { gameId });
  };

  const handleNoBan = () => {
    if (!isMyTurn) return;
    getSocket().emit('banpick:noban');
  };

  const handleUnban = (gameId: string) => {
    if (!isMyUnbanTurn) return;
    getSocket().emit('banpick:unban', { gameId });
  };

  const handleUnbanSkip = () => {
    if (!isMyUnbanTurn) return;
    getSocket().emit('banpick:unban_skip');
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
          랭크 게임 · {firstName} vs {secondName}
        </span>
      </div>
    ) : null;

  // ── 공통 상단 상태 바 ──────────────────────────────────────────────────────

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

    if (data.phase === 'unban' && unbanState) {
      const turnLabel = unbanState.currentTurn === 'first' ? firstName : secondName;
      return (
        <div
          className={cn(
            'rounded-xl px-4 py-2.5',
            isMyUnbanTurn
              ? 'bg-emerald-50 border border-emerald-200'
              : 'bg-gray-50 border border-gray-200',
          )}
        >
          {isMyUnbanTurn ? (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-emerald-700">
                밴 삭제 — 상대 밴을 1개 취소할 수 있습니다
              </span>
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <BanTimer deadline={unbanState.turnDeadline} timeLimit={15} />
                  <span>초</span>
                </div>
                <button
                  onClick={handleUnbanSkip}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50 active:scale-95 transition-transform"
                >
                  스킵
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <span className="text-sm font-semibold text-gray-500">
                {turnLabel}의 밴 삭제 선택 중...
              </span>
              <div className="flex items-center gap-1 text-xs text-gray-400">
                <BanTimer deadline={unbanState.turnDeadline} timeLimit={15} />
                <span>초</span>
              </div>
            </div>
          )}
        </div>
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
            <span className={cn(
              'text-sm font-semibold min-w-0 truncate',
              nobanFeedback ? 'text-gray-500'
              : isMyTurn ? 'text-indigo-700'
              : 'text-gray-600',
            )}>
              {nobanFeedback
                ? `${nobanFeedback === 'first' ? firstName : secondName} 노밴`
                : isMyTurn
                ? `내 차례${data.bansRemainingInTurn > 1 ? ` (${data.bansRemainingInTurn}개 연속)` : ''}`
                : currentTurnLabel}
            </span>
            <div className="flex shrink-0 items-center gap-2">
              {data.timeLimit > 0 && (
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <BanTimer deadline={data.turnDeadline} timeLimit={data.timeLimit} />
                  <span>초</span>
                </div>
              )}
              {isMyTurn && (
                <button
                  onClick={handleNoBan}
                  className="rounded-lg border border-gray-300 bg-white px-2.5 py-1 text-xs font-medium text-gray-500 hover:bg-gray-50 active:scale-95 transition-transform shrink-0"
                >
                  노밴
                </button>
              )}
            </div>
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
                ? (myPosition === pos ? rankMatchTiers.selfTier : myPosition !== null ? (rankMatchTiers.opponentTier ?? undefined) : undefined)
                : undefined;
              const r = rankMatchTiers
                ? (myPosition === pos ? rankMatchTiers.selfRp : myPosition !== null ? (rankMatchTiers.opponentRp ?? undefined) : undefined)
                : undefined;
              const isPl = rankMatchTiers
                ? (myPosition === pos ? rankMatchTiers.selfIsPlacement : myPosition !== null ? (rankMatchTiers.opponentIsPlacement ?? undefined) : undefined)
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
              {data.games.map((game) => {
                const isErasable =
                  data.phase === 'unban' && unbanState != null
                    ? unbanState.erasableGameIds.has(game.id)
                    : false;
                return (
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
                    opponentStat={data.opponentStatsMap.get(game.id)}
                    isErasable={isErasable}
                    isUnbanMyTurn={isMyUnbanTurn}
                    onUnban={handleUnban}
                    justRestored={restoredGameIds.has(game.id)}
                  />
                );
              })}
            </div>

            {/* 추첨 결과 (모바일: 그리드 하단) */}
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
                    <p className="text-lg font-bold text-yellow-700">{pickedGame.name}</p>
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
            tier={rankMatchTiers ? (myPosition === 'first' ? rankMatchTiers.selfTier : myPosition === 'second' ? (rankMatchTiers.opponentTier ?? undefined) : undefined) : undefined}
            rp={rankMatchTiers ? (myPosition === 'first' ? rankMatchTiers.selfRp : myPosition === 'second' ? (rankMatchTiers.opponentRp ?? undefined) : undefined) : undefined}
            placement={rankMatchTiers ? (myPosition === 'first' ? rankMatchTiers.selfIsPlacement : myPosition === 'second' ? (rankMatchTiers.opponentIsPlacement ?? undefined) : undefined) : undefined}
          />
          <PlayerPanel
            name={secondName}
            banCount={data.banCounts[1]}
            maxBan={data.banCount}
            isCurrentTurn={(data.currentPlayer === 'second' || data.currentPlayer === 'com') && data.phase === 'banning'}
            isMe={secondIsMe}
            tier={rankMatchTiers ? (myPosition === 'second' ? rankMatchTiers.selfTier : myPosition === 'first' ? (rankMatchTiers.opponentTier ?? undefined) : undefined) : undefined}
            rp={rankMatchTiers ? (myPosition === 'second' ? rankMatchTiers.selfRp : myPosition === 'first' ? (rankMatchTiers.opponentRp ?? undefined) : undefined) : undefined}
            placement={rankMatchTiers ? (myPosition === 'second' ? rankMatchTiers.selfIsPlacement : myPosition === 'first' ? (rankMatchTiers.opponentIsPlacement ?? undefined) : undefined) : undefined}
          />
        </div>

        {/* 타이머 (시간제한 있을 때만, 밴 단계) */}
        {data.timeLimit > 0 && data.phase === 'banning' && (
          <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
            <p className="mb-1 text-xs text-gray-400">남은 시간</p>
            <BanTimer deadline={data.turnDeadline} timeLimit={data.timeLimit} />
          </div>
        )}

        {/* 밴 삭제 타이머 (데스크탑 사이드바) */}
        {data.phase === 'unban' && unbanState && (
          <div className={cn(
            'rounded-xl border p-4 text-center',
            isMyUnbanTurn ? 'border-emerald-200 bg-emerald-50' : 'border-gray-200 bg-white',
          )}>
            <p className={cn('mb-1 text-xs', isMyUnbanTurn ? 'text-emerald-600' : 'text-gray-400')}>
              {isMyUnbanTurn ? '밴 삭제 선택 시간' : '밴 삭제 대기 중'}
            </p>
            <BanTimer deadline={unbanState.turnDeadline} timeLimit={15} />
            {isMyUnbanTurn && (
              <button
                onClick={handleUnbanSkip}
                className="mt-3 w-full rounded-lg border border-gray-300 bg-white py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors"
              >
                스킵 (아이템 유지)
              </button>
            )}
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
                <p className="mb-1 text-center text-base font-bold text-yellow-700">{pickedGame.name}</p>
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
