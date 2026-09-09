'use client';

import { useEffect, useState } from 'react';
import { RankBadge } from '@/components/cdm/RankBadge';
import { getSocket } from '@/lib/socket';
import { playBanSfx } from '@/lib/sfx';
import { cn } from '@/lib/utils';
import { useMySocketId } from '@/hooks/useMySocketId';
import { useRoomStore } from '@/stores/room';
import { useRankMatchStore } from '@/stores/rankMatch';
import type { Game } from '@/shared/types/game';
import type { GameWinRate } from '@/shared/types/ban-pick';
import type { CounterBanViewPayload } from '@/shared/types/counter-ban';
import type { RankTier } from '@/shared/types/rank';

export default function CounterBanGame() {
  const [view, setView] = useState<CounterBanViewPayload | null>(null);
  const isSpectator = useRoomStore((s) => s.isSpectator);
  const myId = useMySocketId();
  const rankMatchTiers = useRankMatchStore((s) => s.rankMatchTiers);

  useEffect(() => {
    const socket = getSocket();
    socket.emit('game:sync');
    const apply = (payload: CounterBanViewPayload) => setView(payload);
    socket.on('counterban:start', apply);
    socket.on('counterban:update', apply);
    return () => {
      socket.off('counterban:start', apply);
      socket.off('counterban:update', apply);
    };
  }, []);

  const handleBan = (gameId: string) => {
    if (!view || view.phase !== 'picking' || view.myPick || isSpectator) return;
    playBanSfx();
    getSocket().emit('counterban:ban', { gameId });
  };

  if (!view) {
    return (
      <div className="hidden-ban-stage relative flex h-full min-h-0 flex-1 items-center justify-center">
        <p className="relative z-1 text-sm text-cdm-ink-fg-muted">밴픽 대기 중...</p>
      </div>
    );
  }

  const statsMap = new Map((view.opponentGameStats ?? []).map((s) => [s.gameId, s]));
  const gone = new Set(view.goneIds);
  const slotH = statsMap.size > 0 ? 'h-[4.5rem] lg:h-16' : 'h-16 lg:h-14';
  const pickedId = view.keepId;
  const pickedName = view.games.find((g) => g.id === pickedId)?.name ?? '';
  const remainingCount = view.remainingIds.length;
  const oppId = view.players.find((p) => p.id !== myId)?.id;
  const revealed = view.revealedPicks;
  const myRevealed = revealed?.[myId];
  const oppRevealed = oppId ? revealed?.[oppId] : undefined;

  const status = (() => {
    if (view.phase === 'forfeit') return '시간 초과 · 패배';
    if (view.phase === 'empty') return '남는 게임 없음';
    if (view.phase === 'last') return `남은 1개 · ${pickedName}`;
    if (view.phase === 'overlap') return `같은 게임 · ${pickedName}`;
    if (view.phase === 'burning' && view.keepId) return '확정';
    if (view.phase === 'burning') return '제외';
    if (view.phase === 'reveal') return '공개';
    if (view.myPick) return '선택됨 · 상대 대기';
    return '동시에 1밴 · 비공개';
  })();

  const selfName = view.players.find((p) => p.id === myId)?.nickname ?? '나';
  const oppName = view.players.find((p) => p.id !== myId)?.nickname ?? '상대';

  return (
    <div className="hidden-ban-stage relative flex h-full min-h-0 flex-1 overflow-hidden">
      <div className="relative z-1 flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="flex-shrink-0 border-b border-cdm-ink-border px-3 py-3 lg:hidden">
          <Banner round={view.round} left={remainingCount} />
          <div className="mb-2.5 flex gap-2">
            <MiniPlayer
              name={selfName}
              isMe
              locked={Boolean(view.myPick)}
              active={view.phase === 'picking'}
              tier={rankMatchTiers?.selfTier}
              rp={rankMatchTiers?.selfRp}
              placement={rankMatchTiers?.selfIsPlacement === true}
            />
            <MiniPlayer
              name={oppName}
              isMe={false}
              locked={Boolean(oppRevealed)}
              active={view.phase === 'picking'}
              tier={rankMatchTiers?.opponentTier ?? undefined}
              hideRp
            />
          </div>
          <StatusBar status={status} phase={view.phase} deadline={view.deadline} pickedName={pickedName} />
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-3 pb-24 lg:p-5 lg:pb-24">
          <div className="mx-auto max-w-2xl">
            <div className="mb-4 hidden lg:block">
              <Banner round={view.round} left={remainingCount} />
              <StatusBar status={status} phase={view.phase} deadline={view.deadline} pickedName={pickedName} />
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {view.games.map((game, i) => {
                const burning = view.burningIds.includes(game.id);
                if (gone.has(game.id) && !burning) {
                  return <div key={game.id} className={slotH} aria-hidden />;
                }
                const isMine = view.myPick === game.id || myRevealed === game.id;
                const isOpp = oppRevealed === game.id;
                const highlighted = pickedId === game.id;
                const clickable =
                  view.phase === 'picking' &&
                  !view.myPick &&
                  !isSpectator &&
                  view.remainingIds.includes(game.id);
                const stat = statsMap.get(game.id);
                const burnDelay = burning ? view.burningIds.indexOf(game.id) * 90 : 0;
                return (
                  <GameCard
                    key={game.id}
                    game={game}
                    burning={burning}
                    burnDelayMs={burnDelay}
                    highlighted={highlighted}
                    clickable={clickable}
                    pickingMine={isMine && view.phase === 'picking'}
                    myMark={Boolean(revealed && isMine && !isOpp)}
                    oppMark={Boolean(revealed && isOpp && !isMine)}
                    sameMark={Boolean(revealed && isMine && isOpp)}
                    stat={stat}
                    slotH={slotH}
                    onBan={handleBan}
                    z={view.games.length - i}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>

      <div className="relative z-1 hidden lg:flex lg:w-64 lg:flex-col lg:gap-4 lg:border-l lg:border-cdm-ink-border lg:bg-[color-mix(in_srgb,var(--cdm-ink-strong)_55%,transparent)] lg:p-4">
        <div className="space-y-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-cdm-ink-fg-muted">플레이어</h3>
          <SidePlayer
            name={selfName}
            isMe
            locked={Boolean(view.myPick)}
            active={view.phase === 'picking'}
            tier={rankMatchTiers?.selfTier}
            rp={rankMatchTiers?.selfRp}
            placement={rankMatchTiers?.selfIsPlacement === true}
          />
          <SidePlayer
            name={oppName}
            isMe={false}
            locked={Boolean(oppRevealed)}
            active={view.phase === 'picking'}
            tier={rankMatchTiers?.opponentTier ?? undefined}
            hideRp
          />
        </div>
        {view.phase === 'picking' && view.deadline ? (
          <div className="rounded-xl border border-cdm-ink-border bg-[color-mix(in_srgb,var(--cdm-ink-strong)_70%,transparent)] p-4 text-center">
            <p className="mb-1 text-xs text-cdm-ink-fg-muted">남은 시간</p>
            <BanTimer deadline={view.deadline} />
          </div>
        ) : null}
      </div>
    </div>
  );
}

function BanTimer({ deadline }: { deadline: number }) {
  const [remaining, setRemaining] = useState(0);
  useEffect(() => {
    const tick = () => setRemaining(Math.max(0, (deadline - Date.now()) / 1000));
    tick();
    const id = setInterval(tick, 200);
    return () => clearInterval(id);
  }, [deadline]);
  const secs = Math.ceil(remaining);
  return (
    <span
      className={cn(
        'text-2xl font-mono font-bold tabular-nums',
        secs <= 5 ? 'text-cdm-accent animate-pulse' : secs <= 10 ? 'text-cdm-highlight' : 'text-cdm-ink-fg',
      )}
    >
      {secs}
    </span>
  );
}

function GameCard({
  game,
  burning,
  burnDelayMs,
  highlighted,
  clickable,
  pickingMine,
  myMark,
  oppMark,
  sameMark,
  stat,
  slotH,
  onBan,
  z,
}: {
  game: Game;
  burning: boolean;
  burnDelayMs: number;
  highlighted: boolean;
  clickable: boolean;
  pickingMine: boolean;
  myMark: boolean;
  oppMark: boolean;
  sameMark: boolean;
  stat?: GameWinRate;
  slotH: string;
  onBan: (id: string) => void;
  z: number;
}) {
  const winRateColor =
    stat && stat.totalGames > 0
      ? stat.winRate >= 60
        ? 'text-cdm-accent'
        : stat.winRate < 40
          ? 'text-emerald-400'
          : 'text-cdm-ink-fg-muted'
      : 'text-cdm-ink-fg-muted';

  return (
    <div
      className={cn('hidden-ban-wrap', burning && 'hidden-ban-wrap--burn')}
      style={{
        zIndex: burning ? z : undefined,
        ['--hidden-ban-burn-delay' as string]: `${burnDelayMs}ms`,
      }}
    >
      <button
        type="button"
        onClick={() => onBan(game.id)}
        disabled={!clickable}
        className={cn(
          'hidden-ban-card relative flex w-full flex-col items-start justify-center overflow-hidden rounded-xl border px-3 text-left text-sm transition-colors',
          slotH,
          highlighted && 'hidden-ban-card--keep',
          burning && 'hidden-ban-card--burn',
          clickable && 'cursor-pointer active:scale-95',
          !clickable && !highlighted && !burning && 'cursor-default',
          pickingMine && 'hidden-ban-card--picked',
        )}
      >
        <span className={cn('relative z-1 font-medium leading-tight', highlighted ? 'text-yellow-200' : 'text-cdm-ink-fg')}>
          {game.name}
        </span>
        {highlighted ? (
          <span className="relative z-1 mt-0.5 text-xs font-semibold text-yellow-300">선택됨</span>
        ) : pickingMine ? (
          <span className="relative z-1 mt-0.5 text-xs text-cdm-accent-soft">내 선택</span>
        ) : sameMark ? (
          <span className="relative z-1 mt-0.5 text-xs text-cdm-ink-fg-muted">둘 다</span>
        ) : myMark ? (
          <span className="relative z-1 mt-0.5 text-xs text-cdm-ink-fg-muted">나</span>
        ) : oppMark ? (
          <span className="relative z-1 mt-0.5 text-xs text-cdm-ink-fg-muted">상대</span>
        ) : null}
        {stat && !highlighted ? (
          <span className={cn('relative z-1 mt-0.5 text-[10px] font-medium', winRateColor)}>
            {stat.totalGames === 0
              ? '전적 없음'
              : `${stat.totalGames}전 ${stat.wins}승 ${stat.losses}패 ${stat.winRate}%`}
          </span>
        ) : null}
      </button>
      {burning ? (
        <>
          <span className="hidden-ban-flame-front" aria-hidden />
          <span className="hidden-ban-ember" aria-hidden />
          <span className="hidden-ban-ember" aria-hidden />
          <span className="hidden-ban-ember" aria-hidden />
        </>
      ) : null}
    </div>
  );
}

function Banner({ round, left }: { round: number; left: number }) {
  return (
    <div className="mb-2 rounded-lg border border-cdm-ink-border bg-[color-mix(in_srgb,var(--title-wine)_48%,var(--cdm-ink))] px-3 py-2 text-center">
      <span className="text-[11px] font-semibold text-cdm-ink-fg">
        카운터 매치 · 라운드 {round} · 남은 {left}개
      </span>
    </div>
  );
}

function StatusBar({
  status,
  phase,
  deadline,
  pickedName,
}: {
  status: string;
  phase: CounterBanViewPayload['phase'];
  deadline: number | null;
  pickedName: string;
}) {
  if (phase === 'overlap' || phase === 'last') {
    return (
      <div className="rounded-xl border-2 border-yellow-400 bg-yellow-400 px-4 py-3 text-center shadow-lg">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-yellow-900/60">
          {phase === 'last' ? '남은 1개' : '같은 게임'}
        </p>
        <p className="text-2xl font-black leading-tight text-yellow-900">{pickedName}</p>
        <p className="mt-0.5 text-sm font-bold text-yellow-800">이 게임으로 진행</p>
      </div>
    );
  }
  if (phase === 'forfeit') {
    return (
      <div className="rounded-xl border border-cdm-accent/50 bg-[color-mix(in_srgb,var(--title-wine)_55%,var(--cdm-ink))] px-4 py-3 text-center">
        <p className="text-sm font-semibold text-cdm-accent-soft">시간 초과 · 패배</p>
      </div>
    );
  }
  return (
    <div
      className={cn(
        'flex items-center justify-between gap-3 rounded-xl border px-4 py-2.5',
        phase === 'picking'
          ? 'border-cdm-accent/40 bg-[color-mix(in_srgb,var(--title-wine)_42%,var(--cdm-ink))]'
          : 'border-cdm-ink-border bg-[color-mix(in_srgb,var(--cdm-ink-strong)_55%,transparent)]',
      )}
    >
      <span className={cn('min-w-0 truncate text-sm font-semibold', phase === 'picking' ? 'text-cdm-ink-fg' : 'text-cdm-ink-fg-muted')}>
        {status}
      </span>
      {phase === 'picking' && deadline ? (
        <div className="flex shrink-0 items-center gap-1 text-xs text-cdm-ink-fg-muted">
          <BanTimer deadline={deadline} />
          <span>초</span>
        </div>
      ) : null}
    </div>
  );
}

function MiniPlayer({
  name,
  isMe,
  locked,
  active,
  tier,
  rp,
  placement,
  hideRp,
}: {
  name: string;
  isMe: boolean;
  locked: boolean;
  active: boolean;
  tier?: RankTier | null;
  rp?: number;
  placement?: boolean;
  hideRp?: boolean;
}) {
  return (
    <div
      className={cn(
        'flex flex-1 flex-col rounded-lg border px-3 py-1.5 text-xs',
        active
          ? 'border-cdm-accent/40 bg-[color-mix(in_srgb,var(--title-wine)_42%,var(--cdm-ink))]'
          : 'border-cdm-ink-border bg-[color-mix(in_srgb,var(--cdm-ink-strong)_50%,transparent)]',
      )}
    >
      <div className="flex items-center justify-between">
        <span className="truncate font-medium text-cdm-ink-fg">
          {name}
          {isMe ? ' (나)' : ''}
        </span>
        <span className="ml-2 shrink-0 text-cdm-ink-fg-muted">{locked ? '1/1' : '0/1'}</span>
      </div>
      {tier ? (
        <div className="mt-1">
          <RankBadge tier={tier} rp={placement || hideRp ? undefined : rp} size="sm" showRp={!placement && !hideRp} />
        </div>
      ) : null}
    </div>
  );
}

function SidePlayer({
  name,
  isMe,
  locked,
  active,
  tier,
  rp,
  placement,
  hideRp,
}: {
  name: string;
  isMe: boolean;
  locked: boolean;
  active: boolean;
  tier?: RankTier | null;
  rp?: number;
  placement?: boolean;
  hideRp?: boolean;
}) {
  return (
    <div
      className={cn(
        'rounded-xl border p-3 transition-colors',
        active
          ? 'border-cdm-accent/50 bg-[color-mix(in_srgb,var(--title-wine)_42%,var(--cdm-ink))]'
          : 'border-cdm-ink-border bg-[color-mix(in_srgb,var(--cdm-ink-strong)_55%,transparent)]',
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className={cn('truncate text-sm font-semibold', active ? 'text-cdm-ink-fg' : 'text-cdm-ink-fg-muted')}>
          {isMe ? `${name} (나)` : name}
        </span>
        {active && !locked ? (
          <span className="shrink-0 rounded-full bg-cdm-accent px-2 py-0.5 text-xs font-medium text-white">밴 중</span>
        ) : null}
      </div>
      {tier ? (
        <div className="mt-1.5">
          <RankBadge tier={tier} rp={placement || hideRp ? undefined : rp} size="sm" showRp={!placement && !hideRp} />
        </div>
      ) : null}
      <div className="mt-2 flex items-center gap-1">
        <div className={cn('h-2 flex-1 rounded-full', locked ? 'bg-cdm-accent' : 'bg-cdm-ink-border')} />
      </div>
      <p className="mt-1 text-right text-xs text-cdm-ink-fg-muted">{locked ? '1' : '0'}/1개 밴</p>
    </div>
  );
}
