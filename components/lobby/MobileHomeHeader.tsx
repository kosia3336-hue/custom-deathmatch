'use client';

/**
 * 모바일 홈(로비) 상단 헤더 — 앱 재설계안 적용.
 *
 * 디자인 결정: 1c(리스트형 밀도) 위에 1b 의 랭크 카드를 얹는다.
 * - ink(#14142b) 헤더 위에 랭크 카드 하나로 "내 시즌 상태 + 다음 행동"을 모은다.
 * - 랭크 매칭은 카드 안에 있으므로, 아래 행동 줄은 빠른 입장 / 방 만들기 둘만 둔다.
 * - 방 목록 필터는 1c 의 칩 줄로 옮겼다.
 *
 * 데스크톱에서는 렌더하지 않는다(기존 ActionBar 가 그대로 담당).
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { getSocket } from '@/lib/socket';
import { useCurrentMember } from '@/hooks/useCurrentMember';
import { useLobbyStore, type TabFilter } from '@/stores/lobby';
import { useRankMatchStore } from '@/stores/rankMatch';
import { useNicknameStore } from '@/stores/nickname';
import { useLobbyChatStore } from '@/stores/lobbyChat';
import { isRankQueueAcceptingNewJoins, isRankQueueOpen } from '@shared/rank/kst';
import type { RankTier } from '@shared/types/rank';
import type { JoinRoomResult } from '@/shared/types';
import { cn } from '@/lib/utils';

interface Props {
  onCreateRoom: () => void;
}

const TIER_LABEL: Record<RankTier, string> = {
  unranked: '언랭크',
  bronze: '브론즈',
  silver: '실버',
  gold: '골드',
  diamond: '다이아',
  challenger: '챌린저',
};

/** 다음 티어와 승급까지 남은 RP. 챌린저는 상한이 없어 null. */
const NEXT_TIER: Partial<Record<RankTier, { label: string; at: number }>> = {
  bronze: { label: '실버', at: 100 },
  silver: { label: '골드', at: 100 },
  gold: { label: '다이아', at: 100 },
  diamond: { label: '챌린저', at: 150 },
};

interface RankStats {
  tier: RankTier;
  rp: number;
  placement_done: boolean;
  placement_games: number;
  win_streak: number;
}

interface RankResponse {
  season: { id: number; name: string } | null;
  stats: RankStats | null;
}

export default function MobileHomeHeader({ onCreateRoom }: Props) {
  const router = useRouter();
  const { member } = useCurrentMember();
  const requireNickname = useNicknameStore((s) => s.requireNickname);
  const queuing = useRankMatchStore((s) => s.queuing);
  const setQueuing = useRankMatchStore((s) => s.setQueuing);

  const { tabFilters, toggleTabFilter, clearFilters, rooms } = useLobbyStore();

  const [rank, setRank] = useState<RankResponse | null>(null);
  const [cdp, setCdp] = useState<number | null>(null);
  const [quickJoining, setQuickJoining] = useState(false);

  useEffect(() => {
    if (!member) {
      setRank(null);
      setCdp(null);
      return;
    }
    fetch('/api/me/rank')
      .then((r) => r.json())
      .then((d: RankResponse) => setRank(d))
      .catch(() => {});
    fetch('/api/me/cdp')
      .then((r) => r.json())
      .then((d: { balance?: number }) => setCdp(d.balance ?? 0))
      .catch(() => {});
  }, [member?.id]);

  const stats = rank?.stats ?? null;
  const tier: RankTier = stats?.tier ?? 'unranked';
  const rp = stats?.rp ?? 0;
  const next = NEXT_TIER[tier];
  // 언랭크(배치 전)는 진행률이 의미 없다 — 0 으로 두고 안내 문구로 대체한다.
  const progress = tier === 'unranked' ? 0 : next ? Math.min(100, Math.round((rp / next.at) * 100)) : 100;
  const inPlacement = stats != null && !stats.placement_done;

  const waitingCount = rooms.filter((r) => r.status === 'waiting').length;

  const handleRank = () => {
    if (queuing) return;
    if (!member) {
      toast.error('랭크 게임은 로그인 후 이용할 수 있습니다.');
      return;
    }
    if (!isRankQueueOpen() || !isRankQueueAcceptingNewJoins()) {
      toast.error('랭크 운영 시간이 아닙니다. (평일 21:00~익일 01:00 KST / 주말 24시간)');
      return;
    }
    setQueuing(true);
    getSocket().emit('rank:queue:join', (res: { success: boolean; error?: string }) => {
      if (!res.success) {
        toast.error(res.error ?? '랭크 큐 참여에 실패했습니다.');
        setQueuing(false);
      } else {
        toast.success('랭크 매칭을 시작합니다.');
      }
    });
  };

  const handleQuickJoin = () => {
    if (queuing) {
      toast.error('랭크 큐 대기 중에는 게임에 참가할 수 없습니다.');
      return;
    }
    requireNickname(() => {
      setQuickJoining(true);
      getSocket().emit('room:quickjoin', (res: JoinRoomResult) => {
        setQuickJoining(false);
        if (res.success && res.roomId) {
          useLobbyChatStore.getState().clearAll();
          router.push(`/room/${res.roomId}`);
        } else {
          toast.error(res.error ?? '빠른 입장에 실패했습니다.');
        }
      });
    });
  };

  const chips: { key: TabFilter | 'all'; label: string }[] = [
    { key: 'all', label: `전체 ${rooms.length}` },
    { key: 'waiting', label: `대기 ${waitingCount}` },
    { key: 'rank', label: '랭크' },
    { key: 'private', label: '비밀방' },
  ];

  return (
    <div className="-mx-4 mb-3 sm:hidden">
      {/* ── ink 헤더: 재화 스트립 + 랭크 카드 ── */}
      <div className="bg-cdm-ink px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <span className="font-display text-sm font-bold tracking-tight text-white">
            커스텀 데스매치
          </span>
          <div className="flex items-center gap-2">
            <Link
              href="/shop"
              className="flex h-8 items-center gap-1.5 rounded-cdm-md bg-white/10 px-2.5 text-xs font-bold text-cdm-ink-fg tabular-nums"
            >
              CDP {cdp?.toLocaleString() ?? '—'}
            </Link>
            <button
              type="button"
              aria-label="메뉴"
              onClick={() => window.dispatchEvent(new Event('cdm:open-menu'))}
              className="flex h-8 w-8 items-center justify-center rounded-cdm-md text-cdm-ink-fg-muted"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
                <path d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>
            <Link
              href="/notice"
              aria-label="공지사항"
              className="flex h-8 w-8 items-center justify-center rounded-cdm-md text-cdm-ink-fg-muted"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0" />
              </svg>
            </Link>
          </div>
        </div>

        <div
          className="rounded-cdm-lg border border-white/12 p-4"
          style={{
            background:
              'linear-gradient(150deg, rgba(255,255,255,.10), rgba(255,255,255,.04))',
          }}
        >
          <div className="flex items-baseline justify-between gap-2">
            <p className="text-lg font-extrabold tracking-tight text-white">
              {TIER_LABEL[tier]}{' '}
              <span className="text-sm font-bold text-cdm-highlight tabular-nums">{rp} RP</span>
            </p>
            {rank?.season && (
              <span className="text-[11px] font-semibold text-cdm-ink-fg-muted">
                {rank.season.name}
              </span>
            )}
          </div>

          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/13">
            <div
              className="h-full rounded-full"
              style={{
                width: `${progress}%`,
                background: 'linear-gradient(90deg, var(--cdm-primary), #8b90e0)',
              }}
            />
          </div>

          <div className="mt-1.5 flex justify-between text-[11px] text-cdm-ink-fg-muted">
            <span>
              {tier === 'unranked' || inPlacement
                ? `배치전 ${stats?.placement_games ?? 0}/5 — 5판이면 티어가 정해집니다`
                : next
                  ? `${next.label}까지 ${Math.max(0, next.at - rp)} RP`
                  : '최고 티어'}
            </span>
            {(stats?.win_streak ?? 0) >= 2 && (
              <span className="font-semibold text-cdm-success">{stats?.win_streak}연승</span>
            )}
          </div>

          <div className="mt-3.5 flex gap-2">
            <button
              type="button"
              onClick={handleRank}
              disabled={queuing}
              className="flex h-11 flex-[2] items-center justify-center gap-1.5 rounded-cdm-md bg-cdm-primary text-[15px] font-bold text-white disabled:opacity-60"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <path d="M13 2 4 14h6l-1 8 9-12h-6z" />
              </svg>
              {queuing ? '매칭 중…' : '랭크 매칭'}
            </button>
            <Link
              href="/ranking"
              className="flex h-11 flex-1 items-center justify-center rounded-cdm-md border border-white/20 text-sm font-semibold text-cdm-ink-fg"
            >
              티어표
            </Link>
          </div>
        </div>

        {/* ── 1c 행동 줄: 랭크는 카드로 갔으므로 둘만 ── */}
        <div className="mt-2.5 flex gap-2">
          <button
            type="button"
            onClick={handleQuickJoin}
            disabled={quickJoining}
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-cdm-md border border-white/16 bg-white/10 leading-tight text-cdm-ink-fg disabled:opacity-60"
          >
            <span className="text-sm font-bold">빠른 입장</span>
            <span className="text-[9.5px] text-cdm-ink-fg-muted">빈 방 아무데나</span>
          </button>
          <button
            type="button"
            onClick={onCreateRoom}
            className="flex h-12 flex-1 flex-col items-center justify-center rounded-cdm-md border border-white/16 bg-white/10 leading-tight text-cdm-ink-fg"
          >
            <span className="text-sm font-bold">방 만들기</span>
            <span className="text-[9.5px] text-cdm-ink-fg-muted">내가 고른 게임</span>
          </button>
        </div>
      </div>

      {/* ── 필터 칩 줄 ── */}
      <div className="flex gap-1.5 overflow-x-auto px-4 pb-2.5 pt-3">
        {chips.map((c) => {
          const active = c.key === 'all' ? tabFilters.length === 0 : tabFilters.includes(c.key as TabFilter);
          return (
            <button
              key={c.key}
              type="button"
              onClick={() => (c.key === 'all' ? clearFilters() : toggleTabFilter(c.key as TabFilter))}
              className={cn(
                'h-8 flex-none rounded-full px-3.5 text-xs font-semibold transition-colors',
                active
                  ? 'bg-cdm-fg text-cdm-bg'
                  : 'border border-cdm-border bg-cdm-bg-elev-1 text-cdm-fg-muted',
              )}
            >
              {c.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
